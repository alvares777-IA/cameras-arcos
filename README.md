# 🎥 Câmeras Arcos — Sistema de Monitoramento

Sistema web completo para monitoramento de câmeras IP via RTSP, com gravação contínua, live streaming e playback.

## 🏗️ Arquitetura

| Componente | Tecnologia |
|------------|------------|
| **Backend** | Python 3.11 + FastAPI + OpenCV |
| **Frontend** | React 19 + Vite 6 + Tailwind CSS v4 |
| **Banco de dados** | PostgreSQL 16 |
| **Stream RTSP → HLS** | MediaMTX |
| **Player HLS** | hls.js |
| **Containers** | Docker Compose |

## 🚀 Quick Start

### Pré-requisitos
- Docker e Docker Compose instalados
- Portas livres: `3000` (frontend), `8000` (backend), `8554` (RTSP), `8888` (HLS), `5432` (Postgres)

### 1. Configure

```bash
cd cameras-arcos
cp .env.example .env
```

### 2. Suba os containers

```bash
docker compose up -d --build
```

### 3. Acesse a interface

- **Frontend:** http://localhost:3000
- **API Docs (Swagger):** http://localhost:8000/docs
- **MediaMTX API:** http://localhost:9997

### 4. Adicionar câmeras reais

1. Abra http://localhost:3000/cameras
2. Clique em **"Nova Câmera"**
3. Preencha o nome e a URL RTSP: `rtsp://usuario:senha@IP:554/stream1`
4. Adicione o path correspondente no `mediamtx.yml`
5. Reinicie o MediaMTX: `docker compose restart mediamtx`

## 📂 Estrutura do Projeto

```
cameras-arcos/
├── docker-compose.yml
├── mediamtx.yml
├── .env
├── database/
│   └── init.sql
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── routers/
│       │   ├── cameras.py
│       │   ├── gravacoes.py
│       │   └── stream.py
│       └── services/
│           ├── recorder.py
│           └── cleanup.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── api/client.js
        ├── components/
        │   ├── Sidebar.jsx
        │   └── HlsPlayer.jsx
        └── pages/
            ├── Dashboard.jsx
            ├── Playback.jsx
            └── Cameras.jsx
```

## ⚙️ Configurações (.env)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `RETENTION_DAYS` | `30` | Dias para manter gravações |
| `SEGMENT_DURATION_SECONDS` | `300` | Duração de cada segmento (5 min) |
| `POSTGRES_PASSWORD` | `cameras123` | Senha do PostgreSQL |

## 🧹 Limpeza Automática

Rotina diária às 03:00: remove arquivos > 30 dias, limpa registros do banco e diretórios vazios.

## 📱 Responsividade

- **Mobile** (< 640px): 1 coluna, sidebar retrátil
- **Tablet** (640–1024px): 2 colunas
- **Desktop** (> 1024px): 3–4 colunas
