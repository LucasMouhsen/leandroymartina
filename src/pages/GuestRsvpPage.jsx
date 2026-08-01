import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWedding } from '../context/useWedding.jsx'

const attendeeSchema = z.object({
  id: z.string(),
  type: z.enum(['member', 'companion']),
  memberId: z.string().nullable().optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  name: z.string().max(120).optional(),
  attending: z.boolean().optional(),
  dietaryRestrictions: z.string().max(200).optional(),
})

const schema = z.object({
  attending: z.enum(['si', 'no']),
  attendees: z.array(attendeeSchema),
  comments: z.string().max(300).optional(),
})

function attendeeDisplayName(attendee, index) {
  if (attendee.type === 'companion') {
    return attendee.name || `Acompanante ${index + 1}`
  }

  return attendee.name || [attendee.firstName, attendee.lastName].filter(Boolean).join(' ') || `Invitado ${index + 1}`
}

function hasRsvpDeadlinePassed(deadline) {
  const deadlineAt = new Date(`${deadline}T23:59:59-03:00`)
  return !Number.isNaN(deadlineAt.getTime()) && new Date() > deadlineAt
}

function formatDeadline(deadline) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(
    new Date(`${deadline}T12:00:00-03:00`),
  )
}

export default function GuestRsvpPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const {
    fetchInvitationByToken,
    getRsvpAttendees,
    submitRsvp,
    weddingEvent,
  } = useWedding()
  const [status, setStatus] = useState(null)
  const [remoteInvitation, setRemoteInvitation] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchInvitationByToken(token).then((result) => {
      if (active) {
        setRemoteInvitation(result)
        setIsLoading(false)
      }
    })
    return () => { active = false }
  }, [fetchInvitationByToken, token])

  const invitation = remoteInvitation?.invitation ?? null
  const existingResponse = remoteInvitation?.response ?? null
  const attendeeRows = useMemo(
    () => (invitation ? getRsvpAttendees(invitation, existingResponse) : []),
    [existingResponse, getRsvpAttendees, invitation],
  )

  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      attending: existingResponse?.status === 'rechazado' ? 'no' : 'si',
      attendees: attendeeRows,
      comments: existingResponse?.comments ?? '',
    },
  })
  const isDeadlineClosed = hasRsvpDeadlinePassed(remoteInvitation?.rsvpDeadline ?? weddingEvent.rsvpDeadline)

  useEffect(() => {
    form.reset({
      attending: existingResponse?.status === 'rechazado' ? 'no' : 'si',
      attendees: attendeeRows,
      comments: existingResponse?.comments ?? '',
    })
  }, [attendeeRows, existingResponse?.comments, existingResponse?.status, form, invitation?.id])

  const attending = useWatch({ control: form.control, name: 'attending' })
  const watchedAttendees = useWatch({ control: form.control, name: 'attendees' }) ?? []
  const confirmedCount = attending === 'si'
    ? watchedAttendees.filter((attendee) => attendee.attending).length
    : 0
  const attendeeErrors = form.formState.errors.attendees

  if (isLoading) {
    return <section className="feature-page feature-empty"><p>Cargando invitacion…</p></section>
  }

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
          <Link className="primary-button" to="/">
            Ver invitacion general
          </Link>
        </div>
      </section>
    )
  }

  const saveResponse = async (values) => {
    if (isDeadlineClosed) {
      setStatus({ tone: 'error', message: 'El plazo para confirmar asistencia ya finalizo.' })
      return
    }

    if (values.attending === 'si' && confirmedCount === 0) {
      form.setError('attendees', {
        type: 'required',
        message: 'Elegí al menos una persona que vaya a asistir.',
      })
      setStatus({ tone: 'error', message: 'Marca al menos una persona asistente o indica que no podran asistir.' })
      return
    }

    const unnamedCompanionIndex = values.attendees.findIndex(
      (attendee) => attendee.attending && attendee.type === 'companion' && !attendee.name?.trim(),
    )

    if (unnamedCompanionIndex >= 0) {
      form.setError(`attendees.${unnamedCompanionIndex}.name`, {
        type: 'required',
        message: 'Indica el nombre del acompanante.',
      })
      form.setFocus(`attendees.${unnamedCompanionIndex}.name`)
      setStatus({ tone: 'error', message: 'Completa el nombre de cada acompanante confirmado.' })
      return
    }

    const result = await submitRsvp(token, values)
    setStatus(
      result.ok
        ? { tone: 'success', message: 'Respuesta registrada. Los novios ya pueden verla en el panel.' }
        : { tone: 'error', message: result.message },
    )
  }

  const onInvalid = () => {
    setStatus({ tone: 'error', message: 'Revisa los campos marcados antes de guardar la respuesta.' })
  }

  const onSubmit = form.handleSubmit(saveResponse, onInvalid)

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
          <strong>{formatDeadline(weddingEvent.rsvpDeadline)}</strong>
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
        <form className="form-card rsvp-form-card" onSubmit={onSubmit} noValidate>
          <div className="form-card__invitation-summary">
            <span className="feature-kicker">Grupo invitado</span>
            <strong>{invitation.displayLabel}</strong>
            <p>
              Contacto principal: {[invitation.primaryContactFirstName, invitation.primaryContactLastName].filter(Boolean).join(' ') || 'Sin nombre'}.
              Cupo reservado para esta invitacion: {invitation.allowedSeats}{' '}
              {invitation.allowedSeats === 1 ? 'persona' : 'personas'}.
            </p>
          </div>

          {isDeadlineClosed ? (
            <p className="form-feedback is-error" role="alert">
              El plazo para confirmar asistencia ya finalizo. Contacta a los novios ante cualquier cambio.
            </p>
          ) : null}

          <fieldset className="segmented-field rsvp-decision" disabled={isDeadlineClosed}>
            <legend>Van a acompanarnos?<small>Elegí una opcion para continuar.</small></legend>
            <div>
              <label className={attending === 'si' ? 'is-selected' : ''}>
                <input type="radio" value="si" {...form.register('attending')} />
                <span className="rsvp-decision__icon" aria-hidden="true">&#10003;</span>
                <span><strong>Si, vamos a asistir</strong><small>Ahora elegí quienes forman parte del grupo.</small></span>
              </label>
              <label className={attending === 'no' ? 'is-selected' : ''}>
                <input type="radio" value="no" {...form.register('attending')} />
                <span className="rsvp-decision__icon" aria-hidden="true">&mdash;</span>
                <span><strong>No podremos asistir</strong><small>Guardaremos la respuesta y avisaremos a los novios.</small></span>
              </label>
            </div>
          </fieldset>

          {attending === 'si' ? (
            <div className="rsvp-attendee-list">
              <div className="rsvp-attendee-list__header">
                <div>
                  <h3>Quienes asisten?</h3>
                </div>
                <span className={confirmedCount > 0 ? 'is-complete' : ''}>
                  {confirmedCount} de {invitation.allowedSeats} {invitation.allowedSeats === 1 ? 'cupo' : 'cupos'}
                </span>
              </div>

              <p className="rsvp-attendee-list__hint">
                Toca cada nombre para sumarlo a la confirmacion. Los datos de alimentacion son opcionales.
              </p>

              {attendeeErrors?.message ? (
                <p className="field-error" role="alert">{attendeeErrors.message}</p>
              ) : null}

              {attendeeRows.map((attendee, index) => {
                const fieldAttending = watchedAttendees[index]?.attending
                const displayName = attendeeDisplayName(watchedAttendees[index] ?? attendee, index)

                return (
                  <article className={`rsvp-attendee-card ${fieldAttending ? 'is-selected' : ''}`} key={attendee.id}>
                    <input type="hidden" {...form.register(`attendees.${index}.id`)} />
                    <input type="hidden" {...form.register(`attendees.${index}.type`)} />
                    <input type="hidden" {...form.register(`attendees.${index}.memberId`)} />
                    <input type="hidden" {...form.register(`attendees.${index}.firstName`)} />
                    <input type="hidden" {...form.register(`attendees.${index}.lastName`)} />

                    <label className="rsvp-attendee-card__check">
                      <input
                        type="checkbox"
                        {...form.register(`attendees.${index}.attending`, {
                          onChange: () => form.clearErrors('attendees'),
                        })}
                      />
                      <span>
                        <strong>{displayName}</strong>
                        <small>{attendee.type === 'companion' ? 'Acompanante' : 'Integrante invitado'}</small>
                      </span>
                    </label>

                    {attendee.type === 'companion' ? (
                      <label className={form.formState.errors.attendees?.[index]?.name ? 'has-error' : ''}>
                        Nombre del acompanante
                        <input
                          disabled={!fieldAttending}
                          autoComplete="name"
                          placeholder={`Acompanante ${index + 1}…`}
                          aria-invalid={Boolean(form.formState.errors.attendees?.[index]?.name)}
                          aria-describedby={form.formState.errors.attendees?.[index]?.name ? `companion-error-${index}` : undefined}
                          {...form.register(`attendees.${index}.name`, {
                            onChange: () => form.clearErrors(`attendees.${index}.name`),
                          })}
                        />
                        {form.formState.errors.attendees?.[index]?.name ? (
                          <span id={`companion-error-${index}`} role="alert">{form.formState.errors.attendees[index].name.message}</span>
                        ) : null}
                      </label>
                    ) : (
                      <input type="hidden" {...form.register(`attendees.${index}.name`)} />
                    )}

                    <label>
                      Alimentacion especial
                      <textarea
                        disabled={!fieldAttending}
                        rows="2"
                        autoComplete="off"
                        placeholder="Sin restricciones, vegetariano, celiaco, alergias, etc."
                        {...form.register(`attendees.${index}.dietaryRestrictions`)}
                      />
                    </label>
                  </article>
                )
              })}
            </div>
          ) : null}

          <label className={form.formState.errors.comments ? 'has-error' : ''}>
            Comentarios adicionales
            <textarea
              rows="4"
              autoComplete="off"
              placeholder="Podes dejar un mensaje para los novios o aclaraciones."
              aria-invalid={Boolean(form.formState.errors.comments)}
              aria-describedby="comments-help"
              {...form.register('comments')}
            />
            <small id="comments-help">Opcional. Maximo 300 caracteres.</small>
            {form.formState.errors.comments ? <span role="alert">{form.formState.errors.comments.message}</span> : null}
          </label>

          <div className="rsvp-submit-area">
            <button className="primary-button rsvp-submit-button" type="submit" disabled={isDeadlineClosed}>
              <span className="rsvp-submit-span">{attending === 'no' ? 'Confirmar que no asistiremos' : 'Confirmar asistencia'}</span>
              <span aria-hidden="true">&#8594;</span>
            </button>
            <p role="status" aria-live="polite">
              {attending === 'no'
                ? 'Vas a guardar que no podran asistir.'
                : confirmedCount > 0
                  ? `${confirmedCount} ${confirmedCount === 1 ? 'persona confirmada' : 'personas confirmadas'}. Ya podes guardar.`
                  : 'Primero marca al menos una persona que vaya a asistir.'}
            </p>
          </div>

          <p className="form-card__footnote">
            Si necesitas cambiar algo mas adelante, podes volver a entrar con este mismo link
            hasta la fecha limite.
          </p>

          {status?.tone === 'error' ? (
            <div
              className="response-alert response-alert--error"
              role="alert"
              aria-live="assertive"
            >
              <span className="response-alert__icon" aria-hidden="true">
                !
              </span>
              <div>
                <strong>No pudimos guardar tu respuesta</strong>
                <p>{status.message}</p>
              </div>
            </div>
          ) : null}
        </form>
      </div>

      {status?.tone === 'success' ? (
        <div className="rsvp-confirmation-modal" role="presentation">
          <div className="rsvp-confirmation-modal__backdrop" />
          <section
            className="rsvp-confirmation-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rsvp-confirmation-title"
            aria-describedby="rsvp-confirmation-description"
            onKeyDown={(event) => {
              if (event.key === 'Tab') event.preventDefault()
            }}
          >
            <span className="rsvp-confirmation-modal__icon" aria-hidden="true">✓</span>
            <p className="feature-kicker">Confirmación guardada</p>
            <h2 id="rsvp-confirmation-title">¡Gracias por confirmar!</h2>
            <p id="rsvp-confirmation-description">Respuesta registrada. Los novios ya pueden verla en el panel.</p>
            <button className="primary-button" type="button" autoFocus onClick={() => navigate(`/invitacion/${token}`)}>
              Ver invitación
            </button>
          </section>
        </div>
      ) : null}
    </section>
  )
}
