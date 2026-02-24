import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Camera as CameraIcon, X, Save, Power, PowerOff } from 'lucide-react'
import { getCameras, createCamera, updateCamera, deleteCamera } from '../api/client'

export default function Cameras() {
    const [cameras, setCameras] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingCamera, setEditingCamera] = useState(null)
    const [toast, setToast] = useState(null)
    const [formNome, setFormNome] = useState('')
    const [formUrl, setFormUrl] = useState('')
    const [formHabilitada, setFormHabilitada] = useState(true)

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
        setEditingCamera(null); setFormNome(''); setFormUrl(''); setFormHabilitada(true); setShowModal(true)
    }

    const openEditModal = (cam) => {
        setEditingCamera(cam); setFormNome(cam.nome); setFormUrl(cam.rtsp_url); setFormHabilitada(cam.habilitada); setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingCamera) {
                await updateCamera(editingCamera.id, { nome: formNome, rtsp_url: formUrl, habilitada: formHabilitada })
                showToast('Câmera atualizada com sucesso!')
            } else {
                await createCamera({ nome: formNome, rtsp_url: formUrl, habilitada: formHabilitada })
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
            // Atualiza localmente sem recarregar (evita scroll reset)
            setCameras(prev => prev.map(c =>
                c.id === cam.id ? { ...c, habilitada: !c.habilitada } : c
            ))
        } catch { showToast('Erro ao atualizar câmera', 'error') }
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
                            <tr><th>ID</th><th>Nome</th><th>URL RTSP</th><th>Status</th><th>Cadastrada em</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                            {cameras.map((cam) => (
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
                                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{formatDate(cam.criada_em)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(cam)} title="Editar" id={`btn-edit-${cam.id}`}><Pencil size={14} /></button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cam)} title="Excluir" id={`btn-delete-${cam.id}`}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

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
