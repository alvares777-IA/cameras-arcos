from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, BigInteger, ForeignKey
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
    dt_registro = Column(DateTime, default=datetime.now)

    pessoa = relationship("Pessoa", back_populates="reconhecimentos")
    camera = relationship("Camera")

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
