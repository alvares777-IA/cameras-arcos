import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { RefreshCw, WifiOff } from 'lucide-react'

const LOAD_TIMEOUT_MS = 15000

const DEFAULTS = {
    lowLatencyMode: true,
    maxBufferLength: 10,
    backBufferLength: 30,
    liveSyncDuration: 3,
    liveMaxLatencyDuration: 10,
    maxAutoRetries: 5,
    retryDelayMs: 3000,
}

export default function HlsPlayer({ src, autoPlay = true, muted = true, className = '', hlsConfig = {} }) {
    const cfg = { ...DEFAULTS, ...hlsConfig }

    const videoRef = useRef(null)
    const containerRef = useRef(null)
    const hlsRef = useRef(null)
    const timeoutRef = useRef(null)
    const retryCountRef = useRef(0)
    const mountedRef = useRef(true)
    const isVisibleRef = useRef(false)
    // Refs para o observer sempre usar a versão mais recente das funções
    const loadStreamRef = useRef(null)
    const cleanupRef = useRef(null)

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

        const maxRetries = cfg.maxAutoRetries
        const baseDelay = cfg.retryDelayMs

        // Backoff exponencial: 3s → 6s → 12s → ... cap 30s
        const scheduleRetry = () => {
            if (!mountedRef.current) return
            if (retryCountRef.current >= maxRetries) {
                setLoading(false)
                setError('Stream indisponível. Verifique a conexão.')
                return
            }
            retryCountRef.current++
            const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current - 1), 30000)
            console.warn(`[HLS] Retry ${retryCountRef.current}/${maxRetries} em ${delay}ms`)
            setRetrying(true)
            setTimeout(() => {
                if (mountedRef.current && isVisibleRef.current) loadStreamRef.current?.()
            }, delay)
        }

        timeoutRef.current = setTimeout(() => {
            if (mountedRef.current) scheduleRetry()
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
            scheduleRetry()
        }

        // Native HLS (iOS Safari)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src
            video.addEventListener('loadedmetadata', onSuccess, { once: true })
            video.addEventListener('error', onError, { once: true })
            return
        }

        if (!Hls.isSupported()) {
            setError('Navegador não suporta HLS')
            setLoading(false)
            return
        }

        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: cfg.lowLatencyMode,
            backBufferLength: cfg.backBufferLength,
            maxBufferLength: cfg.maxBufferLength,
            liveSyncDuration: cfg.liveSyncDuration,
            liveMaxLatencyDuration: cfg.liveMaxLatencyDuration,
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
    }, [
        src, autoPlay, cleanup,
        cfg.lowLatencyMode, cfg.maxBufferLength, cfg.backBufferLength,
        cfg.liveSyncDuration, cfg.liveMaxLatencyDuration,
        cfg.maxAutoRetries, cfg.retryDelayMs,
    ])

    // Mantém refs sempre atualizados (usados pelo observer e pelos retries)
    useEffect(() => { loadStreamRef.current = loadStream }, [loadStream])
    useEffect(() => { cleanupRef.current = cleanup }, [cleanup])

    // IntersectionObserver: lazy loading — roda apenas uma vez no mount
    // Quando o player sai do viewport: destrói HLS (libera CPU/rede)
    // Quando entra no viewport: reinicializa HLS
    // IMPORTANTE: não afeta o backend — gravação roda independentemente
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const observer = new IntersectionObserver(([entry]) => {
            const wasVisible = isVisibleRef.current
            isVisibleRef.current = entry.isIntersecting

            if (entry.isIntersecting && !wasVisible) {
                retryCountRef.current = 0
                loadStreamRef.current?.()
            } else if (!entry.isIntersecting && wasVisible) {
                cleanupRef.current?.()
                setLoading(true)
                setError(null)
                setRetrying(false)
            }
        }, { threshold: 0.1 })

        observer.observe(container)
        return () => observer.disconnect()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Reage a mudanças de src ou hlsConfig
    useEffect(() => {
        mountedRef.current = true
        retryCountRef.current = 0
        if (isVisibleRef.current) loadStream()

        return () => {
            mountedRef.current = false
            cleanup()
        }
    }, [src, loadStream, cleanup])

    const handleRetry = useCallback(() => {
        retryCountRef.current = 0
        if (isVisibleRef.current) loadStream()
    }, [loadStream])

    return (
        <div ref={containerRef} className={`video-container ${className}`}>
            <video
                ref={videoRef}
                muted={muted}
                playsInline
                controls
                style={{ width: '100%', height: '100%' }}
            />

            {loading && !error && (
                <div className="video-loading">
                    <div className="spinner" />
                    <span style={{ fontSize: '0.8125rem' }}>
                        {retrying
                            ? `Reconectando... (${retryCountRef.current}/${cfg.maxAutoRetries})`
                            : 'Conectando ao stream...'}
                    </span>
                </div>
            )}

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
