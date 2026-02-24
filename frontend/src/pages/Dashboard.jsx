import { useState, useEffect, useMemo } from 'react'
import {
    Video, RefreshCw, Wifi, WifiOff, Circle, Square,
    Camera, ChevronLeft, ChevronRight, Grid3X3, FolderOpen,
    ArrowLeftRight, X, ScanFace
} from 'lucide-react'
import HlsPlayer from '../components/HlsPlayer'
import {
    getCameras, getStreams, getRecordingStatus, startRecording, stopRecording,
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

    // View controls
    const [selectedGrupo, setSelectedGrupo] = useState('')
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

    useEffect(() => {
        fetchData()
        fetchRecStatus()
        fetchFrStatus()
    }, [])

    // ---- Filtered cameras by group ----
    const filteredCameras = useMemo(() => {
        if (!selectedGrupo) return allCameras
        const grupo = grupos.find(g => g.id_grupo === Number(selectedGrupo))
        if (!grupo) return allCameras
        const groupCamIds = new Set(grupo.cameras.map(c => c.id))
        return allCameras.filter(cam => groupCamIds.has(cam.id))
    }, [allCameras, selectedGrupo, grupos])

    // ---- Pagination ----
    const totalPages = Math.max(1, Math.ceil(filteredCameras.length / perPage))

    useEffect(() => {
        setCurrentPage(1)
        setCameraOverrides({})
    }, [selectedGrupo, perPage])

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
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Video size={28} /> Dashboard
                    </h1>
                    <p className="page-subtitle">Visualização ao vivo das câmeras</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            <div className="card" style={{ marginBottom: '1.25rem', overflow: 'visible' }}>
                <div style={{
                    padding: '1rem 1.25rem',
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
                        {selectedGrupo ? 'Nenhuma câmera neste grupo' : 'Nenhuma câmera habilitada'}
                    </p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {selectedGrupo
                            ? 'Selecione outro grupo ou adicione câmeras a este grupo.'
                            : 'Cadastre câmeras na seção "Câmeras" para começar.'}
                    </p>
                </div>
            )}

            {!loading && !error && displayCameras.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${getGridCols()}, 1fr)`,
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
