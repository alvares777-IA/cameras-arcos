import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

export default function HlsPlayer({ src, autoPlay = true, muted = true, className = '' }) {
    const videoRef = useRef(null)
    const hlsRef = useRef(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const video = videoRef.current
        if (!video || !src) return

        setError(null)
        setLoading(true)

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src
            video.addEventListener('loadedmetadata', () => {
                setLoading(false)
                if (autoPlay) video.play().catch(() => { })
            })
            return
        }

        if (!Hls.isSupported()) {
            setError('Seu navegador não suporta reprodução HLS')
            setLoading(false)
            return
        }

        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            maxBufferLength: 10,
            liveSyncDuration: 3,
            liveMaxLatencyDuration: 10,
            liveDurationInfinity: true,
            manifestLoadingMaxRetry: 30,
            manifestLoadingRetryDelay: 2000,
            levelLoadingMaxRetry: 20,
            levelLoadingRetryDelay: 2000,
            fragLoadingMaxRetry: 20,
            fragLoadingRetryDelay: 2000,
        })

        hlsRef.current = hls
        hls.loadSource(src)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setLoading(false)
            if (autoPlay) video.play().catch(() => { })
        })

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.warn('[HLS] Erro de rede, tentando novamente...')
                        setTimeout(() => hls.startLoad(), 3000)
                        break
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError()
                        break
                    default:
                        setError('Erro ao reproduzir o stream')
                        hls.destroy()
                        break
                }
            }
        })

        return () => { hls.destroy(); hlsRef.current = null }
    }, [src, autoPlay])

    return (
        <div className={`video-container ${className}`}>
            <video ref={videoRef} muted={muted} playsInline controls style={{ width: '100%', height: '100%' }} />
            {loading && !error && (
                <div className="video-loading">
                    <div className="spinner" />
                    <span style={{ fontSize: '0.8125rem' }}>Conectando ao stream...</span>
                </div>
            )}
            {error && (
                <div className="video-loading">
                    <span style={{ color: 'var(--color-danger)', fontSize: '0.8125rem' }}>{error}</span>
                </div>
            )}
        </div>
    )
}
