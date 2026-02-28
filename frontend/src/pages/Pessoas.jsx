import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Plus, Pencil, Trash2, X, Save, UserCircle, Camera,
    ScanFace, Image, RotateCcw, CheckCircle, AlertCircle, Eye
} from 'lucide-react'
import {
    getPessoas, createPessoa, updatePessoa, deletePessoa,
    uploadFace, getFaces, deleteFace
} from '../api/client'

const TIPO_LABELS = {
    S: { label: 'Separador', color: '#f59e0b' },
    C: { label: 'Conferente', color: '#8b5cf6' },
    A: { label: 'Administrativo', color: '#3b82f6' },
    V: { label: 'Visitante', color: '#64748b' },
}

export default function Pessoas() {
    const [pessoas, setPessoas] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingPessoa, setEditingPessoa] = useState(null)
    const [toast, setToast] = useState(null)
    const [formNome, setFormNome] = useState('')
    const [formTipo, setFormTipo] = useState('V')

    // Face capture state
    const [showFaceCapture, setShowFaceCapture] = useState(false)
    const [faceCapturePessoa, setFaceCapturePessoa] = useState(null)
    const [faces, setFaces] = useState([])
    const [loadingFaces, setLoadingFaces] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const [cameraReady, setCameraReady] = useState(false)
    const [captureCount, setCaptureCount] = useState(0)

    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)

    // Photo viewer state
    const [showPhotoViewer, setShowPhotoViewer] = useState(false)
    const [photoViewerPessoa, setPhotoViewerPessoa] = useState(null)
    const [photoViewerFaces, setPhotoViewerFaces] = useState([])
    const [photoViewerLoading, setPhotoViewerLoading] = useState(false)

    const fetchPessoas = async () => {
        try {
            setLoading(true)
            const { data } = await getPessoas()
            setPessoas(data)
        } catch {
            showToast('Erro ao carregar pessoas', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchPessoas() }, [])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // ---- CRUD ----
    const openNewModal = () => {
        setEditingPessoa(null)
        setFormNome('')
        setFormTipo('V')
        setShowModal(true)
    }

    const openEditModal = (pessoa) => {
        setEditingPessoa(pessoa)
        setFormNome(pessoa.no_pessoa)
        setFormTipo(pessoa.ao_tipo)
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingPessoa) {
                await updatePessoa(editingPessoa.id_pessoa, { no_pessoa: formNome, ao_tipo: formTipo })
                showToast('Pessoa atualizada com sucesso!')
            } else {
                await createPessoa({ no_pessoa: formNome, ao_tipo: formTipo })
                showToast('Pessoa cadastrada com sucesso!')
            }
            setShowModal(false)
            fetchPessoas()
        } catch {
            showToast('Erro ao salvar pessoa', 'error')
        }
    }

    const handleDelete = async (pessoa) => {
        if (!confirm(`Deseja realmente excluir "${pessoa.no_pessoa}"?\nTodas as fotos e reconhecimentos serão removidos.`)) return
        try {
            await deletePessoa(pessoa.id_pessoa)
            showToast('Pessoa excluída!')
            fetchPessoas()
        } catch {
            showToast('Erro ao excluir pessoa', 'error')
        }
    }

    // ---- FACE CAPTURE ----
    const openFaceCapture = async (pessoa) => {
        setFaceCapturePessoa(pessoa)
        setShowFaceCapture(true)
        setCaptureCount(0)
        setCameraReady(false)
        await fetchFaces(pessoa.id_pessoa)
        startCamera()
    }

    const closeFaceCapture = () => {
        stopCamera()
        setShowFaceCapture(false)
        setFaceCapturePessoa(null)
        setFaces([])
        fetchPessoas()
    }

    const fetchFaces = async (idPessoa) => {
        setLoadingFaces(true)
        try {
            const { data } = await getFaces(idPessoa)
            setFaces(data.faces || [])
        } catch {
            setFaces([])
        } finally {
            setLoadingFaces(false)
        }
    }

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play()
                    setCameraReady(true)
                }
            }
        } catch (err) {
            showToast('Erro ao acessar câmera: ' + err.message, 'error')
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setCameraReady(false)
    }

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current || !faceCapturePessoa) return

        setCapturing(true)
        const video = videoRef.current
        const canvas = canvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0)

        canvas.toBlob(async (blob) => {
            try {
                const file = new File([blob], `face_${Date.now()}.jpg`, { type: 'image/jpeg' })
                await uploadFace(faceCapturePessoa.id_pessoa, file)
                setCaptureCount(prev => prev + 1)
                await fetchFaces(faceCapturePessoa.id_pessoa)
                showToast(`Foto ${captureCount + 1} capturada!`)
            } catch {
                showToast('Erro ao salvar foto', 'error')
            } finally {
                setCapturing(false)
            }
        }, 'image/jpeg', 0.9)
    }

    const handleDeleteFace = async (filename) => {
        if (!faceCapturePessoa) return
        try {
            await deleteFace(faceCapturePessoa.id_pessoa, filename)
            showToast('Foto removida!')
            await fetchFaces(faceCapturePessoa.id_pessoa)
        } catch {
            showToast('Erro ao remover foto', 'error')
        }
    }

    const formatDate = (str) => new Date(str).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    const API_BASE_URL = import.meta.env.VITE_API_URL || ''

    // ---- PHOTO VIEWER ----
    const openPhotoViewer = async (pessoa) => {
        if (pessoa.total_fotos === 0) {
            openFaceCapture(pessoa)
            return
        }
        setPhotoViewerPessoa(pessoa)
        setShowPhotoViewer(true)
        setPhotoViewerLoading(true)
        try {
            const { data } = await getFaces(pessoa.id_pessoa)
            setPhotoViewerFaces(data.faces || [])
        } catch {
            setPhotoViewerFaces([])
        } finally {
            setPhotoViewerLoading(false)
        }
    }

    const closePhotoViewer = () => {
        setShowPhotoViewer(false)
        setPhotoViewerPessoa(null)
        setPhotoViewerFaces([])
    }

    // ---- FACE CAPTURE SCREEN (FULL OVERLAY) ----
    if (showFaceCapture && faceCapturePessoa) {
        const tipo = TIPO_LABELS[faceCapturePessoa.ao_tipo] || TIPO_LABELS.V
        return (
            <div className="page-container" style={{ paddingBottom: '2rem' }}>
                {/* Header */}
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={closeFaceCapture}>
                            <X size={16} /> Voltar
                        </button>
                        <div>
                            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ScanFace size={24} />
                                Captura Facial
                            </h1>
                            <p className="page-subtitle">
                                {faceCapturePessoa.no_pessoa}
                                <span className="badge" style={{
                                    marginLeft: '0.5rem',
                                    background: `${tipo.color}20`,
                                    color: tipo.color,
                                    fontSize: '0.65rem',
                                }}>
                                    {tipo.label}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Capture area */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem',
                    maxHeight: 'calc(100vh - 160px)',
                }}>
                    {/* Camera */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{
                            padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                <Camera size={16} /> Câmera ao Vivo
                            </div>
                            <div className="badge" style={{
                                background: cameraReady ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: cameraReady ? 'var(--color-success)' : 'var(--color-danger)',
                            }}>
                                {cameraReady ? '● Ativa' : '○ Conectando...'}
                            </div>
                        </div>

                        <div style={{ position: 'relative', aspectRatio: '4/3', background: '#000' }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    transform: 'scaleX(-1)',
                                }}
                            />
                            {/* Face guide overlay */}
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                pointerEvents: 'none',
                            }}>
                                <div style={{
                                    width: '200px', height: '260px',
                                    border: '2px dashed rgba(59, 130, 246, 0.5)',
                                    borderRadius: '50%',
                                }} />
                            </div>

                            {capturing && (
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'rgba(59, 130, 246, 0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    animation: 'flash-capture 0.3s ease-out',
                                }}>
                                    <CheckCircle size={48} color="white" />
                                </div>
                            )}

                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>

                        <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={capturePhoto}
                                disabled={!cameraReady || capturing}
                                style={{ flex: 1 }}
                                id="btn-capture-face"
                            >
                                <Camera size={16} />
                                {capturing ? 'Capturando...' : 'Capturar Foto'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => { stopCamera(); setTimeout(startCamera, 300) }}
                                title="Reiniciar câmera"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>

                        {/* Instructions */}
                        <div style={{
                            padding: '0.75rem 1.25rem', borderTop: '1px solid var(--color-border)',
                            background: 'rgba(59, 130, 246, 0.05)',
                        }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                                <strong style={{ color: 'var(--color-accent)' }}>💡 Dicas para melhor reconhecimento:</strong><br />
                                • Capture diversas poses: frente, perfil esquerdo, perfil direito<br />
                                • Varie a iluminação e expressões faciais<br />
                                • Posicione o rosto dentro do guia oval<br />
                                • Recomendado: mínimo de 5 fotos por pessoa
                            </p>
                        </div>
                    </div>

                    {/* Photos grid */}
                    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                            padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                <Image size={16} /> Fotos Registradas
                            </div>
                            <span className="badge badge-online">{faces.length} fotos</span>
                        </div>

                        <div style={{
                            flex: 1, overflow: 'auto', padding: '1rem',
                        }}>
                            {loadingFaces ? (
                                <div className="empty-state">
                                    <div className="spinner" />
                                </div>
                            ) : faces.length === 0 ? (
                                <div className="empty-state">
                                    <ScanFace size={48} />
                                    <p style={{ fontSize: '1rem', fontWeight: 500, marginTop: '0.5rem' }}>
                                        Nenhuma foto registrada
                                    </p>
                                    <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                                        Use a câmera para capturar as fotos da face.
                                    </p>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                    gap: '0.75rem',
                                }}>
                                    {faces.map((face) => (
                                        <div key={face.filename} style={{
                                            position: 'relative', borderRadius: 'var(--radius-md)',
                                            overflow: 'hidden', border: '1px solid var(--color-border)',
                                            aspectRatio: '1',
                                            transition: 'all 0.2s ease',
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                        >
                                            <img
                                                src={`${API_BASE_URL}${face.url}`}
                                                alt="Face"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <button
                                                onClick={() => handleDeleteFace(face.filename)}
                                                style={{
                                                    position: 'absolute', top: '0.25rem', right: '0.25rem',
                                                    background: 'rgba(239, 68, 68, 0.85)', border: 'none',
                                                    borderRadius: '50%', width: '24px', height: '24px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                className="face-delete-btn"
                                            >
                                                <X size={12} color="white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

                <style>{`
                    @keyframes flash-capture {
                        0% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                    .face-delete-btn {
                        opacity: 0 !important;
                    }
                    div:hover > .face-delete-btn {
                        opacity: 1 !important;
                    }
                `}</style>
            </div>
        )
    }

    // ---- MAIN LIST VIEW ----
    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <UserCircle size={28} /> Cadastro de Pessoas
                    </h1>
                    <p className="page-subtitle">Gerencie pessoas e registre faces para reconhecimento facial</p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal} id="btn-add-pessoa">
                    <Plus size={16} /> Nova Pessoa
                </button>
            </div>

            {loading ? (
                <div className="empty-state">
                    <div className="spinner" />
                    <p style={{ marginTop: '1rem' }}>Carregando...</p>
                </div>
            ) : pessoas.length === 0 ? (
                <div className="empty-state">
                    <UserCircle size={48} />
                    <p style={{ fontSize: '1.125rem', fontWeight: 500, marginTop: '0.5rem' }}>
                        Nenhuma pessoa cadastrada
                    </p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Clique em "Nova Pessoa" para começar.
                    </p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nome</th>
                                <th>Tipo</th>
                                <th>Fotos</th>
                                <th>Cadastrado em</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pessoas.map((pessoa) => {
                                const tipo = TIPO_LABELS[pessoa.ao_tipo] || TIPO_LABELS.V
                                return (
                                    <tr key={pessoa.id_pessoa}>
                                        <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
                                            #{pessoa.id_pessoa}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <UserCircle size={20} style={{ color: 'var(--color-text-muted)' }} />
                                                {pessoa.no_pessoa}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge" style={{
                                                background: `${tipo.color}20`,
                                                color: tipo.color,
                                            }}>
                                                {tipo.label}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => openPhotoViewer(pessoa)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)',
                                                    transition: 'all 0.15s ease',
                                                    color: pessoa.total_fotos > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                                    textDecoration: pessoa.total_fotos > 0 ? 'underline' : 'none',
                                                    textUnderlineOffset: '3px',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'none'
                                                }}
                                                title={pessoa.total_fotos > 0 ? 'Clique para ver as fotos' : 'Clique para capturar fotos'}
                                                id={`btn-view-photos-${pessoa.id_pessoa}`}
                                            >
                                                {pessoa.total_fotos > 0 ? (
                                                    <Eye size={14} />
                                                ) : (
                                                    <ScanFace size={14} />
                                                )}
                                                <span style={{ fontWeight: 600 }}>
                                                    {pessoa.total_fotos}
                                                </span>
                                                {pessoa.total_fotos >= 5 && (
                                                    <CheckCircle size={12} style={{ color: 'var(--color-success)' }} />
                                                )}
                                                {pessoa.total_fotos > 0 && pessoa.total_fotos < 5 && (
                                                    <AlertCircle size={12} style={{ color: 'var(--color-warning)' }} />
                                                )}
                                            </button>
                                        </td>
                                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                                            {formatDate(pessoa.criada_em)}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => openFaceCapture(pessoa)}
                                                    title="Capturar faces"
                                                    id={`btn-faces-${pessoa.id_pessoa}`}
                                                >
                                                    <ScanFace size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => openEditModal(pessoa)}
                                                    title="Editar"
                                                    id={`btn-edit-${pessoa.id_pessoa}`}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleDelete(pessoa)}
                                                    title="Excluir"
                                                    id={`btn-delete-${pessoa.id_pessoa}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal Criar/Editar Pessoa */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingPessoa ? 'Editar Pessoa' : 'Nova Pessoa'}</h3>
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
                                    <label className="form-label">Nome da Pessoa</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formNome}
                                        onChange={(e) => setFormNome(e.target.value)}
                                        placeholder="Ex: João da Silva"
                                        required
                                        id="input-pessoa-nome"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo de Pessoa</label>
                                    <select
                                        className="form-select"
                                        value={formTipo}
                                        onChange={(e) => setFormTipo(e.target.value)}
                                        id="input-pessoa-tipo"
                                    >
                                        <option value="S">S - Separador</option>
                                        <option value="C">C - Conferente</option>
                                        <option value="A">A - Administrativo</option>
                                        <option value="V">V - Visitante</option>
                                    </select>
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
                                <button type="submit" className="btn btn-primary" id="btn-save-pessoa">
                                    <Save size={16} /> {editingPessoa ? 'Atualizar' : 'Cadastrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

            {/* Modal Visualizador de Fotos */}
            {showPhotoViewer && photoViewerPessoa && (
                <div className="modal-overlay" onClick={closePhotoViewer}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
                    >
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Image size={18} />
                                <h3 style={{ margin: 0 }}>Fotos — {photoViewerPessoa.no_pessoa}</h3>
                                <span className="badge badge-online" style={{ marginLeft: '0.25rem' }}>
                                    {photoViewerFaces.length} fotos
                                </span>
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={closePhotoViewer}
                                style={{ padding: '0.25rem' }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
                            {photoViewerLoading ? (
                                <div className="empty-state">
                                    <div className="spinner" />
                                </div>
                            ) : photoViewerFaces.length === 0 ? (
                                <div className="empty-state">
                                    <ScanFace size={48} />
                                    <p style={{ marginTop: '0.5rem' }}>Nenhuma foto registrada</p>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                    gap: '0.75rem',
                                }}>
                                    {photoViewerFaces.map((face) => (
                                        <div
                                            key={face.filename}
                                            style={{
                                                borderRadius: 'var(--radius-md)',
                                                overflow: 'hidden',
                                                border: '1px solid var(--color-border)',
                                                aspectRatio: '1',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--color-accent)'
                                                e.currentTarget.style.transform = 'scale(1.03)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--color-border)'
                                                e.currentTarget.style.transform = 'scale(1)'
                                            }}
                                            onClick={() => {
                                                window.open(`${API_BASE_URL}${face.url}`, '_blank')
                                            }}
                                            title="Clique para abrir em tamanho real"
                                        >
                                            <img
                                                src={`${API_BASE_URL}${face.url}`}
                                                alt={face.filename}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closePhotoViewer}>
                                Fechar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => { closePhotoViewer(); openFaceCapture(photoViewerPessoa) }}
                            >
                                <ScanFace size={16} /> Capturar Novas
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
