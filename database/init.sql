-- ============================================
-- Sistema de Monitoramento de Câmeras IP
-- Script de inicialização do banco de dados
-- ============================================

CREATE TABLE IF NOT EXISTS cameras (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL,
    rtsp_url        VARCHAR(500) NOT NULL,
    habilitada      BOOLEAN DEFAULT TRUE,
    continuos       BOOLEAN DEFAULT FALSE,
    hr_ini          INTEGER,
    hr_fim          INTEGER,
    recursos        VARCHAR(2000),
    criada_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizada_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gravacoes (
    id              SERIAL PRIMARY KEY,
    id_camera       INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    caminho_arquivo VARCHAR(1000) NOT NULL,
    data_inicio     TIMESTAMP NOT NULL,
    data_fim        TIMESTAMP NOT NULL,
    tamanho_bytes   BIGINT DEFAULT 0,
    face_analyzed   BOOLEAN DEFAULT FALSE,
    criada_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas rápidas no módulo de playback
CREATE INDEX IF NOT EXISTS idx_gravacoes_camera     ON gravacoes(id_camera);
CREATE INDEX IF NOT EXISTS idx_gravacoes_datas       ON gravacoes(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_gravacoes_camera_data ON gravacoes(id_camera, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_gravacoes_face_analyzed ON gravacoes(face_analyzed);

-- Tabela de Pessoas (reconhecimento facial)
CREATE TABLE IF NOT EXISTS pessoas (
    id_pessoa       SERIAL PRIMARY KEY,
    no_pessoa       VARCHAR(200) NOT NULL,
    ao_tipo         CHAR(1) NOT NULL DEFAULT 'V' CHECK (ao_tipo IN ('S', 'C', 'A', 'V')),
    criada_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizada_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Reconhecimentos Faciais
CREATE TABLE IF NOT EXISTS reconhecimentos (
    id              SERIAL PRIMARY KEY,
    id_pessoa       INTEGER NOT NULL REFERENCES pessoas(id_pessoa) ON DELETE CASCADE,
    id_camera       INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    id_gravacao     INTEGER REFERENCES gravacoes(id) ON DELETE CASCADE,
    dt_registro     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas em reconhecimentos
CREATE INDEX IF NOT EXISTS idx_reconhecimentos_pessoa ON reconhecimentos(id_pessoa);
CREATE INDEX IF NOT EXISTS idx_reconhecimentos_camera ON reconhecimentos(id_camera);
CREATE INDEX IF NOT EXISTS idx_reconhecimentos_gravacao ON reconhecimentos(id_gravacao);
CREATE INDEX IF NOT EXISTS idx_reconhecimentos_data   ON reconhecimentos(dt_registro);

-- Tabela de Grupos de Câmeras
CREATE TABLE IF NOT EXISTS grupos (
    id_grupo        SERIAL PRIMARY KEY,
    no_grupo        VARCHAR(200) NOT NULL,
    criado_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela associativa Grupo ↔ Câmera (N:N)
CREATE TABLE IF NOT EXISTS grupo_cameras (
    id_grupo        INTEGER NOT NULL REFERENCES grupos(id_grupo) ON DELETE CASCADE,
    id_camera       INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    PRIMARY KEY (id_grupo, id_camera)
);

CREATE INDEX IF NOT EXISTS idx_grupo_cameras_grupo  ON grupo_cameras(id_grupo);
CREATE INDEX IF NOT EXISTS idx_grupo_cameras_camera ON grupo_cameras(id_camera);

-- Inserir câmera de teste (stream simulado via FFmpeg)
INSERT INTO cameras (nome, rtsp_url, habilitada)
VALUES ('Câmera Teste - FFmpeg', 'rtsp://mediamtx:8554/test', TRUE)
ON CONFLICT DO NOTHING;

-- Tabela de Parâmetros do sistema (.env)
CREATE TABLE IF NOT EXISTS parametros (
    id              SERIAL PRIMARY KEY,
    chave           VARCHAR(200) UNIQUE NOT NULL,
    valor           VARCHAR(1000),
    nome            VARCHAR(200),
    observacoes     TEXT,
    criado_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
