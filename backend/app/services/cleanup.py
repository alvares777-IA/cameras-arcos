"""
Serviço de limpeza automática de gravações antigas.

Remove arquivos de vídeo e registros do banco de dados
que excedem o tempo de retenção configurado (padrão: 30 dias).
"""

import os
import logging
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Gravacao

logger = logging.getLogger("cleanup")

# Sync engine para uso no scheduler
_sync_db_url = settings.DATABASE_URL.replace("+asyncpg", "").replace(
    "postgresql://", "postgresql+psycopg2://"
)
if "asyncpg" in _sync_db_url:
    _sync_db_url = _sync_db_url.replace("asyncpg", "psycopg2")

sync_engine = create_engine(_sync_db_url, pool_size=2)
SyncSession = sessionmaker(bind=sync_engine)


def cleanup_old_recordings():
    """Remove gravações mais antigas que RETENTION_DAYS."""
    cutoff_date = datetime.utcnow() - timedelta(days=settings.RETENTION_DAYS)
    logger.info(
        f"Iniciando limpeza de gravações anteriores a "
        f"{cutoff_date.strftime('%Y-%m-%d %H:%M:%S')} "
        f"({settings.RETENTION_DAYS} dias de retenção)"
    )

    session = SyncSession()
    try:
        gravacoes = (
            session.query(Gravacao)
            .filter(Gravacao.data_fim < cutoff_date)
            .all()
        )

        deleted_files = 0
        deleted_bytes = 0
        errors = 0

        for grav in gravacoes:
            if os.path.exists(grav.caminho_arquivo):
                try:
                    file_size = os.path.getsize(grav.caminho_arquivo)
                    os.remove(grav.caminho_arquivo)
                    deleted_files += 1
                    deleted_bytes += file_size
                except OSError as e:
                    logger.error(f"Erro ao remover {grav.caminho_arquivo}: {e}")
                    errors += 1

            session.delete(grav)

        session.commit()

        _cleanup_empty_dirs(settings.RECORDINGS_PATH)

        logger.info(
            f"Limpeza concluída: {deleted_files} arquivos removidos "
            f"({deleted_bytes / 1024 / 1024 / 1024:.2f} GB liberados), "
            f"{errors} erros"
        )

    except Exception as e:
        logger.error(f"Erro durante a limpeza: {e}")
        session.rollback()
    finally:
        session.close()


def _cleanup_empty_dirs(root_path: str):
    """Remove diretórios vazios recursivamente."""
    if not os.path.exists(root_path):
        return

    for dirpath, dirnames, filenames in os.walk(root_path, topdown=False):
        if dirpath == root_path:
            continue
        try:
            if not os.listdir(dirpath):
                os.rmdir(dirpath)
                logger.debug(f"Diretório vazio removido: {dirpath}")
        except OSError:
            pass
