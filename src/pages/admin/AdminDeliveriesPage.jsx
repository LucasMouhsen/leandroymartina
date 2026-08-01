import { useMemo, useState } from 'react'
import { useWedding } from '../../context/useWedding.jsx'

const HISTORY_FILTERS = [
  { id: 'all', label: 'Todo' },
  { id: 'needs_attention', label: 'Por confirmar' },
  { id: 'confirmed', label: 'Confirmados' },
  { id: 'prepared', label: 'Preparados' },
]

const INVITATION_STATUS_FILTERS = [
  { id: 'all', label: 'Todos los estados' },
  { id: 'not_sent', label: 'No enviadas' },
  { id: 'needs_confirmation', label: 'Por confirmar' },
  { id: 'sent', label: 'Enviadas' },
  { id: 'responded', label: 'Respondidas' },
  { id: 'not_attending', label: 'No asisten' },
]

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

function normalizeWhatsAppPhone(phone) {
  return String(phone ?? '').replace(/\D/g, '')
}

function contactName(invitation) {
  return [invitation.primaryContactFirstName, invitation.primaryContactLastName]
    .filter(Boolean)
    .join(' ') || invitation.displayLabel
}

function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getDeliveryMeta(delivery) {
  if (delivery.status === 'sent_manual') {
    return {
      title: 'Envio confirmado',
      detail: 'El envio fue confirmado manualmente desde el panel.',
      tone: 'confirmed',
      filter: 'confirmed',
      needsConfirmation: false,
    }
  }

  if (delivery.type === 'whatsapp_composer_opened') {
    return {
      title: 'WhatsApp preparado',
      detail: 'Se abrio el compositor de WhatsApp. Falta confirmar que el mensaje fue enviado.',
      tone: 'attention',
      filter: 'needs_attention',
      needsConfirmation: true,
    }
  }

  if (delivery.type === 'link_copied') {
    return {
      title: 'Link copiado',
      detail: 'El link fue copiado para compartirlo por otro canal.',
      tone: 'prepared',
      filter: 'prepared',
      needsConfirmation: false,
    }
  }

  return {
    title: 'Registro anterior',
    detail: 'Registro importado de la version anterior. Revisa manualmente si el envio se concreto.',
    tone: 'attention',
    filter: 'needs_attention',
    needsConfirmation: delivery.channel !== 'link',
  }
}

function getAccessStatusMeta(accessStatus) {
  return accessStatus === 'paused'
    ? { label: 'Pausado', tone: 'paused' }
    : { label: 'Activo', tone: 'active' }
}

function getInvitationDeliveryStatusMeta(deliveryStatus, pendingDelivery, rsvpStatus) {
  if (rsvpStatus === 'confirmado') {
    return { label: 'RSVP confirmado', tone: 'confirmed', filter: 'responded' }
  }

  if (rsvpStatus === 'rechazado') {
    return { label: 'No asiste', tone: 'rejected', filter: 'not_attending' }
  }

  if (pendingDelivery) return { label: 'Por confirmar', tone: 'attention', filter: 'needs_confirmation' }

  switch (String(deliveryStatus ?? 'pendiente').toLowerCase()) {
    case 'respondida': return { label: 'Respondida', tone: 'confirmed', filter: 'responded' }
    case 'rechazada': return { label: 'No asiste', tone: 'rejected', filter: 'not_attending' }
    case 'enviada_whatsapp': return { label: 'Enviada por WhatsApp', tone: 'sent', filter: 'sent' }
    case 'enviada_email': return { label: 'Enviada por email', tone: 'sent', filter: 'sent' }
    default: return { label: 'No enviada', tone: 'pending', filter: 'not_sent' }
  }
}

export default function AdminDeliveriesPage() {
  const {
    buildInviteLink,
    buildInviteMessage,
    buildRsvpLink,
    confirmDelivery,
    getResponseByInvitation,
    invitations,
    inviteDeliveries,
    recordDelivery,
    regenerateInvitationToken,
    setInvitationAccess,
  } = useWedding()
  const [feedback, setFeedback] = useState('')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [invitationSearch, setInvitationSearch] = useState('')
  const [invitationStatusFilter, setInvitationStatusFilter] = useState('all')

  const history = useMemo(
    () => [...inviteDeliveries]
      .map((delivery) => ({
        ...delivery,
        createdAt: delivery.createdAt ?? delivery.sentAt,
        meta: getDeliveryMeta(delivery),
      }))
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
    [inviteDeliveries],
  )

  const summary = useMemo(() => ({
    all: history.length,
    needs_attention: history.filter((delivery) => delivery.meta.filter === 'needs_attention').length,
    confirmed: history.filter((delivery) => delivery.meta.filter === 'confirmed').length,
    prepared: history.filter((delivery) => delivery.meta.filter === 'prepared').length,
  }), [history])

  const visibleHistory = useMemo(
    () => historyFilter === 'all'
      ? history
      : history.filter((delivery) => delivery.meta.filter === historyFilter),
    [history, historyFilter],
  )

  const pendingDeliveryByInvitation = useMemo(() => {
    const pending = new Map()
    history.forEach((delivery) => {
      if (delivery.meta.needsConfirmation && !pending.has(delivery.invitationId)) {
        pending.set(delivery.invitationId, delivery)
      }
    })
    return pending
  }, [history])

  const managedInvitations = useMemo(() => {
    const query = normalizeText(invitationSearch.trim())

    return invitations
      .map((invitation) => {
        const pendingDelivery = pendingDeliveryByInvitation.get(invitation.id)
        const response = getResponseByInvitation(invitation.id)
        return {
          invitation,
          accessMeta: getAccessStatusMeta(invitation.accessStatus),
          deliveryMeta: getInvitationDeliveryStatusMeta(invitation.deliveryStatus, pendingDelivery, response?.status),
        }
      })
      .filter(({ invitation, deliveryMeta }) => {
        const matchesStatus = invitationStatusFilter === 'all' || deliveryMeta.filter === invitationStatusFilter
        const searchableValue = normalizeText([
          invitation.displayLabel,
          contactName(invitation),
          invitation.primaryContactPhone,
        ].join(' '))
        const matchesSearch = !query || searchableValue.includes(query)

        return matchesStatus && matchesSearch
      })
  }, [getResponseByInvitation, invitationSearch, invitationStatusFilter, invitations, pendingDeliveryByInvitation])

  const ensureInvitationToken = async (invitation) => {
    if (invitation.token && invitation.accessStatus !== 'paused') {
      return { token: invitation.token, regenerated: false }
    }

    const token = await regenerateInvitationToken(invitation.id)
    if (!token) {
      setFeedback(`No se pudo preparar un enlace para ${invitation.displayLabel}. Intenta nuevamente.`)
      return null
    }

    return { token, regenerated: true }
  }

  const recordPreparation = (invitation, inviteLink, payload) => recordDelivery(invitation.id, {
    ...payload,
    inviteLink,
  })

  const copyLink = async (invitation, kind = 'invitation') => {
    const tokenResult = await ensureInvitationToken(invitation)
    if (!tokenResult) return

    try {
      const link = kind === 'rsvp' ? buildRsvpLink(tokenResult.token) : buildInviteLink(tokenResult.token)
      await copyText(link)
      await recordPreparation(invitation, link, {
        channel: 'link',
        type: 'link_copied',
        status: 'prepared',
        recipient: contactName(invitation),
        message: kind === 'rsvp' ? 'Link directo de RSVP copiado.' : 'Link de invitacion copiado.',
      })
      setFeedback(`${tokenResult.regenerated ? 'Se genero un enlace nuevo y se c' : 'C'}opio el link ${kind === 'rsvp' ? 'directo de RSVP' : 'de invitacion'} para ${invitation.displayLabel}.`)
    } catch {
      const link = kind === 'rsvp' ? buildRsvpLink(tokenResult.token) : buildInviteLink(tokenResult.token)
      window.prompt('Copia el enlace:', link)
      setFeedback('El enlace esta listo para copiar desde el cuadro que se abrio.')
    }
  }

  const openWhatsApp = async (invitation) => {
    const phone = normalizeWhatsAppPhone(invitation.primaryContactPhone)

    if (!phone) {
      setFeedback(`La invitacion ${invitation.displayLabel} no tiene un WhatsApp cargado.`)
      return
    }

    const whatsappWindow = window.open('', '_blank')
    const tokenResult = await ensureInvitationToken(invitation)
    if (!tokenResult) {
      whatsappWindow?.close()
      return
    }

    const inviteLink = buildInviteLink(tokenResult.token)
    const message = buildInviteMessage(contactName(invitation), inviteLink).normalize('NFC')
    const params = new URLSearchParams({ phone, text: message, type: 'phone_number', app_absent: '0' })
    const whatsappUrl = `https://api.whatsapp.com/send/?${params.toString()}`
    if (whatsappWindow) {
      whatsappWindow.opener = null
      whatsappWindow.location.replace(whatsappUrl)
    } else {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    }
    await recordPreparation(invitation, inviteLink, {
      channel: 'whatsapp',
      type: 'whatsapp_composer_opened',
      status: 'prepared',
      recipient: phone,
      message,
    })
    setFeedback(`${tokenResult.regenerated ? 'Se genero un enlace nuevo. ' : ''}WhatsApp preparado para ${invitation.displayLabel}. Confirma el envio despues de mandarlo.`)
  }

  const handleConfirmDelivery = (delivery) => {
    confirmDelivery(delivery.id)
    setFeedback(`Envio por ${delivery.channel} confirmado manualmente para ${delivery.recipient || 'el contacto principal'}.`)
  }

  const toggleInvitationAccess = (invitation) => {
    const nextStatus = invitation.accessStatus === 'paused' ? 'active' : 'paused'
    const action = nextStatus === 'paused' ? 'pausar' : 'reactivar'

    if (!window.confirm(`Vas a ${action} el enlace de ${invitation.displayLabel}.`)) {
      return
    }

    setInvitationAccess(invitation.id, nextStatus)
    setFeedback(`Enlace ${nextStatus === 'paused' ? 'pausado' : 'reactivado'} para ${invitation.displayLabel}.`)
  }

  const regenerateLink = async (invitation) => {
    if (!window.confirm(`Vas a invalidar el enlace actual de ${invitation.displayLabel} y crear uno nuevo.`)) {
      return
    }

    const token = await regenerateInvitationToken(invitation.id)
    setFeedback(
      token
        ? `Enlace regenerado para ${invitation.displayLabel}. Ya podes copiarlo o enviarlo.`
        : 'No se pudo regenerar el enlace. Intenta nuevamente.',
    )
  }

  const renderActions = (invitation) => (
    <div className="delivery-actions">
      <button className="secondary-button" type="button" onClick={() => openWhatsApp(invitation)}>
        Preparar WhatsApp
      </button>
      <button className="secondary-button" type="button" onClick={() => copyLink(invitation)}>
        Copiar invitacion
      </button>
      <button className="secondary-button" type="button" onClick={() => copyLink(invitation, 'rsvp')}>
        Copiar RSVP
      </button>
      <button className="secondary-button" type="button" onClick={() => toggleInvitationAccess(invitation)}>
        {invitation.accessStatus === 'paused' ? 'Reactivar link' : 'Pausar link'}
      </button>
      <button className="secondary-button" type="button" onClick={() => regenerateLink(invitation)}>
        Regenerar link
      </button>
    </div>
  )

  const managementContent = (
    <section className="delivery-management" aria-labelledby="delivery-management-title">
      <div className="delivery-management__header">
        <div>
          <p className="feature-kicker">Acciones</p>
          <h3 id="delivery-management-title">Administrar invitaciones</h3>
        </div>
        <p>Los links se pueden pausar o regenerar sin alterar las respuestas ya registradas.</p>
      </div>

      <div className="delivery-filters" aria-label="Filtros de invitaciones">
        <label>
          <span>Buscar invitación</span>
          <input
            type="search"
            value={invitationSearch}
            onChange={(event) => setInvitationSearch(event.target.value)}
            placeholder="Nombre o teléfono"
          />
        </label>
        <label>
          <span>Estado del envío</span>
          <select
            value={invitationStatusFilter}
            onChange={(event) => setInvitationStatusFilter(event.target.value)}
          >
            {INVITATION_STATUS_FILTERS.map((filter) => (
              <option key={filter.id} value={filter.id}>{filter.label}</option>
            ))}
          </select>
        </label>
        <p role="status" aria-live="polite">
          {managedInvitations.length} {managedInvitations.length === 1 ? 'invitación encontrada' : 'invitaciones encontradas'}
        </p>
      </div>

      <div className="table-card admin-table-desktop">
        <table>
          <thead>
            <tr>
              <th>Invitacion</th>
              <th>Contacto</th>
              <th>Acceso</th>
              <th>Envio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {managedInvitations.map(({ invitation, accessMeta, deliveryMeta }) => {
              return (
                <tr key={invitation.id}>
                  <td><strong>{invitation.displayLabel}</strong></td>
                  <td>{invitation.primaryContactPhone || '-'}</td>
                  <td><span className={`delivery-status delivery-status--${accessMeta.tone}`}>{accessMeta.label}</span></td>
                  <td><span className={`delivery-status delivery-status--${deliveryMeta.tone}`}>{deliveryMeta.label}</span></td>
                  <td>{renderActions(invitation)}</td>
                </tr>
              )
            })}
            {!managedInvitations.length ? (
              <tr>
                <td colSpan="5">
                  <div className="delivery-empty">
                    <strong>No encontramos invitaciones con estos filtros.</strong>
                    <p>Prueba con otro nombre o estado de envío.</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="admin-table-mobile">
        <div className="admin-mobile-list">
          {managedInvitations.map(({ invitation, accessMeta, deliveryMeta }) => {
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
                  <span>Acceso</span>
                  <span className={`delivery-status delivery-status--${accessMeta.tone}`}>{accessMeta.label}</span>
                </div>
                <div className="admin-mobile-card__row">
                  <span>Envio</span>
                  <span className={`delivery-status delivery-status--${deliveryMeta.tone}`}>{deliveryMeta.label}</span>
                </div>
                {renderActions(invitation)}
              </article>
            )
          })}
          {!managedInvitations.length ? (
            <div className="delivery-empty">
              <strong>No encontramos invitaciones con estos filtros.</strong>
              <p>Prueba con otro nombre o estado de envío.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )

  return (
    <section className="admin-panel delivery-panel">
      <header className="admin-panel__header delivery-panel__header">
        <div>
          <p className="feature-kicker">Envios</p>
          <h2>Seguimiento de invitaciones</h2>
          <p className="feature-lead">
            Confirma solo los mensajes que ya enviaste. Lo preparado y lo confirmado quedan separados.
          </p>
        </div>
      </header>

      {managementContent}

      <section className="delivery-summary" aria-label="Resumen del historial">
        {HISTORY_FILTERS.map((filter) => (
          <button
            className={`delivery-summary__item${historyFilter === filter.id ? ' is-active' : ''}${filter.id === 'needs_attention' && summary[filter.id] ? ' is-attention' : ''}`}
            type="button"
            key={filter.id}
            onClick={() => setHistoryFilter(filter.id)}
            aria-pressed={historyFilter === filter.id}
          >
            <span>{filter.label}</span>
            <strong>{summary[filter.id]}</strong>
          </button>
        ))}
      </section>

      <section className="delivery-history" aria-labelledby="delivery-history-title">
        <div className="delivery-history__header">
          <div>
            <p className="feature-kicker">Historial</p>
            <h3 id="delivery-history-title">
              {historyFilter === 'all' ? 'Toda la actividad' : HISTORY_FILTERS.find((filter) => filter.id === historyFilter)?.label}
            </h3>
          </div>
          <p>{visibleHistory.length} {visibleHistory.length === 1 ? 'registro' : 'registros'}</p>
        </div>

        <div className="delivery-timeline">
          {visibleHistory.length ? visibleHistory.map((delivery) => {
            const invitation = invitations.find((item) => item.id === delivery.invitationId)

            return (
              <article className={`delivery-event delivery-event--${delivery.meta.tone}`} key={delivery.id}>
                <span className="delivery-event__marker" aria-hidden="true" />
                <div className="delivery-event__content">
                  <div className="delivery-event__topline">
                    <div>
                      <p className="delivery-event__eyebrow">{delivery.meta.title}</p>
                      <h4>{invitation?.displayLabel ?? 'Invitacion'}</h4>
                    </div>
                    <time dateTime={delivery.createdAt}>{formatDate(delivery.createdAt)}</time>
                  </div>
                  <p className="delivery-event__description">{delivery.meta.detail}</p>
                  <dl className="delivery-event__facts">
                    <div><dt>Canal</dt><dd>{delivery.channel}</dd></div>
                    <div><dt>Destino</dt><dd>{delivery.recipient || 'Contacto principal'}</dd></div>
                    <div><dt>Registrado por</dt><dd>{delivery.confirmedBy ?? delivery.operator ?? 'Panel local'}</dd></div>
                  </dl>
                  <div className="delivery-event__actions">
                    {delivery.meta.needsConfirmation ? (
                      <button className="primary-button" type="button" onClick={() => handleConfirmDelivery(delivery)}>
                        Confirmar envio
                      </button>
                    ) : null}
                    {delivery.message ? (
                      <details>
                        <summary>Ver mensaje registrado</summary>
                        <p>{delivery.message}</p>
                      </details>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          }) : (
            <div className="delivery-empty">
              <strong>No hay registros en este estado.</strong>
              <p>Prepara una invitacion o cambia el filtro para ver el resto de la actividad.</p>
            </div>
          )}
        </div>
      </section>

      {feedback ? (
        <div className="admin-toast" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <p>{feedback}</p>
          <button type="button" onClick={() => setFeedback('')} aria-label="Cerrar aviso">×</button>
        </div>
      ) : null}
    </section>
  )
}
