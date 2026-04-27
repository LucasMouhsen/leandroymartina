const defaultCeremony = {
  label: 'Ceremonia',
  venue: 'Parroquia Nuestra Senora del Valle',
  time: '15:00 hs',
}

const defaultReception = {
  label: 'Fiesta',
  venue: 'Club Hipico San Jorge',
  time: '17:30 hs',
}

export default function EventFeatureHero({
  weddingEvent,
  title,
  bannerSrc = '/assets/optimized/hero-photo.webp',
  portraitSrc = '/assets/optimized/party-photo.webp',
  portraitAlt,
  ceremony = defaultCeremony,
  reception = defaultReception,
}) {
  return (
    <section className="gift-hero">
      <div className="gift-hero__banner">
        <img src={bannerSrc} alt="" aria-hidden="true" />
        <div className="gift-hero__overlay">
          <p className="gift-hero__eyebrow">{weddingEvent.couple}</p>
          <h1>{title}</h1>
          <p>{weddingEvent.date}</p>
        </div>
      </div>

      <div className="gift-hero__portrait">
        <img src={portraitSrc} alt={portraitAlt ?? weddingEvent.couple} />
      </div>

      <div className="gift-hero__details">
        <article className="gift-hero__event">
          <span>{ceremony.label}</span>
          <strong>{ceremony.venue}</strong>
          <p>{ceremony.time}</p>
        </article>
        <article className="gift-hero__event">
          <span>{reception.label}</span>
          <strong>{reception.venue}</strong>
          <p>{reception.time}</p>
        </article>
      </div>
    </section>
  )
}
