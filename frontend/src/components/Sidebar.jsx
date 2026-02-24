import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlayCircle, Camera, Menu, X, Activity, UserCircle, FolderOpen } from 'lucide-react'

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/playback', icon: PlayCircle, label: 'Playback' },
    { to: '/cameras', icon: Camera, label: 'Câmeras' },
    { to: '/grupos', icon: FolderOpen, label: 'Grupos' },
    { to: '/pessoas', icon: UserCircle, label: 'Pessoas' },
]

export default function Sidebar() {
    const [open, setOpen] = useState(false)
    const location = useLocation()

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

                {/* Navigation */}
                <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
                    <div style={{
                        fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.5rem',
                    }}>
                        Menu
                    </div>

                    {navItems.map(({ to, icon: Icon, label }) => {
                        const isActive = location.pathname === to
                        return (
                            <NavLink
                                key={to} to={to} onClick={() => setOpen(false)}
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
                                {label}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)',
                    fontSize: '0.75rem', color: 'var(--color-text-muted)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: 'var(--color-success)', animation: 'pulse-badge 2s ease-in-out infinite',
                        }} />
                        Sistema Online
                    </div>
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
