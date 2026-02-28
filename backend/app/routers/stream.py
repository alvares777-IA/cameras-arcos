from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Camera, CameraRec
from app.schemas import StreamInfo
from app.config import settings
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/stream", tags=["stream"])


@router.get("/", response_model=List[StreamInfo])
async def listar_streams(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Retorna as URLs HLS de câmeras habilitadas que o usuário tem permissão."""
    # Buscar câmeras permitidas
    perm_result = await db.execute(
        select(CameraRec.id_camera).where(CameraRec.id_usuario == user["id_usuario"])
    )
    allowed_ids = [row[0] for row in perm_result.all()]

    if not allowed_ids:
        return []

    result = await db.execute(
        select(Camera)
        .where(Camera.habilitada == True, Camera.id.in_(allowed_ids))
        .order_by(Camera.id)
    )
    cameras = result.scalars().all()

    streams = []
    for cam in cameras:
        path_name = f"cam{cam.id}"
        hls_url = f"{settings.MEDIAMTX_HLS_URL}/{path_name}/index.m3u8"
        streams.append(StreamInfo(
            camera_id=cam.id,
            camera_nome=cam.nome,
            hls_url=hls_url,
        ))
    return streams


@router.get("/{camera_id}", response_model=StreamInfo)
async def obter_stream(camera_id: int, db: AsyncSession = Depends(get_db)):
    """Retorna a URL HLS de uma câmera específica."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Câmera não encontrada")
    if not cam.habilitada:
        raise HTTPException(status_code=400, detail="Câmera está desabilitada")

    path_name = f"cam{cam.id}"
    hls_url = f"{settings.MEDIAMTX_HLS_URL}/{path_name}/"
    return StreamInfo(
        camera_id=cam.id,
        camera_nome=cam.nome,
        hls_url=hls_url,
    )
