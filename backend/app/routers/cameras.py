from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Camera
from app.schemas import CameraCreate, CameraUpdate, CameraResponse
from app.services.mediamtx_client import add_camera_path, remove_camera_path

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
