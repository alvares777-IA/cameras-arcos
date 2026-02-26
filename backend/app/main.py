"""
Sistema de Monitoramento de Câmeras IP
Aplicação principal FastAPI
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.routers import cameras, gravacoes, stream, pessoas, grupos
from app.services.recorder import recording_manager
from app.services.cleanup import cleanup_old_recordings
from app.services.mediamtx_client import sync_all_cameras
from app.services.recorder import SyncSession
from app.models import Camera

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")

# Scheduler para limpeza automática
scheduler = BackgroundScheduler()

# Flag de reconhecimento facial (controlável em runtime)
_face_recognition_active = settings.FACE_RECOGNITION_ENABLED


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação."""
    logger.info("=" * 60)
    logger.info("  Sistema de Monitoramento de Câmeras IP")
    logger.info(f"  Gravação automática: {'LIGADA' if settings.RECORDING_ENABLED else 'DESLIGADA'}")
    logger.info(f"  Reconhecimento facial: {'LIGADO' if settings.FACE_RECOGNITION_ENABLED else 'DESLIGADO'}")
    logger.info(f"  Retenção: {settings.RETENTION_DAYS} dias")
    logger.info(f"  Segmento: {settings.SEGMENT_DURATION_SECONDS}s")
    logger.info("=" * 60)

    # Sincroniza câmeras com o MediaMTX
    try:
        session = SyncSession()
        all_cameras = session.query(Camera).all()
        session.close()
        await sync_all_cameras(all_cameras)
        logger.info("Câmeras sincronizadas com MediaMTX")
    except Exception as e:
        logger.error(f"Erro ao sincronizar com MediaMTX: {e}")

    # Auto-migration: adiciona coluna face_analyzed se não existir
    try:
        from sqlalchemy import text as sa_text
        session = SyncSession()
        session.execute(
            sa_text(
                "ALTER TABLE gravacoes ADD COLUMN IF NOT EXISTS face_analyzed BOOLEAN DEFAULT FALSE"
            )
        )
        session.execute(
            sa_text(
                "ALTER TABLE reconhecimentos ADD COLUMN IF NOT EXISTS id_gravacao INTEGER REFERENCES gravacoes(id) ON DELETE CASCADE"
            )
        )
        session.commit()
        session.close()
        logger.info("Migration face_analyzed verificada")
    except Exception as e:
        logger.warning(f"Migration face_analyzed: {e}")

    # Inicia o serviço de gravação (somente se habilitado)
    if settings.RECORDING_ENABLED:
        try:
            recording_manager.start_all()
            logger.info("Serviço de gravação iniciado")
        except Exception as e:
            logger.error(f"Erro ao iniciar gravação: {e}")
    else:
        logger.info("Gravação DESLIGADA (RECORDING_ENABLED=false). Use /api/recording/start para ativar.")

    # Agenda limpeza automática (diária às 3h da manhã)
    scheduler.add_job(
        cleanup_old_recordings,
        "cron",
        hour=3,
        minute=0,
        id="cleanup_recordings",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Limpeza automática agendada para 03:00 diariamente")

    yield

    # Encerra serviços
    logger.info("Encerrando serviços...")
    recording_manager.stop_all()
    scheduler.shutdown(wait=False)
    logger.info("Sistema encerrado")


# Aplicação FastAPI
app = FastAPI(
    title="Câmeras Arcos - Sistema de Monitoramento",
    description="API para monitoramento e gravação de câmeras IP via RTSP",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS para o frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas da API
app.include_router(cameras.router)
app.include_router(gravacoes.router)
app.include_router(stream.router)
app.include_router(pessoas.router)
app.include_router(grupos.router)


# Rota de saúde
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "recording_enabled": settings.RECORDING_ENABLED,
        "recording_active": recording_manager.is_active(),
        "recording_status": recording_manager.get_status(),
        "retention_days": settings.RETENTION_DAYS,
        "face_recognition_enabled": settings.FACE_RECOGNITION_ENABLED,
        "face_recognition_active": _face_recognition_active,
    }


# ---- Controle de gravação ----
@app.post("/api/recording/start")
async def start_recording():
    """Inicia a gravação de todas as câmeras habilitadas."""
    if recording_manager.is_active():
        return {"message": "Gravação já está ativa", "status": recording_manager.get_status()}
    try:
        recording_manager.start_all()
        return {"message": "Gravação iniciada", "status": recording_manager.get_status()}
    except Exception as e:
        return {"message": f"Erro ao iniciar: {e}", "status": {}}


@app.post("/api/recording/stop")
async def stop_recording():
    """Para a gravação de todas as câmeras (não-bloqueante)."""
    import asyncio
    await asyncio.to_thread(recording_manager.stop_all)
    return {"message": "Gravação parada"}


@app.get("/api/recording/status")
async def recording_status():
    """Retorna o status da gravação."""
    return {
        "active": recording_manager.is_active(),
        "cameras": recording_manager.get_status(),
    }


# ---- Controle de reconhecimento facial ----
@app.post("/api/face-recognition/start")
async def start_face_recognition():
    """Ativa o reconhecimento facial automático."""
    global _face_recognition_active
    _face_recognition_active = True
    logger.info("Reconhecimento facial ATIVADO via API")
    return {"message": "Reconhecimento facial ativado", "active": True}


@app.post("/api/face-recognition/stop")
async def stop_face_recognition():
    """Desativa o reconhecimento facial automático."""
    global _face_recognition_active
    _face_recognition_active = False
    logger.info("Reconhecimento facial DESATIVADO via API")
    return {"message": "Reconhecimento facial desativado", "active": False}


@app.get("/api/face-recognition/status")
async def face_recognition_status():
    """Retorna o status do reconhecimento facial."""
    return {"active": _face_recognition_active}


def is_face_recognition_active() -> bool:
    """Verifica se o reconhecimento facial está ativo (usado pelo recorder)."""
    return _face_recognition_active


# Servir arquivos de gravação
if os.path.exists(settings.RECORDINGS_PATH):
    app.mount(
        "/recordings",
        StaticFiles(directory=settings.RECORDINGS_PATH),
        name="recordings",
    )
