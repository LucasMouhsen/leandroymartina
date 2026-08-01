import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import SecondaryFooterNav from '../components/SecondaryFooterNav.jsx'
import {
  buildFeaturePath,
  buildInvitationPath,
  INVITATION_QUERY_PARAM,
} from '../lib/invitationNavigation.js'

export default function FeatureLayout() {
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get(INVITATION_QUERY_PARAM)
  const invitationToken = tokenFromUrl

  return (
    <div className="feature-shell">
      <header className="feature-header">
        <div className="feature-header__intro">
          <p className="feature-kicker">Leandro y Martina</p>
        </div>

        <nav className="feature-nav" aria-label="Navegacion principal">
          <NavLink to={buildInvitationPath(invitationToken)}>Invitacion</NavLink>
          <NavLink to={buildFeaturePath('/regalos', invitationToken)}>Regalos</NavLink>
          <NavLink to={buildFeaturePath('/mensajes', invitationToken)}>Mensajes</NavLink>
          <NavLink to="/admin/login">Panel</NavLink>
        </nav>
      </header>

      <Outlet />

      <SecondaryFooterNav
        links={[
          { to: buildInvitationPath(invitationToken), text: 'Invitacion' },
          { to: buildFeaturePath('/regalos', invitationToken), text: 'Regalos' },
          { to: buildFeaturePath('/mensajes', invitationToken), text: 'Mensajes' },
          { to: '/admin/login', text: 'Panel' },
        ]}
      />
    </div>
  )
}
