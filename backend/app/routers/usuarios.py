from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Usuario, MenuRec, MenuModel, CameraRec, Camera
from app.schemas import (
    UsuarioCreate, UsuarioUpdate, UsuarioResponse, MenuResponse,
    PermissaoMenuUpdate, PermissaoCameraUpdate,
)
from app.services.auth_service import hash_password
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


async def _build_usuario_response(user, db: AsyncSession) -> dict:
    """Monta o response com menus e câmeras."""
    menus_result = await db.execute(
        select(MenuModel).join(MenuRec, MenuRec.id_menu == MenuModel.id_menu)
        .where(MenuRec.id_usuario == user.id_usuario)
        .order_by(MenuModel.id_menu)
    )
    menus = [MenuResponse.model_validate(m) for m in menus_result.scalars().all()]

    cam_result = await db.execute(
        select(CameraRec.id_camera).where(CameraRec.id_usuario == user.id_usuario)
    )
    camera_ids = [row[0] for row in cam_result.all()]

    return {
        "id_usuario": user.id_usuario,
        "no_login": user.no_login,
        "no_usuario": user.no_usuario,
        "tx_funcao": user.tx_funcao,
        "menus": menus,
        "cameras": camera_ids,
    }


# ---- Listar menus disponíveis (DEVE ficar antes de /{user_id}) ----

@router.get("/menus/all", response_model=List[MenuResponse])
async def listar_todos_menus(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Lista todos os menus do sistema."""
    result = await db.execute(select(MenuModel).order_by(MenuModel.id_menu))
    return result.scalars().all()


@router.get("/")
async def listar_usuarios(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Lista todos os usuários."""
    result = await db.execute(select(Usuario).order_by(Usuario.id_usuario))
    users = result.scalars().all()
    responses = []
    for u in users:
        responses.append(await _build_usuario_response(u, db))
    return responses


@router.get("/{user_id}")
async def obter_usuario(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Obtém um usuário pelo ID."""
    result = await db.execute(select(Usuario).where(Usuario.id_usuario == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return await _build_usuario_response(user, db)


@router.post("/", status_code=201)
async def criar_usuario(
    body: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cria um novo usuário."""
    existing = await db.execute(
        select(Usuario).where(Usuario.no_login == body.no_login)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Login '{body.no_login}' já existe")

    user = Usuario(
        no_login=body.no_login,
        no_senha=hash_password(body.no_senha),
        no_usuario=body.no_usuario,
        tx_funcao=body.tx_funcao,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _build_usuario_response(user, db)


@router.put("/{user_id}")
async def atualizar_usuario(
    user_id: int,
    body: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Atualiza um usuário."""
    result = await db.execute(select(Usuario).where(Usuario.id_usuario == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if body.no_login is not None:
        if body.no_login != user.no_login:
            dup = await db.execute(
                select(Usuario).where(Usuario.no_login == body.no_login)
            )
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=409, detail=f"Login '{body.no_login}' já existe")
        user.no_login = body.no_login
    if body.no_usuario is not None:
        user.no_usuario = body.no_usuario
    if body.tx_funcao is not None:
        user.tx_funcao = body.tx_funcao
    if body.no_senha is not None and body.no_senha.strip():
        user.no_senha = hash_password(body.no_senha)

    await db.commit()
    await db.refresh(user)
    return await _build_usuario_response(user, db)


@router.delete("/{user_id}", status_code=204)
async def deletar_usuario(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Remove um usuário."""
    result = await db.execute(select(Usuario).where(Usuario.id_usuario == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if user.no_login == "admin":
        raise HTTPException(status_code=403, detail="Não é possível excluir o usuário admin")

    await db.delete(user)
    await db.commit()


# ---- Permissões de Menus ----

@router.put("/{user_id}/menus")
async def atualizar_menus_usuario(
    user_id: int,
    body: PermissaoMenuUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Define os menus permitidos para o usuário.
    Regra: só posso dar permissão a menus que EU tenho acesso.
    """
    result = await db.execute(select(Usuario).where(Usuario.id_usuario == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Menus do usuário logado
    my_menus = await db.execute(
        select(MenuRec.id_menu).where(MenuRec.id_usuario == current_user["id_usuario"])
    )
    my_menu_ids = {row[0] for row in my_menus.all()}

    # Validar: só pode dar menus que eu tenho
    for mid in body.menu_ids:
        if mid not in my_menu_ids:
            raise HTTPException(
                status_code=403,
                detail=f"Você não tem permissão ao menu {mid} para concedê-lo"
            )

    # Remove permissões atuais e insere novas
    await db.execute(
        sa_delete(MenuRec).where(MenuRec.id_usuario == user_id)
    )
    for mid in body.menu_ids:
        db.add(MenuRec(id_menu=mid, id_usuario=user_id))

    await db.commit()
    return await _build_usuario_response(user, db)


# ---- Permissões de Câmeras ----

@router.put("/{user_id}/cameras")
async def atualizar_cameras_usuario(
    user_id: int,
    body: PermissaoCameraUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Define as câmeras permitidas para o usuário.
    Regra: só posso dar permissão a câmeras que EU tenho acesso.
    """
    result = await db.execute(select(Usuario).where(Usuario.id_usuario == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Câmeras do usuário logado
    my_cams = await db.execute(
        select(CameraRec.id_camera).where(CameraRec.id_usuario == current_user["id_usuario"])
    )
    my_cam_ids = {row[0] for row in my_cams.all()}

    # Validar
    for cid in body.camera_ids:
        if cid not in my_cam_ids:
            raise HTTPException(
                status_code=403,
                detail=f"Você não tem permissão à câmera {cid} para concedê-la"
            )

    # Remove e insere
    await db.execute(
        sa_delete(CameraRec).where(CameraRec.id_usuario == user_id)
    )
    for cid in body.camera_ids:
        db.add(CameraRec(id_camera=cid, id_usuario=user_id))

    await db.commit()
    return await _build_usuario_response(user, db)
