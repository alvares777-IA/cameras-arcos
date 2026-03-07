import os
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Gravacao, GravacaoLixeira
from app.schemas import GravacaoResponse, GravacaoLixeiraResponse
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


@router.delete("/", status_code=200)
async def deletar_gravacoes(
    camera_id: Optional[int] = Query(None, description="Filtrar por ID da câmera"),
    data_inicio: Optional[datetime] = Query(None, description="Data/hora inicial"),
    data_fim: Optional[datetime] = Query(None, description="Data/hora final"),
    db: AsyncSession = Depends(get_db),
):
    """Move gravações de um período para a lixeira (soft delete em lote)."""
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
        return {"message": "Nenhuma gravação encontrada no período", "movidas": 0}

    now = datetime.now()
    count = 0

    for g in gravacoes:
        lixeira = GravacaoLixeira(
            id=g.id,
            id_camera=g.id_camera,
            caminho_arquivo=g.caminho_arquivo,
            data_inicio=g.data_inicio,
            data_fim=g.data_fim,
            tamanho_bytes=g.tamanho_bytes,
            face_analyzed=g.face_analyzed,
            criada_em=g.criada_em,
            dt_exclusao=now,
        )
        db.add(lixeira)
        await db.delete(g)
        count += 1

    await db.commit()

    return {
        "message": f"{count} gravações movidas para a lixeira",
        "movidas": count,
    }


# ================================================================
# LIXEIRA ENDPOINTS (must be before /{gravacao_id} routes)
# ================================================================

@router.get("/lixeira/", response_model=List[GravacaoLixeiraResponse])
async def listar_lixeira(db: AsyncSession = Depends(get_db)):
    """Lista todas as gravações na lixeira."""
    query = select(GravacaoLixeira).order_by(GravacaoLixeira.dt_exclusao.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/lixeira/{gravacao_id}/restaurar")
async def restaurar_gravacao(gravacao_id: int, db: AsyncSession = Depends(get_db)):
    """Restaura uma gravação da lixeira para a tabela principal."""
    result = await db.execute(
        select(GravacaoLixeira).where(GravacaoLixeira.id == gravacao_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Gravação não encontrada na lixeira")

    # Recriar na tabela principal
    gravacao = Gravacao(
        id=item.id,
        id_camera=item.id_camera,
        caminho_arquivo=item.caminho_arquivo,
        data_inicio=item.data_inicio,
        data_fim=item.data_fim,
        tamanho_bytes=item.tamanho_bytes,
        face_analyzed=item.face_analyzed,
        criada_em=item.criada_em,
    )
    db.add(gravacao)

    # Remover da lixeira
    await db.delete(item)
    await db.commit()

    return {
        "message": "Gravação restaurada com sucesso",
        "gravacao_id": gravacao_id,
    }


@router.delete("/lixeira/{gravacao_id}")
async def excluir_permanente(gravacao_id: int, db: AsyncSession = Depends(get_db)):
    """Exclui permanentemente uma gravação da lixeira e remove o arquivo do disco."""
    result = await db.execute(
        select(GravacaoLixeira).where(GravacaoLixeira.id == gravacao_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Gravação não encontrada na lixeira")

    bytes_freed = 0
    dir_to_check = None

    if item.caminho_arquivo and os.path.exists(item.caminho_arquivo):
        bytes_freed = os.path.getsize(item.caminho_arquivo)
        dir_to_check = os.path.dirname(item.caminho_arquivo)
        os.remove(item.caminho_arquivo)

    await db.delete(item)
    await db.commit()

    if dir_to_check:
        _cleanup_empty_dirs({dir_to_check})

    return {
        "message": "Gravação excluída permanentemente",
        "bytes_liberados": bytes_freed,
    }


# ================================================================
# GRAVACAO BY ID ENDPOINTS
# ================================================================

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


@router.get("/{gravacao_id}/download")
async def download_gravacao(gravacao_id: int, db: AsyncSession = Depends(get_db)):
    """Força o download do arquivo de vídeo da gravação."""
    result = await db.execute(select(Gravacao).where(Gravacao.id == gravacao_id))
    gravacao = result.scalar_one_or_none()
    if not gravacao:
        raise HTTPException(status_code=404, detail="Gravação não encontrada")

    file_path = gravacao.caminho_arquivo
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo de vídeo não encontrado no disco")

    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=os.path.basename(file_path),
        headers={"Content-Disposition": f'attachment; filename="{os.path.basename(file_path)}"'},
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
    """Move uma gravação para a lixeira (soft delete)."""
    result = await db.execute(select(Gravacao).where(Gravacao.id == gravacao_id))
    gravacao = result.scalar_one_or_none()
    if not gravacao:
        raise HTTPException(status_code=404, detail="Gravação não encontrada")

    # Inserir na lixeira
    lixeira = GravacaoLixeira(
        id=gravacao.id,
        id_camera=gravacao.id_camera,
        caminho_arquivo=gravacao.caminho_arquivo,
        data_inicio=gravacao.data_inicio,
        data_fim=gravacao.data_fim,
        tamanho_bytes=gravacao.tamanho_bytes,
        face_analyzed=gravacao.face_analyzed,
        criada_em=gravacao.criada_em,
        dt_exclusao=datetime.now(),
    )
    db.add(lixeira)

    # Remover da tabela original
    await db.delete(gravacao)
    await db.commit()

    return {
        "message": "Gravação enviada para a lixeira",
        "gravacao_id": gravacao_id,
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
