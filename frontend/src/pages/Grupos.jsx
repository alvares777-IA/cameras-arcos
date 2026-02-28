import { useState, useEffect } from 'react'
import {
    Plus, Pencil, Trash2, X, Save, FolderOpen, Camera, Check
} from 'lucide-react'
import {
    getGrupos, createGrupo, updateGrupo, deleteGrupo, getCameras
} from '../api/client'

export default function Grupos() {
    const [grupos, setGrupos] = useState([])
    const [cameras, setCameras] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingGrupo, setEditingGrupo] = useState(null)
    const [toast, setToast] = useState(null)
    const [formNome, setFormNome] = useState('')
    const [selectedCameras, setSelectedCameras] = useState([])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [gruposRes, camerasRes] = await Promise.all([
                getGrupos(),
                getCameras(),
            ])
            setGrupos(gruposRes.data)
            setCameras(camerasRes.data)
        } catch {
            showToast('Erro ao carregar dados', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // ---- CRUD ----
    const openNewModal = () => {
        setEditingGrupo(null)
        setFormNome('')
        setSelectedCameras([])
        setShowModal(true)
    }

    const openEditModal = (grupo) => {
        setEditingGrupo(grupo)
        setFormNome(grupo.no_grupo)
        setSelectedCameras(grupo.cameras.map(c => c.id))
        setShowModal(true)
    }

    const toggleCamera = (camId) => {
        setSelectedCameras(prev =>
            prev.includes(camId)
                ? prev.filter(id => id !== camId)
                : [...prev, camId]
        )
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const payload = { no_grupo: formNome, camera_ids: selectedCameras }
            if (editingGrupo) {
                await updateGrupo(editingGrupo.id_grupo, payload)
                showToast('Grupo atualizado com sucesso!')
            } else {
                await createGrupo(payload)
                showToast('Grupo cadastrado com sucesso!')
            }
            setShowModal(false)
            fetchData()
        } catch {
            showToast('Erro ao salvar grupo', 'error')
        }
    }

    const handleDelete = async (grupo) => {
        if (!confirm(`Deseja realmente excluir o grupo "${grupo.no_grupo}"?\nAs câmeras não serão removidas, apenas a associação.`)) return
        try {
            await deleteGrupo(grupo.id_grupo)
            showToast('Grupo excluído!')
            fetchData()
        } catch {
            showToast('Erro ao excluir grupo', 'error')
        }
    }

    const formatDate = (str) => new Date(str).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FolderOpen size={28} /> Grupos de Câmeras
                    </h1>
                    <p className="page-subtitle">Organize suas câmeras em grupos para facilitar o gerenciamento</p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal} id="btn-add-grupo">
                    <Plus size={16} /> Novo Grupo
                </button>
            </div>

            {loading ? (
                <div className="empty-state">
                    <div className="spinner" />
                    <p style={{ marginTop: '1rem' }}>Carregando...</p>
                </div>
            ) : grupos.length === 0 ? (
                <div className="empty-state">
                    <FolderOpen size={48} />
                    <p style={{ fontSize: '1.125rem', fontWeight: 500, marginTop: '0.5rem' }}>
                        Nenhum grupo cadastrado
                    </p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Clique em "Novo Grupo" para organizar suas câmeras.
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1.25rem',
                }}>
                    {grupos.map((grupo) => (
                        <div key={grupo.id_grupo} className="card" style={{
                            overflow: 'hidden',
                            transition: 'all 0.2s ease',
                            border: '1px solid var(--color-border)',
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-accent)'
                                e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.1)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-border)'
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        >
                            {/* Card Header */}
                            <div style={{
                                padding: '1.25rem 1.25rem 1rem',
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)',
                                        background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <FolderOpen size={18} color="white" />
                                    </div>
                                    <div>
                                        <h3 style={{
                                            fontSize: '1rem', fontWeight: 600, margin: 0,
                                            color: 'var(--color-text-primary)',
                                        }}>
                                            {grupo.no_grupo}
                                        </h3>
                                        <p style={{
                                            fontSize: '0.75rem', color: 'var(--color-text-muted)',
                                            margin: '0.125rem 0 0',
                                        }}>
                                            ID #{grupo.id_grupo} • Criado em {formatDate(grupo.criado_em)}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.375rem' }}>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => openEditModal(grupo)}
                                        title="Editar"
                                        id={`btn-edit-grupo-${grupo.id_grupo}`}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleDelete(grupo)}
                                        title="Excluir"
                                        id={`btn-delete-grupo-${grupo.id_grupo}`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Camera Count Badge */}
                            <div style={{
                                padding: '0 1.25rem 0.75rem',
                            }}>
                                <span className="badge" style={{
                                    background: grupo.total_cameras > 0
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : 'rgba(100, 116, 139, 0.15)',
                                    color: grupo.total_cameras > 0
                                        ? 'var(--color-success)'
                                        : 'var(--color-text-muted)',
                                    fontSize: '0.7rem',
                                }}>
                                    <Camera size={11} style={{ marginRight: '0.25rem' }} />
                                    {grupo.total_cameras} câmera{grupo.total_cameras !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Camera List */}
                            <div style={{
                                borderTop: '1px solid var(--color-border)',
                                padding: '0.75rem 1.25rem',
                                minHeight: '3.5rem',
                            }}>
                                {grupo.cameras.length === 0 ? (
                                    <p style={{
                                        fontSize: '0.8125rem', color: 'var(--color-text-muted)',
                                        fontStyle: 'italic', margin: 0,
                                    }}>
                                        Nenhuma câmera associada
                                    </p>
                                ) : (
                                    <div style={{
                                        display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
                                    }}>
                                        {grupo.cameras.map((cam) => (
                                            <span key={cam.id} className="badge" style={{
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                color: 'var(--color-accent)',
                                                fontSize: '0.7rem',
                                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                                            }}>
                                                <Camera size={10} />
                                                {cam.nome}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Criar/Editar Grupo */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '540px' }}
                    >
                        <div className="modal-header">
                            <h3>{editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}</h3>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowModal(false)}
                                style={{ padding: '0.25rem' }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nome do Grupo</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formNome}
                                        onChange={(e) => setFormNome(e.target.value)}
                                        placeholder="Ex: Área de Expedição"
                                        required
                                        id="input-grupo-nome"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Câmeras do Grupo
                                        <span style={{
                                            fontWeight: 400, fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)', marginLeft: '0.5rem',
                                        }}>
                                            ({selectedCameras.length} selecionada{selectedCameras.length !== 1 ? 's' : ''})
                                        </span>
                                    </label>

                                    {cameras.length === 0 ? (
                                        <p style={{
                                            fontSize: '0.8125rem', color: 'var(--color-text-muted)',
                                            fontStyle: 'italic', padding: '1rem 0',
                                        }}>
                                            Nenhuma câmera cadastrada no sistema.
                                        </p>
                                    ) : (
                                        <div style={{
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-md)',
                                            maxHeight: '240px', overflow: 'auto',
                                        }}>
                                            {cameras.map((cam) => {
                                                const isSelected = selectedCameras.includes(cam.id)
                                                return (
                                                    <div
                                                        key={cam.id}
                                                        onClick={() => toggleCamera(cam.id)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                            padding: '0.75rem 1rem',
                                                            cursor: 'pointer',
                                                            background: isSelected
                                                                ? 'rgba(59, 130, 246, 0.08)'
                                                                : 'transparent',
                                                            borderBottom: '1px solid var(--color-border)',
                                                            transition: 'background 0.15s ease',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-card-hover)'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isSelected) e.currentTarget.style.background = 'transparent'
                                                        }}
                                                    >
                                                        {/* Checkbox */}
                                                        <div style={{
                                                            width: '20px', height: '20px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            border: isSelected
                                                                ? '2px solid var(--color-accent)'
                                                                : '2px solid var(--color-border)',
                                                            background: isSelected ? 'var(--color-accent)' : 'transparent',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'all 0.15s ease',
                                                            flexShrink: 0,
                                                        }}>
                                                            {isSelected && <Check size={12} color="white" />}
                                                        </div>

                                                        {/* Camera info */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{
                                                                fontSize: '0.875rem', fontWeight: 500,
                                                                color: 'var(--color-text-primary)',
                                                                whiteSpace: 'nowrap', overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }}>
                                                                {cam.nome}
                                                            </div>
                                                            <div style={{
                                                                fontSize: '0.7rem',
                                                                color: 'var(--color-text-muted)',
                                                                whiteSpace: 'nowrap', overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }}>
                                                                {cam.rtsp_url}
                                                            </div>
                                                        </div>

                                                        {/* Status */}
                                                        <div className="badge" style={{
                                                            background: cam.habilitada
                                                                ? 'rgba(16, 185, 129, 0.15)'
                                                                : 'rgba(239, 68, 68, 0.15)',
                                                            color: cam.habilitada
                                                                ? 'var(--color-success)'
                                                                : 'var(--color-danger)',
                                                            fontSize: '0.65rem',
                                                            flexShrink: 0,
                                                        }}>
                                                            {cam.habilitada ? 'Ativa' : 'Inativa'}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" id="btn-save-grupo">
                                    <Save size={16} /> {editingGrupo ? 'Atualizar' : 'Cadastrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
        </div>
    )
}
