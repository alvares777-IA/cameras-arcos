"""
Router para gerenciamento de Grupos de Câmeras.
"""

import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Grupo, GrupoCamera, Camera
from app.schemas import GrupoCreate, GrupoUpdate, GrupoResponse

logger = logging.getLogger("grupos")

router = APIRouter(prefix="/api/grupos", tags=["grupos"])


def _build_grupo_response(grupo: Grupo) -> dict:
    """Monta o dict de resposta de um grupo com suas câmeras."""
    cameras_list = [
        {"id": cam.id, "nome": cam.nome}
        for cam in grupo.cameras
    ]
    return {
        "id_grupo": grupo.id_grupo,
        "no_grupo": grupo.no_grupo,
        "criado_em": grupo.criado_em,
        "atualizado_em": grupo.atualizado_em,
        "cameras": cameras_list,
        "total_cameras": len(cameras_list),
    }


@router.get("/", response_model=List[GrupoResponse])
async def listar_grupos(db: AsyncSession = Depends(get_db)):
    """Lista todos os grupos com suas câmeras."""
    result = await db.execute(
        select(Grupo)
        .options(selectinload(Grupo.cameras))
        .order_by(Grupo.id_grupo)
    )
    grupos = result.scalars().all()
    return [_build_grupo_response(g) for g in grupos]


@router.get("/{id_grupo}", response_model=GrupoResponse)
async def obter_grupo(id_grupo: int, db: AsyncSession = Depends(get_db)):
    """Obtém um grupo pelo ID."""
    result = await db.execute(
        select(Grupo)
        .options(selectinload(Grupo.cameras))
        .where(Grupo.id_grupo == id_grupo)
    )
    grupo = result.scalar_one_or_none()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    return _build_grupo_response(grupo)


@router.post("/", response_model=GrupoResponse, status_code=201)
async def criar_grupo(grupo: GrupoCreate, db: AsyncSession = Depends(get_db)):
    """Cadastra um novo grupo de câmeras."""
    novo_grupo = Grupo(no_grupo=grupo.no_grupo)
    db.add(novo_grupo)
    await db.flush()

    # Associar câmeras
    for cam_id in grupo.camera_ids:
        # Verificar se câmera existe
        cam_result = await db.execute(select(Camera).where(Camera.id == cam_id))
        if cam_result.scalar_one_or_none():
            db.add(GrupoCamera(id_grupo=novo_grupo.id_grupo, id_camera=cam_id))

    await db.commit()

    # Recarregar com câmeras
    result = await db.execute(
        select(Grupo)
        .options(selectinload(Grupo.cameras))
        .where(Grupo.id_grupo == novo_grupo.id_grupo)
    )
    grupo_db = result.scalar_one()
    logger.info(f"Grupo criado: {grupo_db.no_grupo} (ID: {grupo_db.id_grupo})")
    return _build_grupo_response(grupo_db)


@router.put("/{id_grupo}", response_model=GrupoResponse)
async def atualizar_grupo(
    id_grupo: int,
    grupo: GrupoUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Atualiza um grupo e/ou suas câmeras associadas."""
    result = await db.execute(
        select(Grupo)
        .options(selectinload(Grupo.cameras))
        .where(Grupo.id_grupo == id_grupo)
    )
    g = result.scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    if grupo.no_grupo is not None:
        g.no_grupo = grupo.no_grupo

    # Atualizar câmeras associadas (se fornecido)
    if grupo.camera_ids is not None:
        # Remove associações atuais
        await db.execute(
            delete(GrupoCamera).where(GrupoCamera.id_grupo == id_grupo)
        )
        # Adiciona novas associações
        for cam_id in grupo.camera_ids:
            cam_result = await db.execute(select(Camera).where(Camera.id == cam_id))
            if cam_result.scalar_one_or_none():
                db.add(GrupoCamera(id_grupo=id_grupo, id_camera=cam_id))

    g.atualizado_em = datetime.utcnow()
    await db.commit()

    # Recarregar com câmeras
    result = await db.execute(
        select(Grupo)
        .options(selectinload(Grupo.cameras))
        .where(Grupo.id_grupo == id_grupo)
    )
    grupo_db = result.scalar_one()
    logger.info(f"Grupo atualizado: {grupo_db.no_grupo} (ID: {grupo_db.id_grupo})")
    return _build_grupo_response(grupo_db)


@router.delete("/{id_grupo}", status_code=204)
async def deletar_grupo(id_grupo: int, db: AsyncSession = Depends(get_db)):
    """Remove um grupo (as associações são removidas em cascata)."""
    result = await db.execute(select(Grupo).where(Grupo.id_grupo == id_grupo))
    g = result.scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    await db.delete(g)
    await db.commit()
    logger.info(f"Grupo removido: ID {id_grupo}")


# ---- Gerenciar câmeras individualmente ----

@router.post("/{id_grupo}/cameras/{id_camera}", status_code=201)
async def adicionar_camera_ao_grupo(
    id_grupo: int,
    id_camera: int,
    db: AsyncSession = Depends(get_db),
):
    """Adiciona uma câmera a um grupo."""
    # Verificar grupo
    result = await db.execute(select(Grupo).where(Grupo.id_grupo == id_grupo))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    # Verificar câmera
    result = await db.execute(select(Camera).where(Camera.id == id_camera))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Câmera não encontrada")

    # Verificar duplicata
    result = await db.execute(
        select(GrupoCamera).where(
            GrupoCamera.id_grupo == id_grupo,
            GrupoCamera.id_camera == id_camera,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Câmera já pertence a este grupo")

    db.add(GrupoCamera(id_grupo=id_grupo, id_camera=id_camera))
    await db.commit()
    return {"message": "Câmera adicionada ao grupo"}


@router.delete("/{id_grupo}/cameras/{id_camera}", status_code=204)
async def remover_camera_do_grupo(
    id_grupo: int,
    id_camera: int,
    db: AsyncSession = Depends(get_db),
):
    """Remove uma câmera de um grupo."""
    result = await db.execute(
        select(GrupoCamera).where(
            GrupoCamera.id_grupo == id_grupo,
            GrupoCamera.id_camera == id_camera,
        )
    )
    gc = result.scalar_one_or_none()
    if not gc:
        raise HTTPException(status_code=404, detail="Associação não encontrada")

    await db.delete(gc)
    await db.commit()
