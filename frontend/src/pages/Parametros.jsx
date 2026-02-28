import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Save, Settings, Key, FileText, MessageSquare } from 'lucide-react'
import { getParametros, syncParametros, createParametro, updateParametro, deleteParametro } from '../api/client'

export default function Parametros() {
    const [parametros, setParametros] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [toast, setToast] = useState(null)
    const [formChave, setFormChave] = useState('')
    const [formValor, setFormValor] = useState('')
    const [formNome, setFormNome] = useState('')
    const [formObs, setFormObs] = useState('')
    const [search, setSearch] = useState('')

    const fetchParametros = async () => {
        try {
            setLoading(true)
            // Sincroniza com o .env antes de listar
            const { data } = await syncParametros()
            setParametros(data)
        } catch {
            // Fallback: se sync falhar, tenta listar direto
            try {
                const { data } = await getParametros()
                setParametros(data)
            } catch {
                showToast('Erro ao carregar parâmetros', 'error')
            }
        } finally { setLoading(false) }
    }

    useEffect(() => { fetchParametros() }, [])

    const showToast = (message, type = 'success') => {
        setToast({ message, type }); setTimeout(() => setToast(null), 3000)
    }

    const openNewModal = () => {
        setEditing(null); setFormChave(''); setFormValor(''); setFormNome(''); setFormObs(''); setShowModal(true)
    }

    const openEditModal = (param) => {
        setEditing(param)
        setFormChave(param.chave || '')
        setFormValor(param.valor || '')
        setFormNome(param.nome || '')
        setFormObs(param.observacoes || '')
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                chave: formChave.trim(),
                valor: formValor,
                nome: formNome.trim() || null,
                observacoes: formObs.trim() || null,
            }
            if (editing) {
                await updateParametro(editing.id, payload)
                showToast('Parâmetro atualizado!')
            } else {
                await createParametro(payload)
                showToast('Parâmetro criado!')
            }
            setShowModal(false); fetchParametros()
        } catch (err) {
            const detail = err.response?.data?.detail || 'Erro ao salvar'
            showToast(detail, 'error')
        }
    }

    const handleDelete = async (param) => {
        if (!confirm(`Excluir o parâmetro "${param.chave}"?`)) return
        try { await deleteParametro(param.id); showToast('Parâmetro excluído!'); fetchParametros() }
        catch { showToast('Erro ao excluir', 'error') }
    }

    const filtered = parametros.filter(p => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
            (p.chave || '').toLowerCase().includes(q) ||
            (p.valor || '').toLowerCase().includes(q) ||
            (p.nome || '').toLowerCase().includes(q) ||
            (p.observacoes || '').toLowerCase().includes(q)
        )
    })

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings size={28} /> Parâmetros
                    </h1>
                    <p className="page-subtitle">Gerencie as variáveis de configuração do sistema (.env)</p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal} id="btn-add-param">
                    <Plus size={16} /> Novo Parâmetro
                </button>
            </div>

            {/* Search */}
            {parametros.length > 0 && (
                <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Buscar por chave, valor, nome ou observação..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ border: 'none', padding: '0.5rem 0', outline: 'none', background: 'transparent', width: '100%' }}
                        id="search-params"
                    />
                </div>
            )}

            {loading ? (
                <div className="empty-state"><div className="spinner" /><p style={{ marginTop: '1rem' }}>Carregando...</p></div>
            ) : parametros.length === 0 ? (
                <div className="empty-state">
                    <Settings size={48} />
                    <p style={{ fontSize: '1.125rem', fontWeight: 500, marginTop: '0.5rem' }}>Nenhum parâmetro cadastrado</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Clique em "Novo Parâmetro" para começar.</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <p style={{ fontSize: '0.875rem' }}>Nenhum resultado para "{search}"</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: '1rem',
                }}>
                    {filtered.map((param) => (
                        <div key={param.id} className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                            {/* Card header */}
                            <div style={{
                                padding: '1rem 1.25rem 0.75rem',
                                borderBottom: '1px solid var(--color-border)',
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem',
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {param.nome && (
                                        <div style={{
                                            fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)',
                                            marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {param.nome}
                                        </div>
                                    )}
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                        background: 'rgba(59, 130, 246, 0.08)', padding: '0.2rem 0.5rem',
                                        borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace',
                                        fontWeight: 600, color: 'var(--color-accent)',
                                    }}>
                                        <Key size={11} /> {param.chave}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(param)} title="Editar" style={{ padding: '0.3rem' }} id={`btn-edit-${param.id}`}>
                                        <Pencil size={14} />
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(param)} title="Excluir" style={{ padding: '0.3rem' }} id={`btn-delete-${param.id}`}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Card body */}
                            <div style={{ padding: '0.75rem 1.25rem', flex: 1 }}>
                                {/* Valor */}
                                <div style={{ marginBottom: param.observacoes ? '0.75rem' : 0 }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <FileText size={10} /> Valor
                                    </div>
                                    <div style={{
                                        fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--color-text)',
                                        background: 'var(--color-bg-input)', padding: '0.5rem 0.75rem',
                                        borderRadius: 'var(--radius-sm)',
                                        wordBreak: 'break-all',
                                    }}>
                                        {param.valor || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>(vazio)</span>}
                                    </div>
                                </div>

                                {/* Observações */}
                                {param.observacoes && (
                                    <div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <MessageSquare size={10} /> Observações
                                        </div>
                                        <div style={{
                                            fontSize: '0.8125rem', color: 'var(--color-text-secondary)',
                                            lineHeight: 1.5, whiteSpace: 'pre-wrap',
                                        }}>
                                            {param.observacoes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Settings size={20} /> {editing ? 'Editar Parâmetro' : 'Novo Parâmetro'}
                            </h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} style={{ padding: '0.25rem' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Chave (.env)</label>
                                    <input
                                        type="text" className="form-input" value={formChave}
                                        onChange={(e) => setFormChave(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                                        placeholder="Ex: MEDIAMTX_HLS_URL" required id="input-param-chave"
                                        style={{ fontFamily: 'monospace' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Valor</label>
                                    <input
                                        type="text" className="form-input" value={formValor}
                                        onChange={(e) => setFormValor(e.target.value)}
                                        placeholder="Ex: http://192.168.70.216:8888" id="input-param-valor"
                                        style={{ fontFamily: 'monospace' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nome (descrição amigável)</label>
                                    <input
                                        type="text" className="form-input" value={formNome}
                                        onChange={(e) => setFormNome(e.target.value)}
                                        placeholder="Ex: URL do servidor HLS" id="input-param-nome"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <textarea
                                        className="form-input" value={formObs}
                                        onChange={(e) => setFormObs(e.target.value)}
                                        placeholder="Ex: Endereço público do MediaMTX para acesso via navegador..."
                                        rows={3} id="input-param-obs"
                                        style={{ resize: 'vertical', minHeight: '4rem' }}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" id="btn-save-param">
                                    <Save size={16} /> {editing ? 'Atualizar' : 'Cadastrar'}
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
