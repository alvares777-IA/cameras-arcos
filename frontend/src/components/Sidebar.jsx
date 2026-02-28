import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard, PlayCircle, Camera, Menu, X, Activity,
    UserCircle, FolderOpen, Settings, Shield, LogOut,
} from 'lucide-react'

// Mapa de ícones por rota
const iconMap = {
    '/': LayoutDashboard,
    '/playback': PlayCircle,
    '/cameras': Camera,
    '/grupos': FolderOpen,
    '/pessoas': UserCircle,
    '/parametros': Settings,
    '/usuarios': Shield,
}

export default function Sidebar({ user, onLogout }) {
    const [open, setOpen] = useState(false)
    const location = useLocation()

    // Menus do usuário logado
    const menus = user?.menus || []

    return (
        <>
            {/* Mobile toggle */}
            <button
                className="btn btn-secondary"
                onClick={() => setOpen(!open)}
                aria-label="Menu"
                style={{
                    position: 'fixed', top: '1rem', left: '1rem', zIndex: 1100,
                    display: 'none', padding: '0.5rem',
                }}
                id="sidebar-toggle"
            >
                {open ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Overlay */}
            {open && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
                    onClick={() => setOpen(false)}
                />
            )}

            <aside
                style={{
                    width: '260px', background: 'var(--color-bg-secondary)',
                    borderRight: '1px solid var(--color-border)', display: 'flex',
                    flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0,
                    zIndex: 1000, transform: open ? 'translateX(0)' : undefined,
                    transition: 'transform 0.3s ease',
                }}
                className="sidebar" id="sidebar"
            >
                {/* Logo */}
                <div style={{
                    padding: '1.5rem 1.25rem', borderBottom: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                    <div style={{
                        width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Activity size={18} color="white" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
                            Câmeras Arcos
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                            Monitoramento
                        </div>
                    </div>
                </div>

                {/* Navigation - dynamic from user menus */}
                <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
                    <div style={{
                        fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.5rem',
                    }}>
                        Menu
                    </div>

                    {menus.map(({ tx_link, no_menu }) => {
                        const Icon = iconMap[tx_link] || LayoutDashboard
                        const isActive = location.pathname === tx_link
                        return (
                            <NavLink
                                key={tx_link} to={tx_link} onClick={() => setOpen(false)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)',
                                    color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                    background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    textDecoration: 'none', fontSize: '0.875rem',
                                    fontWeight: isActive ? 600 : 400, transition: 'all 0.2s ease', marginBottom: '0.25rem',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'var(--color-bg-card-hover)'
                                        e.currentTarget.style.color = 'var(--color-text-primary)'
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent'
                                        e.currentTarget.style.color = 'var(--color-text-secondary)'
                                    }
                                }}
                            >
                                <Icon size={18} />
                                {no_menu}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* User info + Logout */}
                <div style={{
                    padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        marginBottom: '0.75rem',
                    }}>
                        <div style={{
                            width: '2rem', height: '2rem', borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 700, color: 'white',
                        }}>
                            {user?.no_usuario?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.no_usuario || 'Usuário'}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                                {user?.tx_funcao || user?.no_login}
                            </div>
                        </div>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={onLogout}
                        style={{
                            width: '100%', justifyContent: 'center', gap: '0.5rem',
                            padding: '0.5rem', fontSize: '0.8125rem',
                        }}
                        id="btn-logout"
                    >
                        <LogOut size={14} /> Sair
                    </button>
                </div>
            </aside>

            <style>{`
        @media (max-width: 767px) {
          #sidebar-toggle { display: flex !important; }
          #sidebar { transform: ${open ? 'translateX(0)' : 'translateX(-100%)'} !important; }
          .app-content { margin-left: 0 !important; }
        }
        @media (min-width: 768px) { .app-content { margin-left: 260px; } }
      `}</style>
        </>
    )
}
