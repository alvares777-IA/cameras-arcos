import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Playback from './pages/Playback'
import Cameras from './pages/Cameras'
import Pessoas from './pages/Pessoas'
import Grupos from './pages/Grupos'

export default function App() {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="app-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/playback" element={<Playback />} />
                    <Route path="/cameras" element={<Cameras />} />
                    <Route path="/pessoas" element={<Pessoas />} />
                    <Route path="/grupos" element={<Grupos />} />
                </Routes>
            </main>
        </div>
    )
}
