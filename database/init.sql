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

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario      SERIAL PRIMARY KEY,
    no_login        VARCHAR(100) UNIQUE NOT NULL,
    no_senha        VARCHAR(256) NOT NULL,
    no_usuario      VARCHAR(200) NOT NULL,
    tx_funcao       VARCHAR(200)
);

-- Tabela de Menus
CREATE TABLE IF NOT EXISTS menus (
    id_menu         SERIAL PRIMARY KEY,
    no_menu         VARCHAR(200) NOT NULL,
    tx_link         VARCHAR(200) UNIQUE NOT NULL
);

-- Tabela de Permissões de Menus
CREATE TABLE IF NOT EXISTS menurec (
    id_menurec      SERIAL PRIMARY KEY,
    id_menu         INTEGER NOT NULL REFERENCES menus(id_menu) ON DELETE CASCADE,
    id_usuario      INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- Tabela de Permissões de Câmeras
CREATE TABLE IF NOT EXISTS camerarec (
    id_camerarec    SERIAL PRIMARY KEY,
    id_camera       INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    id_usuario      INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- Seed Menus
INSERT INTO menus (no_menu, tx_link) VALUES
    ('Dashboard', '/'),
    ('Playback', '/playback'),
    ('Câmeras', '/cameras'),
    ('Grupos', '/grupos'),
    ('Pessoas', '/pessoas'),
    ('Parâmetros', '/parametros'),
    ('Usuários', '/usuarios')
ON CONFLICT (tx_link) DO NOTHING;

-- Criar admin com permissões totais (somente se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE no_login = 'admin') THEN
        -- SHA-256 de 'admin'
        INSERT INTO usuarios (no_login, no_senha, no_usuario, tx_funcao)
        VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Administrador', 'Administrador do Sistema');

        -- Permissões de menus
        INSERT INTO menurec (id_menu, id_usuario)
        SELECT m.id_menu, u.id_usuario
        FROM menus m, usuarios u
        WHERE u.no_login = 'admin';

        -- Permissões de câmeras
        INSERT INTO camerarec (id_camera, id_usuario)
        SELECT c.id, u.id_usuario
        FROM cameras c, usuarios u
        WHERE u.no_login = 'admin';
    END IF;
END $$;
