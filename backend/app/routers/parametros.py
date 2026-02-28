from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Parametro
from app.schemas import ParametroCreate, ParametroUpdate, ParametroResponse

router = APIRouter(prefix="/api/parametros", tags=["parametros"])


@router.get("/", response_model=List[ParametroResponse])
async def listar_parametros(db: AsyncSession = Depends(get_db)):
    """Lista todos os parâmetros cadastrados."""
    result = await db.execute(select(Parametro).order_by(Parametro.chave))
    return result.scalars().all()


@router.get("/{parametro_id}", response_model=ParametroResponse)
async def obter_parametro(parametro_id: int, db: AsyncSession = Depends(get_db)):
    """Obtém um parâmetro pelo ID."""
    result = await db.execute(select(Parametro).where(Parametro.id == parametro_id))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parâmetro não encontrado")
    return param


@router.post("/", response_model=ParametroResponse, status_code=201)
async def criar_parametro(parametro: ParametroCreate, db: AsyncSession = Depends(get_db)):
    """Cadastra um novo parâmetro."""
    # Verifica se a chave já existe
    existing = await db.execute(
        select(Parametro).where(Parametro.chave == parametro.chave)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Chave '{parametro.chave}' já existe")

    novo = Parametro(
        chave=parametro.chave,
        valor=parametro.valor,
        nome=parametro.nome,
        observacoes=parametro.observacoes,
    )
    db.add(novo)
    await db.commit()
    await db.refresh(novo)
    return novo


@router.put("/{parametro_id}", response_model=ParametroResponse)
async def atualizar_parametro(
    parametro_id: int,
    parametro: ParametroUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Atualiza um parâmetro existente."""
    result = await db.execute(select(Parametro).where(Parametro.id == parametro_id))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parâmetro não encontrado")

    if parametro.chave is not None:
        # Verifica duplicidade de chave
        if parametro.chave != param.chave:
            dup = await db.execute(
                select(Parametro).where(Parametro.chave == parametro.chave)
            )
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=409, detail=f"Chave '{parametro.chave}' já existe")
        param.chave = parametro.chave
    if parametro.valor is not None:
        param.valor = parametro.valor
    if parametro.nome is not None:
        param.nome = parametro.nome
    if parametro.observacoes is not None:
        param.observacoes = parametro.observacoes
    param.atualizado_em = datetime.utcnow()

    await db.commit()
    await db.refresh(param)
    return param


@router.delete("/{parametro_id}", status_code=204)
async def deletar_parametro(parametro_id: int, db: AsyncSession = Depends(get_db)):
    """Remove um parâmetro."""
    result = await db.execute(select(Parametro).where(Parametro.id == parametro_id))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parâmetro não encontrado")

    await db.delete(param)
    await db.commit()
