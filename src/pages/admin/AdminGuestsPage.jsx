import { useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useWedding } from '../../context/useWedding.jsx'

function MemberFields({ errors, fields, form, primaryMemberIndex, removeMember }) {
  return (
    <div className="form-grid">
      {fields.map((field, index) => (
        <div className="member-editor" key={field.id}>
          <div className="member-editor__header">
            <strong>Integrante {index + 1}</strong>
            {fields.length > 1 ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => removeMember(index)}
              >
                Quitar
              </button>
            ) : null}
          </div>

          <div className="form-grid two-columns">
            <label className={errors.members?.[index]?.firstName ? 'has-error' : ''}>
              Nombre
              <input
                aria-invalid={errors.members?.[index]?.firstName ? 'true' : 'false'}
                {...form.register(`members.${index}.firstName`)}
              />
              {errors.members?.[index]?.firstName ? (
                <span>{errors.members[index].firstName.message}</span>
              ) : null}
            </label>
            <label>
              Apellido
              <input {...form.register(`members.${index}.lastName`)} />
            </label>
          </div>

          <label className="member-editor__radio">
            <input type="radio" value={index} {...form.register('primaryMemberIndex')} />
            Referente de la invitacion
          </label>

          {Number(primaryMemberIndex) === index ? (
            <div className="form-grid">
              <label className={errors.members?.[index]?.phone ? 'has-error' : ''}>
                WhatsApp del referente
                <input
                  aria-invalid={errors.members?.[index]?.phone ? 'true' : 'false'}
                  {...form.register(`members.${index}.phone`)}
                />
                {errors.members?.[index]?.phone ? (
                  <span>{errors.members[index].phone.message}</span>
                ) : null}
              </label>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function invitationModeLabel(mode) {
  return mode === 'individual' ? 'Individual' : 'Grupo'
}

function invitationVisualStatus(invitation, response) {
  if (invitation.accessStatus === 'paused') return 'paused'
  if (response?.status === 'confirmado') return 'confirmed'
  if (response?.status === 'rechazado') return 'declined'
  return 'pending'
}

function matchesInvitationSearch(invitation, searchTerm) {
  if (!searchTerm) return true

  const searchableText = [
    invitation.displayLabel,
    invitation.category,
    invitation.token,
    invitation.primaryContactPhone,
    ...(invitation.members ?? []).flatMap((member) => [
      member.firstName,
      member.lastName,
      member.phone,
    ]),
  ].filter(Boolean).join(' ').toLocaleLowerCase()

  return searchableText.includes(searchTerm)
}

export default function AdminGuestsPage() {
  const { addGuest, deleteInvitation, exportGuests, getResponseByInvitation, importGuests, invitations } = useWedding()
  const [importResult, setImportResult] = useState('')
  const [submitStatus, setSubmitStatus] = useState(null)
  const [filter, setFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const form = useForm({
    defaultValues: {
      invitationMode: 'group',
      displayLabel: '',
      category: 'amigos',
      allowedSeats: 1,
      individualFirstName: '',
      individualLastName: '',
      individualPhone: '',
      primaryMemberIndex: '0',
      members: [
        {
          firstName: '',
          lastName: '',
          phone: '',
        },
      ],
    },
  })
  const {
    clearErrors,
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = form

  const invitationMode = useWatch({
    control,
    name: 'invitationMode',
  })
  const primaryMemberIndex = useWatch({
    control,
    name: 'primaryMemberIndex',
  })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'members',
  })

  const filteredInvitations = useMemo(() => {
    const searchTerm = search.trim().toLocaleLowerCase()

    return invitations.filter((invitation) => (
      (filter === 'todos' || invitation.category === filter)
      && matchesInvitationSearch(invitation, searchTerm)
    ))
  }, [filter, invitations, search])

  const resetForm = () =>
    reset({
      invitationMode: 'group',
      displayLabel: '',
      category: 'amigos',
      allowedSeats: 1,
      individualFirstName: '',
      individualLastName: '',
      individualPhone: '',
      primaryMemberIndex: '0',
      members: [
        {
          firstName: '',
          lastName: '',
          phone: '',
        },
      ],
    })

  const handleModeChange = (mode) => {
    setSubmitStatus(null)
    clearErrors()
    setValue('invitationMode', mode)

    if (mode === 'group') {
      replace([
        {
          firstName: '',
          lastName: '',
          phone: '',
        },
      ])
      setValue('primaryMemberIndex', '0')
      setValue('displayLabel', '')
      setValue('allowedSeats', 1)
      setValue('individualFirstName', '')
      setValue('individualLastName', '')
      setValue('individualPhone', '')
      return
    }

    setValue('displayLabel', '')
    setValue('allowedSeats', 1)
  }

  const handleRemoveMember = (index) => {
    const currentMembers = getValues('members')
    const currentPrimary = Number(getValues('primaryMemberIndex') ?? 0)

    if (currentMembers.length <= 1) {
      return
    }

    remove(index)

    const remainingCount = currentMembers.length - 1
    let nextPrimary = currentPrimary

    if (currentPrimary === index) {
      nextPrimary = 0
    } else if (currentPrimary > index) {
      nextPrimary = currentPrimary - 1
    }

    setValue('primaryMemberIndex', String(Math.min(nextPrimary, remainingCount - 1)))
  }

  const onSubmit = handleSubmit(async (values) => {
    clearErrors()
    const mode = values.invitationMode === 'individual' ? 'individual' : 'group'
    let hasErrors = false

    if (mode === 'group') {
      const cleanedLabel = values.displayLabel.trim()
      const members = values.members.map((member) => ({
        firstName: member.firstName?.trim() ?? '',
        lastName: member.lastName?.trim() ?? '',
        phone: member.phone?.trim() ?? '',
      }))
      const nonEmptyMembers = members.filter(
        (member) => member.firstName || member.lastName || member.phone,
      )
      const primaryIndex = Number(values.primaryMemberIndex ?? 0)
      const primaryMember = members[primaryIndex]
      const normalizedPhone = (primaryMember?.phone ?? '').replace(/\D/g, '')

      if (!cleanedLabel) {
        setError('displayLabel', {
          type: 'manual',
          message: 'Ingresa un nombre para el grupo antes de guardar.',
        })
        hasErrors = true
      }

      if (!nonEmptyMembers.length) {
        setError('members', {
          type: 'manual',
          message: 'Agrega al menos un integrante para crear la invitacion.',
        })
        hasErrors = true
      }

      members.forEach((member, index) => {
        const hasPartialContent = member.firstName || member.lastName || member.phone

        if (hasPartialContent && !member.firstName) {
          setError(`members.${index}.firstName`, {
            type: 'manual',
            message: 'Completa el nombre del integrante.',
          })
          hasErrors = true
        }
      })

      if (!primaryMember?.firstName) {
        setError(`members.${Math.max(primaryIndex, 0)}.firstName`, {
          type: 'manual',
          message: 'El referente debe tener nombre.',
        })
        hasErrors = true
      }

      if (!normalizedPhone) {
        setError(`members.${primaryIndex}.phone`, {
          type: 'manual',
          message: 'Ingresa el WhatsApp del referente.',
        })
        hasErrors = true
      } else if (normalizedPhone && normalizedPhone.length < 8) {
        setError(`members.${primaryIndex}.phone`, {
          type: 'manual',
          message: 'Ingresa un WhatsApp valido.',
        })
        hasErrors = true
      }
    } else {
      const normalizedPhone = (values.individualPhone ?? '').replace(/\D/g, '')

      if (!values.individualFirstName?.trim()) {
        setError('individualFirstName', {
          type: 'manual',
          message: 'Ingresa el nombre de la persona invitada.',
        })
        hasErrors = true
      }

      if (!normalizedPhone) {
        setError('individualPhone', {
          type: 'manual',
          message: 'Ingresa el WhatsApp de la persona invitada.',
        })
        hasErrors = true
      } else if (normalizedPhone && normalizedPhone.length < 8) {
        setError('individualPhone', {
          type: 'manual',
          message: 'Ingresa un WhatsApp valido.',
        })
        hasErrors = true
      }
    }

    if (hasErrors) {
      setSubmitStatus({
        type: 'error',
        message: 'Revisa los campos marcados antes de guardar la invitacion.',
      })
      return
    }

    let result
    try {
      result = await addGuest(values)
    } catch {
      setSubmitStatus({
        type: 'error',
        message: 'No se pudo guardar la invitacion. Revisa tu conexion e intenta nuevamente.',
      })
      return
    }

    if (!result.ok) {
      setSubmitStatus({
        type: 'error',
        message: result.message,
      })
      return
    }

    setFilter('todos')
    setSubmitStatus({
      type: 'success',
      message: `${mode === 'individual' ? 'Invitacion' : 'Grupo'} "${result.invitation.displayLabel}" agregado correctamente.`,
    })
    resetForm()
  })

  const handleImport = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const result = await importGuests(file)
    setImportResult(`Importados ${result.importedInvitations} grupos y ${result.importedGuests} integrantes.`)
    event.target.value = ''
  }

  const handleDeleteInvitation = async (invitation) => {
    const confirmed = window.confirm(
      `Vas a eliminar la invitacion de ${invitation.displayLabel}. Tambien se eliminaran sus integrantes, RSVP y actividad asociada. Esta accion no se puede deshacer.`,
    )

    if (!confirmed) return

    const result = await deleteInvitation(invitation.id)
    setSubmitStatus(
      result.ok
        ? { type: 'success', message: `La invitacion de ${invitation.displayLabel} fue eliminada.` }
        : { type: 'error', message: result.message },
    )
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <div>
          <p className="feature-kicker">Grupos</p>
          <h2>Gestion de invitaciones</h2>
        </div>
        <button className="secondary-button" type="button" onClick={exportGuests}>
          Exportar CSV
        </button>
      </header>

      <div className="admin-two-columns">
        <form className="form-card compact-card" noValidate onSubmit={onSubmit}>
          <h3>Alta manual</h3>
          {submitStatus ? (
            <p className={`form-feedback ${submitStatus.type === 'error' ? 'is-error' : 'is-success'}`}>
              {submitStatus.message}
            </p>
          ) : null}

          <fieldset className="segmented-field">
            <legend>Como quieres cargar esta invitacion</legend>
            <div>
              <label>
                <input
                  checked={invitationMode !== 'individual'}
                  type="radio"
                  onChange={() => handleModeChange('group')}
                />
                Por grupo
              </label>
              <label>
                <input
                  checked={invitationMode === 'individual'}
                  type="radio"
                  onChange={() => handleModeChange('individual')}
                />
                Individual
              </label>
            </div>
          </fieldset>

          {invitationMode === 'group' ? (
            <div className="form-grid two-columns">
              <label className={errors.displayLabel ? 'has-error' : ''}>
                Nombre del grupo
                <input
                  aria-invalid={errors.displayLabel ? 'true' : 'false'}
                  placeholder="Familia Iacobelli, Chuno y Mica"
                  {...register('displayLabel')}
                />
                {errors.displayLabel ? <span>{errors.displayLabel.message}</span> : null}
              </label>
              <label>
                Categoria
                <select {...register('category')}>
                  <option value="familia">Familia</option>
                  <option value="amigos">Amigos</option>
                  <option value="trabajo">Trabajo</option>
                  <option value="otros">Otros</option>
                </select>
              </label>
            </div>
          ) : (
            <label>
              Categoria
              <select {...register('category')}>
                <option value="familia">Familia</option>
                <option value="amigos">Amigos</option>
                <option value="trabajo">Trabajo</option>
                <option value="otros">Otros</option>
              </select>
            </label>
          )}

          {invitationMode === 'individual' ? (
            <>
              <div className="form-grid two-columns">
                <label className={errors.individualFirstName ? 'has-error' : ''}>
                  Nombre
                  <input
                    aria-invalid={errors.individualFirstName ? 'true' : 'false'}
                    {...register('individualFirstName')}
                  />
                  {errors.individualFirstName ? <span>{errors.individualFirstName.message}</span> : null}
                </label>
                <label>
                  Apellido
                  <input {...register('individualLastName')} />
                </label>
              </div>

              <div className="form-grid">
                <label className={errors.individualPhone ? 'has-error' : ''}>
                  WhatsApp
                  <input
                    aria-invalid={errors.individualPhone ? 'true' : 'false'}
                    {...register('individualPhone')}
                  />
                  {errors.individualPhone ? <span>{errors.individualPhone.message}</span> : null}
                </label>
              </div>

              <label>
                Cupo total para esta invitacion
                <select {...register('allowedSeats', { valueAsNumber: true })}>
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1} {index === 0 ? 'persona' : 'personas'}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              {errors.members?.message ? <p className="form-feedback is-error">{errors.members.message}</p> : null}

              <MemberFields
                errors={errors}
                fields={fields}
                form={form}
                primaryMemberIndex={primaryMemberIndex}
                removeMember={handleRemoveMember}
              />

              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  append({
                    firstName: '',
                    lastName: '',
                    phone: '',
                  })
                }
              >
                Agregar integrante
              </button>
            </>
          )}

          <button className="primary-button" type="button" onClick={() => void onSubmit()}>
            {invitationMode === 'individual' ? 'Agregar invitacion individual' : 'Agregar grupo'}
          </button>
        </form>

        <article className="panel-card">
          <div className="list-card__header">
            <h3>Importacion masiva</h3>
          </div>
          <p>Se admiten archivos `.csv`, `.xlsx` y `.xls`.</p>
          <label className="file-field">
            Seleccionar archivo
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} />
            <small>Columnas sugeridas: grupo o etiqueta, nombre, apellido, telefono, categoria, cupo. Si repetis el mismo grupo en varias filas, se agrupan como integrantes.</small>
          </label>
          {importResult ? <p className="form-feedback">{importResult}</p> : null}
        </article>
      </div>

      <div className="admin-panel__filters">
        <button type="button" onClick={() => setFilter('todos')}>Todos</button>
        <button type="button" onClick={() => setFilter('familia')}>Familia</button>
        <button type="button" onClick={() => setFilter('amigos')}>Amigos</button>
        <button type="button" onClick={() => setFilter('trabajo')}>Trabajo</button>
        <button type="button" onClick={() => setFilter('otros')}>Otros</button>
      </div>

      <label className="admin-guest-search">
        <span>Buscar invitación</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nombre, grupo o WhatsApp"
        />
      </label>

      <div className="table-card admin-table-desktop">
        <table>
          <thead>
            <tr>
              <th>Invitacion</th>
              <th>Tipo</th>
              <th>Referente</th>
              <th>Integrantes</th>
              <th>Categoria</th>
              <th>Cupo</th>
              <th>Estado RSVP</th>
              <th>Estado envio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvitations.map((invitation) => {
              const response = getResponseByInvitation(invitation.id)
              const primaryMember = invitation.members?.find((member) => member.isPrimary) ?? invitation.members?.[0]
              const visualStatus = invitationVisualStatus(invitation, response)

              return (
                <tr className={`admin-invitation-row is-${visualStatus}`} key={invitation.id}>
                  <td>
                    <strong>{invitation.displayLabel}</strong>
                    <br />
                    <code>{invitation.token ?? 'Token protegido'}</code>
                  </td>
                  <td>{invitationModeLabel(invitation.invitationMode)}</td>
                  <td>{primaryMember ? `${primaryMember.firstName} ${primaryMember.lastName}`.trim() : '-'}</td>
                  <td>{(invitation.members ?? []).map((member) => `${member.firstName} ${member.lastName}`.trim()).join(', ') || '-'}</td>
                  <td>{invitation.category}</td>
                  <td>{invitation.allowedSeats}</td>
                  <td>{response?.status ?? 'sin_respuesta'}</td>
                  <td>{invitation.deliveryStatus}</td>
                  <td>
                    <button className="secondary-button" type="button" onClick={() => handleDeleteInvitation(invitation)}>
                      Eliminar
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
          {filteredInvitations.map((invitation) => {
            const response = getResponseByInvitation(invitation.id)
            const primaryMember = invitation.members?.find((member) => member.isPrimary) ?? invitation.members?.[0]
            const visualStatus = invitationVisualStatus(invitation, response)

            return (
              <article className={`admin-mobile-card is-${visualStatus}`} key={invitation.id}>
                <div className="admin-mobile-card__header">
                  <p className="admin-mobile-card__title">{invitation.displayLabel}</p>
                  <code>{invitation.token ?? 'Token protegido'}</code>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Tipo</span>
                  <strong>{invitationModeLabel(invitation.invitationMode)}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Referente</span>
                  <strong>{primaryMember ? `${primaryMember.firstName} ${primaryMember.lastName}`.trim() : '-'}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Integrantes</span>
                  <strong>{(invitation.members ?? []).map((member) => `${member.firstName} ${member.lastName}`.trim()).join(', ') || '-'}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Categoria</span>
                  <strong>{invitation.category}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Cupo</span>
                  <strong>{invitation.allowedSeats}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>RSVP</span>
                  <strong>{response?.status ?? 'sin_respuesta'}</strong>
                </div>

                <div className="admin-mobile-card__row">
                  <span>Envio</span>
                  <strong>{invitation.deliveryStatus}</strong>
                </div>
                <button className="secondary-button" type="button" onClick={() => handleDeleteInvitation(invitation)}>
                  Eliminar invitacion
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
