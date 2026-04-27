import { NavLink, Outlet } from 'react-router-dom'

export default function FeatureLayout() {
  return (
    <div className="feature-shell">
      <header className="feature-header">
        <div className="feature-header__intro">
          <p className="feature-kicker">Leandro y Martina</p>
        </div>

        <nav className="feature-nav" aria-label="Navegacion principal">
          <NavLink to="/">Invitacion</NavLink>
          <NavLink to="/regalos">Regalos</NavLink>
          <NavLink to="/mensajes">Mensajes</NavLink>
          <NavLink to="/admin/login">Panel</NavLink>
        </nav>
      </header>

      <Outlet />
    </div>
  )
}
