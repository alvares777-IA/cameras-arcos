from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, BigInteger, ForeignKey, Text
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(100), nullable=False)
    rtsp_url = Column(String(500), nullable=False)
    habilitada = Column(Boolean, default=True)
    continuos = Column(Boolean, default=False)
    hr_ini = Column(Integer, nullable=True)   # Hora início gravação contínua (0-23)
    hr_fim = Column(Integer, nullable=True)   # Hora fim gravação contínua (0-23)
    recursos = Column(String(2000), nullable=True)  # JSON com info do stream (resolução, codec, fps)
    criada_em = Column(DateTime, default=datetime.now)
    atualizada_em = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    gravacoes = relationship("Gravacao", back_populates="camera", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Camera(id={self.id}, nome='{self.nome}')>"


class Gravacao(Base):
    __tablename__ = "gravacoes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_camera = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    caminho_arquivo = Column(String(1000), nullable=False)
    data_inicio = Column(DateTime, nullable=False)
    data_fim = Column(DateTime, nullable=False)
    tamanho_bytes = Column(BigInteger, default=0)
    face_analyzed = Column(Boolean, default=False)
    criada_em = Column(DateTime, default=datetime.now)

    camera = relationship("Camera", back_populates="gravacoes")
    reconhecimentos = relationship("Reconhecimento", back_populates="gravacao", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Gravacao(id={self.id}, camera={self.id_camera}, inicio={self.data_inicio})>"


class Pessoa(Base):
    __tablename__ = "pessoas"

    id_pessoa = Column(Integer, primary_key=True, autoincrement=True)
    no_pessoa = Column(String(200), nullable=False)
    ao_tipo = Column(String(1), nullable=False, default='V')
    criada_em = Column(DateTime, default=datetime.now)
    atualizada_em = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    reconhecimentos = relationship("Reconhecimento", back_populates="pessoa", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Pessoa(id={self.id_pessoa}, nome='{self.no_pessoa}', tipo='{self.ao_tipo}')>"


class Reconhecimento(Base):
    __tablename__ = "reconhecimentos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_pessoa = Column(Integer, ForeignKey("pessoas.id_pessoa", ondelete="CASCADE"), nullable=False)
    id_camera = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    id_gravacao = Column(Integer, ForeignKey("gravacoes.id", ondelete="CASCADE"), nullable=True)
    dt_registro = Column(DateTime, default=datetime.now)

    pessoa = relationship("Pessoa", back_populates="reconhecimentos")
    camera = relationship("Camera")
    gravacao = relationship("Gravacao")

    def __repr__(self):
        return f"<Reconhecimento(id={self.id}, pessoa={self.id_pessoa}, camera={self.id_camera})>"


class Grupo(Base):
    __tablename__ = "grupos"

    id_grupo = Column(Integer, primary_key=True, autoincrement=True)
    no_grupo = Column(String(200), nullable=False)
    criado_em = Column(DateTime, default=datetime.now)
    atualizado_em = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    cameras = relationship("Camera", secondary="grupo_cameras", backref="grupos")

    def __repr__(self):
        return f"<Grupo(id={self.id_grupo}, nome='{self.no_grupo}')>"


class GrupoCamera(Base):
    __tablename__ = "grupo_cameras"

    id_grupo = Column(Integer, ForeignKey("grupos.id_grupo", ondelete="CASCADE"), primary_key=True)
    id_camera = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), primary_key=True)


class Parametro(Base):
    __tablename__ = "parametros"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chave = Column(String(200), unique=True, nullable=False)
    valor = Column(String(1000), nullable=True)
    nome = Column(String(200), nullable=True)
    observacoes = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=datetime.now)
    atualizado_em = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def __repr__(self):
        return f"<Parametro(id={self.id}, chave='{self.chave}')>"


class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, autoincrement=True)
    no_login = Column(String(100), unique=True, nullable=False)
    no_senha = Column(String(256), nullable=False)  # SHA-256 hash
    no_usuario = Column(String(200), nullable=False)
    tx_funcao = Column(String(200), nullable=True)

    menus = relationship("MenuRec", back_populates="usuario", cascade="all, delete-orphan")
    cameras_perm = relationship("CameraRec", back_populates="usuario", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Usuario(id={self.id_usuario}, login='{self.no_login}')>"


class MenuModel(Base):
    __tablename__ = "menus"

    id_menu = Column(Integer, primary_key=True, autoincrement=True)
    no_menu = Column(String(200), nullable=False)
    tx_link = Column(String(200), unique=True, nullable=False)

    def __repr__(self):
        return f"<Menu(id={self.id_menu}, nome='{self.no_menu}')>"


class MenuRec(Base):
    __tablename__ = "menurec"

    id_menurec = Column(Integer, primary_key=True, autoincrement=True)
    id_menu = Column(Integer, ForeignKey("menus.id_menu", ondelete="CASCADE"), nullable=False)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)

    usuario = relationship("Usuario", back_populates="menus")
    menu = relationship("MenuModel")

    def __repr__(self):
        return f"<MenuRec(id={self.id_menurec}, menu={self.id_menu}, user={self.id_usuario})>"


class CameraRec(Base):
    __tablename__ = "camerarec"

    id_camerarec = Column(Integer, primary_key=True, autoincrement=True)
    id_camera = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)

    usuario = relationship("Usuario", back_populates="cameras_perm")
    camera = relationship("Camera")

    def __repr__(self):
        return f"<CameraRec(id={self.id_camerarec}, camera={self.id_camera}, user={self.id_usuario})>"

