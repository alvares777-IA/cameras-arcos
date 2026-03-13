from datetime import datetime
from typing import List
import os
import re
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Parametro, Camera
from app.schemas import ParametroCreate, ParametroUpdate, ParametroResponse

logger = logging.getLogger("parametros")

# Mapeamento: chave .env → campo da API do MediaMTX (config global)
MTX_KEY_MAP = {
    "MTX_HLS_SEGMENT_DURATION": "hlsSegmentDuration",
    "MTX_HLS_PART_DURATION":    "hlsPartDuration",
    "MTX_HLS_VARIANT":          "hlsVariant",
    "MTX_HLS_ALWAYS_REMUX":     "hlsAlwaysRemux",
    "MTX_READ_BUFFER_COUNT":    "readBufferCount",
}


def _infer_categoria(chave: str) -> str | None:
    """Infere a categoria (arquivo de configuração) a partir da chave."""
    if chave == "MTX_SOURCE_ON_DEMAND":
        return "mediamtx_client.py"
    if chave.startswith("MTX_"):
        return "mediamtx.yml"
    if chave.startswith("HLS_"):
        return "hls.js"
    return None

# Defaults usados pelo HlsPlayer quando a chave não existe no banco
HLS_CONFIG_KEYS = {
    "HLS_LOW_LATENCY_MODE":        ("lowLatencyMode",        "bool", True),
    "HLS_MAX_BUFFER_LENGTH":       ("maxBufferLength",       "int",  10),
    "HLS_BACK_BUFFER_LENGTH":      ("backBufferLength",      "int",  30),
    "HLS_LIVE_SYNC_DURATION":      ("liveSyncDuration",      "int",  3),
    "HLS_LIVE_MAX_LATENCY_DURATION":("liveMaxLatencyDuration","int", 10),
    "HLS_MAX_AUTO_RETRIES":        ("maxAutoRetries",        "int",  5),
    "HLS_RETRY_DELAY_MS":          ("retryDelayMs",          "int",  3000),
}


async def _apply_mediamtx_config(chave: str, valor: str):
    """Envia alteração de parâmetro MTX_* para a API do MediaMTX (live, sem restart)."""
    if chave not in MTX_KEY_MAP:
        return
    mtx_url = os.getenv("MEDIAMTX_URL", "http://mediamtx:9997")
    field = MTX_KEY_MAP[chave]
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.patch(
                f"{mtx_url}/v3/config/global/patch",
                json={field: valor},
            )
            logger.info(f"MediaMTX config atualizado: {field}={valor} → {resp.status_code}")
    except Exception as e:
        logger.warning(f"Erro ao aplicar config no MediaMTX ({field}={valor}): {e}")


async def _apply_source_on_demand(valor: str, db: AsyncSession):
    """Aplica sourceOnDemand em todos os paths de câmera habilitadas no MediaMTX."""
    mtx_url = os.getenv("MEDIAMTX_URL", "http://mediamtx:9997")
    source_on_demand = valor.strip().lower() in ("true", "1", "yes")
    result = await db.execute(select(Camera).where(Camera.habilitada == True))
    cameras = result.scalars().all()
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            for cam in cameras:
                path_name = f"cam{cam.id}"
                resp = await client.patch(
                    f"{mtx_url}/v3/config/paths/patch/{path_name}",
                    json={"sourceOnDemand": source_on_demand},
                )
                logger.info(f"MediaMTX sourceOnDemand={source_on_demand} → {path_name} ({resp.status_code})")
    except Exception as e:
        logger.warning(f"Erro ao aplicar sourceOnDemand: {e}")

def _update_mediamtx_yml(chave: str, valor: str):
    """Atualiza o campo correspondente no arquivo mediamtx.yml (preserva comentários)."""
    if chave not in MTX_KEY_MAP:
        return
    field = MTX_KEY_MAP[chave]
    yml_path = os.getenv("MEDIAMTX_YML_PATH", "/project/mediamtx.yml")
    if not os.path.exists(yml_path):
        logger.warning(f"mediamtx.yml não encontrado em {yml_path}")
        return
    try:
        with open(yml_path, "r", encoding="utf-8") as f:
            content = f.read()
        new_content = re.sub(
            rf'^({re.escape(field)}:\s*)(.+)$',
            rf'\g<1>{valor}',
            content,
            flags=re.MULTILINE,
        )
        if new_content != content:
            with open(yml_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            logger.info(f"mediamtx.yml atualizado: {field}={valor}")
        else:
            logger.warning(f"Campo '{field}' não encontrado em mediamtx.yml")
    except Exception as e:
        logger.error(f"Erro ao atualizar mediamtx.yml ({field}={valor}): {e}")


router = APIRouter(prefix="/api/parametros", tags=["parametros"])

ENV_FILE_PATH = os.getenv("ENV_FILE_PATH", "/project/.env")


# ========= Helpers =========

def _read_env_file() -> dict:
    """
    Lê o arquivo .env e retorna um dict chave→(valor, observacoes).
    Comentários imediatamente acima de uma chave (sem linha em branco entre eles)
    são capturados como observações e importados no banco na sincronização.
    """
    env_vars = {}
    if not os.path.exists(ENV_FILE_PATH):
        return env_vars
    try:
        pending_comments: list[str] = []
        with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line_stripped = line.strip()
                if not line_stripped:
                    pending_comments = []  # linha em branco desassocia comentários
                    continue
                if line_stripped.startswith("#"):
                    text = line_stripped[1:].strip()
                    if text:
                        pending_comments.append(text)
                    continue
                if "=" in line_stripped:
                    key, _, value = line_stripped.partition("=")
                    key = key.strip()
                    value = value.strip()
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                        value = value[1:-1]
                    obs = "\n".join(pending_comments) if pending_comments else None
                    env_vars[key] = (value, obs)
                    pending_comments = []
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
        for chave, (valor, observacoes) in env_vars.items():
            result = await db.execute(
                select(Parametro).where(Parametro.chave == chave)
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Atualiza valor se mudou
                if existing.valor != valor:
                    existing.valor = valor
                    existing.atualizado_em = datetime.utcnow()
                # Importa observações do .env apenas se o campo ainda estiver vazio no banco
                if observacoes and not existing.observacoes:
                    existing.observacoes = observacoes
                    existing.atualizado_em = datetime.utcnow()
                # Preenche categoria se ainda estiver vazia
                if not existing.categoria:
                    cat = _infer_categoria(chave)
                    if cat:
                        existing.categoria = cat
                        existing.atualizado_em = datetime.utcnow()
            else:
                # Cria novo registro com observações do comentário .env e categoria inferida
                novo = Parametro(chave=chave, valor=valor, observacoes=observacoes,
                                 categoria=_infer_categoria(chave))
                db.add(novo)

        await db.commit()
        logger.info(f"Sync .env: {len(env_vars)} variáveis processadas")

    # Retorna todos
    result = await db.execute(select(Parametro).order_by(Parametro.chave))
    return result.scalars().all()


@router.get("/hls-config")
async def get_hls_config(db: AsyncSession = Depends(get_db)):
    """
    Retorna a configuração HLS.js lida dos parâmetros do banco.
    Usado pelo frontend para configurar o player sem rebuild.
    """
    result = await db.execute(
        select(Parametro).where(Parametro.chave.in_(HLS_CONFIG_KEYS.keys()))
    )
    params_by_key = {p.chave: p.valor for p in result.scalars().all()}

    config = {}
    for key, (field, type_, default) in HLS_CONFIG_KEYS.items():
        valor = params_by_key.get(key)
        if valor is None:
            config[field] = default
        elif type_ == "bool":
            config[field] = valor.strip().lower() in ("true", "1", "yes")
        elif type_ == "int":
            try:
                config[field] = int(valor)
            except ValueError:
                config[field] = default
    return config


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

    cat = parametro.categoria if parametro.categoria is not None else _infer_categoria(parametro.chave)
    novo = Parametro(
        chave=parametro.chave,
        valor=parametro.valor,
        nome=parametro.nome,
        observacoes=parametro.observacoes,
        categoria=cat,
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
    if parametro.categoria is not None:
        param.categoria = parametro.categoria
    param.atualizado_em = datetime.utcnow()

    await db.commit()
    await db.refresh(param)

    # Regrava o .env
    all_params = await _get_all_params(db)
    _write_env_file(all_params)

    # Se for um parâmetro MediaMTX global, aplica live via API (sem restart)
    await _apply_mediamtx_config(param.chave, param.valor or "")
    _update_mediamtx_yml(param.chave, param.valor or "")

    # Se for sourceOnDemand, aplica em todos os paths de câmera
    if param.chave == "MTX_SOURCE_ON_DEMAND":
        await _apply_source_on_demand(param.valor or "true", db)

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
