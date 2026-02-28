import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Playback from './pages/Playback'
import Cameras from './pages/Cameras'
import Pessoas from './pages/Pessoas'
import Grupos from './pages/Grupos'
import Parametros from './pages/Parametros'
import Usuarios from './pages/Usuarios'
import Login from './pages/Login'
import { apiLogin, apiGetMe, apiLogout } from './api/client'

export default function App() {
    const [user, setUser] = useState(null)
    const [checking, setChecking] = useState(true)

    // Verifica sessão ativa ao abrir
    useEffect(() => {
        apiGetMe()
            .then(({ data }) => setUser(data))
            .catch(() => setUser(null))
            .finally(() => setChecking(false))
    }, [])

    const handleLogin = async (login, senha) => {
        const { data } = await apiLogin(login, senha)
        setUser(data.usuario)
    }

    const handleLogout = async () => {
        await apiLogout()
        setUser(null)
    }

    if (checking) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-bg-primary)',
            }}>
                <div className="spinner" />
            </div>
        )
    }

    if (!user) {
        return <Login onLogin={handleLogin} />
    }

    return (
        <div className="app-layout">
            <Sidebar user={user} onLogout={handleLogout} />
            <main className="app-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/playback" element={<Playback />} />
                    <Route path="/cameras" element={<Cameras />} />
                    <Route path="/pessoas" element={<Pessoas />} />
                    <Route path="/grupos" element={<Grupos />} />
                    <Route path="/parametros" element={<Parametros />} />
                    <Route path="/usuarios" element={<Usuarios currentUser={user} />} />
                    <Route path="/login" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    )
}
