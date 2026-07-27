import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SecondaryFooterNav from '../components/SecondaryFooterNav.jsx'
import { useWedding } from '../context/useWedding.jsx'

const AUDIO_START_OFFSET = 0.5
const ENVELOPE_OPEN_DELAY_MS = 1350
const AUDIO_ERROR_LABEL = 'No se pudo iniciar la musica. Usa el boton floral para intentarlo de nuevo.'
const asset = (path) => `${import.meta.env.BASE_URL}${path}`
const COUNTDOWN_PARTS = [
  { key: 'days', label: 'DIAS' },
  { key: 'hours', label: 'HS' },
  { key: 'minutes', label: 'MIN' },
  { key: 'seconds', label: 'SEG' },
]

function getCountdownParts(targetDate) {
  const distance = Math.max(targetDate.getTime() - Date.now(), 0)
  const totalSeconds = Math.floor(distance / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    days: String(days).padStart(3, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  }
}

function formatGoogleCalendarDate(value) {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

export default function InvitationPage() {
  const { token } = useParams()
  const audioRef = useRef(null)
  const userPausedRef = useRef(false)
  const openTimerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false)
  const [showInvitation, setShowInvitation] = useState(false)
  const { getInvitationByToken, weddingEvent } = useWedding()
  const invitation = token ? getInvitationByToken(token) : null
  const isPersonalInvitation = Boolean(token && invitation)
  const isInvalidPersonalInvitation = Boolean(token && !invitation)
  const countdownTarget = useMemo(
    () => new Date(weddingEvent.countdownTarget),
    [weddingEvent.countdownTarget],
  )
  const [countdownParts, setCountdownParts] = useState(() => getCountdownParts(countdownTarget))

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

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('loadedmetadata', seekToStartOffset)
      audio.removeEventListener('canplay', seekToStartOffset)
    }
  }, [])

  useEffect(() => {
    if (showInvitation) {
      return undefined
    }

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = overflow
    }
  }, [showInvitation])

  useEffect(() => (
    () => {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current)
      }
    }
  ), [])

  useEffect(() => {
    const updateCountdown = () => {
      setCountdownParts(getCountdownParts(countdownTarget))
    }

    const timeoutId = window.setTimeout(updateCountdown, 0)
    const intervalId = window.setInterval(updateCountdown, 1000)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [countdownTarget])

  const calendarStart = formatGoogleCalendarDate(countdownTarget)
  const calendarEnd = formatGoogleCalendarDate(new Date(countdownTarget.getTime() + 4 * 60 * 60 * 1000))
  const calendarUrl = new URL('https://calendar.google.com/calendar/render')
  calendarUrl.searchParams.set('action', 'TEMPLATE')
  calendarUrl.searchParams.set('text', `${weddingEvent.couple} - Casamiento`)
  calendarUrl.searchParams.set('dates', `${calendarStart}/${calendarEnd}`)
  calendarUrl.searchParams.set('details', 'Reserva la fecha para celebrar con nosotros.')
  calendarUrl.searchParams.set('location', weddingEvent.location)

  const startAudio = async () => {
    const audio = audioRef.current

    if (!audio) {
      return false
    }

    try {
      if (audio.currentTime < AUDIO_START_OFFSET) {
        audio.currentTime = AUDIO_START_OFFSET
      }

      await audio.play()
      userPausedRef.current = false
      setAudioNotice('')
      return true
    } catch {
      setIsPlaying(false)
      setAudioNotice(AUDIO_ERROR_LABEL)
      return false
    }
  }

  const handleOpenEnvelope = async () => {
    if (isEnvelopeOpen) {
      return
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    setIsEnvelopeOpen(true)
    await startAudio()

    openTimerRef.current = window.setTimeout(() => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      setShowInvitation(true)
    }, ENVELOPE_OPEN_DELAY_MS)
  }

  const toggleAudio = async () => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (audio.paused) {
      await startAudio()
      return
    }

    userPausedRef.current = true
    setAudioNotice('')
    audio.pause()
  }

  if (isInvalidPersonalInvitation) {
    return (
      <div className="site-shell invitation-shell">
        <main className="invitation-invalid">
          <div className="feature-empty__card">
            <p className="feature-kicker">Invitacion personalizada</p>
            <h1>Este enlace no es valido</h1>
            <p>
              Puede haber expirado o estar incompleto. Pediles a los novios que te
              reenvien tu invitacion personalizada.
            </p>
            <Link className="primary-button" to="/">
              Ver invitacion general
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="site-shell invitation-shell">
      <audio
        ref={audioRef}
        src={asset('assets/original/bg-audio.m4a')}
        loop
        playsInline
        preload="none"
      />

      <span
        className="player"
        onClick={toggleAudio}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void toggleAudio()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={isPlaying ? 'Pausar musica' : 'Reproducir musica'}
      >
        <div className="icon">
          <img
            src={asset(isPlaying ? 'assets/original/player-play.gif' : 'assets/original/player-pause.png')}
            alt=""
            aria-hidden="true"
          />
        </div>
      </span>

      <section
        className={`envelope-screen${isEnvelopeOpen ? ' envelope-screen--opening' : ''}${showInvitation ? ' envelope-screen--hidden' : ''}`}
        aria-label="Abrir invitacion"
      >
        <div className="envelope-frame">
          <div className="envelope-card">
            <div className="envelope-card__paper" aria-hidden="true" />
            <div className="envelope-card__back" aria-hidden="true" />
            <div className="envelope-card__flap" aria-hidden="true" />
            <div className="envelope-card__fold envelope-card__fold--left" aria-hidden="true" />
            <div className="envelope-card__fold envelope-card__fold--right" aria-hidden="true" />
            <div className="envelope-card__bottom" aria-hidden="true" />

            <button
              className="envelope-seal"
              type="button"
              onClick={handleOpenEnvelope}
              disabled={isEnvelopeOpen}
              aria-label="Abrir sobre"
            >
              <span className="envelope-seal__initials">
                <span className="envelope-seal__letter">L</span>
                <span className="envelope-seal__ampersand">&amp;</span>
                <span className="envelope-seal__letter">M</span>
              </span>
              <span className="envelope-seal__open">ABRIR</span>
            </button>
          </div>
        </div>
        {audioNotice ? <p className="envelope-screen__note">{audioNotice}</p> : null}
      </section>

      <main className={`invitation-page${isEnvelopeOpen || showInvitation ? ' invitation-page--visible' : ''}`}>
        <section className="hero-section">
          <div className="hero-stage">
            <img
              className="hero-background"
              src={asset('assets/original/hero-photo.png')}
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
            <div className="intro-copy">
              <div className="intro-copy__lower">
                <div className="intro-copy__text">
                  <h2 className="script-heading">
                    &iexcl;Nos casamos!
                  </h2>
                  {isPersonalInvitation ? (
                    <p className="personal-invitation-label">
                      Invitacion especial para {invitation.displayLabel}
                    </p>
                  ) : null}
                  <p>
                    Te invitamos a celebrar con nosotros el día que decimos Sí para
                    toda la vida
                  </p>
                </div>

                <div className="save-date-card">
                  <div className="save-date-icon" aria-hidden="true">
                    <svg viewBox="0 0 64 64" role="presentation">
                      <rect x="14" y="18" width="36" height="30" rx="2.5" />
                      <path d="M14 26h36" />
                      <path d="M22 14v8" />
                      <path d="M42 14v8" />
                      <path d="M34.4 35.5c0-2.5-2-4.6-4.6-4.6-1.6 0-2.9.8-3.8 2-0.9-1.2-2.3-2-3.8-2-2.5 0-4.6 2-4.6 4.6 0 5.6 8.4 9.9 8.4 9.9s8.4-4.3 8.4-9.9Z" />
                    </svg>
                  </div>
                  <span className="save-date-kicker">AGENDA LA FECHA</span>
                  <p className="save-date-date">{weddingEvent.date}</p>
                  <div className="save-date-divider" aria-hidden="true">
                    <img src={asset('assets/original/divider-dark.svg')} alt="" />
                  </div>

                  <div className="countdown-grid" aria-label="Cuenta regresiva al casamiento">
                    {COUNTDOWN_PARTS.map(({ key, label }) => (
                      <div className="countdown-item" key={key}>
                        <strong>{countdownParts[key]}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>

                  <a
                    className="save-date-button"
                    href={calendarUrl.toString()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="save-date-button__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="presentation">
                        <rect x="4.5" y="6.5" width="15" height="13" rx="2" />
                        <path d="M4.5 10.5h15" />
                        <path d="M8 4.5v4" />
                        <path d="M16 4.5v4" />
                      </svg>
                    </span>
                    AGENDAR FECHA
                  </a>
                </div>
              </div>

              {audioNotice ? (
                <p className="audio-note">{audioNotice}</p>
              ) : null}
            </div>

            <img
              className="intro-flower"
              src={asset('assets/original/gallery-flower-cutout.png')}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section className="ceremony-section">
          <div className="ceremony-sprig" aria-hidden="true">
            <img className="ceremony-sprig__stem" src={asset('assets/original/floral-stem.png')} alt="" loading="lazy" decoding="async" />
            <img className="ceremony-sprig__leaves" src={asset('assets/original/floral-cluster.png')} alt="" loading="lazy" decoding="async" />
          </div>

          <div className="ceremony-layout">
            <div className="ceremony-copy">
              <h2 className="section-title">
                CEREMONIA
              </h2>
              <p className="section-place">
                Parroquia
                <br />
                Nuestra Señora del Valle
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
              src={asset('assets/original/ceremony-photo.png')}
              alt="Ilustracion de la parroquia"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section className="olive-panel reception-section">
          <div className="reception-layout">
            <div className="reception-details">
              <div className="reception-copy">
                <h2 className="reception-title">
                  RECEPCIÓN
                </h2>
                <p className="reception-script">
                  y celebración
                </p>
              </div>
            </div>

            <div className="reception-visual">
              <div className="reception-flower" aria-hidden="true">
                <img src={asset('assets/original/reception-photo.png')} alt="" loading="lazy" decoding="async" />
              </div>

              <img
                className="reception-image"
                src={asset('assets/original/party-photo.png')}
                alt="Club Hipico San Jorge"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="reception-details reception-details--location">
              <p className="reception-place">
                Club Hípico San Jorge
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
                &iexcl;Tu presencia es lo más importante para nosotros!
              </h2>
              <p className="gifts-copy">
                Si además te gustaría ayudarnos con nuestra luna de miel y
                proyectos futuros, te compartimos los datos
              </p>
            </div>

            <div className="gifts-bank">
              <div className="gifts-spray" aria-hidden="true">
                <img
                  className="gift-stem gift-stem--eucalyptus"
                  src={asset('assets/original/dress-shape-1.png')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="gift-stem gift-stem--wheat"
                  src={asset('assets/original/dress-shape-3.png')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="gift-stem gift-stem--mimosa"
                  src={asset('assets/original/dress-shape-4.png')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="gift-stem gift-stem--cluster"
                  src={asset('assets/original/floral-cluster.png')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </div>

              <div className="gift-details">
                {[
                  weddingEvent.giftInstructions[1],
                  weddingEvent.giftInstructions[2],
                  weddingEvent.giftInstructions[0],
                ].filter(Boolean).map((detail) => (
                  <p key={detail}>
                    {detail
                      .replace('CBU en pesos:', 'CBU PESOS:')
                      .replace('CBU en USD:', 'CBU USD:')
                      .replace('Alias:', 'ALIAS:')}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="olive-panel dress-section">
          <img
            className="dress-background"
            src={asset('assets/original/canva-dress-bg.jpg')}
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
              src={asset('assets/original/hero-photo.jpg')}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />

            <div className="rsvp-copy">
              {isPersonalInvitation ? (
                <p className="personal-rsvp-kicker">Invitacion para {invitation.displayLabel}</p>
              ) : null}
              <h2>
                <span>&iexcl;Confírmanos tu</span>
                <br />
                <span>asistencia!</span>
              </h2>
              <Link
                className="map-button map-button--olive"
                to={isPersonalInvitation ? `/confirmar/${invitation.token}` : '/mensajes'}
              >
                RSVP
              </Link>
              <img
                className="rsvp-icon"
                src={asset('assets/original/rsvp-icon.png')}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
            </div>
        </section>

        <SecondaryFooterNav
          links={[
            { to: '/regalos', text: 'Regalos' },
            { to: '/mensajes', text: 'Mensajes' },
            { to: '/admin/login', text: 'Panel' },
          ]}
        />
      </main>
    </div>
  )
}
