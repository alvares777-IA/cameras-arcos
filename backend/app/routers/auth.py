from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Usuario, MenuRec, MenuModel, CameraRec
from app.schemas import LoginRequest, LoginResponse, MeResponse, UsuarioResponse, MenuResponse
from app.services.auth_service import verify_password, create_session, get_session, delete_session
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Autentica o usuário e retorna um token de sessão no cookie."""
    result = await db.execute(
        select(Usuario).where(Usuario.no_login == body.login)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.senha, user.no_senha):
        raise HTTPException(status_code=401, detail="Login ou senha inválidos")

    token = create_session(user)

    # Buscar menus e câmeras
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

    # Set cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=False,  # Frontend precisa ler para verificar
        samesite="lax",
        path="/",
        max_age=86400 * 7,  # 7 dias
    )

    return {
        "token": token,
        "usuario": {
            "id_usuario": user.id_usuario,
            "no_login": user.no_login,
            "no_usuario": user.no_usuario,
            "tx_funcao": user.tx_funcao,
            "menus": menus,
            "cameras": camera_ids,
        }
    }


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Remove a sessão e limpa o cookie."""
    token = request.cookies.get("session_token")
    if token:
        delete_session(token)
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Retorna os dados do usuário autenticado + menus + câmeras permitidas."""
    menus_result = await db.execute(
        select(MenuModel).join(MenuRec, MenuRec.id_menu == MenuModel.id_menu)
        .where(MenuRec.id_usuario == user["id_usuario"])
        .order_by(MenuModel.id_menu)
    )
    menus = [MenuResponse.model_validate(m) for m in menus_result.scalars().all()]

    cam_result = await db.execute(
        select(CameraRec.id_camera).where(CameraRec.id_usuario == user["id_usuario"])
    )
    camera_ids = [row[0] for row in cam_result.all()]

    return {
        "id_usuario": user["id_usuario"],
        "no_login": user["no_login"],
        "no_usuario": user["no_usuario"],
        "tx_funcao": user["tx_funcao"],
        "menus": menus,
        "cameras": camera_ids,
    }
