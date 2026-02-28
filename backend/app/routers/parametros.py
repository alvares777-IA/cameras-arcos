from datetime import datetime
from typing import List
import os
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Parametro
from app.schemas import ParametroCreate, ParametroUpdate, ParametroResponse

logger = logging.getLogger("parametros")

router = APIRouter(prefix="/api/parametros", tags=["parametros"])

ENV_FILE_PATH = os.getenv("ENV_FILE_PATH", "/project/.env")


# ========= Helpers =========

def _read_env_file() -> dict:
    """Lê o arquivo .env e retorna um dict chave→valor."""
    env_vars = {}
    if not os.path.exists(ENV_FILE_PATH):
        return env_vars
    try:
        with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip()
                    # Remove aspas se existirem
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                        value = value[1:-1]
                    env_vars[key] = value
    except Exception as e:
        logger.error(f"Erro ao ler {ENV_FILE_PATH}: {e}")
    return env_vars


def _write_env_file(parametros: list):
    """Reescreve o arquivo .env a partir dos parâmetros do banco."""
    try:
        lines = []
        lines.append("# ============================================")
        lines.append("# Parâmetros do Sistema - Gerado automaticamente")
        lines.append(f"# Última atualização: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("# ============================================")
        lines.append("")

        for p in sorted(parametros, key=lambda x: x.chave):
            if p.nome:
                lines.append(f"# {p.nome}")
            if p.observacoes:
                for obs_line in p.observacoes.split("\n"):
                    lines.append(f"# {obs_line}")
            valor = p.valor or ""
            # Se o valor contém espaços ou caracteres especiais, usar aspas
            if " " in valor or "#" in valor or "'" in valor:
                lines.append(f'{p.chave}="{valor}"')
            else:
                lines.append(f"{p.chave}={valor}")
            lines.append("")

        # Garante que o diretório existe
        os.makedirs(os.path.dirname(ENV_FILE_PATH), exist_ok=True)

        with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        logger.info(f".env atualizado com {len(parametros)} parâmetros")
    except Exception as e:
        logger.error(f"Erro ao escrever {ENV_FILE_PATH}: {e}")


async def _get_all_params(db: AsyncSession) -> list:
    """Retorna todos os parâmetros do banco."""
    result = await db.execute(select(Parametro).order_by(Parametro.chave))
    return list(result.scalars().all())


# ========= Endpoints =========

@router.post("/sync", response_model=List[ParametroResponse])
async def sync_env(db: AsyncSession = Depends(get_db)):
    """
    Lê o arquivo .env e sincroniza com a tabela parametros.
    - Chaves novas do .env → cria no banco
    - Chaves existentes → atualiza apenas o valor (preserva nome/observacoes)
    - Chaves que só existem no banco → mantém (não apaga)
    Retorna todos os parâmetros após a sincronização.
    """
    env_vars = _read_env_file()

    if env_vars:
        for chave, valor in env_vars.items():
            result = await db.execute(
                select(Parametro).where(Parametro.chave == chave)
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Atualiza só o valor se mudou
                if existing.valor != valor:
                    existing.valor = valor
                    existing.atualizado_em = datetime.utcnow()
            else:
                # Cria novo registro
                novo = Parametro(chave=chave, valor=valor)
                db.add(novo)

        await db.commit()
        logger.info(f"Sync .env: {len(env_vars)} variáveis processadas")

    # Retorna todos
    result = await db.execute(select(Parametro).order_by(Parametro.chave))
    return result.scalars().all()


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
    """Cadastra um novo parâmetro e regrava o .env."""
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

    # Regrava o .env
    all_params = await _get_all_params(db)
    _write_env_file(all_params)

    return novo


@router.put("/{parametro_id}", response_model=ParametroResponse)
async def atualizar_parametro(
    parametro_id: int,
    parametro: ParametroUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Atualiza um parâmetro e regrava o .env."""
    result = await db.execute(select(Parametro).where(Parametro.id == parametro_id))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parâmetro não encontrado")

    if parametro.chave is not None:
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

    # Regrava o .env
    all_params = await _get_all_params(db)
    _write_env_file(all_params)

    return param


@router.delete("/{parametro_id}", status_code=204)
async def deletar_parametro(parametro_id: int, db: AsyncSession = Depends(get_db)):
    """Remove um parâmetro e regrava o .env."""
    result = await db.execute(select(Parametro).where(Parametro.id == parametro_id))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parâmetro não encontrado")

    await db.delete(param)
    await db.commit()

    # Regrava o .env
    all_params = await _get_all_params(db)
    _write_env_file(all_params)
