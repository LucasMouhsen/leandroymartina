import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWedding } from '../context/useWedding.jsx'

const AUTOPLAY_BLOCKED_LABEL = 'Toca en cualquier parte para escuchar la musica'
const AUDIO_START_OFFSET = 0.5
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

export default function InvitationPage() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const { weddingEvent } = useWedding()

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return undefined
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const seekToStartOffset = () => {
      if (audio.currentTime < AUDIO_START_OFFSET) {
        audio.currentTime = AUDIO_START_OFFSET
      }
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('loadedmetadata', seekToStartOffset)
    audio.addEventListener('canplay', seekToStartOffset)

    const attemptAutoplay = async () => {
      try {
        seekToStartOffset()
        await audio.play()
        setAutoplayBlocked(false)
      } catch {
        setIsPlaying(false)
        setAutoplayBlocked(true)
      }
    }

    attemptAutoplay()

    const handleFirstInteraction = () => {
      if (!audio.paused) {
        return
      }

      attemptAutoplay()
    }

    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true })
    window.addEventListener('keydown', handleFirstInteraction)
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true })

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('loadedmetadata', seekToStartOffset)
      audio.removeEventListener('canplay', seekToStartOffset)
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
      window.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [])

  const toggleAudio = async () => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (audio.paused) {
      try {
        if (audio.currentTime < AUDIO_START_OFFSET) {
          audio.currentTime = AUDIO_START_OFFSET
        }
        await audio.play()
        setAutoplayBlocked(false)
      } catch {
        setIsPlaying(false)
        setAutoplayBlocked(true)
      }
      return
    }

    audio.pause()
  }

  return (
    <div className="site-shell">
      <audio
        ref={audioRef}
        src={asset('assets/original/bg-audio.m4a')}
        loop
        playsInline
        preload="none"
      />

      <main className="invitation-page">
        <section className="hero-section">
          <div className="hero-stage">
            <img
              className="hero-background"
              src={asset('assets/optimized/hero-photo.webp')}
              alt=""
              aria-hidden="true"
              decoding="async"
              fetchPriority="high"
            />

            <div className="hero-copy invitation-enter invitation-enter--delay-1">
              <h1 className="hero-title">
                <span>Leandro</span>
                <span className="hero-connector">y</span>
                <span>Martina</span>
              </h1>
              <p className="hero-date">10 de octubre 2026</p>
            </div>
          </div>
        </section>

        <section className="olive-panel intro-panel">
          <div className="intro-stage">
            <img
              className="panel-background"
              src={asset('assets/optimized/gallery-bg.webp')}
              alt="Lirio acuarelado de fondo"
              loading="lazy"
              decoding="async"
            />

            <div className="intro-copy">
              <h2 className="script-heading">
                &iexcl;Nos casamos!
              </h2>
              <p>
                Te invitamos a celebrar con nosotros el dia que decimos Si para
                toda la vida
              </p>

              <button
                className="audio-button"
                type="button"
                onClick={toggleAudio}
              >
                <img
                  src={asset('assets/optimized/candidate-mahg9.webp')}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
              </button>

              {autoplayBlocked && !isPlaying ? (
                <p className="audio-note">{AUTOPLAY_BLOCKED_LABEL}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="ceremony-section">
          <div className="ceremony-sprig" aria-hidden="true">
            <img src={asset('assets/optimized/floral-cluster.webp')} alt="" loading="lazy" decoding="async" />
          </div>

          <div className="ceremony-layout">
            <div className="ceremony-copy">
              <h2 className="section-title">
                CEREMONIA
              </h2>
              <p className="section-place">
                Parroquia
                <br />
                Nuestra Senora del Valle
              </p>
              <div className="section-divider" aria-hidden="true">
                <img src={asset('assets/original/divider-light.svg')} alt="" />
              </div>
              <p className="section-time">
                15.00 hs
              </p>
              <a
                className="map-button map-button--olive"
                href="https://maps.app.goo.gl/8ESoqWCrHLbhzGQXA?g_st=ic"
                target="_blank"
                rel="noreferrer"
              >
                MAPA
              </a>
            </div>

            <img
              className="ceremony-image"
              src={asset('assets/optimized/ceremony-photo.webp')}
              alt="Ilustracion de la parroquia"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section className="olive-panel reception-section">
          <div className="reception-layout">
            <div className="reception-visual">
              <div className="reception-flower" aria-hidden="true">
                <img src={asset('assets/optimized/reception-photo.webp')} alt="" loading="lazy" decoding="async" />
              </div>

              <img
                className="reception-image"
                src={asset('assets/optimized/party-photo.webp')}
                alt="Club Hipico San Jorge"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="reception-details">
              <div className="reception-copy">
                <h2 className="reception-title">
                  RECEPCION
                </h2>
                <p className="reception-script">
                  y celebracion
                </p>
              </div>

              <p className="reception-place">
                Club Hipico San Jorge
              </p>
              <div className="reception-divider" aria-hidden="true">
                <img src={asset('assets/original/divider-dark.svg')} alt="" />
              </div>
              <p className="section-time section-time--light">
                17.30 hs
              </p>
              <a
                className="map-button map-button--gold"
                href="https://maps.app.goo.gl/SE1GHd4DBEHC2mET6?g_st=ic"
                target="_blank"
                rel="noreferrer"
              >
                MAPA
              </a>
            </div>
          </div>
        </section>

        <section className="gifts-section">
          <div className="gifts-layout">
            <div className="gifts-message">
              <h2 className="gifts-title">
                &iexcl;Tu presencia es lo mas importante para nosotros!
              </h2>
              <p className="gifts-copy">
                Si ademas te gustaria ayudarnos con nuestra luna de miel y
                proyectos futuros, te compartimos los datos
              </p>
            </div>

            <div className="gifts-bank">
              <div className="gifts-spray" aria-hidden="true">
                <img
                  className="gift-stem gift-stem--eucalyptus"
                  src={asset('assets/optimized/dress-shape-1.webp')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="gift-stem gift-stem--wheat"
                  src={asset('assets/optimized/dress-shape-3.webp')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="gift-stem gift-stem--mimosa"
                  src={asset('assets/optimized/dress-shape-4.webp')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="gift-stem gift-stem--cluster"
                  src={asset('assets/optimized/floral-cluster.webp')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </div>

              <div className="gift-details">
                {weddingEvent.giftInstructions.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="olive-panel dress-section">
          <img
            className="dress-background"
            src={asset('assets/optimized/gallery-bg.webp')}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />

          <div className="dress-content">
            <div className="dress-heading">
              <span className="dress-script">Dress</span>
              <span className="dress-code-word">CODE</span>
            </div>

            <img
              className="dress-illustration"
              src={asset('assets/original/dress-card.svg')}
              alt="Ilustracion de dress code elegante"
              loading="lazy"
              decoding="async"
            />

            <p className="dress-label">
              ELEGANTE
            </p>
            <div className="reception-divider dress-divider" aria-hidden="true">
              <img src={asset('assets/original/divider-dark.svg')} alt="" />
            </div>
          </div>
        </section>

        <section className="rsvp-section">
          <img
            className="rsvp-background"
            src={asset('assets/optimized/hero-photo.webp')}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />

          <div className="rsvp-copy">
            <h2>&iexcl;Confirmanos tu asistencia!</h2>
            <button
              className="map-button map-button--olive"
              type="button"
              disabled
              title="El export original no expone el enlace publico de RSVP"
            >
              RSVP
            </button>
            <img
              className="rsvp-icon"
              src={asset('assets/optimized/rsvp-icon.webp')}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>
      </main>

      <aside className="portal-dock">
        <div className="portal-dock__label">
          <span>Funciones nuevas</span>
          <strong>Demo operativa</strong>
        </div>
        <div className="portal-dock__actions">
          <Link to="/confirmar/familia-garcia-2026">RSVP</Link>
          <Link to="/regalos">Regalos</Link>
          <Link to="/mensajes">Mensajes</Link>
          <Link to="/admin/login">Panel</Link>
        </div>
      </aside>
    </div>
  )
}
