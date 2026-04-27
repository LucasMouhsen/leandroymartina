import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { NavLink, useNavigate } from 'react-router-dom'
import SecondaryFooterNav from '../../components/SecondaryFooterNav.jsx'
import { useWedding } from '../../context/useWedding.jsx'

export default function AdminLoginPage() {
  const { adminUser, login } = useWedding()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const form = useForm({
    defaultValues: {
      email: adminUser.email,
      password: adminUser.password,
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await login(values)

    if (!result.ok) {
      setError(result.message)
      return
    }

    navigate('/admin/reportes')
  })

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

      <main className="admin-login-shell admin-login-shell--embedded">
        <section className="admin-login-card">
          <div>
            <p className="feature-kicker">Panel privado</p>
            <h1>Gestion de invitados y contenidos</h1>
            <p className="feature-lead">
              En esta demo el acceso esta preconfigurado para que puedas probar el panel completo.
            </p>
          </div>

          <form className="form-card compact-card" onSubmit={onSubmit}>
            <label>
              Email
              <input type="email" {...form.register('email')} />
            </label>
            <label>
              Contrasena
              <input type="password" {...form.register('password')} />
            </label>

            <button className="primary-button" type="submit">
              Ingresar al panel
            </button>

            {error ? <p className="form-feedback">{error}</p> : null}
          </form>

          <div className="credential-note">
            <span>Acceso demo</span>
            <strong>{adminUser.email}</strong>
            <strong>{adminUser.password}</strong>
          </div>
        </section>
      </main>

      <SecondaryFooterNav
        links={[
          { to: '/', text: 'Invitacion' },
          { to: '/regalos', text: 'Regalos' },
          { to: '/mensajes', text: 'Mensajes' },
          { to: '/admin/login', text: 'Panel' },
        ]}
      />
    </div>
  )
}
