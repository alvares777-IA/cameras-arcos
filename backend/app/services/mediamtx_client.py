"""
Cliente da API do MediaMTX.

Registra/remove paths de câmeras automaticamente para que o
MediaMTX converta RTSP → HLS sob demanda.
"""

import logging
import httpx
from app.config import settings

logger = logging.getLogger("mediamtx_client")

MEDIAMTX_API = settings.MEDIAMTX_URL  # http://mediamtx:9997


async def add_camera_path(camera_id: int, rtsp_url: str):
    """Registra um path de câmera no MediaMTX."""
    path_name = f"cam{camera_id}"
    payload = {
        "source": rtsp_url,
        "sourceOnDemand": False, # Mantém conectado sempre para stream instantâneo
        "rtspTransport": "tcp",  # Força TCP para evitar perda de pacotes RTP
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Tenta adicionar
            resp = await client.post(
                f"{MEDIAMTX_API}/v3/config/paths/add/{path_name}",
                json=payload,
            )
            if resp.status_code in (400, 409):
                # Path já existe — atualiza
                resp = await client.patch(
                    f"{MEDIAMTX_API}/v3/config/paths/patch/{path_name}",
                    json=payload,
                )
            logger.info(f"MediaMTX path '{path_name}' → {resp.status_code}")
    except Exception as e:
        logger.error(f"Falha ao configurar path '{path_name}': {e}")


async def remove_camera_path(camera_id: int):
    """Remove um path de câmera do MediaMTX."""
    path_name = f"cam{camera_id}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                f"{MEDIAMTX_API}/v3/config/paths/delete/{path_name}",
            )
            logger.info(f"MediaMTX path '{path_name}' removido → {resp.status_code}")
    except Exception as e:
        logger.error(f"Falha ao remover path '{path_name}': {e}")


async def sync_all_cameras(cameras):
    """Sincroniza todas as câmeras habilitadas com o MediaMTX na inicialização."""
    count = 0
    for cam in cameras:
        if cam.habilitada:
            await add_camera_path(cam.id, cam.rtsp_url)
            count += 1
    logger.info(f"Sincronizadas {count} câmeras com o MediaMTX")
