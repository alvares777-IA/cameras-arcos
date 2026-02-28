import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Save, Shield, Camera, Menu as MenuIcon, User, ChevronRight } from 'lucide-react'
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario, updateUsuarioMenus, updateUsuarioCameras, getAllMenus, getAllCameras } from '../api/client'

export default function Usuarios({ currentUser }) {
    const [usuarios, setUsuarios] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [toast, setToast] = useState(null)
    const [formLogin, setFormLogin] = useState('')
    const [formSenha, setFormSenha] = useState('')
    const [formNome, setFormNome] = useState('')
    const [formFuncao, setFormFuncao] = useState('')

    // Permissions modal
    const [permUser, setPermUser] = useState(null)
    const [permTab, setPermTab] = useState('menus')
    const [allMenus, setAllMenus] = useState([])
    const [allCameras, setAllCameras] = useState([])
    const [selectedMenus, setSelectedMenus] = useState([])
    const [selectedCameras, setSelectedCameras] = useState([])
    const [savingPerm, setSavingPerm] = useState(false)

    const fetchUsuarios = async () => {
        try { setLoading(true); const { data } = await getUsuarios(); setUsuarios(data) }
        catch { showToast('Erro ao carregar usuários', 'error') }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchUsuarios() }, [])

    const showToast = (message, type = 'success') => {
        setToast({ message, type }); setTimeout(() => setToast(null), 3000)
    }

    const openNewModal = () => {
        setEditing(null); setFormLogin(''); setFormSenha(''); setFormNome(''); setFormFuncao(''); setShowModal(true)
    }

    const openEditModal = (u) => {
        setEditing(u); setFormLogin(u.no_login); setFormSenha(''); setFormNome(u.no_usuario); setFormFuncao(u.tx_funcao || ''); setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const payload = { no_login: formLogin, no_usuario: formNome, tx_funcao: formFuncao || null }
            if (editing) {
                if (formSenha.trim()) payload.no_senha = formSenha
                await updateUsuario(editing.id_usuario, payload)
                showToast('Usuário atualizado!')
            } else {
                payload.no_senha = formSenha
                await createUsuario(payload)
                showToast('Usuário criado!')
            }
            setShowModal(false); fetchUsuarios()
        } catch (err) {
            showToast(err.response?.data?.detail || 'Erro ao salvar', 'error')
        }
    }

    const handleDelete = async (u) => {
        if (!confirm(`Excluir "${u.no_usuario}"?`)) return
        try { await deleteUsuario(u.id_usuario); showToast('Usuário excluído!'); fetchUsuarios() }
        catch (err) { showToast(err.response?.data?.detail || 'Erro ao excluir', 'error') }
    }

    const openPermModal = async (u) => {
        setPermUser(u); setPermTab('menus')
        setSelectedMenus(u.menus.map(m => m.id_menu))
        setSelectedCameras(u.cameras || [])
        try {
            const [menusRes, camerasRes] = await Promise.all([getAllMenus(), getAllCameras()])
            // Filter: only show menus/cameras that I have permission to
            const myMenuIds = currentUser?.menus?.map(m => m.id_menu) || []
            const myCameraIds = currentUser?.cameras || []
            setAllMenus(menusRes.data.filter(m => myMenuIds.includes(m.id_menu)))
            setAllCameras(camerasRes.data.filter(c => myCameraIds.includes(c.id)))
        } catch { showToast('Erro ao carregar permissões', 'error') }
    }

    const toggleMenu = (id) => {
        setSelectedMenus(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const toggleCamera = (id) => {
        setSelectedCameras(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const savePermissions = async () => {
        setSavingPerm(true)
        try {
            await updateUsuarioMenus(permUser.id_usuario, selectedMenus)
            await updateUsuarioCameras(permUser.id_usuario, selectedCameras)
            showToast('Permissões salvas!')
            setPermUser(null); fetchUsuarios()
        } catch (err) {
            showToast(err.response?.data?.detail || 'Erro ao salvar permissões', 'error')
        } finally { setSavingPerm(false) }
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={28} /> Usuários
                    </h1>
                    <p className="page-subtitle">Gerencie usuários e permissões de acesso</p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal} id="btn-add-user">
                    <Plus size={16} /> Novo Usuário
                </button>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /><p style={{ marginTop: '1rem' }}>Carregando...</p></div>
            ) : usuarios.length === 0 ? (
                <div className="empty-state">
                    <Shield size={48} />
                    <p style={{ fontSize: '1.125rem', fontWeight: 500, marginTop: '0.5rem' }}>Nenhum usuário</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr><th>ID</th><th>Login</th><th>Nome</th><th>Função</th><th>Menus</th><th>Câmeras</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                            {usuarios.map((u) => (
                                <tr key={u.id_usuario}>
                                    <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>#{u.id_usuario}</td>
                                    <td><code style={{ fontSize: '0.8125rem', background: 'var(--color-bg-input)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{u.no_login}</code></td>
                                    <td style={{ fontWeight: 500 }}>{u.no_usuario}</td>
                                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{u.tx_funcao || '—'}</td>
                                    <td>
                                        <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>
                                            <MenuIcon size={10} /> {u.menus?.length || 0}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>
                                            <Camera size={10} /> {u.cameras?.length || 0}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openPermModal(u)} title="Permissões" id={`btn-perm-${u.id_usuario}`}>
                                                <Shield size={14} /> Permissões
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(u)} title="Editar" id={`btn-edit-${u.id_usuario}`}>
                                                <Pencil size={14} />
                                            </button>
                                            {u.no_login !== 'admin' && (
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)} title="Excluir" id={`btn-delete-${u.id_usuario}`}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal CRUD */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><User size={20} /> {editing ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} style={{ padding: '0.25rem' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Login</label>
                                    <input type="text" className="form-input" value={formLogin} onChange={(e) => setFormLogin(e.target.value)} placeholder="admin" required id="input-user-login" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Senha {editing && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(deixe vazio para manter)</span>}</label>
                                    <input type="password" className="form-input" value={formSenha} onChange={(e) => setFormSenha(e.target.value)} placeholder={editing ? '••••••' : 'Senha'} required={!editing} id="input-user-senha" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nome Completo</label>
                                    <input type="text" className="form-input" value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="João da Silva" required id="input-user-nome" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Função</label>
                                    <input type="text" className="form-input" value={formFuncao} onChange={(e) => setFormFuncao(e.target.value)} placeholder="Operador" id="input-user-funcao" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" id="btn-save-user"><Save size={16} /> {editing ? 'Atualizar' : 'Cadastrar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Permissões */}
            {permUser && (
                <div className="modal-overlay" onClick={() => setPermUser(null)}>
                    <div className="modal-content" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Shield size={20} /> Permissões — {permUser.no_usuario}
                            </h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPermUser(null)} style={{ padding: '0.25rem' }}><X size={16} /></button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
                            {['menus', 'cameras'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setPermTab(tab)}
                                    style={{
                                        flex: 1, padding: '0.75rem', background: 'none', border: 'none',
                                        borderBottom: permTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
                                        color: permTab === tab ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                        fontWeight: permTab === tab ? 600 : 400, cursor: 'pointer', fontSize: '0.875rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {tab === 'menus' ? <><MenuIcon size={16} /> Menus</> : <><Camera size={16} /> Câmeras</>}
                                </button>
                            ))}
                        </div>

                        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {permTab === 'menus' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {allMenus.length === 0 ? (
                                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>Nenhum menu disponível</p>
                                    ) : allMenus.map(menu => (
                                        <label
                                            key={menu.id_menu}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)',
                                                background: selectedMenus.includes(menu.id_menu) ? 'rgba(59,130,246,0.08)' : 'var(--color-bg-input)',
                                                border: selectedMenus.includes(menu.id_menu) ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--color-border)',
                                                cursor: 'pointer', transition: 'all 0.15s ease',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedMenus.includes(menu.id_menu)}
                                                onChange={() => toggleMenu(menu.id_menu)}
                                                style={{ accentColor: 'var(--color-accent)' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{menu.no_menu}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{menu.tx_link}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {allCameras.length === 0 ? (
                                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>Nenhuma câmera disponível</p>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCameras(allCameras.map(c => c.id))}>
                                                    Selecionar Todas
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCameras([])}>
                                                    Limpar
                                                </button>
                                            </div>
                                            {allCameras.map(cam => (
                                                <label
                                                    key={cam.id}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                        padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)',
                                                        background: selectedCameras.includes(cam.id) ? 'rgba(59,130,246,0.08)' : 'var(--color-bg-input)',
                                                        border: selectedCameras.includes(cam.id) ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--color-border)',
                                                        cursor: 'pointer', transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCameras.includes(cam.id)}
                                                        onChange={() => toggleCamera(cam.id)}
                                                        style={{ accentColor: 'var(--color-accent)' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{cam.nome}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{cam.rtsp_url}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setPermUser(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={savePermissions} disabled={savingPerm} id="btn-save-perm">
                                <Save size={16} /> {savingPerm ? 'Salvando...' : 'Salvar Permissões'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
        </div>
    )
}
