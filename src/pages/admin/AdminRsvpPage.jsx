import { useWedding } from '../../context/useWedding.jsx'

function renderAttendeeSummary(attendees, response) {
  if (!response) {
    return '-'
  }

  const confirmed = attendees.filter((attendee) => attendee.attending)

  if (!confirmed.length) {
    return 'Sin asistentes confirmados'
  }

  return confirmed.map((attendee) => attendee.name).join(', ')
}

function renderDietSummary(attendees, response) {
  if (!response) {
    return '-'
  }

  const diets = attendees
    .filter((attendee) => attendee.attending && attendee.dietaryRestrictions)
    .map((attendee) => `${attendee.name}: ${attendee.dietaryRestrictions}`)

  return diets.length ? diets.join('; ') : 'Sin restricciones'
}

export default function AdminRsvpPage() {
  const { getResponseByInvitation, getRsvpAttendees, invitations } = useWedding()

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
              <th>Detalle</th>
              <th>Alimentacion especial</th>
              <th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => {
              const response = getResponseByInvitation(invitation.id)
              const attendees = getRsvpAttendees(invitation, response)

              return (
                <tr key={invitation.id}>
                  <td>{invitation.displayLabel}</td>
                  <td>{invitation.primaryContactPhone || '-'}</td>
                  <td>{response?.status ?? 'sin_respuesta'}</td>
                  <td>{response?.attendingCount ?? '-'}</td>
                  <td>{renderAttendeeSummary(attendees, response)}</td>
                  <td>{renderDietSummary(attendees, response)}</td>
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
            const attendees = getRsvpAttendees(invitation, response)

            return (
              <article className="admin-mobile-card" key={invitation.id}>
                <div className="admin-mobile-card__header">
                  <p className="admin-mobile-card__title">{invitation.displayLabel}</p>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Contacto</span>
                  <strong>{invitation.primaryContactPhone || '-'}</strong>
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
                  <span>Detalle</span>
                  <strong>{renderAttendeeSummary(attendees, response)}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Alimentacion especial</span>
                  <strong>{renderDietSummary(attendees, response)}</strong>
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
