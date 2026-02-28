"""
Dependência FastAPI para autenticação — extrai o usuário atual do cookie/header.
"""
from fastapi import Request, HTTPException
from app.services.auth_service import get_session


async def get_current_user(request: Request) -> dict:
    """
    Obtém o usuário atual a partir do cookie 'session_token'.
    Levanta 401 se não autenticado.
    """
    token = request.cookies.get("session_token")
    if not token:
        # Fallback: header Authorization
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    user = get_session(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    return user
