import { useState } from 'react'
import { Activity, LogIn, Eye, EyeOff } from 'lucide-react'

export default function Login({ onLogin }) {
    const [login, setLogin] = useState('')
    const [senha, setSenha] = useState('')
    const [showSenha, setShowSenha] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await onLogin(login, senha)
        } catch (err) {
            setError(err.response?.data?.detail || 'Login ou senha inválidos')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            padding: '1rem',
        }}>
            <div style={{
                width: '100%', maxWidth: '400px',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                padding: '2.5rem 2rem',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '1rem',
                    }}>
                        <Activity size={24} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Câmeras Arcos</h1>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Faça login para continuar</p>
                </div>

                {error && (
                    <div style={{
                        padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444', fontSize: '0.8125rem', marginBottom: '1.25rem', textAlign: 'center',
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Login</label>
                        <input
                            type="text" className="form-input" value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            placeholder="Seu login" required autoFocus id="input-login"
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Senha</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showSenha ? 'text' : 'password'} className="form-input" value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                placeholder="Sua senha" required id="input-senha"
                                style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowSenha(!showSenha)}
                                style={{
                                    position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-text-muted)', padding: '0.25rem',
                                }}
                            >
                                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit" className="btn btn-primary" disabled={loading}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}
                        id="btn-login"
                    >
                        {loading
                            ? <><span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> Entrando...</>
                            : <><LogIn size={18} /> Entrar</>}
                    </button>
                </form>
            </div>
        </div>
    )
}
