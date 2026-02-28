import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { RefreshCw, WifiOff } from 'lucide-react'

const MAX_AUTO_RETRIES = 5
const LOAD_TIMEOUT_MS = 15000 // 15s timeout for initial load
const RETRY_DELAY_MS = 3000

export default function HlsPlayer({ src, autoPlay = true, muted = true, className = '' }) {
    const videoRef = useRef(null)
    const hlsRef = useRef(null)
    const timeoutRef = useRef(null)
    const retryCountRef = useRef(0)
    const mountedRef = useRef(true)

    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(true)
    const [retrying, setRetrying] = useState(false)

    const cleanup = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
        if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
        }
        const video = videoRef.current
        if (video) {
            video.removeAttribute('src')
            video.load()
        }
    }, [])

    const loadStream = useCallback(() => {
        const video = videoRef.current
        if (!video || !src || !mountedRef.current) return

        cleanup()
        setError(null)
        setLoading(true)
        setRetrying(false)

        // Timeout: if not loaded in N seconds, auto-retry
        timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return
            if (retryCountRef.current < MAX_AUTO_RETRIES) {
                retryCountRef.current++
                console.warn(`[HLS] Timeout ao carregar, tentativa ${retryCountRef.current}/${MAX_AUTO_RETRIES}`)
                setRetrying(true)
                setTimeout(() => loadStream(), RETRY_DELAY_MS)
            } else {
                setLoading(false)
                setError('Stream indisponível. Verifique a conexão.')
            }
        }, LOAD_TIMEOUT_MS)

        const onSuccess = () => {
            if (!mountedRef.current) return
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
            retryCountRef.current = 0
            setLoading(false)
            setError(null)
            if (autoPlay) video.play().catch(() => { })
        }

        const onError = () => {
            if (!mountedRef.current) return
            clearTimeout(timeoutRef.current)
            if (retryCountRef.current < MAX_AUTO_RETRIES) {
                retryCountRef.current++
                console.warn(`[HLS] Erro, tentativa ${retryCountRef.current}/${MAX_AUTO_RETRIES}`)
                setRetrying(true)
                setTimeout(() => loadStream(), RETRY_DELAY_MS)
            } else {
                setLoading(false)
                setError('Não foi possível carregar o stream.')
            }
        }

        // ---- Native HLS (iOS Safari) ----
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src
            video.addEventListener('loadedmetadata', onSuccess, { once: true })
            video.addEventListener('error', onError, { once: true })
            return
        }

        // ---- HLS.js (Chrome, Firefox, Android) ----
        if (!Hls.isSupported()) {
            setError('Navegador não suporta HLS')
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
            manifestLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 2000,
            levelLoadingMaxRetry: 3,
            levelLoadingRetryDelay: 2000,
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 2000,
        })

        hlsRef.current = hls
        hls.loadSource(src)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, onSuccess)

        hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
                console.warn('[HLS] Erro fatal:', data.type, data.details)
                hls.destroy()
                hlsRef.current = null
                onError()
            }
        })
    }, [src, autoPlay, cleanup])

    // Manual retry (resets counter)
    const handleRetry = useCallback(() => {
        retryCountRef.current = 0
        loadStream()
    }, [loadStream])

    useEffect(() => {
        mountedRef.current = true
        retryCountRef.current = 0
        loadStream()

        return () => {
            mountedRef.current = false
            cleanup()
        }
    }, [src, loadStream, cleanup])

    return (
        <div className={`video-container ${className}`}>
            <video
                ref={videoRef}
                muted={muted}
                playsInline
                controls
                style={{ width: '100%', height: '100%' }}
            />

            {/* Loading / Retrying overlay */}
            {loading && !error && (
                <div className="video-loading">
                    <div className="spinner" />
                    <span style={{ fontSize: '0.8125rem' }}>
                        {retrying
                            ? `Reconectando... (${retryCountRef.current}/${MAX_AUTO_RETRIES})`
                            : 'Conectando ao stream...'}
                    </span>
                </div>
            )}

            {/* Error overlay with retry button */}
            {error && (
                <div className="video-loading">
                    <WifiOff size={28} style={{ color: 'var(--color-danger)', opacity: 0.7 }} />
                    <span style={{ color: 'var(--color-danger)', fontSize: '0.8125rem', textAlign: 'center' }}>
                        {error}
                    </span>
                    <button
                        onClick={handleRetry}
                        style={{
                            marginTop: '0.5rem',
                            display: 'flex', alignItems: 'center', gap: '0.375rem',
                            padding: '0.5rem 1rem',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--color-accent)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'}
                    >
                        <RefreshCw size={14} /> Tentar novamente
                    </button>
                </div>
            )}
        </div>
    )
}
