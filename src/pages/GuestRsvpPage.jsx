import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'react-router-dom'
import { useWedding } from '../context/useWedding.jsx'

const schema = z.object({
  attending: z.enum(['si', 'no']),
  attendingCount: z.coerce.number().min(0).max(12),
  dietaryRestrictions: z.string().max(200).optional(),
  comments: z.string().max(300).optional(),
})

export default function GuestRsvpPage() {
  const { token } = useParams()
  const { getInvitationByToken, getResponseByInvitation, submitRsvp, weddingEvent } = useWedding()
  const [status, setStatus] = useState(null)

  const invitation = getInvitationByToken(token)
  const existingResponse = invitation ? getResponseByInvitation(invitation.id) : null
  const allowedSeats = invitation?.allowedSeats ?? 1
  const isSingleInvite = allowedSeats === 1
  const allowedOptions = Array.from({ length: allowedSeats }, (_, index) => index + 1)

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      attending: existingResponse?.status === 'rechazado' ? 'no' : 'si',
      attendingCount: existingResponse?.attendingCount ?? allowedSeats,
      dietaryRestrictions: existingResponse?.dietaryRestrictions ?? '',
      comments: existingResponse?.comments ?? '',
    },
  })

  const attending = useWatch({ control: form.control, name: 'attending' })

  if (!invitation) {
    return (
      <section className="feature-page feature-empty">
        <div className="feature-empty__card">
          <p className="feature-kicker">RSVP</p>
          <h2>Este enlace no es valido</h2>
          <p>
            Puede haber expirado o estar incompleto. Pediles a los novios que te reenvien
            tu invitacion personalizada.
          </p>
        </div>
      </section>
    )
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await submitRsvp(token, values)
    setStatus(
      result.ok
        ? 'Respuesta registrada. Los novios ya pueden verla en el panel.'
        : result.message,
    )
  })

  return (
    <section className="feature-page">
      <div className="feature-hero">
        <div>
          <p className="feature-kicker">RSVP personalizado</p>
          <h2>Confirmacion para {invitation.displayLabel}</h2>
          <p className="feature-lead">
            Esta invitacion esta preparada para {invitation.displayLabel}. Podes confirmar hasta{' '}
            {invitation.allowedSeats} {invitation.allowedSeats === 1 ? 'asistente' : 'asistentes'} con este mismo link.
          </p>
        </div>
        <div className="feature-note-card">
          <span>Fecha limite</span>
          <strong>{weddingEvent.rsvpDeadline}</strong>
          {existingResponse ? (
            <p>
              Estado actual: <strong>{existingResponse.status}</strong>
            </p>
          ) : (
            <p>Todavia no registraron respuesta.</p>
          )}
        </div>
      </div>

      <div className="feature-grid">
        <form className="form-card" onSubmit={onSubmit}>
          <div className="form-card__invitation-summary">
            <span className="feature-kicker">Grupo invitado</span>
            <strong>{invitation.displayLabel}</strong>
            <p>
              Contacto principal: {[invitation.primaryContactFirstName, invitation.primaryContactLastName].filter(Boolean).join(' ') || 'Sin nombre'}.
              Cupo reservado para esta invitacion: {invitation.allowedSeats}{' '}
              {invitation.allowedSeats === 1 ? 'persona' : 'personas'}.
            </p>
            {invitation.members?.length ? (
              <p>
                Integrantes: {invitation.members.map((member) => `${member.firstName} ${member.lastName}`.trim()).join(', ')}.
              </p>
            ) : null}
          </div>

          <div className="form-grid">
            <fieldset className="segmented-field">
              <legend>Van a acompanarnos?</legend>
              <div>
                <label>
                  <input type="radio" value="si" {...form.register('attending')} />
                  {isSingleInvite ? 'Si, ahi estare' : 'Si, ahi estaremos'}
                </label>
                <label>
                  <input type="radio" value="no" {...form.register('attending')} />
                  {isSingleInvite ? 'No puedo asistir' : 'No podemos asistir'}
                </label>
              </div>
            </fieldset>
          </div>

          {attending === 'si' ? (
            <div className="form-grid">
              <label>
                Cuantas personas asistiran
                <select {...form.register('attendingCount', { valueAsNumber: true })}>
                  {allowedOptions.map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? 'persona' : 'personas'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="form-grid">
            <label>
              Restricciones alimentarias
              <textarea
                rows="3"
                placeholder="Contanos si alguien necesita menu especial."
                {...form.register('dietaryRestrictions')}
              />
            </label>

            <label>
              Comentarios adicionales
              <textarea
                rows="4"
                placeholder="Podes dejar un mensaje para los novios o aclaraciones."
                {...form.register('comments')}
              />
            </label>
          </div>

          <button className="primary-button" type="submit">
            Guardar respuesta
          </button>

          <p className="form-card__footnote">
            Si necesitas cambiar algo mas adelante, podes volver a entrar con este mismo link
            hasta la fecha limite.
          </p>

          {status ? <p className="form-feedback">{status}</p> : null}
        </form>
      </div>
    </section>
  )
}
