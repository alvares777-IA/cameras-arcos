import { useState, useEffect, useMemo, useRef } from 'react'
import {
    Search, Play, Clock, HardDrive, Film, Trash2,
    Camera, ChevronLeft, ChevronRight, Grid3X3, FolderOpen,
    ArrowLeftRight, X, Wifi, Radio, ScanFace, CheckCircle2
} from 'lucide-react'
import HlsPlayer from '../components/HlsPlayer'
import {
    getCameras, getGravacoes, getGravacaoStreamUrl, deleteGravacoes,
    deleteGravacao, analyzeGravacao,
    getStreams, getGrupos
} from '../api/client'

const PER_PAGE_OPTIONS = [1, 2, 4, 6, 8, 9, 12, 16]

export default function Playback() {
    // ---- Live view state ----
    const [showLive, setShowLive] = useState(false)
    const [liveLoaded, setLiveLoaded] = useState(false)
    const [allCameras, setAllCameras] = useState([])
    const [streams, setStreams] = useState([])
    const [grupos, setGrupos] = useState([])
    const [loading, setLoading] = useState(true)
    const [liveLoading, setLiveLoading] = useState(false)
    const [selectedGrupo, setSelectedGrupo] = useState('')
    const [perPage, setPerPage] = useState(4)
    const [currentPage, setCurrentPage] = useState(1)
    const [swapTarget, setSwapTarget] = useState(null) // camera being swapped
    const [cameraOverrides, setCameraOverrides] = useState({}) // slot index -> camera id

    // ---- Playback search state ----
    const [gravacoes, setGravacoes] = useState([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [selectedVideo, setSelectedVideo] = useState(null)
    const [searchCameraId, setSearchCameraId] = useState('')
    const [dataInicio, setDataInicio] = useState('')
    const [dataFim, setDataFim] = useState('')
    const [toast, setToast] = useState(null)
    const [analyzingId, setAnalyzingId] = useState(null)
    const [deletingId, setDeletingId] = useState(null)
    const videoPlayerRef = useRef(null)

    // ---- Load initial data (cameras + groups, but NOT streams) ----
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)
                const [camerasRes, gruposRes] = await Promise.all([
                    getCameras(),
                    getGrupos(),
                ])
                setAllCameras(camerasRes.data.filter(c => c.habilitada))
                setGrupos(gruposRes.data)
            } catch (err) {
                console.error('Erro ao carregar dados:', err)
            } finally {
                setLoading(false)
            }
        }
        loadData()

        // Set default dates
        const today = new Date()
        const start = new Date(today); start.setHours(0, 0, 0, 0)
        const end = new Date(today); end.setHours(23, 59, 59, 999)
        setDataInicio(fmt(start))
        setDataFim(fmt(end))
    }, [])

    // ---- Activate live view on demand ----
    const toggleLive = async () => {
        if (showLive) {
            setShowLive(false)
            return
        }
        setShowLive(true)
        if (!liveLoaded) {
            setLiveLoading(true)
            try {
                const { data } = await getStreams()
                setStreams(data)
                setLiveLoaded(true)
            } catch (err) {
                console.error('Erro ao carregar streams:', err)
            } finally {
                setLiveLoading(false)
            }
        }
    }

    // ---- Filtered cameras based on group selection ----
    const filteredCameras = useMemo(() => {
        if (!selectedGrupo) return allCameras
        const grupo = grupos.find(g => g.id_grupo === Number(selectedGrupo))
        if (!grupo) return allCameras
        const groupCamIds = new Set(grupo.cameras.map(c => c.id))
        return allCameras.filter(cam => groupCamIds.has(cam.id))
    }, [allCameras, selectedGrupo, grupos])

    // ---- Pagination ----
    const totalPages = Math.max(1, Math.ceil(filteredCameras.length / perPage))

    // Reset to page 1 when filter/perPage changes
    useEffect(() => {
        setCurrentPage(1)
        setCameraOverrides({})
    }, [selectedGrupo, perPage])

    // Cameras to display on current page (with swap overrides)
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

    // Get stream URL for a given camera id
    const getStreamForCamera = (cameraId) => {
        const s = streams.find(st => st.camera_id === cameraId)
        return s ? s.hls_url : null
    }

    // ---- Camera groups for swap (all groups the camera belongs to) ----
    const getSwapCandidates = (cameraId) => {
        // Find groups that contain this camera
        const parentGroups = grupos.filter(g =>
            g.cameras.some(c => c.id === cameraId)
        )

        if (parentGroups.length === 0) {
            // If camera has no group, show all cameras as swap candidates
            return allCameras.filter(c => c.id !== cameraId)
        }

        // Gather all cameras from those groups
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

    // ---- Grid columns based on perPage ----
    const getGridCols = () => {
        if (perPage === 1) return 1
        if (perPage <= 2) return 2
        if (perPage <= 4) return 2
        if (perPage <= 6) return 3
        if (perPage <= 9) return 3
        return 4
    }

    // ---- Playback search helpers ----
    const fmt = (d) => {
        const p = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
    }

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }

    const buildParams = () => {
        const params = {}
        if (searchCameraId) params.camera_id = searchCameraId
        if (dataInicio) params.data_inicio = dataInicio
        if (dataFim) params.data_fim = dataFim
        return params
    }

    const handleSearch = async () => {
        try {
            setSearchLoading(true); setSelectedVideo(null)
            const { data } = await getGravacoes(buildParams())
            setGravacoes(data)
        } catch (err) { console.error('Erro ao buscar gravações:', err) }
        finally { setSearchLoading(false) }
    }

    const handleDelete = async () => {
        if (gravacoes.length === 0) {
            showToast('Consulte as gravações primeiro', 'error')
            return
        }
        const msg = `Deseja excluir ${gravacoes.length} gravação(ões) do período selecionado?\n\nEssa ação não pode ser desfeita.`
        if (!window.confirm(msg)) return

        setDeleting(true)
        try {
            const { data } = await deleteGravacoes(buildParams())
            showToast(`${data.deletadas} gravações removidas (${formatSize(data.bytes_liberados)} liberados)`)
            setGravacoes([])
            setSelectedVideo(null)
        } catch (err) {
            console.error('Erro ao deletar:', err)
            showToast('Erro ao deletar gravações', 'error')
        } finally {
            setDeleting(false)
        }
    }

    const handleAnalyze = async (gravacao) => {
        setAnalyzingId(gravacao.id)
        try {
            await analyzeGravacao(gravacao.id)
            showToast(`Reconhecimento facial iniciado para ${getCameraName(gravacao.id_camera)}`)
            // Atualiza o flag localmente
            setGravacoes(prev => prev.map(g =>
                g.id === gravacao.id ? { ...g, face_analyzed: true } : g
            ))
        } catch (err) {
            console.error('Erro ao analisar:', err)
            showToast('Erro ao iniciar reconhecimento facial', 'error')
        } finally {
            setAnalyzingId(null)
        }
    }

    const handleDeleteSingle = async (gravacao) => {
        const msg = `Excluir gravação de ${getCameraName(gravacao.id_camera)}?\n${formatDate(gravacao.data_inicio)} — ${formatSize(gravacao.tamanho_bytes)}\n\nEssa ação não pode ser desfeita.`
        if (!window.confirm(msg)) return

        setDeletingId(gravacao.id)
        try {
            const { data } = await deleteGravacao(gravacao.id)
            showToast(`Gravação excluída (${formatSize(data.bytes_liberados)} liberados)`)
            setGravacoes(prev => prev.filter(g => g.id !== gravacao.id))
            if (selectedVideo?.id === gravacao.id) setSelectedVideo(null)
        } catch (err) {
            console.error('Erro ao excluir:', err)
            showToast('Erro ao excluir gravação', 'error')
        } finally {
            setDeletingId(null)
        }
    }

    const formatDate = (str) => new Date(str).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    })

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
        return `${(bytes / 1073741824).toFixed(2)} GB`
    }

    const getDuration = (ini, fim) => {
        const d = (new Date(fim) - new Date(ini)) / 1000
        return `${Math.floor(d / 60)}m ${Math.floor(d % 60)}s`
    }

    const getCameraName = (id) => {
        const cam = allCameras.find((c) => c.id === id)
        return cam ? cam.nome : `Câmera #${id}`
    }

    const totalSize = gravacoes.reduce((sum, g) => sum + (g.tamanho_bytes || 0), 0)

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Film size={28} /> Playback
                    </h1>
                    <p className="page-subtitle">Consulte gravações e visualize câmeras ao vivo</p>
                </div>
                <button
                    className={`btn ${showLive ? 'btn-danger' : 'btn-success'}`}
                    onClick={toggleLive}
                    id="btn-toggle-live"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                    <Radio size={16} />
                    {showLive ? 'Fechar Ao Vivo' : 'Ao Vivo'}
                </button>
            </div>

            {/* ================================================================
                SECTION 1: LIVE CAMERAS GRID (only when toggled)
                ================================================================ */}
            {showLive && <div className="card" style={{ marginBottom: '2rem', overflow: 'visible' }}>
                {/* Toolbar */}
                <div style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem',
                }}>
                    {/* Group filter */}
                    <div className="form-group" style={{ flex: '0 0 auto', minWidth: '200px', gap: '0.25rem' }}>
                        <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>
                            <FolderOpen size={11} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: '-1px' }} />
                            Grupo
                        </label>
                        <select
                            className="form-select"
                            value={selectedGrupo}
                            onChange={(e) => setSelectedGrupo(e.target.value)}
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                            id="filter-grupo"
                        >
                            <option value="">Todas as câmeras</option>
                            {grupos.map(g => (
                                <option key={g.id_grupo} value={g.id_grupo}>
                                    {g.no_grupo} ({g.total_cameras})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Per-page selector */}
                    <div className="form-group" style={{ flex: '0 0 auto', minWidth: '140px', gap: '0.25rem' }}>
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
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                    }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            {filteredCameras.length} câmera{filteredCameras.length !== 1 ? 's' : ''}
                        </span>

                        {totalPages > 1 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                            }}>
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

                {/* Camera Grid */}
                {(loading || liveLoading) ? (
                    <div className="empty-state" style={{ padding: '3rem' }}>
                        <div className="spinner" />
                        <p style={{ marginTop: '1rem' }}>Carregando câmeras...</p>
                    </div>
                ) : filteredCameras.length === 0 ? (
                    <div className="empty-state" style={{ padding: '3rem' }}>
                        <Camera size={48} />
                        <p style={{ fontSize: '1rem', fontWeight: 500, marginTop: '0.5rem' }}>
                            {selectedGrupo ? 'Nenhuma câmera neste grupo' : 'Nenhuma câmera cadastrada'}
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${getGridCols()}, 1fr)`,
                        gap: '2px',
                        background: 'var(--color-border)',
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
                                        <HlsPlayer src={hlsUrl} />
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
                                            <div style={{
                                                fontSize: '0.6875rem', color: 'var(--color-text-muted)',
                                            }}>
                                                #{cam.id}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                                            {hlsUrl && (
                                                <span className="badge badge-online" style={{ fontSize: '0.6rem' }}>
                                                    <Wifi size={9} /> Live
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
            </div>}

            {/* ================================================================
                SWAP CAMERA MODAL
                ================================================================ */}
            {showLive && swapTarget && (
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

            {/* ================================================================
                SECTION 2: PLAYBACK SEARCH (Recordings)
                ================================================================ */}
            <div style={{
                marginTop: '0.5rem',
                padding: '1.25rem 0 0.5rem',
                borderTop: '1px solid var(--color-border)',
            }}>
                <h2 style={{
                    fontSize: '1.125rem', fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    marginBottom: '1rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                    <Search size={18} /> Consultar Gravações
                </h2>
            </div>

            <div className="filters-bar" id="playback-filters">
                <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                    <label className="form-label">Câmera</label>
                    <select className="form-select" value={searchCameraId} onChange={(e) => setSearchCameraId(e.target.value)} id="filter-camera">
                        <option value="">Todas as câmeras</option>
                        {allCameras.map((cam) => <option key={cam.id} value={cam.id}>{cam.nome}</option>)}
                    </select>
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label">Data/Hora Início</label>
                    <input type="datetime-local" className="form-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} id="filter-data-inicio" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label">Data/Hora Fim</label>
                    <input type="datetime-local" className="form-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} id="filter-data-fim" />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleSearch} disabled={searchLoading} id="btn-search">
                        <Search size={16} /> {searchLoading ? 'Buscando...' : 'Consultar'}
                    </button>
                    {gravacoes.length > 0 && (
                        <button className="btn btn-danger" onClick={handleDelete} disabled={deleting} id="btn-delete-gravacoes">
                            <Trash2 size={16} /> {deleting ? 'Excluindo...' : 'Limpar período'}
                        </button>
                    )}
                </div>
            </div>

            {gravacoes.length > 0 && (
                <div style={{
                    display: 'flex', gap: '1rem', marginBottom: '1rem',
                    fontSize: '0.8125rem', color: 'var(--color-text-secondary)',
                }}>
                    <span>{gravacoes.length} gravação(ões)</span>
                    <span>•</span>
                    <span>{formatSize(totalSize)} total</span>
                </div>
            )}

            {selectedVideo && (
                <div ref={videoPlayerRef} className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: 600 }}>
                            {getCameraName(selectedVideo.id_camera)} — {formatDate(selectedVideo.data_inicio)}
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedVideo(null)}>Fechar</button>
                    </div>
                    <div className="video-container">
                        <video src={getGravacaoStreamUrl(selectedVideo.id)} controls autoPlay style={{ width: '100%', height: '100%' }} />
                    </div>
                </div>
            )}

            {gravacoes.length > 0 && (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Câmera</th><th>Início</th><th>Fim</th>
                                <th><Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />Duração</th>
                                <th><HardDrive size={12} style={{ display: 'inline', marginRight: '4px' }} />Tamanho</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gravacoes.map((g) => (
                                <tr key={g.id}>
                                    <td style={{ fontWeight: 500 }}>{getCameraName(g.id_camera)}</td>
                                    <td>{formatDate(g.data_inicio)}</td>
                                    <td>{formatDate(g.data_fim)}</td>
                                    <td>{getDuration(g.data_inicio, g.data_fim)}</td>
                                    <td>{formatSize(g.tamanho_bytes)}</td>
                                    <td>
                                        {g.face_analyzed ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontSize: '0.8125rem' }}>
                                                <CheckCircle2 size={14} /> Analisado
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Pendente</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => {
                                                setSelectedVideo(g)
                                                setTimeout(() => videoPlayerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
                                            }} id={`btn-play-${g.id}`}>
                                                <Play size={14} /> Reproduzir
                                            </button>
                                            {!g.face_analyzed && (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleAnalyze(g)}
                                                    disabled={analyzingId === g.id}
                                                    id={`btn-analyze-${g.id}`}
                                                    title="Iniciar reconhecimento facial"
                                                >
                                                    <ScanFace size={14} /> {analyzingId === g.id ? 'Analisando...' : 'Analisar'}
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDeleteSingle(g)}
                                                disabled={deletingId === g.id}
                                                id={`btn-delete-${g.id}`}
                                                title="Excluir gravação"
                                            >
                                                <Trash2 size={14} /> {deletingId === g.id ? 'Excluindo...' : 'Excluir'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!searchLoading && gravacoes.length === 0 && (
                <div className="empty-state">
                    <Film size={48} />
                    <p style={{ fontSize: '1.125rem', fontWeight: 500, marginTop: '0.5rem' }}>Nenhuma gravação encontrada</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Use os filtros acima para buscar gravações por câmera e período.</p>
                </div>
            )}

            {toast && (
                <div className={`toast toast-${toast.type}`}>{toast.message}</div>
            )}
        </div>
    )
}
