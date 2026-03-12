import { useState } from 'react'
import {
    Info, Server, Database, Camera, Video, Shield, Users, ScanFace,
    Settings, FolderOpen, Film, Code, Layers, Activity, ChevronDown,
    ChevronRight, Monitor, Cpu, HardDrive, Globe, Lock, Zap, ArrowUp
} from 'lucide-react'

const SECTIONS = [
    {
        id: 'visao-geral',
        icon: <Info size={18} />,
        title: 'Visão Geral do Sistema',
        content: () => (
            <>
                <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.7', color: 'var(--color-text-secondary)' }}>
                        O <strong style={{ color: 'var(--color-text-primary)' }}>Câmeras Arcos</strong> é um sistema
                        completo de monitoramento de câmeras IP via protocolo RTSP. Ele foi projetado para oferecer
                        visualização ao vivo, gravação inteligente (por movimento ou contínua), reconhecimento facial
                        automatizado e gestão avançada de usuários com controle granular de permissões.
                    </p>
                </div>
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.75rem', marginBottom: '1rem',
                }}>
                    {[
                        { icon: <Camera size={20} />, label: 'Câmeras IP', desc: 'Gerenciamento completo de câmeras RTSP' },
                        { icon: <Video size={20} />, label: 'Gravação', desc: 'Movimento ou contínua com segmentos' },
                        { icon: <ScanFace size={20} />, label: 'Rec. Facial', desc: 'Identificação automática de pessoas' },
                        { icon: <Shield size={20} />, label: 'Segurança', desc: 'Autenticação e permissões granulares' },
                        { icon: <FolderOpen size={20} />, label: 'Grupos', desc: 'Organização de câmeras por setores' },
                        { icon: <Film size={20} />, label: 'Playback', desc: 'Consulta e reprodução de gravações' },
                    ].map((item, i) => (
                        <div key={i} style={{
                            background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '0.5rem',
                        }}>
                            <div style={{ color: 'var(--color-accent)' }}>{item.icon}</div>
                            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>{item.label}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{item.desc}</div>
                        </div>
                    ))}
                </div>
            </>
        ),
    },
    {
        id: 'arquitetura',
        icon: <Layers size={18} />,
        title: 'Arquitetura Técnica',
        content: () => (
            <>
                <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                        O sistema utiliza uma arquitetura de microsserviços baseada em Docker Compose, composta por 4 containers principais:
                    </p>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {[
                            {
                                name: 'Frontend (Nginx)', icon: <Globe size={16} />, color: '#3b82f6',
                                desc: 'Aplicação React construída com Vite, servida via Nginx. Interface SPA (Single Page Application) responsiva com design dark-mode premium.',
                                tech: 'React 18 • Vite • Lucide Icons • Axios • HLS.js'
                            },
                            {
                                name: 'Backend (FastAPI)', icon: <Server size={16} />, color: '#10b981',
                                desc: 'API REST em Python com FastAPI. Gerencia toda a lógica de negócios, autenticação, CRUD de entidades, gravação e reconhecimento facial.',
                                tech: 'Python 3.11 • FastAPI • SQLAlchemy • APScheduler • OpenCV • dlib'
                            },
                            {
                                name: 'Banco de Dados (PostgreSQL)', icon: <Database size={16} />, color: '#f59e0b',
                                desc: 'Banco relacional que armazena todas as entidades do sistema: câmeras, gravações, pessoas, reconhecimentos, grupos, parâmetros e usuários.',
                                tech: 'PostgreSQL 15 • SQLAlchemy ORM'
                            },
                            {
                                name: 'MediaMTX (Streaming)', icon: <Monitor size={16} />, color: '#8b5cf6',
                                desc: 'Servidor de mídia que recebe streams RTSP das câmeras e converte para HLS, permitindo a visualização no navegador em tempo real.',
                                tech: 'MediaMTX • RTSP → HLS • WebRTC'
                            },
                        ].map((svc, i) => (
                            <div key={i} style={{
                                background: 'var(--color-bg-input)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1rem 1.25rem',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <div style={{
                                        width: '1.75rem', height: '1.75rem', borderRadius: 'var(--radius-sm)',
                                        background: `${svc.color}20`, display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', color: svc.color, flexShrink: 0,
                                    }}>
                                        {svc.icon}
                                    </div>
                                    <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{svc.name}</strong>
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '0.5rem' }}>
                                    {svc.desc}
                                </p>
                                <code style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-card)', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>
                                    {svc.tech}
                                </code>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{
                    background: 'rgba(59,130,246,0.05)',
                    border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: '1.7',
                }}>
                    <strong style={{ color: 'var(--color-accent)' }}>💡 Fluxo de dados:</strong><br />
                    Câmera IP → (RTSP) → MediaMTX → (HLS) → Frontend (navegador)<br />
                    Câmera IP → (RTSP) → Backend (FFmpeg) → Gravação em disco + Banco de dados<br />
                    Gravação → Backend (OpenCV/dlib) → Reconhecimento Facial → Banco de dados
                </div>
            </>
        ),
    },
    {
        id: 'banco-dados',
        icon: <Database size={18} />,
        title: 'Banco de Dados',
        content: () => (
            <>
                <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    O sistema utiliza PostgreSQL com as seguintes tabelas principais:
                </p>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{
                        width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem',
                    }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Tabela</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Descrição</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Campos Principais</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { name: 'cameras', desc: 'Câmeras IP cadastradas', fields: 'id, nome, rtsp_url, habilitada, continuos, hr_ini, hr_fim, recursos' },
                                { name: 'gravacoes', desc: 'Gravações de vídeo', fields: 'id, id_camera, caminho_arquivo, data_inicio, data_fim, tamanho_bytes, face_analyzed' },
                                { name: 'gravacoes_lixeira', desc: 'Gravações excluídas (lixeira)', fields: 'id, id_camera, caminho_arquivo, dt_exclusao' },
                                { name: 'pessoas', desc: 'Pessoas para reconhecimento facial', fields: 'id_pessoa, no_pessoa, ao_tipo (S/C/A/V)' },
                                { name: 'reconhecimentos', desc: 'Registros de reconhecimento facial', fields: 'id, id_pessoa, id_camera, id_gravacao, dt_registro' },
                                { name: 'grupos', desc: 'Grupos para organizar câmeras', fields: 'id_grupo, no_grupo' },
                                { name: 'grupo_cameras', desc: 'Associação grupo ↔ câmera', fields: 'id_grupo, id_camera (chaves compostas)' },
                                { name: 'parametros', desc: 'Configurações do sistema (.env)', fields: 'id, chave, valor, nome, observacoes' },
                                { name: 'usuarios', desc: 'Usuários do sistema', fields: 'id_usuario, no_login, no_senha (SHA-256), no_usuario, tx_funcao' },
                                { name: 'menus', desc: 'Telas/menus do sistema', fields: 'id_menu, no_menu, tx_link' },
                                { name: 'menurec', desc: 'Permissão de menu por usuário', fields: 'id_menurec, id_menu, id_usuario' },
                                { name: 'camerarec', desc: 'Permissão de câmera por usuário', fields: 'id_camerarec, id_camera, id_usuario' },
                            ].map((table, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(30,48,72,0.5)' }}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <code style={{
                                            background: 'rgba(59,130,246,0.1)', color: 'var(--color-accent)',
                                            padding: '0.15rem 0.4rem', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 600,
                                        }}>{table.name}</code>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--color-text-secondary)' }}>{table.desc}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{table.fields}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </>
        ),
    },
    {
        id: 'api-endpoints',
        icon: <Code size={18} />,
        title: 'Endpoints da API',
        content: () => (
            <>
                <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    A API REST está organizada em módulos (routers). Todos os endpoints exigem autenticação via cookie de sessão,
                    exceto o endpoint de login. A base URL é <code style={{ background: 'var(--color-bg-input)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>/api</code>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                        {
                            group: 'Autenticação (/api/auth)',
                            endpoints: [
                                { method: 'POST', path: '/login', desc: 'Login (recebe cookie de sessão)' },
                                { method: 'POST', path: '/logout', desc: 'Logout (remove cookie)' },
                                { method: 'GET', path: '/me', desc: 'Dados do usuário logado + menus' },
                            ]
                        },
                        {
                            group: 'Câmeras (/api/cameras)',
                            endpoints: [
                                { method: 'GET', path: '/', desc: 'Lista câmeras (filtrada por permissão)' },
                                { method: 'POST', path: '/', desc: 'Cria nova câmera' },
                                { method: 'PUT', path: '/{id}', desc: 'Atualiza câmera' },
                                { method: 'DELETE', path: '/{id}', desc: 'Remove câmera' },
                                { method: 'PATCH', path: '/{id}/continuos', desc: 'Alterna flag de gravação contínua' },
                                { method: 'POST', path: '/{id}/probe', desc: 'Detecta recursos via ffprobe' },
                            ]
                        },
                        {
                            group: 'Gravações (/api/gravacoes)',
                            endpoints: [
                                { method: 'GET', path: '/', desc: 'Busca gravações (filtro por câmera e período)' },
                                { method: 'GET', path: '/{id}/stream', desc: 'Stream de vídeo (MP4)' },
                                { method: 'GET', path: '/{id}/download', desc: 'Download do arquivo' },
                                { method: 'DELETE', path: '/{id}', desc: 'Move para lixeira' },
                                { method: 'POST', path: '/{id}/analyze', desc: 'Executa reconhecimento facial' },
                            ]
                        },
                        {
                            group: 'Controle de Gravação',
                            endpoints: [
                                { method: 'POST', path: '/api/recording/start', desc: 'Inicia gravação de todas as câmeras' },
                                { method: 'POST', path: '/api/recording/stop', desc: 'Para gravação de todas as câmeras' },
                                { method: 'POST', path: '/api/recording/continuous/start', desc: 'Ativa modo contínuo global' },
                                { method: 'POST', path: '/api/recording/continuous/stop', desc: 'Ativa modo movimento global' },
                                { method: 'POST', path: '/api/recording/continuous/disable', desc: 'Ativa modo por câmera' },
                            ]
                        },
                        {
                            group: 'Pessoas e Rec. Facial (/api/pessoas)',
                            endpoints: [
                                { method: 'GET/POST', path: '/', desc: 'Lista/cria pessoas' },
                                { method: 'POST', path: '/{id}/faces', desc: 'Upload de foto facial' },
                                { method: 'GET', path: '/{id}/reconhecimentos', desc: 'Histórico de reconhecimentos' },
                            ]
                        },
                        {
                            group: 'Grupos, Parâmetros e Usuários',
                            endpoints: [
                                { method: 'CRUD', path: '/api/grupos/', desc: 'Gerenciamento de grupos de câmeras' },
                                { method: 'CRUD', path: '/api/parametros/', desc: 'Configurações do sistema' },
                                { method: 'CRUD', path: '/api/usuarios/', desc: 'Gerenciamento de usuários e permissões' },
                            ]
                        },
                    ].map((group, i) => (
                        <div key={i} style={{
                            background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '0.625rem 1rem', fontWeight: 600, fontSize: '0.8125rem',
                                borderBottom: '1px solid var(--color-border)',
                                background: 'var(--color-bg-card)',
                                color: 'var(--color-text-primary)',
                            }}>
                                {group.group}
                            </div>
                            {group.endpoints.map((ep, j) => (
                                <div key={j} style={{
                                    padding: '0.5rem 1rem', borderBottom: j < group.endpoints.length - 1 ? '1px solid rgba(30,48,72,0.3)' : 'none',
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem',
                                }}>
                                    <code style={{
                                        background: ep.method === 'GET' ? 'rgba(16,185,129,0.15)' :
                                            ep.method === 'POST' ? 'rgba(59,130,246,0.15)' :
                                                ep.method === 'PUT' || ep.method === 'PATCH' ? 'rgba(245,158,11,0.15)' :
                                                    ep.method === 'DELETE' ? 'rgba(239,68,68,0.15)' :
                                                        'rgba(139,92,246,0.15)',
                                        color: ep.method === 'GET' ? 'var(--color-success)' :
                                            ep.method === 'POST' ? 'var(--color-accent)' :
                                                ep.method === 'PUT' || ep.method === 'PATCH' ? 'var(--color-warning)' :
                                                    ep.method === 'DELETE' ? 'var(--color-danger)' :
                                                        '#8b5cf6',
                                        padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.65rem',
                                        fontWeight: 700, minWidth: '52px', textAlign: 'center',
                                    }}>
                                        {ep.method}
                                    </code>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{ep.path}</code>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: 'auto' }}>{ep.desc}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </>
        ),
    },
    {
        id: 'gravacao',
        icon: <Video size={18} />,
        title: 'Sistema de Gravação',
        content: () => (
            <>
                <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    O sistema de gravação é gerenciado por threads independentes (uma por câmera) que operam em dois modos:
                </p>
                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[
                        {
                            title: '🎯 Gravação por Movimento',
                            desc: 'O sistema lê frames a baixa resolução (160×120, 2 FPS) via FFmpeg para detectar movimento. Quando pixels mudam acima do limiar configurado, inicia a gravação em codec copy (sem re-encoding) economizando CPU. Continua gravando por 15 segundos após o último movimento detectado.',
                            params: 'MOTION_THRESHOLD_PCT • MOTION_PIXEL_THRESHOLD • MOTION_BLUR_KERNEL',
                        },
                        {
                            title: '📹 Gravação Contínua',
                            desc: 'Grava ininterruptamente em segmentos de duração configurável (padrão: 5 minutos). Não utiliza detecção de movimento. Ideal para áreas que exigem monitoramento total.',
                            params: 'SEGMENT_DURATION_SECONDS',
                        },
                        {
                            title: '⏰ Gravação por Horário',
                            desc: 'Cada câmera pode ter horário de início (hr_ini) e fim (hr_fim) configurados. Dentro desse intervalo, a câmera grava continuamente independente do modo global. Suporta intervalos que cruzam meia-noite (ex: 22h–06h).',
                            params: 'hr_ini • hr_fim (por câmera)',
                        },
                    ].map((mode, i) => (
                        <div key={i} style={{
                            background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem 1.25rem',
                        }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>{mode.title}</h4>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '0.5rem' }}>{mode.desc}</p>
                            <code style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-card)', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>{mode.params}</code>
                        </div>
                    ))}
                </div>
                <div style={{
                    background: 'rgba(245,158,11,0.05)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: '1.7',
                }}>
                    <strong style={{ color: 'var(--color-warning)' }}>⚠️ Prioridades de gravação:</strong><br />
                    1. Horário agendado (hr_ini/hr_fim) → prioridade máxima<br />
                    2. Modo global "true" → todas gravam contínuo<br />
                    3. Modo global "false" → todas gravam por movimento<br />
                    4. Modo global "disable" → cada câmera usa seu flag individual
                </div>
            </>
        ),
    },
    {
        id: 'reconhecimento-facial',
        icon: <ScanFace size={18} />,
        title: 'Reconhecimento Facial',
        content: () => (
            <>
                <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    O sistema utiliza a biblioteca <strong>dlib</strong> com modelos de deep learning para reconhecimento facial em 3 etapas:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[
                        { step: '1', title: 'Detecção', desc: 'Localiza rostos nos frames usando o detector HOG do dlib ou o CNN face detector. Identifica a posição e bounding box de cada rosto.' },
                        { step: '2', title: 'Encoding', desc: 'Para cada rosto detectado, calcula um vetor de 128 dimensões (face encoding) que representa as características faciais únicas usando o modelo de rede neural ResNet.' },
                        { step: '3', title: 'Comparação', desc: 'Compara o encoding do rosto detectado com os encodings das pessoas cadastradas. Se a distância euclidiana for menor que o limiar, identifica a pessoa.' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: '1rem', alignItems: 'flex-start',
                            background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem 1.25rem',
                        }}>
                            <div style={{
                                width: '2rem', height: '2rem', borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '0.875rem', color: 'white', flexShrink: 0,
                            }}>{s.step}</div>
                            <div>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>{s.title}</h4>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{
                    background: 'rgba(16,185,129,0.05)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: '1.7',
                }}>
                    <strong style={{ color: 'var(--color-success)' }}>✅ Dicas para melhor resultado:</strong><br />
                    • Cadastre no mínimo 5 fotos por pessoa (frente, perfis, com e sem óculos)<br />
                    • Varie iluminação e expressões faciais<br />
                    • O processamento é feito em background após cada gravação<br />
                    • Pode ser ativado/desativado em tempo real pelo Dashboard
                </div>
            </>
        ),
    },
    {
        id: 'autenticacao',
        icon: <Lock size={18} />,
        title: 'Autenticação e Permissões',
        content: () => (
            <>
                <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    O sistema implementa autenticação baseada em cookies HTTP com hash SHA-256 e controle de acesso granular:
                </p>
                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[
                        {
                            title: '🔑 Login e Sessão',
                            desc: 'O login recebe login e senha, verifica o hash SHA-256 no banco e, se válido, gera um cookie httpOnly com o token da sessão. Todas as requisições subsequentes incluem esse cookie automaticamente. O interceptor do Axios redireciona para /login se receber um 401.',
                        },
                        {
                            title: '📋 Permissão de Menus',
                            desc: 'Cada usuário tem permissão para acessar telas específicas (tabela menurec). Os menus exibidos no sidebar são dinâmicos baseados nas permissões. Um usuário só pode conceder a outro as permissões que ele próprio já possui.',
                        },
                        {
                            title: '📷 Permissão de Câmeras',
                            desc: 'Cada usuário visualiza apenas as câmeras autorizadas (tabela camerarec). Isso afeta o Dashboard, Playback e todas as consultas que envolvem câmeras. Um admin auto-criado recebe acesso a todos os menus e câmeras.',
                        },
                    ].map((item, i) => (
                        <div key={i} style={{
                            background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem 1.25rem',
                        }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>{item.title}</h4>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </>
        ),
    },
    {
        id: 'configuracao',
        icon: <Settings size={18} />,
        title: 'Variáveis de Configuração',
        content: () => (
            <>
                <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    O sistema é configurado via variáveis de ambiente definidas no arquivo <code style={{ background: 'var(--color-bg-input)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>.env</code>:
                </p>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Variável</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Padrão</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Descrição</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { key: 'DATABASE_URL', val: 'postgresql://cameras:cameras123@db:5432/cameras_db', desc: 'URL de conexão com PostgreSQL' },
                                { key: 'RECORDINGS_PATH', val: '/recordings', desc: 'Caminho dos arquivos de gravação' },
                                { key: 'RETENTION_DAYS', val: '30', desc: 'Dias para reter gravações antes da limpeza automática' },
                                { key: 'SEGMENT_DURATION_SECONDS', val: '300', desc: 'Duração máxima de cada segmento (5 min)' },
                                { key: 'MEDIAMTX_URL', val: 'http://mediamtx:9997', desc: 'URL interna do MediaMTX (API)' },
                                { key: 'MEDIAMTX_HLS_URL', val: 'http://localhost:8888', desc: 'URL pública do HLS para o navegador' },
                                { key: 'RECORDING_ENABLED', val: 'false', desc: 'Habilita gravação automática ao iniciar' },
                                { key: 'FACE_RECOGNITION_ENABLED', val: 'false', desc: 'Habilita reconhecimento facial ao iniciar' },
                                { key: 'CONTINUOUS_RECORDING_ENABLED', val: 'false', desc: 'Modo de gravação: true/false/disable' },
                                { key: 'MOTION_THRESHOLD_PCT', val: '1.5', desc: '% mín. de pixels alterados para detectar movimento' },
                                { key: 'MOTION_PIXEL_THRESHOLD', val: '25', desc: 'Diferença mínima de intensidade por pixel' },
                                { key: 'MOTION_BLUR_KERNEL', val: '21', desc: 'Tamanho do kernel de blur (anti-ruído)' },
                            ].map((v, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(30,48,72,0.5)' }}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <code style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-success)', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 600 }}>
                                            {v.key}
                                        </code>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{v.val}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--color-text-secondary)' }}>{v.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </>
        ),
    },
    {
        id: 'limpeza',
        icon: <HardDrive size={18} />,
        title: 'Limpeza e Manutenção',
        content: () => (
            <>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {[
                        {
                            title: '🗑️ Limpeza Automática',
                            desc: 'Um job agendado (APScheduler) executa diariamente às 03:00h. Remove gravações e arquivos mais antigos que RETENTION_DAYS do banco e do disco. Isso evita que o espaço em disco se esgote.',
                        },
                        {
                            title: '♻️ Lixeira de Gravações',
                            desc: 'Ao excluir uma gravação, ela é movida para a tabela gravacoes_lixeira em vez de ser excluída permanentemente. O arquivo no disco é mantido. O usuário pode restaurar gravações da lixeira ou excluí-las permanentemente (liberando espaço em disco).',
                        },
                        {
                            title: '🔄 Sincronização com MediaMTX',
                            desc: 'Ao iniciar o backend, todas as câmeras habilitadas são sincronizadas com o MediaMTX, criando as rotas de streaming necessárias para cada câmera (RTSP → HLS).',
                        },
                        {
                            title: '🗃️ Auto-Migration',
                            desc: 'O sistema executa migrações automáticas ao iniciar: cria tabelas se não existirem, adiciona colunas novas e cria o usuário admin padrão com senha "admin" e permissões totais.',
                        },
                    ].map((item, i) => (
                        <div key={i} style={{
                            background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem 1.25rem',
                        }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>{item.title}</h4>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </>
        ),
    },
    {
        id: 'versoes',
        icon: <Zap size={18} />,
        title: 'Stack Tecnológica',
        content: () => (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {[
                        { category: 'Frontend', items: ['React 18', 'Vite', 'React Router', 'Axios', 'Lucide Icons', 'HLS.js', 'TailwindCSS'] },
                        { category: 'Backend', items: ['Python 3.11', 'FastAPI', 'SQLAlchemy', 'Pydantic', 'APScheduler', 'uvicorn'] },
                        { category: 'IA / Visão', items: ['OpenCV', 'NumPy', 'dlib', 'face_recognition', 'FFmpeg / ffprobe'] },
                        { category: 'Infra', items: ['Docker / Docker Compose', 'Nginx', 'PostgreSQL 15', 'MediaMTX', 'RTSP / HLS'] },
                    ].map((cat, i) => (
                        <div key={i} style={{
                            background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '0.625rem 1rem', fontWeight: 600, fontSize: '0.8125rem',
                                borderBottom: '1px solid var(--color-border)',
                                background: 'var(--color-bg-card)', color: 'var(--color-accent)',
                            }}>{cat.category}</div>
                            <div style={{ padding: '0.5rem 1rem' }}>
                                {cat.items.map((item, j) => (
                                    <div key={j} style={{
                                        padding: '0.3rem 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)',
                                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                                    }}>
                                        <span style={{ color: 'var(--color-success)', fontSize: '0.5rem' }}>●</span>
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </>
        ),
    },
]

export default function Sobre() {
    const [expanded, setExpanded] = useState(SECTIONS.map(s => s.id))

    const toggleSection = (id) => {
        setExpanded(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Info size={28} /> Sobre o Sistema
                    </h1>
                    <p className="page-subtitle">Documentação técnica completa do Câmeras Arcos</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))',
                        border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.5rem 1rem',
                    }}>
                        <Activity size={16} style={{ color: 'var(--color-accent)' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            Câmeras Arcos v1.0.0
                        </span>
                    </div>
                </div>
            </div>

            {/* Table of Contents */}
            <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
                <div style={{
                    padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    fontWeight: 600, fontSize: '0.875rem',
                }}>
                    <Layers size={16} style={{ color: 'var(--color-accent)' }} />
                    Índice
                </div>
                <div style={{
                    padding: '0.75rem 1.25rem',
                    display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
                }}>
                    {SECTIONS.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => {
                                if (!expanded.includes(section.id)) {
                                    setExpanded(prev => [...prev, section.id])
                                }
                                document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }}
                            style={{
                                background: 'var(--color-bg-input)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.375rem 0.75rem',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.375rem',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-accent)'
                                e.currentTarget.style.color = 'var(--color-accent)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-border)'
                                e.currentTarget.style.color = 'var(--color-text-secondary)'
                            }}
                        >
                            {section.icon}
                            {section.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sections */}
            {SECTIONS.map((section) => {
                const isOpen = expanded.includes(section.id)
                return (
                    <div
                        key={section.id}
                        id={`section-${section.id}`}
                        className="card"
                        style={{
                            marginBottom: '1rem',
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        <div
                            onClick={() => toggleSection(section.id)}
                            style={{
                                padding: '1rem 1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                cursor: 'pointer',
                                borderBottom: isOpen ? '1px solid var(--color-border)' : 'none',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-card-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{
                                width: '2rem', height: '2rem',
                                borderRadius: 'var(--radius-sm)',
                                background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--color-accent)', flexShrink: 0,
                            }}>
                                {section.icon}
                            </div>
                            <h2 style={{
                                flex: 1, fontSize: '1rem', fontWeight: 600,
                                color: 'var(--color-text-primary)', margin: 0,
                            }}>
                                {section.title}
                            </h2>
                            {isOpen
                                ? <ChevronDown size={18} style={{ color: 'var(--color-text-muted)', transition: 'transform 0.2s' }} />
                                : <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', transition: 'transform 0.2s' }} />
                            }
                        </div>
                        {isOpen && (
                            <div style={{
                                padding: '1.25rem',
                                animation: 'modal-in 0.2s ease-out',
                            }}>
                                {section.content()}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                                    <button
                                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.375rem',
                                            background: 'var(--color-bg-input)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '0.375rem 0.75rem',
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--color-accent)'
                                            e.currentTarget.style.color = 'var(--color-accent)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--color-border)'
                                            e.currentTarget.style.color = 'var(--color-text-muted)'
                                        }}
                                    >
                                        <ArrowUp size={13} />
                                        Voltar ao topo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Footer */}
            <div style={{
                textAlign: 'center',
                padding: '2rem 0',
                color: 'var(--color-text-muted)',
                fontSize: '0.75rem',
            }}>
                <p>Câmeras Arcos — Sistema de Monitoramento de Câmeras IP</p>
                <p style={{ marginTop: '0.25rem' }}>Documentação gerada automaticamente • Versão 1.0.0</p>
            </div>
        </div>
    )
}
