import { useWedding } from '../../context/useWedding.jsx'

export default function AdminReportsPage() {
  const { metrics, giftItems, giftContributions } = useWedding()

  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <div>
          <p className="feature-kicker">Resumen general</p>
          <h2>Estado del evento</h2>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Invitaciones</span>
          <strong>{metrics.totalInvitations}</strong>
          <p>{metrics.responseRate}% de respuestas registradas</p>
        </article>
        <article className="stat-card">
          <span>Asistentes confirmados</span>
          <strong>{metrics.totalConfirmed}</strong>
          <p>Sobre un cupo total de {metrics.totalAllowed}</p>
        </article>
        <article className="stat-card">
          <span>Pendientes</span>
          <strong>{metrics.pendingInvitations}</strong>
          <p>Invitaciones sin respuesta todavia</p>
        </article>
        <article className="stat-card">
          <span>Mensajes por moderar</span>
          <strong>{metrics.pendingMessages}</strong>
          <p>Saludos y fotos pendientes de revision</p>
        </article>
      </div>

      <div className="admin-two-columns">
        <article className="panel-card">
          <div className="list-card__header">
            <h3>Regalos</h3>
            <span>{giftContributions.length} aportes registrados</span>
          </div>
          <div className="stack-list">
            {giftItems.map((gift) => (
              <div className="stack-row" key={gift.id}>
                <div>
                  <strong>{gift.name}</strong>
                  <p>{gift.status}</p>
                </div>
                <strong>${gift.raisedAmount.toLocaleString('es-AR')}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="list-card__header">
            <h3>Tareas sugeridas</h3>
          </div>
          <ul className="admin-list">
            <li>Validar aportes pendientes y actualizar estados de regalo.</li>
            <li>Revisar mensajes antes de publicarlos.</li>
            <li>Enviar recordatorio a las invitaciones que aun no respondieron RSVP.</li>
            <li>Exportar listado final para catering cuando cierre el RSVP.</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
