import { NavLink, Outlet } from 'react-router-dom'
import { useWedding } from '../../context/useWedding.jsx'

const links = [
  ['reportes', 'Reportes'],
  ['invitados', 'Invitados'],
  ['rsvp', 'RSVP'],
  ['regalos', 'Regalos'],
  ['mensajes', 'Mensajes'],
  ['envios', 'Envios'],
]

export default function AdminLayout() {
  const { logout, session } = useWedding()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <p className="feature-kicker">Panel privado</p>
          <h1>Leandro y Martina</h1>
          <span>{session?.email}</span>
        </div>

        <nav className="admin-sidebar__nav" aria-label="Panel privado">
          {links.map(([path, label]) => (
            <NavLink key={path} to={`/admin/${path}`}>
              {label}
            </NavLink>
          ))}
        </nav>

        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  )
}
