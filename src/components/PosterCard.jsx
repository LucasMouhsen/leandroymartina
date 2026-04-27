export function PosterCard({ alt, href, image, label }) {
  return (
    <article className="poster-card">
      <img className="poster-card__image" src={image} alt={alt} />
      <a
        className="poster-card__action"
        href={href}
        aria-label={label}
        rel="noreferrer"
        target="_blank"
      >
        <span className="sr-only">{label}</span>
      </a>
    </article>
  )
}
