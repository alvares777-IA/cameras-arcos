from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Camera
from app.schemas import CameraCreate, CameraUpdate, CameraResponse
from app.services.mediamtx_client import add_camera_path, remove_camera_path

import asyncio
import json
import logging

logger = logging.getLogger("cameras")

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


@router.get("/", response_model=List[CameraResponse])
async def listar_cameras(db: AsyncSession = Depends(get_db)):
    """Lista todas as câmeras cadastradas."""
    result = await db.execute(select(Camera).order_by(Camera.id))
    cameras = result.scalars().all()
    return cameras


@router.get("/{camera_id}", response_model=CameraResponse)
async def obter_camera(camera_id: int, db: AsyncSession = Depends(get_db)):
    """Obtém uma câmera pelo ID."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()
    if not camera:
        raise HTTPException(status_code=404, detail="Câmera não encontrada")
    return camera


@router.post("/", response_model=CameraResponse, status_code=201)
async def criar_camera(camera: CameraCreate, db: AsyncSession = Depends(get_db)):
    """Cadastra uma nova câmera."""
    nova_camera = Camera(
        nome=camera.nome,
        rtsp_url=camera.rtsp_url,
        habilitada=camera.habilitada,
        continuos=camera.continuos,
        hr_ini=camera.hr_ini,
        hr_fim=camera.hr_fim,
    )
    db.add(nova_camera)
    await db.commit()
    await db.refresh(nova_camera)

    # Registra no MediaMTX
    if nova_camera.habilitada:
        await add_camera_path(nova_camera.id, nova_camera.rtsp_url)

    return nova_camera


@router.put("/{camera_id}", response_model=CameraResponse)
async def atualizar_camera(
    camera_id: int,
    camera: CameraUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Atualiza os dados de uma câmera."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Câmera não encontrada")

    if camera.nome is not None:
        cam.nome = camera.nome
    if camera.rtsp_url is not None:
        cam.rtsp_url = camera.rtsp_url
    if camera.habilitada is not None:
        cam.habilitada = camera.habilitada
    if camera.continuos is not None:
        cam.continuos = camera.continuos
    if camera.hr_ini is not None:
        cam.hr_ini = camera.hr_ini
    if camera.hr_fim is not None:
        cam.hr_fim = camera.hr_fim
    cam.atualizada_em = datetime.utcnow()

    await db.commit()
    await db.refresh(cam)

    # Sincroniza com MediaMTX
    if cam.habilitada:
        await add_camera_path(cam.id, cam.rtsp_url)
    else:
        await remove_camera_path(cam.id)

    return cam


@router.delete("/{camera_id}", status_code=204)
async def deletar_camera(camera_id: int, db: AsyncSession = Depends(get_db)):
    """Remove uma câmera e todas suas gravações."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Câmera não encontrada")

    await db.delete(cam)
    await db.commit()

    # Remove do MediaMTX
    await remove_camera_path(camera_id)


@router.patch("/{camera_id}/continuos", response_model=CameraResponse)
async def toggle_continuos(
    camera_id: int, db: AsyncSession = Depends(get_db)
):
    """Alterna o flag de gravação contínua da câmera."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Câmera não encontrada")

    cam.continuos = not cam.continuos
    cam.atualizada_em = datetime.utcnow()
    await db.commit()
    await db.refresh(cam)
    return cam


@router.post("/{camera_id}/probe", response_model=CameraResponse)
async def probe_camera(
    camera_id: int, db: AsyncSession = Depends(get_db)
):
    """
    Usa ffprobe para consultar os recursos/características do stream RTSP
    da câmera e armazena o resultado no campo 'recursos'.
    """
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Câmera não encontrada")

    rtsp_url = cam.rtsp_url
    logger.info(f"Probing câmera #{camera_id}: {rtsp_url}")

    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-rtsp_transport", "tcp",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            rtsp_url,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)

        if proc.returncode != 0:
            err_msg = stderr.decode(errors="replace").strip()
            logger.warning(f"ffprobe falhou para câmera #{camera_id}: {err_msg}")
            raise HTTPException(
                status_code=502,
                detail=f"Não foi possível conectar ao stream: {err_msg[:200]}"
            )

        probe_data = json.loads(stdout.decode(errors="replace"))

        # Extrair informações relevantes
        recursos = {}
        streams = probe_data.get("streams", [])
        fmt = probe_data.get("format", {})

        for stream in streams:
            codec_type = stream.get("codec_type", "")
            if codec_type == "video":
                recursos["video_codec"] = stream.get("codec_name", "").upper()
                recursos["video_profile"] = stream.get("profile", "")
                recursos["resolucao"] = f"{stream.get('width', '?')}x{stream.get('height', '?')}"
                recursos["largura"] = stream.get("width")
                recursos["altura"] = stream.get("height")
                # FPS
                r_fps = stream.get("r_frame_rate", "0/1")
                try:
                    num, den = r_fps.split("/")
                    fps = round(int(num) / int(den), 2)
                except (ValueError, ZeroDivisionError):
                    fps = 0
                recursos["fps"] = fps
                recursos["pix_fmt"] = stream.get("pix_fmt", "")
                if stream.get("bit_rate"):
                    recursos["video_bitrate_kbps"] = round(int(stream["bit_rate"]) / 1000)
            elif codec_type == "audio":
                recursos["audio_codec"] = stream.get("codec_name", "").upper()
                recursos["audio_sample_rate"] = stream.get("sample_rate", "")
                recursos["audio_channels"] = stream.get("channels")

        if fmt.get("format_name"):
            recursos["formato"] = fmt["format_name"]

        recursos_json = json.dumps(recursos, ensure_ascii=False)
        cam.recursos = recursos_json
        cam.atualizada_em = datetime.utcnow()
        await db.commit()
        await db.refresh(cam)

        logger.info(f"Probe câmera #{camera_id} OK: {recursos_json}")
        return cam

    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Timeout ao conectar ao stream (15s). Verifique a URL RTSP."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao fazer probe da câmera #{camera_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
