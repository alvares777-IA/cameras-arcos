"""
Serviço de autenticação — gerenciamento de sessões e hashing de senhas.
"""
import hashlib
import uuid
from datetime import datetime

# Armazena sessões ativas em memória: token → user_info
_sessions: dict = {}


def hash_password(password: str) -> str:
    """Gera hash SHA-256 da senha."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verifica se a senha bate com o hash."""
    return hash_password(password) == hashed


def create_session(user) -> str:
    """Cria uma sessão e retorna o token."""
    token = uuid.uuid4().hex
    _sessions[token] = {
        "id_usuario": user.id_usuario,
        "no_login": user.no_login,
        "no_usuario": user.no_usuario,
        "tx_funcao": user.tx_funcao,
        "login_time": datetime.utcnow().isoformat(),
    }
    return token


def get_session(token: str) -> dict | None:
    """Retorna os dados da sessão ou None."""
    return _sessions.get(token)


def delete_session(token: str):
    """Remove a sessão."""
    _sessions.pop(token, None)
