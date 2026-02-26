import os
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Gravacao
from app.schemas import GravacaoResponse
from app.config import settings

router = APIRouter(prefix="/api/gravacoes", tags=["gravações"])
logger = logging.getLogger("gravacoes")


@router.get("/", response_model=List[GravacaoResponse])
async def listar_gravacoes(
    camera_id: Optional[int] = Query(None, description="Filtrar por ID da câmera"),
    data_inicio: Optional[datetime] = Query(None, description="Data/hora inicial"),
    data_fim: Optional[datetime] = Query(None, description="Data/hora final"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Lista gravações com filtros opcionais por câmera e intervalo de datas."""
    from sqlalchemy.orm import selectinload
    from app.models import Reconhecimento, Pessoa

    query = select(Gravacao).options(
        selectinload(Gravacao.reconhecimentos).selectinload(Reconhecimento.pessoa)
    )
    conditions = []

    if camera_id is not None:
        conditions.append(Gravacao.id_camera == camera_id)
    if data_inicio is not None:
        conditions.append(Gravacao.data_fim >= data_inicio)
    if data_fim is not None:
        conditions.append(Gravacao.data_inicio <= data_fim)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(Gravacao.data_inicio.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    
    gravacoes = result.scalars().all()
    
    # Adicionar o campo no_pessoa manualmente se necessário pelo schema
    for g in gravacoes:
        for r in g.reconhecimentos:
            if r.pessoa:
                r.no_pessoa = r.pessoa.no_pessoa
                
    return gravacoes


@router.get("/{gravacao_id}", response_model=GravacaoResponse)
async def obter_gravacao(gravacao_id: int, db: AsyncSession = Depends(get_db)):
    """Obtém detalhes de uma gravação específica."""
    result = await db.execute(select(Gravacao).where(Gravacao.id == gravacao_id))
    gravacao = result.scalar_one_or_none()
    if not gravacao:
        raise HTTPException(status_code=404, detail="Gravação não encontrada")
    return gravacao


@router.get("/{gravacao_id}/stream")
async def stream_gravacao(gravacao_id: int, db: AsyncSession = Depends(get_db)):
    """Serve o arquivo de vídeo da gravação com suporte a range requests."""
    result = await db.execute(select(Gravacao).where(Gravacao.id == gravacao_id))
    gravacao = result.scalar_one_or_none()
    if not gravacao:
        raise HTTPException(status_code=404, detail="Gravação não encontrada")

    file_path = gravacao.caminho_arquivo
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo de vídeo não encontrado no disco")

    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=os.path.basename(file_path),
    )


@router.post("/{gravacao_id}/analyze")
async def analisar_gravacao(gravacao_id: int, db: AsyncSession = Depends(get_db)):
    """Aciona reconhecimento facial sob demanda para uma gravação específica."""
    result = await db.execute(select(Gravacao).where(Gravacao.id == gravacao_id))
    gravacao = result.scalar_one_or_none()
    if not gravacao:
        raise HTTPException(status_code=404, detail="Gravação não encontrada")

    file_path = gravacao.caminho_arquivo
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo de vídeo não encontrado no disco")

    try:
        from app.services.face_recognition_service import process_video_async
        process_video_async(file_path, gravacao.id_camera, gravacao_id=gravacao.id)
        logger.info(f"Reconhecimento facial sob demanda iniciado para gravação {gravacao_id}")
        return {
            "message": "Reconhecimento facial iniciado em background",
            "gravacao_id": gravacao_id,
        }
    except Exception as e:
        logger.error(f"Erro ao iniciar reconhecimento facial: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar análise: {e}")


@router.delete("/{gravacao_id}")
async def deletar_gravacao(gravacao_id: int, db: AsyncSession = Depends(get_db)):
    """Remove uma gravação específica do banco e do disco."""
    result = await db.execute(select(Gravacao).where(Gravacao.id == gravacao_id))
    gravacao = result.scalar_one_or_none()
    if not gravacao:
        raise HTTPException(status_code=404, detail="Gravação não encontrada")

    bytes_freed = 0
    dir_to_check = None

    if gravacao.caminho_arquivo and os.path.exists(gravacao.caminho_arquivo):
        bytes_freed = os.path.getsize(gravacao.caminho_arquivo)
        dir_to_check = os.path.dirname(gravacao.caminho_arquivo)
        os.remove(gravacao.caminho_arquivo)

    await db.delete(gravacao)
    await db.commit()

    if dir_to_check:
        _cleanup_empty_dirs({dir_to_check})

    return {
        "message": "Gravação excluída",
        "bytes_liberados": bytes_freed,
    }


@router.delete("/", status_code=200)
async def deletar_gravacoes(
    camera_id: Optional[int] = Query(None, description="Filtrar por ID da câmera"),
    data_inicio: Optional[datetime] = Query(None, description="Data/hora inicial"),
    data_fim: Optional[datetime] = Query(None, description="Data/hora final"),
    db: AsyncSession = Depends(get_db),
):
    """Remove gravações de um período, apaga os arquivos e limpa pastas vazias."""
    query = select(Gravacao)
    conditions = []

    if camera_id is not None:
        conditions.append(Gravacao.id_camera == camera_id)
    if data_inicio is not None:
        conditions.append(Gravacao.data_fim >= data_inicio)
    if data_fim is not None:
        conditions.append(Gravacao.data_inicio <= data_fim)

    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    gravacoes = result.scalars().all()

    if not gravacoes:
        return {"message": "Nenhuma gravação encontrada no período", "deletadas": 0}

    dirs_to_check = set()
    files_deleted = 0
    bytes_freed = 0

    for g in gravacoes:
        if g.caminho_arquivo and os.path.exists(g.caminho_arquivo):
            bytes_freed += os.path.getsize(g.caminho_arquivo)
            os.remove(g.caminho_arquivo)
            files_deleted += 1
            dirs_to_check.add(os.path.dirname(g.caminho_arquivo))
        await db.delete(g)

    await db.commit()

    cleaned_dirs = _cleanup_empty_dirs(dirs_to_check)

    return {
        "message": f"{files_deleted} gravações removidas",
        "deletadas": files_deleted,
        "bytes_liberados": bytes_freed,
        "pastas_removidas": cleaned_dirs,
    }


def _cleanup_empty_dirs(dirs: set) -> int:
    """Remove recursivamente diretórios vazios."""
    removed = 0
    recordings_root = settings.RECORDINGS_PATH

    sorted_dirs = sorted(dirs, key=lambda d: d.count(os.sep), reverse=True)

    for d in sorted_dirs:
        current = d
        while current and current != recordings_root and current.startswith(recordings_root):
            try:
                if os.path.isdir(current) and not os.listdir(current):
                    os.rmdir(current)
                    removed += 1
                    current = os.path.dirname(current)
                else:
                    break
            except OSError:
                break

    return removed
