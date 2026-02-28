from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# ---- Camera Schemas ----

class CameraBase(BaseModel):
    nome: str
    rtsp_url: str
    habilitada: bool = True
    continuos: bool = False
    hr_ini: Optional[int] = None
    hr_fim: Optional[int] = None
    recursos: Optional[str] = None


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    nome: Optional[str] = None
    rtsp_url: Optional[str] = None
    habilitada: Optional[bool] = None
    continuos: Optional[bool] = None
    hr_ini: Optional[int] = None
    hr_fim: Optional[int] = None


class CameraResponse(CameraBase):
    id: int
    criada_em: datetime
    atualizada_em: datetime

    class Config:
        from_attributes = True


# ---- Pessoa Schemas ----

class PessoaBase(BaseModel):
    no_pessoa: str
    ao_tipo: str = 'V'


class PessoaCreate(PessoaBase):
    pass


class PessoaUpdate(BaseModel):
    no_pessoa: Optional[str] = None
    ao_tipo: Optional[str] = None


class PessoaResponse(PessoaBase):
    id_pessoa: int
    criada_em: datetime
    atualizada_em: datetime
    total_fotos: int = 0

    class Config:
        from_attributes = True


# ---- Reconhecimento Schemas ----

class ReconhecimentoCreate(BaseModel):
    id_pessoa: int
    id_camera: int


class ReconhecimentoResponse(BaseModel):
    id: int
    id_pessoa: int
    id_camera: int
    id_gravacao: Optional[int] = None
    dt_registro: datetime
    no_pessoa: Optional[str] = None
    camera_nome: Optional[str] = None

    class Config:
        from_attributes = True


# ---- Gravação Schemas ----

class GravacaoBase(BaseModel):
    id_camera: int
    caminho_arquivo: str
    data_inicio: datetime
    data_fim: datetime
    tamanho_bytes: int = 0


class GravacaoCreate(GravacaoBase):
    pass


class GravacaoResponse(GravacaoBase):
    id: int
    face_analyzed: bool = False
    criada_em: datetime
    reconhecimentos: List[ReconhecimentoResponse] = []

    class Config:
        from_attributes = True


class GravacaoQuery(BaseModel):
    camera_id: Optional[int] = None
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None


# ---- Stream Schema ----

class StreamInfo(BaseModel):
    camera_id: int
    camera_nome: str
    hls_url: str


# ---- Grupo Schemas ----

class GrupoBase(BaseModel):
    no_grupo: str


class GrupoCreate(GrupoBase):
    camera_ids: List[int] = []


class GrupoUpdate(BaseModel):
    no_grupo: Optional[str] = None
    camera_ids: Optional[List[int]] = None


class GrupoCameraSimple(BaseModel):
    id: int
    nome: str

    class Config:
        from_attributes = True


class GrupoResponse(GrupoBase):
    id_grupo: int
    criado_em: datetime
    atualizado_em: datetime
    cameras: List[GrupoCameraSimple] = []
    total_cameras: int = 0

    class Config:
        from_attributes = True


# ---- Parametro Schemas ----

class ParametroBase(BaseModel):
    chave: str
    valor: Optional[str] = None
    nome: Optional[str] = None
    observacoes: Optional[str] = None


class ParametroCreate(ParametroBase):
    pass


class ParametroUpdate(BaseModel):
    chave: Optional[str] = None
    valor: Optional[str] = None
    nome: Optional[str] = None
    observacoes: Optional[str] = None


class ParametroResponse(ParametroBase):
    id: int
    criado_em: datetime
    atualizado_em: datetime

    class Config:
        from_attributes = True


# ---- Auth Schemas ----

class LoginRequest(BaseModel):
    login: str
    senha: str


class LoginResponse(BaseModel):
    token: str
    usuario: 'UsuarioResponse'


class MeResponse(BaseModel):
    id_usuario: int
    no_login: str
    no_usuario: str
    tx_funcao: Optional[str] = None


# ---- Menu Schemas ----

class MenuResponse(BaseModel):
    id_menu: int
    no_menu: str
    tx_link: str

    class Config:
        from_attributes = True


# ---- Usuario Schemas ----

class UsuarioBase(BaseModel):
    no_login: str
    no_usuario: str
    tx_funcao: Optional[str] = None


class UsuarioCreate(UsuarioBase):
    no_senha: str


class UsuarioUpdate(BaseModel):
    no_login: Optional[str] = None
    no_usuario: Optional[str] = None
    tx_funcao: Optional[str] = None
    no_senha: Optional[str] = None  # Opcional na atualização


class UsuarioResponse(UsuarioBase):
    id_usuario: int
    menus: List[MenuResponse] = []
    cameras: List[int] = []  # IDs das câmeras permitidas

    class Config:
        from_attributes = True


# ---- Permission Schemas ----

class PermissaoMenuUpdate(BaseModel):
    menu_ids: List[int]


class PermissaoCameraUpdate(BaseModel):
    camera_ids: List[int]

