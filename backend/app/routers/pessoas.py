"""
Router para gerenciamento de Pessoas (cadastro + reconhecimento facial).
"""

import os
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Pessoa, Reconhecimento, Camera
from app.schemas import PessoaCreate, PessoaUpdate, PessoaResponse, ReconhecimentoResponse
from app.config import settings

logger = logging.getLogger("pessoas")

router = APIRouter(prefix="/api/pessoas", tags=["pessoas"])

FACES_DIR = os.path.join(settings.RECORDINGS_PATH, "faces")


def _get_face_dir(id_pessoa: int) -> str:
    """Retorna o diretório de faces de uma pessoa."""
    dir_path = os.path.join(FACES_DIR, str(id_pessoa))
    os.makedirs(dir_path, exist_ok=True)
    return dir_path


def _count_faces(id_pessoa: int) -> int:
    """Conta quantas fotos de face uma pessoa tem."""
    dir_path = os.path.join(FACES_DIR, str(id_pessoa))
    if not os.path.exists(dir_path):
        return 0
    return len([f for f in os.listdir(dir_path) if f.endswith(('.jpg', '.jpeg', '.png'))])


@router.get("/", response_model=List[PessoaResponse])
async def listar_pessoas(db: AsyncSession = Depends(get_db)):
    """Lista todas as pessoas cadastradas."""
    result = await db.execute(select(Pessoa).order_by(Pessoa.id_pessoa))
    pessoas = result.scalars().all()

    response = []
    for p in pessoas:
        pessoa_dict = {
            "id_pessoa": p.id_pessoa,
            "no_pessoa": p.no_pessoa,
            "ao_tipo": p.ao_tipo,
            "criada_em": p.criada_em,
            "atualizada_em": p.atualizada_em,
            "total_fotos": _count_faces(p.id_pessoa),
        }
        response.append(pessoa_dict)
    return response


@router.get("/{id_pessoa}", response_model=PessoaResponse)
async def obter_pessoa(id_pessoa: int, db: AsyncSession = Depends(get_db)):
    """Obtém uma pessoa pelo ID."""
    result = await db.execute(select(Pessoa).where(Pessoa.id_pessoa == id_pessoa))
    pessoa = result.scalar_one_or_none()
    if not pessoa:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")

    return {
        "id_pessoa": pessoa.id_pessoa,
        "no_pessoa": pessoa.no_pessoa,
        "ao_tipo": pessoa.ao_tipo,
        "criada_em": pessoa.criada_em,
        "atualizada_em": pessoa.atualizada_em,
        "total_fotos": _count_faces(pessoa.id_pessoa),
    }


@router.post("/", response_model=PessoaResponse, status_code=201)
async def criar_pessoa(pessoa: PessoaCreate, db: AsyncSession = Depends(get_db)):
    """Cadastra uma nova pessoa."""
    if pessoa.ao_tipo not in ('S', 'C', 'A', 'V'):
        raise HTTPException(status_code=400, detail="Tipo inválido. Use S, C, A ou V.")

    nova_pessoa = Pessoa(
        no_pessoa=pessoa.no_pessoa,
        ao_tipo=pessoa.ao_tipo,
    )
    db.add(nova_pessoa)
    await db.commit()
    await db.refresh(nova_pessoa)
    logger.info(f"Pessoa cadastrada: {nova_pessoa.no_pessoa} (ID: {nova_pessoa.id_pessoa})")

    return {
        "id_pessoa": nova_pessoa.id_pessoa,
        "no_pessoa": nova_pessoa.no_pessoa,
        "ao_tipo": nova_pessoa.ao_tipo,
        "criada_em": nova_pessoa.criada_em,
        "atualizada_em": nova_pessoa.atualizada_em,
        "total_fotos": 0,
    }


@router.put("/{id_pessoa}", response_model=PessoaResponse)
async def atualizar_pessoa(
    id_pessoa: int,
    pessoa: PessoaUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Atualiza os dados de uma pessoa."""
    result = await db.execute(select(Pessoa).where(Pessoa.id_pessoa == id_pessoa))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")

    if pessoa.no_pessoa is not None:
        p.no_pessoa = pessoa.no_pessoa
    if pessoa.ao_tipo is not None:
        if pessoa.ao_tipo not in ('S', 'C', 'A', 'V'):
            raise HTTPException(status_code=400, detail="Tipo inválido. Use S, C, A ou V.")
        p.ao_tipo = pessoa.ao_tipo
    p.atualizada_em = datetime.utcnow()

    await db.commit()
    await db.refresh(p)

    return {
        "id_pessoa": p.id_pessoa,
        "no_pessoa": p.no_pessoa,
        "ao_tipo": p.ao_tipo,
        "criada_em": p.criada_em,
        "atualizada_em": p.atualizada_em,
        "total_fotos": _count_faces(p.id_pessoa),
    }


@router.delete("/{id_pessoa}", status_code=204)
async def deletar_pessoa(id_pessoa: int, db: AsyncSession = Depends(get_db)):
    """Remove uma pessoa e todas suas faces/reconhecimentos."""
    result = await db.execute(select(Pessoa).where(Pessoa.id_pessoa == id_pessoa))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")

    # Remove diretório de fotos
    face_dir = os.path.join(FACES_DIR, str(id_pessoa))
    if os.path.exists(face_dir):
        import shutil
        shutil.rmtree(face_dir)

    await db.delete(p)
    await db.commit()
    logger.info(f"Pessoa removida: ID {id_pessoa}")

    # Invalida cache de reconhecimento facial
    try:
        from app.services.face_recognition_service import invalidate_cache
        invalidate_cache()
    except Exception:
        pass


# ---- Upload de fotos de face ----

@router.post("/{id_pessoa}/faces", status_code=201)
async def upload_face(
    id_pessoa: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Faz upload de uma foto de face para uma pessoa."""
    result = await db.execute(select(Pessoa).where(Pessoa.id_pessoa == id_pessoa))
    pessoa = result.scalar_one_or_none()
    if not pessoa:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")

    face_dir = _get_face_dir(id_pessoa)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"face_{timestamp}.jpg"
    filepath = os.path.join(face_dir, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    total = _count_faces(id_pessoa)
    logger.info(f"Face salva para pessoa {id_pessoa}: {filename} (total: {total})")

    # Invalida cache de reconhecimento facial
    try:
        from app.services.face_recognition_service import invalidate_cache
        invalidate_cache()
    except Exception:
        pass

    return {"filename": filename, "total_fotos": total}


@router.get("/{id_pessoa}/faces")
async def listar_faces(id_pessoa: int, db: AsyncSession = Depends(get_db)):
    """Lista as fotos de face registradas de uma pessoa."""
    result = await db.execute(select(Pessoa).where(Pessoa.id_pessoa == id_pessoa))
    pessoa = result.scalar_one_or_none()
    if not pessoa:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")

    face_dir = os.path.join(FACES_DIR, str(id_pessoa))
    if not os.path.exists(face_dir):
        return {"faces": [], "total": 0}

    faces = sorted([
        f for f in os.listdir(face_dir)
        if f.endswith(('.jpg', '.jpeg', '.png'))
    ])

    return {
        "faces": [
            {
                "filename": f,
                "url": f"/recordings/faces/{id_pessoa}/{f}",
            }
            for f in faces
        ],
        "total": len(faces),
    }


@router.delete("/{id_pessoa}/faces/{filename}", status_code=204)
async def deletar_face(
    id_pessoa: int,
    filename: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove uma foto de face específica."""
    filepath = os.path.join(FACES_DIR, str(id_pessoa), filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Face não encontrada")

    os.remove(filepath)
    logger.info(f"Face removida: pessoa {id_pessoa}, arquivo {filename}")

    # Invalida cache de reconhecimento facial
    try:
        from app.services.face_recognition_service import invalidate_cache
        invalidate_cache()
    except Exception:
        pass


# ---- Reconhecimentos ----

@router.get("/{id_pessoa}/reconhecimentos", response_model=List[ReconhecimentoResponse])
async def listar_reconhecimentos_pessoa(
    id_pessoa: int,
    db: AsyncSession = Depends(get_db),
):
    """Lista os reconhecimentos faciais de uma pessoa."""
    result = await db.execute(
        select(Reconhecimento, Camera.nome)
        .join(Camera, Reconhecimento.id_camera == Camera.id)
        .where(Reconhecimento.id_pessoa == id_pessoa)
        .order_by(Reconhecimento.dt_registro.desc())
        .limit(100)
    )

    reconhecimentos = []
    for rec, camera_nome in result.all():
        reconhecimentos.append({
            "id": rec.id,
            "id_pessoa": rec.id_pessoa,
            "id_camera": rec.id_camera,
            "dt_registro": rec.dt_registro,
            "camera_nome": camera_nome,
        })
    return reconhecimentos


@router.get("/reconhecimentos/recentes", response_model=List[ReconhecimentoResponse])
async def listar_reconhecimentos_recentes(
    db: AsyncSession = Depends(get_db),
):
    """Lista os reconhecimentos faciais mais recentes (todas as pessoas)."""
    result = await db.execute(
        select(Reconhecimento, Pessoa.no_pessoa, Camera.nome)
        .join(Pessoa, Reconhecimento.id_pessoa == Pessoa.id_pessoa)
        .join(Camera, Reconhecimento.id_camera == Camera.id)
        .order_by(Reconhecimento.dt_registro.desc())
        .limit(50)
    )

    reconhecimentos = []
    for rec, no_pessoa, camera_nome in result.all():
        reconhecimentos.append({
            "id": rec.id,
            "id_pessoa": rec.id_pessoa,
            "id_camera": rec.id_camera,
            "dt_registro": rec.dt_registro,
            "no_pessoa": no_pessoa,
            "camera_nome": camera_nome,
        })
    return reconhecimentos
