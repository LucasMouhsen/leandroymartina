import { useMemo, useState } from 'react'
import { useWedding } from '../../context/useWedding.jsx'

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  const successful = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!successful) {
    throw new Error('copy_failed')
  }
}

export default function AdminDeliveriesPage() {
  const {
    buildInviteLink,
    buildInviteMessage,
    invitations,
    inviteDeliveries,
    recordDelivery,
  } = useWedding()
  const [copied, setCopied] = useState('')

  const rows = useMemo(() => invitations, [invitations])

  const copyMessage = async (invitation, channel) => {
    const message = buildInviteMessage(
      invitation.displayLabel,
      buildInviteLink(invitation.token),
    )

    try {
      await copyText(message)
      recordDelivery(invitation.id, channel, message)
      setCopied(`Mensaje copiado para ${invitation.displayLabel}.`)
    } catch {
      setCopied('No se pudo copiar automaticamente. Proba en un navegador con permisos de portapapeles.')
    }
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <div>
          <p className="feature-kicker">Envios</p>
          <h2>Links personalizados y recordatorios</h2>
        </div>
      </header>

      <div className="table-card admin-table-desktop">
        <table>
          <thead>
            <tr>
              <th>Invitacion</th>
              <th>Contacto</th>
              <th>Link</th>
              <th>WhatsApp</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((invitation) => {
              const contactName = [invitation.primaryContactFirstName, invitation.primaryContactLastName]
                .filter(Boolean)
                .join(' ')

              return (
                <tr key={invitation.id}>
                  <td>{invitation.displayLabel}</td>
                  <td>{contactName || '-'}</td>
                  <td><code>{buildInviteLink(invitation.token)}</code></td>
                  <td>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => copyMessage(invitation, 'whatsapp')}
                    >
                      Copiar WhatsApp
                    </button>
                  </td>
                  <td>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => copyMessage(invitation, 'email')}
                    >
                      Copiar email
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="admin-table-mobile">
        <div className="admin-mobile-list">
          {rows.map((invitation) => {
            const contactName = [invitation.primaryContactFirstName, invitation.primaryContactLastName]
              .filter(Boolean)
              .join(' ')

            return (
              <article className="admin-mobile-card" key={invitation.id}>
                <div className="admin-mobile-card__header">
                  <p className="admin-mobile-card__title">{invitation.displayLabel}</p>
                  <code>{buildInviteLink(invitation.token)}</code>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Contacto</span>
                  <strong>{contactName || '-'}</strong>
                </div>

                <div className="admin-mobile-card__actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => copyMessage(invitation, 'whatsapp')}
                  >
                    Copiar WhatsApp
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => copyMessage(invitation, 'email')}
                  >
                    Copiar email
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {copied ? <p className="form-feedback">{copied}</p> : null}

      <article className="panel-card">
        <div className="list-card__header">
          <h3>Historial de envios</h3>
          <span>{inviteDeliveries.length} registros</span>
        </div>
        <div className="stack-list">
          {inviteDeliveries.map((delivery) => {
            const invitation = invitations.find((item) => item.id === delivery.invitationId)
            return (
              <div className="stack-row" key={delivery.id}>
                <div>
                  <strong>{invitation?.displayLabel ?? 'Invitacion'}</strong>
                  <p>{delivery.channel}</p>
                </div>
                <small>{new Date(delivery.sentAt).toLocaleString('es-AR')}</small>
              </div>
            )
          })}
        </div>
      </article>
    </section>
  )
}
