import { useWedding } from '../../context/useWedding.jsx'

export default function AdminMessagesPage() {
  const { guestMessages, reviewMessage } = useWedding()

  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <div>
          <p className="feature-kicker">Mensajes</p>
          <h2>Moderación del libro de saludos</h2>
        </div>
      </header>

      <div className="stack-list">
        {guestMessages.map((message) => (
          <article className="panel-card stack-row--column" key={message.id}>
            <div className="stack-row stack-row--grow">
              <div>
                <strong>{message.guestName}</strong>
                <p>{message.status}</p>
              </div>
              <div className="stack-actions">
                <button className="secondary-button" type="button" onClick={() => reviewMessage(message.id, 'aprobado')}>
                  Aprobar
                </button>
                <button className="secondary-button" type="button" onClick={() => reviewMessage(message.id, 'rechazado')}>
                  Rechazar
                </button>
              </div>
            </div>
            <p>{message.note}</p>
            {message.photo ? <img className="admin-inline-image" src={message.photo.dataUrl} alt={message.guestName} /> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
