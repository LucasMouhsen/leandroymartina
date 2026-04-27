import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
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
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <div>
          <p className="feature-kicker">Panel privado</p>
          <h1>Gestión de invitados y contenidos</h1>
          <p className="feature-lead">
            En esta demo el acceso está preconfigurado para que puedas probar el panel completo.
          </p>
        </div>

        <form className="form-card compact-card" onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" {...form.register('email')} />
          </label>
          <label>
            Contraseña
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
  )
}
