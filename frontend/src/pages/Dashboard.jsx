import { useState, useEffect, useMemo, useRef } from 'react'
import {
    Video, RefreshCw, Wifi, WifiOff, Circle, Square,
    Camera, ChevronLeft, ChevronRight, Grid3X3, FolderOpen,
    ArrowLeftRight, X, ScanFace, ChevronDown, Check
} from 'lucide-react'
import HlsPlayer from '../components/HlsPlayer'
import HelpButton from '../components/HelpButton'
import {
    getCameras, getStreams, getRecordingStatus, startRecording, stopRecording,
    getContinuousRecordingStatus, startContinuousRecording, stopContinuousRecording,
    disableContinuousRecording,
    getGrupos, getFaceRecognitionStatus, startFaceRecognition, stopFaceRecognition
} from '../api/client'

const PER_PAGE_OPTIONS = [1, 2, 4, 6, 8, 9, 12, 16]

export default function Dashboard() {
    const [allCameras, setAllCameras] = useState([])
    const [streams, setStreams] = useState([])
    const [grupos, setGrupos] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [recActive, setRecActive] = useState(false)
    const [recLoading, setRecLoading] = useState(false)
    const [frActive, setFrActive] = useState(false)
    const [frLoading, setFrLoading] = useState(false)
    const [contMode, setContMode] = useState('false')   // "true" | "false" | "disable"
    const [contLoading, setContLoading] = useState(false)

    // View controls
    const [selectedCameraIds, setSelectedCameraIds] = useState(new Set())
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false)
    const groupDropdownRef = useRef(null)
    const [perPage, setPerPage] = useState(4)
    const [currentPage, setCurrentPage] = useState(1)
    const [swapTarget, setSwapTarget] = useState(null)
    const [cameraOverrides, setCameraOverrides] = useState({})
    const [refreshKeys, setRefreshKeys] = useState({})

    // ---- Load data ----
    const fetchData = async () => {
        try {
            setLoading(true)
            setError(null)
            const [camerasRes, streamsRes, gruposRes] = await Promise.all([
                getCameras(),
                getStreams(),
                getGrupos(),
            ])
            setAllCameras(camerasRes.data.filter(c => c.habilitada))
            setStreams(streamsRes.data)
            setGrupos(gruposRes.data)
        } catch (err) {
            setError('Erro ao carregar streams. Verifique se o backend está disponível.')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchRecStatus = async () => {
        try {
            const { data } = await getRecordingStatus()
            setRecActive(data.active)
        } catch (err) {
            console.error('Erro ao verificar status da gravação:', err)
        }
    }

    const fetchFrStatus = async () => {
        try {
            const { data } = await getFaceRecognitionStatus()
            setFrActive(data.active)
        } catch (err) {
            console.error('Erro ao verificar status do reconhecimento facial:', err)
        }
    }

    const fetchContStatus = async () => {
        try {
            const { data } = await getContinuousRecordingStatus()
            setContMode(data.mode || 'false')
        } catch (err) {
            console.error('Erro ao verificar status da gravação contínua:', err)
        }
    }

    const toggleRecording = async () => {
        setRecLoading(true)
        try {
            if (recActive) {
                await stopRecording()
                setRecActive(false)
            } else {
                await startRecording()
                setRecActive(true)
            }
        } catch (err) {
            console.error('Erro ao alterar gravação:', err)
        } finally {
            setRecLoading(false)
        }
    }

    const toggleFaceRecognition = async () => {
        setFrLoading(true)
        try {
            if (frActive) {
                await stopFaceRecognition()
                setFrActive(false)
            } else {
                await startFaceRecognition()
                setFrActive(true)
            }
        } catch (err) {
            console.error('Erro ao alterar reconhecimento facial:', err)
        } finally {
            setFrLoading(false)
        }
    }

    const cycleContinuousRecording = async () => {
        setContLoading(true)
        try {
            // Ciclo: true -> false -> disable -> true
            if (contMode === 'true') {
                await stopContinuousRecording()
                setContMode('false')
            } else if (contMode === 'false') {
                await disableContinuousRecording()
                setContMode('disable')
            } else {
                await startContinuousRecording()
                setContMode('true')
            }
        } catch (err) {
            console.error('Erro ao alterar gravação contínua:', err)
        } finally {
            setContLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        fetchRecStatus()
        fetchFrStatus()
        fetchContStatus()
    }, [])

    // ---- Close dropdown on outside click ----
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target)) {
                setGroupDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // ---- Virtual group: all enabled cameras sorted by name ----
    const virtualGroupCameras = useMemo(() => {
        return [...allCameras].sort((a, b) => a.nome.localeCompare(b.nome))
    }, [allCameras])

    // ---- Filtered cameras by multi-selection ----
    const filteredCameras = useMemo(() => {
        if (selectedCameraIds.size === 0) return allCameras
        return allCameras.filter(cam => selectedCameraIds.has(cam.id))
    }, [allCameras, selectedCameraIds])

    // ---- Pagination ----
    const totalPages = Math.max(1, Math.ceil(filteredCameras.length / perPage))

    useEffect(() => {
        setCurrentPage(1)
        setCameraOverrides({})
    }, [selectedCameraIds, perPage])

    // ---- Multi-select helpers ----
    const toggleCamera = (camId) => {
        setSelectedCameraIds(prev => {
            const next = new Set(prev)
            if (next.has(camId)) {
                next.delete(camId)
            } else {
                next.add(camId)
            }
            return next
        })
    }

    const toggleGroup = (groupCameras) => {
        const enabledIds = groupCameras.filter(c => c.habilitada !== false).map(c => c.id)
        setSelectedCameraIds(prev => {
            const next = new Set(prev)
            const allSelected = enabledIds.every(id => next.has(id))
            if (allSelected) {
                enabledIds.forEach(id => next.delete(id))
            } else {
                enabledIds.forEach(id => next.add(id))
            }
            return next
        })
    }

    const toggleAllCameras = () => {
        setSelectedCameraIds(prev => {
            const allIds = virtualGroupCameras.map(c => c.id)
            const allSelected = allIds.every(id => prev.has(id))
            if (allSelected) {
                return new Set() // desmarcar tudo = mostra todas
            } else {
                return new Set(allIds)
            }
        })
    }

    const clearSelection = () => {
        setSelectedCameraIds(new Set())
        setGroupDropdownOpen(false)
    }

    const getSelectionLabel = () => {
        if (selectedCameraIds.size === 0) return 'Todas as câmeras'
        if (selectedCameraIds.size === 1) {
            const cam = allCameras.find(c => c.id === [...selectedCameraIds][0])
            return cam ? cam.nome : '1 câmera'
        }
        return `${selectedCameraIds.size} câmeras selecionadas`
    }

    // ---- Display cameras with swap overrides ----
    const displayCameras = useMemo(() => {
        const startIdx = (currentPage - 1) * perPage
        const pageSlice = filteredCameras.slice(startIdx, startIdx + perPage)

        return pageSlice.map((cam, idx) => {
            const globalIdx = startIdx + idx
            if (cameraOverrides[globalIdx] !== undefined) {
                const overrideCam = allCameras.find(c => c.id === cameraOverrides[globalIdx])
                if (overrideCam) return overrideCam
            }
            return cam
        })
    }, [filteredCameras, currentPage, perPage, cameraOverrides, allCameras])

    // ---- Stream helper ----
    const getStreamForCamera = (cameraId) => {
        const s = streams.find(st => st.camera_id === cameraId)
        return s ? s.hls_url : null
    }

    // ---- Swap candidates: same group(s) ----
    const getSwapCandidates = (cameraId) => {
        const parentGroups = grupos.filter(g =>
            g.cameras.some(c => c.id === cameraId)
        )

        if (parentGroups.length === 0) {
            return allCameras.filter(c => c.id !== cameraId)
        }

        const candidateIds = new Set()
        parentGroups.forEach(g => {
            g.cameras.forEach(c => candidateIds.add(c.id))
        })
        candidateIds.delete(cameraId)

        return allCameras.filter(c => candidateIds.has(c.id))
    }

    const handleSwap = (slotIndex, newCameraId) => {
        setCameraOverrides(prev => ({ ...prev, [slotIndex]: newCameraId }))
        setSwapTarget(null)
    }

    // ---- Grid columns ----
    const getGridCols = () => {
        if (perPage === 1) return 1
        if (perPage <= 2) return 2
        if (perPage <= 4) return 2
        if (perPage <= 6) return 3
        if (perPage <= 9) return 3
        return 4
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div>
                        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Video size={28} /> Dashboard
                        </h1>
                        <p className="page-subtitle">Visualização ao vivo das câmeras</p>
                    </div>
                    <HelpButton
                        title="Ajuda — Dashboard"
                        sections={[
                            { icon: '📹', subtitle: 'O que é esta tela?', content: 'O Dashboard é a tela principal do sistema. Aqui você visualiza em tempo real o que cada câmera está transmitindo. As imagens são atualizadas ao vivo via streaming HLS (HTTP Live Streaming).' },
                            { icon: '🔴', subtitle: 'Botão Iniciar/Parar REC', content: 'Inicia ou para o monitoramento de todas as câmeras habilitadas. Quando ativo, o sistema detecta movimento (ou grava continuamente conforme o modo) e salva os vídeos automaticamente no servidor.' },
                            { icon: '📹', subtitle: 'Modo de Gravação (Contínuo / Movimento / Por Câmera)', content: 'Alterna entre 3 modos de gravação:\n• Contínuo: grava ininterruptamente em segmentos\n• Movimento: grava apenas quando há movimento detectado\n• Por Câmera: cada câmera usa sua configuração individual de gravação contínua' },
                            { icon: '🧑', subtitle: 'Reconhecimento Facial (ON/OFF)', content: 'Quando ativado, o sistema analisa cada gravação finalizada utilizando inteligência artificial (dlib/OpenCV) para identificar rostos. Se encontrar uma pessoa cadastrada, registra o reconhecimento automaticamente.' },
                            { icon: '📂', subtitle: 'Filtro por Grupo/Câmeras', content: 'Use o seletor de grupos para filtrar quais câmeras exibir. Você pode selecionar um grupo inteiro ou câmeras individuais. A opção "Todas as Câmeras" mostra todas as câmeras disponíveis para seu usuário.' },
                            { icon: '🔄', subtitle: 'Troca de Câmeras (Swap)', content: 'Clique no ícone de setas em uma câmera para trocar sua posição com outra. Isso permite reorganizar a visualização sem alterar as configurações.' },
                            { icon: '⚙️', subtitle: 'O que acontece no backend?', content: 'O backend FastAPI gerencia threads de gravação para cada câmera (uma thread por câmera). O streaming ao vivo passa pelo MediaMTX, que converte o sinal RTSP da câmera para HLS acessível pelo navegador. As gravações são feitas com FFmpeg usando codec copy (sem re-encoding) para economizar CPU.' },
                        ]}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        className={`btn ${frActive ? 'btn-secondary' : 'btn-success'}`}
                        onClick={toggleFaceRecognition}
                        disabled={frLoading}
                        id="btn-toggle-face-recognition"
                        title={frActive ? 'Desativar reconhecimento facial' : 'Ativar reconhecimento facial'}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                    >
                        <ScanFace size={14} />
                        {frLoading ? '...' : frActive ? 'Facial ON' : 'Facial OFF'}
                    </button>
                    <button
                        className={`btn ${contMode === 'true' ? 'btn-primary' : contMode === 'disable' ? 'btn-warning' : 'btn-secondary'}`}
                        onClick={cycleContinuousRecording}
                        disabled={contLoading}
                        id="btn-toggle-continuous-recording"
                        title={
                            contMode === 'true' ? 'Contínuo → clique para Movimento'
                                : contMode === 'false' ? 'Movimento → clique para Por Câmera'
                                    : 'Por Câmera → clique para Contínuo'
                        }
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                    >
                        {contMode === 'true' ? <Video size={14} /> : <Camera size={14} />}
                        {contLoading ? '...' : contMode === 'true' ? 'Contínuo' : contMode === 'disable' ? 'Por Câmera' : 'Movimento'}
                    </button>
                    <button
                        className={`btn ${recActive ? 'btn-danger' : 'btn-success'}`}
                        onClick={toggleRecording}
                        disabled={recLoading}
                        id="btn-toggle-recording"
                        title={recActive ? 'Parar gravação' : 'Iniciar gravação'}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                    >
                        {recActive ? <Square size={14} /> : <Circle size={14} />}
                        {recLoading ? '...' : recActive ? 'Parar REC' : 'Iniciar REC'}
                    </button>
                    <button className="btn btn-secondary" onClick={fetchData} id="btn-refresh-dashboard">
                        <RefreshCw size={16} /> Atualizar
                    </button>
                </div>
            </div>

            {/* ================================================================
                TOOLBAR: Group filter, per-page selector, pagination
                ================================================================ */}
            <div className="card" style={{ marginBottom: '1.25rem', overflow: 'visible', position: 'relative', zIndex: 50 }}>
                <div style={{
                    padding: '1rem 1.25rem',
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem',
                }}>
                    {/* Group multi-select filter */}
                    <div className="form-group" style={{ flex: '1 1 auto', minWidth: '220px', gap: '0.25rem', position: 'relative' }} ref={groupDropdownRef}>
                        <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>
                            <FolderOpen size={11} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: '-1px' }} />
                            Grupo / Câmeras
                        </label>
                        <div
                            onClick={() => setGroupDropdownOpen(prev => !prev)}
                            className="form-select"
                            style={{
                                padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', userSelect: 'none',
                            }}
                            id="filter-grupo"
                        >
                            <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                color: selectedCameraIds.size === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                            }}>
                                {getSelectionLabel()}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                {selectedCameraIds.size > 0 && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '1.1rem', height: '1.1rem', borderRadius: '50%',
                                            background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)',
                                            cursor: 'pointer', fontSize: '0.65rem',
                                        }}
                                        title="Limpar seleção"
                                    >
                                        <X size={10} />
                                    </span>
                                )}
                                <ChevronDown size={14} style={{
                                    transition: 'transform 0.2s ease',
                                    transform: groupDropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                                    color: 'var(--color-text-muted)',
                                }} />
                            </div>
                        </div>

                        {/* Dropdown panel */}
                        {groupDropdownOpen && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                marginTop: '0.25rem', zIndex: 9999,
                                background: 'var(--color-bg-card)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                                maxHeight: '360px', overflow: 'auto',
                            }}>
                                {/* Existing groups */}
                                {grupos.map(g => {
                                    const groupEnabledCams = (g.cameras || []).filter(c => c.habilitada !== false)
                                    const allGroupSelected = groupEnabledCams.length > 0 && groupEnabledCams.every(c => selectedCameraIds.has(c.id))
                                    const someGroupSelected = groupEnabledCams.some(c => selectedCameraIds.has(c.id))
                                    return (
                                        <div key={g.id_grupo}>
                                            {/* Group header */}
                                            <div
                                                onClick={() => toggleGroup(g.cameras || [])}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    padding: '0.6rem 0.75rem',
                                                    cursor: 'pointer',
                                                    background: allGroupSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                                    borderBottom: '1px solid var(--color-border)',
                                                    fontWeight: 600, fontSize: '0.8rem',
                                                    transition: 'background 0.15s ease',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)'}
                                                onMouseLeave={e => e.currentTarget.style.background = allGroupSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent'}
                                            >
                                                <div style={{
                                                    width: '1rem', height: '1rem', borderRadius: '3px',
                                                    border: `2px solid ${allGroupSelected ? 'var(--color-primary)' : someGroupSelected ? 'var(--color-primary)' : 'var(--color-text-muted)'}`,
                                                    background: allGroupSelected ? 'var(--color-primary)' : someGroupSelected ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                    transition: 'all 0.15s ease',
                                                }}>
                                                    {allGroupSelected && <Check size={10} style={{ color: '#fff' }} />}
                                                    {!allGroupSelected && someGroupSelected && <div style={{ width: '6px', height: '2px', background: '#fff', borderRadius: '1px' }} />}
                                                </div>
                                                <FolderOpen size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                                <span style={{ flex: 1 }}>{g.no_grupo}</span>
                                                <span style={{
                                                    fontSize: '0.65rem', color: 'var(--color-text-muted)',
                                                    background: 'rgba(100, 116, 139, 0.1)', borderRadius: '10px',
                                                    padding: '0.1rem 0.4rem',
                                                }}>{groupEnabledCams.length}</span>
                                            </div>
                                            {/* Group's cameras */}
                                            {groupEnabledCams.map(cam => (
                                                <div
                                                    key={`g${g.id_grupo}-c${cam.id}`}
                                                    onClick={() => toggleCamera(cam.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                        padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                                                        cursor: 'pointer',
                                                        background: selectedCameraIds.has(cam.id) ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                                                        borderBottom: '1px solid rgba(148,163,184,0.08)',
                                                        fontSize: '0.78rem',
                                                        transition: 'background 0.12s ease',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = selectedCameraIds.has(cam.id) ? 'rgba(59, 130, 246, 0.06)' : 'transparent'}
                                                >
                                                    <div style={{
                                                        width: '0.85rem', height: '0.85rem', borderRadius: '3px',
                                                        border: `2px solid ${selectedCameraIds.has(cam.id) ? 'var(--color-primary)' : 'var(--color-text-muted)'}`,
                                                        background: selectedCameraIds.has(cam.id) ? 'var(--color-primary)' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0,
                                                        transition: 'all 0.15s ease',
                                                    }}>
                                                        {selectedCameraIds.has(cam.id) && <Check size={9} style={{ color: '#fff' }} />}
                                                    </div>
                                                    <Camera size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cam.nome}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })}

                                {/* Separator if there are groups */}
                                {grupos.length > 0 && (
                                    <div style={{
                                        height: '2px',
                                        background: 'linear-gradient(90deg, transparent, var(--color-border), transparent)',
                                        margin: '0.15rem 0',
                                    }} />
                                )}

                                {/* Virtual group: Todas as Câmeras */}
                                <div>
                                    <div
                                        onClick={toggleAllCameras}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.6rem 0.75rem',
                                            cursor: 'pointer',
                                            background: virtualGroupCameras.length > 0 && virtualGroupCameras.every(c => selectedCameraIds.has(c.id)) ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                            borderBottom: '1px solid var(--color-border)',
                                            fontWeight: 600, fontSize: '0.8rem',
                                            transition: 'background 0.15s ease',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.06)'}
                                        onMouseLeave={e => e.currentTarget.style.background = virtualGroupCameras.length > 0 && virtualGroupCameras.every(c => selectedCameraIds.has(c.id)) ? 'rgba(16, 185, 129, 0.08)' : 'transparent'}
                                    >
                                        <div style={{
                                            width: '1rem', height: '1rem', borderRadius: '3px',
                                            border: `2px solid ${virtualGroupCameras.length > 0 && virtualGroupCameras.every(c => selectedCameraIds.has(c.id)) ? 'var(--color-success)' : virtualGroupCameras.some(c => selectedCameraIds.has(c.id)) ? 'var(--color-success)' : 'var(--color-text-muted)'}`,
                                            background: virtualGroupCameras.length > 0 && virtualGroupCameras.every(c => selectedCameraIds.has(c.id)) ? 'var(--color-success)' : virtualGroupCameras.some(c => selectedCameraIds.has(c.id)) ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                            transition: 'all 0.15s ease',
                                        }}>
                                            {virtualGroupCameras.length > 0 && virtualGroupCameras.every(c => selectedCameraIds.has(c.id)) && <Check size={10} style={{ color: '#fff' }} />}
                                            {virtualGroupCameras.some(c => selectedCameraIds.has(c.id)) && !virtualGroupCameras.every(c => selectedCameraIds.has(c.id)) && <div style={{ width: '6px', height: '2px', background: '#fff', borderRadius: '1px' }} />}
                                        </div>
                                        <Camera size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                                        <span style={{ flex: 1 }}>Todas as Câmeras</span>
                                        <span style={{
                                            fontSize: '0.65rem', color: 'var(--color-text-muted)',
                                            background: 'rgba(100, 116, 139, 0.1)', borderRadius: '10px',
                                            padding: '0.1rem 0.4rem',
                                        }}>{virtualGroupCameras.length}</span>
                                    </div>
                                    {/* All cameras individually sorted by name */}
                                    {virtualGroupCameras.map(cam => (
                                        <div
                                            key={`all-c${cam.id}`}
                                            onClick={() => toggleCamera(cam.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                                                cursor: 'pointer',
                                                background: selectedCameraIds.has(cam.id) ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                                                borderBottom: '1px solid rgba(148,163,184,0.08)',
                                                fontSize: '0.78rem',
                                                transition: 'background 0.12s ease',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'}
                                            onMouseLeave={e => e.currentTarget.style.background = selectedCameraIds.has(cam.id) ? 'rgba(16, 185, 129, 0.06)' : 'transparent'}
                                        >
                                            <div style={{
                                                width: '0.85rem', height: '0.85rem', borderRadius: '3px',
                                                border: `2px solid ${selectedCameraIds.has(cam.id) ? 'var(--color-success)' : 'var(--color-text-muted)'}`,
                                                background: selectedCameraIds.has(cam.id) ? 'var(--color-success)' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'all 0.15s ease',
                                            }}>
                                                {selectedCameraIds.has(cam.id) && <Check size={9} style={{ color: '#fff' }} />}
                                            </div>
                                            <Camera size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cam.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Per-page selector */}
                    <div className="form-group" style={{ flex: '1 1 auto', minWidth: '120px', gap: '0.25rem' }}>
                        <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>
                            <Grid3X3 size={11} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: '-1px' }} />
                            Câmeras por página
                        </label>
                        <select
                            className="form-select"
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value))}
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                            id="filter-per-page"
                        >
                            {PER_PAGE_OPTIONS.map(n => (
                                <option key={n} value={n}>{n} câmera{n > 1 ? 's' : ''}</option>
                            ))}
                        </select>
                    </div>

                    {/* Spacer */}
                    <div style={{ flex: 1 }} />

                    {/* Info + Pagination */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            {filteredCameras.length} câmera{filteredCameras.length !== 1 ? 's' : ''}
                        </span>

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{ padding: '0.375rem' }}
                                    title="Página anterior"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span style={{
                                    fontSize: '0.8125rem', fontWeight: 600,
                                    color: 'var(--color-text-secondary)',
                                    minWidth: '4rem', textAlign: 'center',
                                }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{ padding: '0.375rem' }}
                                    title="Próxima página"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ================================================================
                CAMERA GRID
                ================================================================ */}
            {loading && (
                <div className="empty-state">
                    <div className="spinner" />
                    <p style={{ marginTop: '1rem' }}>Carregando câmeras...</p>
                </div>
            )}

            {error && (
                <div className="empty-state">
                    <WifiOff size={48} />
                    <p style={{ color: 'var(--color-danger)', marginTop: '0.5rem' }}>{error}</p>
                    <button className="btn btn-primary" onClick={fetchData} style={{ marginTop: '1rem' }}>
                        Tentar novamente
                    </button>
                </div>
            )}

            {!loading && !error && filteredCameras.length === 0 && (
                <div className="empty-state">
                    <Camera size={48} />
                    <p style={{ fontSize: '1.125rem', fontWeight: 500, marginTop: '0.5rem' }}>
                        {selectedCameraIds.size > 0 ? 'Nenhuma câmera encontrada na seleção' : 'Nenhuma câmera habilitada'}
                    </p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {selectedCameraIds.size > 0
                            ? 'Altere a seleção no filtro de câmeras.'
                            : 'Cadastre câmeras na seção "Câmeras" para começar.'}
                    </p>
                </div>
            )}

            {!loading && !error && displayCameras.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${perPage <= 2 ? 320 : perPage <= 4 ? 280 : 240}px, 1fr))`,
                    gap: '2px',
                    background: 'var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border)',
                }}>
                    {displayCameras.map((cam, idx) => {
                        const globalIdx = (currentPage - 1) * perPage + idx
                        const hlsUrl = getStreamForCamera(cam.id)
                        const isOverridden = cameraOverrides[globalIdx] !== undefined

                        return (
                            <div key={`${globalIdx}-${cam.id}`} style={{
                                background: 'var(--color-bg-card)',
                                position: 'relative',
                            }}>
                                {/* Stream or placeholder */}
                                {hlsUrl ? (
                                    <HlsPlayer key={`hls-${cam.id}-${refreshKeys[cam.id] || 0}`} src={hlsUrl} />
                                ) : (
                                    <div className="video-container" style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexDirection: 'column', gap: '0.5rem',
                                    }}>
                                        <Camera size={32} style={{ opacity: 0.3 }} />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            Stream indisponível
                                        </span>
                                    </div>
                                )}

                                {/* Camera info bar */}
                                <div style={{
                                    padding: '0.625rem 0.75rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    borderTop: '1px solid var(--color-border)',
                                }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 600, fontSize: '0.8125rem',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {cam.nome}
                                        </div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                                            #{cam.id}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                                        {hlsUrl && (
                                            <span className="badge badge-online" style={{ fontSize: '0.6rem' }}>
                                                <Wifi size={9} /> Live
                                            </span>
                                        )}
                                        {recActive && hlsUrl && (
                                            <span className="badge badge-recording" style={{ fontSize: '0.6rem' }}>
                                                ● REC
                                            </span>
                                        )}
                                        {isOverridden && (
                                            <span className="badge" style={{
                                                fontSize: '0.6rem',
                                                background: 'rgba(245, 158, 11, 0.15)',
                                                color: 'var(--color-warning)',
                                            }}>
                                                Trocada
                                            </span>
                                        )}
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setRefreshKeys(prev => ({ ...prev, [cam.id]: (prev[cam.id] || 0) + 1 }))}
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                            title="Atualizar esta câmera"
                                            id={`btn-refresh-cam-${cam.id}`}
                                        >
                                            <RefreshCw size={12} />
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setSwapTarget({ cam, globalIdx })}
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                            title="Trocar câmera nesta posição"
                                            id={`btn-swap-${cam.id}`}
                                        >
                                            <ArrowLeftRight size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ================================================================
                SWAP CAMERA MODAL
                ================================================================ */}
            {swapTarget && (
                <div className="modal-overlay" onClick={() => setSwapTarget(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ArrowLeftRight size={18} />
                                Trocar Câmera
                            </h3>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSwapTarget(null)}
                                style={{ padding: '0.25rem' }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderBottom: '1px solid var(--color-border)',
                            background: 'rgba(59, 130, 246, 0.05)',
                        }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                Câmera atual: <strong style={{ color: 'var(--color-text-primary)' }}>{swapTarget.cam.nome}</strong>
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                Selecione uma câmera do mesmo grupo para trocar nesta posição.
                            </p>
                        </div>
                        <div style={{ maxHeight: '320px', overflow: 'auto' }}>
                            {(() => {
                                const candidates = getSwapCandidates(swapTarget.cam.id)
                                if (candidates.length === 0) {
                                    return (
                                        <div className="empty-state" style={{ padding: '2rem' }}>
                                            <Camera size={32} />
                                            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                                Nenhuma câmera disponível para troca
                                            </p>
                                            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                                Esta câmera não pertence a nenhum grupo ou não há outras câmeras no mesmo grupo.
                                            </p>
                                        </div>
                                    )
                                }
                                return candidates.map(cam => {
                                    const hasStream = getStreamForCamera(cam.id)
                                    return (
                                        <div
                                            key={cam.id}
                                            onClick={() => handleSwap(swapTarget.globalIdx, cam.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.875rem 1.5rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid var(--color-border)',
                                                transition: 'background 0.15s ease',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{
                                                width: '2rem', height: '2rem',
                                                borderRadius: 'var(--radius-md)',
                                                background: hasStream
                                                    ? 'rgba(16, 185, 129, 0.15)'
                                                    : 'rgba(100, 116, 139, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <Camera size={14} style={{
                                                    color: hasStream ? 'var(--color-success)' : 'var(--color-text-muted)'
                                                }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '0.875rem', fontWeight: 500,
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {cam.nome}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                                    #{cam.id}
                                                </div>
                                            </div>
                                            <span className="badge" style={{
                                                background: hasStream ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                                                color: hasStream ? 'var(--color-success)' : 'var(--color-text-muted)',
                                                fontSize: '0.65rem',
                                            }}>
                                                {hasStream ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    )
                                })
                            })()}
                        </div>
                        <div className="modal-footer">
                            {cameraOverrides[swapTarget.globalIdx] !== undefined && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setCameraOverrides(prev => {
                                            const next = { ...prev }
                                            delete next[swapTarget.globalIdx]
                                            return next
                                        })
                                        setSwapTarget(null)
                                    }}
                                    style={{ marginRight: 'auto' }}
                                >
                                    Restaurar original
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setSwapTarget(null)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
