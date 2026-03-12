import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

/**
 * Botão de ajuda (?) que exibe um modal com informações contextuais sobre a tela.
 * @param {string} title - Título da ajuda
 * @param {Array} sections - Array de { subtitle, content } para exibir
 */
export default function HelpButton({ title, sections = [] }) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                className="btn btn-secondary btn-sm"
                onClick={() => setOpen(true)}
                title="Ajuda sobre esta tela"
                style={{
                    padding: '0.35rem',
                    borderRadius: '50%',
                    width: '2rem',
                    height: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: 'var(--color-accent)',
                    transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))'
                    e.currentTarget.style.transform = 'scale(1.1)'
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(59,130,246,0.3)'
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))'
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = 'none'
                }}
                id="btn-help"
            >
                <HelpCircle size={16} />
            </button>

            {open && (
                <div className="modal-overlay" onClick={() => setOpen(false)} style={{ zIndex: 2000 }}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '640px',
                            maxHeight: '85vh',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {/* Header */}
                        <div className="modal-header" style={{
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))',
                            borderBottom: '1px solid rgba(59,130,246,0.2)',
                        }}>
                            <h3 style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'var(--color-accent)',
                            }}>
                                <HelpCircle size={20} />
                                {title || 'Ajuda'}
                            </h3>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setOpen(false)}
                                style={{ padding: '0.25rem' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '1.25rem 1.5rem',
                        }}>
                            {sections.map((section, idx) => (
                                <div key={idx} style={{
                                    marginBottom: idx < sections.length - 1 ? '1.25rem' : 0,
                                }}>
                                    {section.subtitle && (
                                        <h4 style={{
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--color-text-primary)',
                                            marginBottom: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.375rem',
                                        }}>
                                            {section.icon && <span style={{ fontSize: '1rem' }}>{section.icon}</span>}
                                            {section.subtitle}
                                        </h4>
                                    )}
                                    <div style={{
                                        fontSize: '0.8125rem',
                                        color: 'var(--color-text-secondary)',
                                        lineHeight: '1.7',
                                        background: 'var(--color-bg-input)',
                                        padding: '0.875rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                    }}>
                                        {typeof section.content === 'string'
                                            ? section.content.split('\n').map((line, i) => (
                                                <p key={i} style={{ margin: i > 0 ? '0.5rem 0 0 0' : 0 }}>
                                                    {line}
                                                </p>
                                            ))
                                            : section.content
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="modal-footer">
                            <button
                                className="btn btn-primary"
                                onClick={() => setOpen(false)}
                            >
                                Entendi!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
