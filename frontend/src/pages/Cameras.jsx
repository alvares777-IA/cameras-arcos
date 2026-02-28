import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Camera as CameraIcon, X, Save, Power, PowerOff, Video, Eye, Search, Loader2, Monitor, Mic, Film } from 'lucide-react'
import { getCameras, createCamera, updateCamera, deleteCamera, toggleCameraContinuos, probeCamera } from '../api/client'

export default function Cameras() {
    const [cameras, setCameras] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingCamera, setEditingCamera] = useState(null)
    const [toast, setToast] = useState(null)
    const [formNome, setFormNome] = useState('')
    const [formUrl, setFormUrl] = useState('')
    const [formHabilitada, setFormHabilitada] = useState(true)
    const [formContinuos, setFormContinuos] = useState(false)
    const [formHrIni, setFormHrIni] = useState('')
    const [formHrFim, setFormHrFim] = useState('')
    const [probingId, setProbingId] = useState(null)
    const [showRecursosModal, setShowRecursosModal] = useState(null)

    const fetchCameras = async () => {
        try { setLoading(true); const { data } = await getCameras(); setCameras(data) }
        catch { showToast('Erro ao carregar câmeras', 'error') }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchCameras() }, [])

    const showToast = (message, type = 'success') => {
        setToast({ message, type }); setTimeout(() => setToast(null), 3000)
    }

    const openNewModal = () => {
        setEditingCamera(null); setFormNome(''); setFormUrl(''); setFormHabilitada(true); setFormContinuos(false); setFormHrIni(''); setFormHrFim(''); setShowModal(true)
    }

    const openEditModal = (cam) => {
        setEditingCamera(cam); setFormNome(cam.nome); setFormUrl(cam.rtsp_url); setFormHabilitada(cam.habilitada); setFormContinuos(cam.continuos || false); setFormHrIni(cam.hr_ini != null ? String(cam.hr_ini) : ''); setFormHrFim(cam.hr_fim != null ? String(cam.hr_fim) : ''); setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                nome: formNome, rtsp_url: formUrl, habilitada: formHabilitada, continuos: formContinuos,
                hr_ini: formHrIni !== '' ? parseInt(formHrIni, 10) : null,
                hr_fim: formHrFim !== '' ? parseInt(formHrFim, 10) : null,
            }
            if (editingCamera) {
                await updateCamera(editingCamera.id, payload)
                showToast('Câmera atualizada com sucesso!')
            } else {
                await createCamera(payload)
                showToast('Câmera cadastrada com sucesso!')
            }
            setShowModal(false); fetchCameras()
        } catch { showToast('Erro ao salvar câmera', 'error') }
    }

    const handleDelete = async (cam) => {
        if (!confirm(`Deseja realmente excluir a câmera "${cam.nome}"?`)) return
        try { await deleteCamera(cam.id); showToast('Câmera excluída!'); fetchCameras() }
        catch { showToast('Erro ao excluir câmera', 'error') }
    }

    const toggleCamera = async (cam) => {
        try {
            await updateCamera(cam.id, { habilitada: !cam.habilitada })
            showToast(cam.habilitada ? 'Câmera desabilitada' : 'Câmera habilitada')
            setCameras(prev => prev.map(c =>
                c.id === cam.id ? { ...c, habilitada: !c.habilitada } : c
            ))
        } catch { showToast('Erro ao atualizar câmera', 'error') }
    }

    const toggleContinuos = async (cam) => {
        try {
            await toggleCameraContinuos(cam.id)
            showToast(cam.continuos ? 'Gravação por movimento' : 'Gravação contínua')
            setCameras(prev => prev.map(c =>
                c.id === cam.id ? { ...c, continuos: !c.continuos } : c
            ))
        } catch { showToast('Erro ao atualizar câmera', 'error') }
    }

    const handleProbe = async (cam) => {
        setProbingId(cam.id)
        try {
            const { data } = await probeCamera(cam.id)
            setCameras(prev => prev.map(c =>
                c.id === cam.id ? { ...c, recursos: data.recursos } : c
            ))
            showToast(`Recursos de "${cam.nome}" detectados!`)
        } catch (err) {
            const detail = err.response?.data?.detail || 'Erro ao buscar recursos'
            showToast(detail, 'error')
        } finally {
            setProbingId(null)
        }
    }

    const parseRecursos = (jsonStr) => {
        if (!jsonStr) return null
        try { return JSON.parse(jsonStr) }
        catch { return null }
    }

    const formatDate = (str) => new Date(str).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Câmeras</h1>
                    <p className="page-subtitle">Gerencie suas câmeras de monitoramento</p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal} id="btn-add-camera">
                    <Plus size={16} /> Nova Câmera
                </button>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /><p style={{ marginTop: '1rem' }}>Carregando...</p></div>
            ) : cameras.length === 0 ? (
                <div className="empty-state">
                    <CameraIcon size={48} />
                    <p style={{ fontSize: '1.125rem', fontWeight: 500, marginTop: '0.5rem' }}>Nenhuma câmera cadastrada</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Clique em "Nova Câmera" para adicionar.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th><th>Nome</th><th>URL RTSP</th><th>Status</th>
                                <th>Gravação</th><th>Horário</th><th>Recursos</th><th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cameras.map((cam) => {
                                const rec = parseRecursos(cam.recursos)
                                return (
                                    <tr key={cam.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>#{cam.id}</td>
                                        <td style={{ fontWeight: 500 }}>{cam.nome}</td>
                                        <td>
                                            <code style={{
                                                fontSize: '0.75rem', background: 'var(--color-bg-input)',
                                                padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)',
                                                color: 'var(--color-text-secondary)',
                                            }}>{cam.rtsp_url}</code>
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${cam.habilitada ? 'badge-online' : 'badge-offline'}`}
                                                style={{ cursor: 'pointer' }} onClick={() => toggleCamera(cam)}
                                                title={cam.habilitada ? 'Clique para desabilitar' : 'Clique para habilitar'}
                                            >
                                                {cam.habilitada ? <><Power size={10} /> Ativa</> : <><PowerOff size={10} /> Inativa</>}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${cam.continuos ? 'badge-online' : 'badge-offline'}`}
                                                style={{ cursor: 'pointer' }} onClick={() => toggleContinuos(cam)}
                                                title={cam.continuos ? 'Clique para mudar para gravação por movimento' : 'Clique para ativar gravação contínua'}
                                            >
                                                {cam.continuos ? <><Video size={10} /> Contínua</> : <><Eye size={10} /> Movimento</>}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                                {cam.hr_ini != null && cam.hr_fim != null
                                                    ? `${String(cam.hr_ini).padStart(2, '0')}h – ${String(cam.hr_fim).padStart(2, '0')}h`
                                                    : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                                            </span>
                                        </td>
                                        <td>
                                            {rec ? (
                                                <button
                                                    className="btn btn-sm"
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.1)',
                                                        color: 'var(--color-accent)',
                                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                    }}
                                                    onClick={() => setShowRecursosModal(cam)}
                                                    title="Ver detalhes dos recursos"
                                                >
                                                    <Monitor size={12} />
                                                    {rec.resolucao || 'Detectado'}
                                                </button>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleProbe(cam)}
                                                    disabled={probingId === cam.id}
                                                    title="Buscar recursos via ffprobe"
                                                    id={`btn-probe-${cam.id}`}
                                                >
                                                    {probingId === cam.id
                                                        ? <><Loader2 size={14} className="spin" /> Buscando...</>
                                                        : <><Search size={14} /> Recursos</>}
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(cam)} title="Editar" id={`btn-edit-${cam.id}`}><Pencil size={14} /></button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cam)} title="Excluir" id={`btn-delete-${cam.id}`}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Recursos */}
            {showRecursosModal && (() => {
                const rec = parseRecursos(showRecursosModal.recursos)
                if (!rec) return null
                return (
                    <div className="modal-overlay" onClick={() => setShowRecursosModal(null)}>
                        <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Monitor size={20} /> Recursos — {showRecursosModal.nome}
                                </h3>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowRecursosModal(null)} style={{ padding: '0.25rem' }}><X size={16} /></button>
                            </div>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    {/* Video info */}
                                    {rec.resolucao && (
                                        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Resolução</div>
                                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-accent)' }}>{rec.resolucao}</div>
                                        </div>
                                    )}
                                    {rec.video_codec && (
                                        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Codec Vídeo</div>
                                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                                <Film size={16} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: '-2px' }} />
                                                {rec.video_codec}
                                            </div>
                                            {rec.video_profile && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{rec.video_profile}</div>}
                                        </div>
                                    )}
                                    {rec.fps > 0 && (
                                        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>FPS</div>
                                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{rec.fps}</div>
                                        </div>
                                    )}
                                    {rec.video_bitrate_kbps && (
                                        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Bitrate Vídeo</div>
                                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{rec.video_bitrate_kbps} kbps</div>
                                        </div>
                                    )}
                                    {rec.pix_fmt && (
                                        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Pixel Format</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>{rec.pix_fmt}</div>
                                        </div>
                                    )}
                                    {rec.formato && (
                                        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Formato</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>{rec.formato}</div>
                                        </div>
                                    )}
                                    {/* Audio info */}
                                    {rec.audio_codec && (
                                        <div className="card" style={{ padding: '0.75rem', textAlign: 'center', gridColumn: 'span 2' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                <Mic size={12} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: '-2px' }} /> Áudio
                                            </div>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                                {rec.audio_codec}
                                                {rec.audio_sample_rate && <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}> — {rec.audio_sample_rate} Hz</span>}
                                                {rec.audio_channels && <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}> — {rec.audio_channels}ch</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        handleProbe(showRecursosModal)
                                        setShowRecursosModal(null)
                                    }}
                                >
                                    <Search size={14} /> Atualizar Recursos
                                </button>
                                <button className="btn btn-primary" onClick={() => setShowRecursosModal(null)}>Fechar</button>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Modal de Criar/Editar */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingCamera ? 'Editar Câmera' : 'Nova Câmera'}</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} style={{ padding: '0.25rem' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nome da Câmera</label>
                                    <input type="text" className="form-input" value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Ex: Entrada Principal" required id="input-camera-nome" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">URL RTSP</label>
                                    <input type="text" className="form-input" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="rtsp://usuario:senha@192.168.1.100:554/stream1" required id="input-camera-url" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input type="checkbox" checked={formHabilitada} onChange={(e) => setFormHabilitada(e.target.checked)} id="input-camera-habilitada" style={{ accentColor: 'var(--color-accent)' }} />
                                    <label htmlFor="input-camera-habilitada" style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                        Câmera habilitada (gravar e exibir no dashboard)
                                    </label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <input type="checkbox" checked={formContinuos} onChange={(e) => setFormContinuos(e.target.checked)} id="input-camera-continuos" style={{ accentColor: 'var(--color-accent)' }} />
                                    <label htmlFor="input-camera-continuos" style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                        Gravação contínua (quando modo global = "disable")
                                    </label>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Hora Início (0–23)</label>
                                        <input type="number" className="form-input" min="0" max="23" value={formHrIni} onChange={(e) => setFormHrIni(e.target.value)} placeholder="Ex: 08" id="input-camera-hr-ini" />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Hora Fim (0–23)</label>
                                        <input type="number" className="form-input" min="0" max="23" value={formHrFim} onChange={(e) => setFormHrFim(e.target.value)} placeholder="Ex: 17" id="input-camera-hr-fim" />
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                    Se preenchidos, a câmera grava continuamente nesse horário, independente do modo global.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" id="btn-save-camera"><Save size={16} /> {editingCamera ? 'Atualizar' : 'Cadastrar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
        </div>
    )
}
