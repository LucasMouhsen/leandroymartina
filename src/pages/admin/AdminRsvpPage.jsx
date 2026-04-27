import { useWedding } from '../../context/useWedding.jsx'

export default function AdminRsvpPage() {
  const { invitations, getResponseByInvitation } = useWedding()

  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <div>
          <p className="feature-kicker">RSVP</p>
          <h2>Seguimiento de respuestas</h2>
        </div>
      </header>

      <div className="table-card admin-table-desktop">
        <table>
          <thead>
            <tr>
              <th>Invitacion</th>
              <th>Contacto</th>
              <th>Estado</th>
              <th>Asistentes</th>
              <th>Restricciones</th>
              <th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => {
              const response = getResponseByInvitation(invitation.id)

              return (
                <tr key={invitation.id}>
                  <td>{invitation.displayLabel}</td>
                  <td>{invitation.primaryContactPhone || invitation.primaryContactEmail || '-'}</td>
                  <td>{response?.status ?? 'sin_respuesta'}</td>
                  <td>{response?.attendingCount ?? '-'}</td>
                  <td>{response?.dietaryRestrictions ?? '-'}</td>
                  <td>{response?.comments ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="admin-table-mobile">
        <div className="admin-mobile-list">
          {invitations.map((invitation) => {
            const response = getResponseByInvitation(invitation.id)

            return (
              <article className="admin-mobile-card" key={invitation.id}>
                <div className="admin-mobile-card__header">
                  <p className="admin-mobile-card__title">{invitation.displayLabel}</p>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Contacto</span>
                  <strong>{invitation.primaryContactPhone || invitation.primaryContactEmail || '-'}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Estado</span>
                  <strong>{response?.status ?? 'sin_respuesta'}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Asistentes</span>
                  <strong>{response?.attendingCount ?? '-'}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Restricciones</span>
                  <strong>{response?.dietaryRestrictions ?? '-'}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Comentarios</span>
                  <strong>{response?.comments ?? '-'}</strong>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
