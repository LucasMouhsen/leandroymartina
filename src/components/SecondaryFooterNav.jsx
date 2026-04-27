import { NavLink } from 'react-router-dom'

export default function SecondaryFooterNav({ links, label = 'Navegacion' }) {
  return (
    <footer className="invitation-footer-nav">
      <div className="invitation-footer-nav__inner">
        <span className="invitation-footer-nav__label">{label}</span>
        <nav className="invitation-footer-nav__links" aria-label={label}>
          {links.map(({ to, text }) => (
            <NavLink key={`${to}-${text}`} to={to}>
              {text}
            </NavLink>
          ))}
        </nav>
      </div>
    </footer>
  )
}
