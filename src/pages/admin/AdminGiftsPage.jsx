import { useWedding } from '../../context/useWedding.jsx'

export default function AdminGiftsPage() {
  const { giftContributions, giftItems, setContributionStatus } = useWedding()

  const contributionTotal = giftContributions
    .filter((contribution) => contribution.status === 'validado')
    .reduce((sum, contribution) => sum + Number(contribution.amount || 0), 0)

  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <div>
          <p className="feature-kicker">Regalos</p>
          <h2>Validacion de aportes</h2>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Regalos en catalogo</span>
          <strong>{giftItems.length}</strong>
          <p>Snapshot importado para esta boda</p>
        </article>
        <article className="stat-card">
          <span>Total validado</span>
          <strong>${contributionTotal.toLocaleString('es-AR')}</strong>
          <p>Visible solo en el panel privado</p>
        </article>
        <article className="stat-card">
          <span>Aportes pendientes</span>
          <strong>{giftContributions.filter((item) => item.status === 'pendiente_validacion').length}</strong>
          <p>Esperando revision manual</p>
        </article>
      </div>

      <div className="table-card admin-table-desktop">
        <table>
          <thead>
            <tr>
              <th>Regalo</th>
              <th>Monto sugerido</th>
              <th>Validado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {giftItems.map((gift) => (
              <tr key={gift.id}>
                <td>{gift.name}</td>
                <td>${gift.suggestedAmount.toLocaleString('es-AR')}</td>
                <td>${gift.raisedAmount.toLocaleString('es-AR')}</td>
                <td>{gift.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-table-mobile">
        <div className="admin-mobile-list">
          {giftItems.map((gift) => (
            <article className="admin-mobile-card" key={gift.id}>
              <div className="admin-mobile-card__header">
                <p className="admin-mobile-card__title">{gift.name}</p>
              </div>
              <div className="admin-mobile-card__row">
                <span>Monto sugerido</span>
                <strong>${gift.suggestedAmount.toLocaleString('es-AR')}</strong>
              </div>
              <div className="admin-mobile-card__row">
                <span>Validado</span>
                <strong>${gift.raisedAmount.toLocaleString('es-AR')}</strong>
              </div>
              <div className="admin-mobile-card__row">
                <span>Estado</span>
                <strong>{gift.status}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="stack-list">
        {giftContributions.map((contribution) => (
          <article className="panel-card stack-row stack-row--grow" key={contribution.id}>
            <div>
              <strong>{contribution.guestName}</strong>
              <p>
                {contribution.giftItemId
                  ? giftItems.find((gift) => gift.id === contribution.giftItemId)?.name
                  : 'Aporte libre'}
              </p>
              <small>{contribution.guestContact}</small>
            </div>
            <div>
              <strong>${Number(contribution.amount).toLocaleString('es-AR')}</strong>
              <p>{contribution.status}</p>
            </div>
            <div className="stack-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setContributionStatus(contribution.id, 'validado')}
              >
                Validar
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setContributionStatus(contribution.id, 'rechazado')}
              >
                Rechazar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
