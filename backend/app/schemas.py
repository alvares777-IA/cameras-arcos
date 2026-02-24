from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ---- Camera Schemas ----

class CameraBase(BaseModel):
    nome: str
    rtsp_url: str
    habilitada: bool = True


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    nome: Optional[str] = None
    rtsp_url: Optional[str] = None
    habilitada: Optional[bool] = None


class CameraResponse(CameraBase):
    id: int
    criada_em: datetime
    atualizada_em: datetime

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
    dt_registro: datetime
    no_pessoa: Optional[str] = None
    camera_nome: Optional[str] = None

    class Config:
        from_attributes = True


# ---- Grupo Schemas ----

class GrupoBase(BaseModel):
    no_grupo: str


class GrupoCreate(GrupoBase):
    camera_ids: list[int] = []


class GrupoUpdate(BaseModel):
    no_grupo: Optional[str] = None
    camera_ids: Optional[list[int]] = None


class GrupoCameraSimple(BaseModel):
    id: int
    nome: str

    class Config:
        from_attributes = True


class GrupoResponse(GrupoBase):
    id_grupo: int
    criado_em: datetime
    atualizado_em: datetime
    cameras: list[GrupoCameraSimple] = []
    total_cameras: int = 0

    class Config:
        from_attributes = True
