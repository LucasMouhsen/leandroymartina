import {
  createContext,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { initialWeddingState } from '../data/initialState.js'

const STORAGE_KEY = 'wedding-hub-state-v1'
const SESSION_KEY = 'wedding-hub-session-v1'
const STATE_VERSION = 3

const WeddingContext = createContext(null)

function createToken() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '')
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num))
}

function buildContactName(invitation) {
  return [invitation.primaryContactFirstName, invitation.primaryContactLastName]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function derivePrimaryMember(members = []) {
  return members.find((member) => member.isPrimary) ?? members[0] ?? null
}

function buildMembersFromGuests(guests = [], invitationId) {
  return guests
    .filter((guest) => guest.invitationId === invitationId || guest.groupId === invitationId)
    .map((guest, index) => ({
      id: guest.memberId ?? guest.id ?? `member-${createToken()}`,
      firstName: guest.firstName ?? '',
      lastName: guest.lastName ?? '',
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      isPrimary: guest.role === 'principal' || index === 0,
    }))
}

function flattenGuestsFromInvitations(invitations = []) {
  return invitations.flatMap((invitation) =>
    (invitation.members ?? []).map((member) => ({
      id: `guest-${member.id}`,
      invitationId: invitation.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone,
      inviteStatus: invitation.deliveryStatus,
      role: member.isPrimary ? 'principal' : 'acompanante',
      memberId: member.id,
    })),
  )
}

function migrateGuestGroupsToInvitations(parsed) {
  const legacyGroups = parsed.guestGroups ?? []
  const legacyGuests = parsed.guests ?? []

  const invitations = legacyGroups.map((group) => {
    const members = buildMembersFromGuests(legacyGuests, group.id)
    const primaryGuest = derivePrimaryMember(members)

    return {
      id: group.id,
      displayLabel: group.displayLabel ?? group.name ?? (buildContactName(primaryGuest ?? {}) || 'Invitacion'),
      category: group.category ?? 'otros',
      token: group.token ?? createToken(),
      allowedSeats: group.allowedSeats ?? group.totalAllowed ?? 1,
      notes: group.notes ?? '',
      primaryContactFirstName: group.primaryContactFirstName ?? primaryGuest?.firstName ?? '',
      primaryContactLastName: group.primaryContactLastName ?? primaryGuest?.lastName ?? '',
      primaryContactEmail: group.primaryContactEmail ?? primaryGuest?.email ?? '',
      primaryContactPhone: group.primaryContactPhone ?? primaryGuest?.phone ?? '',
      deliveryStatus: group.deliveryStatus ?? primaryGuest?.inviteStatus ?? 'pendiente',
      createdAt: group.createdAt ?? new Date().toISOString(),
      members,
    }
  })

  const guests = flattenGuestsFromInvitations(invitations)

  const rsvpResponses = (parsed.rsvpResponses ?? []).map((response) => ({
    ...response,
    invitationId: response.invitationId ?? response.groupId,
  }))

  const inviteDeliveries = (parsed.inviteDeliveries ?? []).map((delivery) => {
    if (delivery.invitationId) {
      return delivery
    }

    const guest = guests.find((item) => item.id === delivery.guestId)

    return {
      ...delivery,
      invitationId: guest?.invitationId ?? null,
    }
  })

  return {
    ...parsed,
    invitations,
    guests,
    rsvpResponses,
    inviteDeliveries,
  }
}

function migrateState(parsed) {
  let next = { ...parsed }

  if (!next.invitations && next.guestGroups) {
    next = migrateGuestGroupsToInvitations(next)
  }

  if (next.guests) {
    next.guests = next.guests.map((guest) => ({
      ...guest,
      invitationId: guest.invitationId ?? guest.groupId,
    }))
  }

  if (next.invitations) {
    next.invitations = next.invitations.map((invitation) => {
      const members = invitation.members?.length
        ? invitation.members
        : buildMembersFromGuests(next.guests ?? [], invitation.id)
      const primaryMember = derivePrimaryMember(members)

      return {
        ...invitation,
        allowedSeats: invitation.allowedSeats ?? invitation.totalAllowed ?? Math.max(members.length, 1),
        invitationMode: invitation.invitationMode ?? (members.length > 1 ? 'group' : 'individual'),
        primaryContactFirstName: invitation.primaryContactFirstName ?? primaryMember?.firstName ?? '',
        primaryContactLastName: invitation.primaryContactLastName ?? primaryMember?.lastName ?? '',
        primaryContactEmail: invitation.primaryContactEmail ?? primaryMember?.email ?? '',
        primaryContactPhone: invitation.primaryContactPhone ?? primaryMember?.phone ?? '',
        members,
      }
    })

    next.guests = flattenGuestsFromInvitations(next.invitations)
  }

  if (next.rsvpResponses) {
    next.rsvpResponses = next.rsvpResponses.map((response) => ({
      ...response,
      invitationId: response.invitationId ?? response.groupId,
    }))
  }

  if (next.inviteDeliveries) {
    next.inviteDeliveries = next.inviteDeliveries.map((delivery) => {
      if (delivery.invitationId) {
        return delivery
      }

      const guest = (next.guests ?? []).find((item) => item.id === delivery.guestId)

      return {
        ...delivery,
        invitationId: guest?.invitationId ?? null,
      }
    })
  }

  delete next.guestGroups

  return next
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return {
        ...initialWeddingState,
        stateVersion: STATE_VERSION,
      }
    }

    const parsed = migrateState(JSON.parse(stored))
    const merged = { ...initialWeddingState, ...parsed }

    if (!parsed.stateVersion || parsed.stateVersion < STATE_VERSION) {
      return {
        ...merged,
        giftItems: initialWeddingState.giftItems,
        stateVersion: STATE_VERSION,
      }
    }

    return {
      ...merged,
      stateVersion: STATE_VERSION,
    }
  } catch {
    return {
      ...initialWeddingState,
      stateVersion: STATE_VERSION,
    }
  }
}

function loadSession() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

async function loadPapa() {
  const module = await import('papaparse')
  return module.default
}

async function loadXlsx() {
  return import('xlsx')
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function buildInviteMessage(name, link) {
  return `Hola ${name}! Queremos invitarte a nuestra boda. En este link vas a encontrar todos los detalles y vas a poder confirmar tu asistencia: ${link}. Nos haria muy felices que nos acompanes.`
}

function validateInvitationPayload(payload, existingInvitations = []) {
  const invitationMode = payload.invitationMode === 'individual' ? 'individual' : 'group'
  const rawMembers = invitationMode === 'individual'
    ? [
        {
          firstName: payload.individualFirstName ?? '',
          lastName: payload.individualLastName ?? '',
          email: payload.individualEmail ?? '',
          phone: payload.individualPhone ?? '',
        },
      ]
    : payload.members ?? []
  const members = rawMembers.map((member) => ({
    firstName: member.firstName?.trim() ?? '',
    lastName: member.lastName?.trim() ?? '',
    email: member.email?.trim() ?? '',
    phone: member.phone?.trim() ?? '',
  }))
  const fallbackLabel = invitationMode === 'individual'
    ? `${members[0]?.firstName ?? ''} ${members[0]?.lastName ?? ''}`.trim()
    : ''
  const cleanedLabel = payload.displayLabel?.trim() || fallbackLabel
  const nonEmptyMembers = members.filter(
    (member) => member.firstName || member.lastName || member.email || member.phone,
  )
  const primaryIndex = invitationMode === 'individual' ? 0 : Number(payload.primaryMemberIndex ?? 0)
  const primaryMember = members[primaryIndex]
  const normalizedPhone = (primaryMember?.phone ?? '').replace(/\D/g, '')
  const allowedSeats = invitationMode === 'individual'
    ? clamp(Number(payload.allowedSeats ?? 1) || 1, 1, 12)
    : Math.max(nonEmptyMembers.filter((member) => member.firstName).length, 1)

  if (!cleanedLabel) {
    return {
      ok: false,
      message:
        invitationMode === 'individual'
          ? 'Ingresa al menos el nombre de la persona invitada.'
          : 'Ingresa un nombre para el grupo antes de guardar.',
    }
  }

  if (
    existingInvitations.some(
      (invitation) => invitation.displayLabel.trim().toLowerCase() === cleanedLabel.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      message:
        invitationMode === 'individual'
          ? 'Ya existe una invitacion con esa etiqueta. Usa otra etiqueta para distinguirla.'
          : 'Ya existe un grupo con ese nombre. Usa otra etiqueta para distinguirlo.',
    }
  }

  if (!nonEmptyMembers.length) {
    return {
      ok: false,
      message:
        invitationMode === 'individual'
          ? 'Completa los datos de la persona invitada.'
          : 'Agrega al menos un integrante para crear la invitacion.',
    }
  }

  if (!primaryMember?.firstName) {
    return { ok: false, message: 'El referente debe tener nombre.' }
  }

  if (primaryMember.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryMember.email)) {
    return { ok: false, message: 'Ingresa un email valido para el referente.' }
  }

  if (!primaryMember.email && !normalizedPhone) {
    return { ok: false, message: 'Ingresa email o WhatsApp del referente.' }
  }

  if (normalizedPhone && normalizedPhone.length < 8) {
    return { ok: false, message: 'Ingresa un WhatsApp valido para el referente.' }
  }

  return {
    ok: true,
    cleanedLabel,
    members,
    primaryIndex,
    invitationMode,
    allowedSeats,
  }
}

function normalizeInvitationRows(rows) {
  const buckets = new Map()

  rows.forEach((row, index) => {
    const firstName =
      row.nombre ||
      row.first_name ||
      row.firstname ||
      row.nombre_invitado ||
      row.name ||
      ''
    const lastName =
      row.apellido ||
      row.last_name ||
      row.lastname ||
      row.surname ||
      ''
    const phone = row.telefono || row.celular || row.phone || ''
    const email = row.email || row.mail || ''
    const category = row.categoria || row.category || 'otros'
    const rawSeats = Number(row.cupo_total || row.cupo || row.acompanantes || row.companions || 1)
    const displayLabel =
      row.etiqueta ||
      row.display_label ||
      row.invitacion ||
      row.grupo ||
      row.group ||
      `${firstName} ${lastName}`.trim() ||
      `Invitacion ${index + 1}`

    const allowedSeats = clamp(
      row.acompanantes || row.companions ? rawSeats + 1 : rawSeats,
      1,
      12,
    )
    const key = (displayLabel || `invitacion-${index + 1}`).toLowerCase()

    if (!buckets.has(key)) {
      buckets.set(key, {
        invitation: {
          id: `invitation-${createToken()}`,
          displayLabel,
          category,
          token: createToken(),
          allowedSeats,
          notes: row.notas || row.notes || '',
          primaryContactFirstName: firstName || 'Invitado',
          primaryContactLastName: lastName || '',
          primaryContactEmail: email,
          primaryContactPhone: phone,
          deliveryStatus: 'pendiente',
          createdAt: new Date().toISOString(),
          members: [],
        },
      })
    }

    const bucket = buckets.get(key)
    bucket.invitation.allowedSeats = Math.max(bucket.invitation.allowedSeats, allowedSeats)
    bucket.invitation.members.push({
      id: `member-${createToken()}`,
      firstName: firstName || `Integrante ${bucket.invitation.members.length + 1}`,
      lastName: lastName || '',
      email,
      phone,
      isPrimary: bucket.invitation.members.length === 0,
    })
  })

  return Array.from(buckets.values()).map((item) => ({
    invitation: item.invitation,
    guestRecords: flattenGuestsFromInvitations([item.invitation]),
  }))
}

function deriveGiftStatus(gift, contributions) {
  const validated = contributions
    .filter((contribution) => contribution.giftItemId === gift.id && contribution.status === 'validado')
    .reduce((sum, contribution) => sum + Number(contribution.amount || 0), 0)

  if (validated <= 0) {
    return 'disponible'
  }

  if (validated >= gift.suggestedAmount) {
    return 'completado'
  }

  return 'parcial'
}

function enrichGift(gift, contributions) {
  const validated = contributions
    .filter((contribution) => contribution.giftItemId === gift.id && contribution.status === 'validado')
    .reduce((sum, contribution) => sum + Number(contribution.amount || 0), 0)

  return {
    ...gift,
    raisedAmount: validated,
    status: deriveGiftStatus(gift, contributions),
  }
}

export function WeddingProvider({ children }) {
  const [state, setState] = useState(loadState)
  const [session, setSession] = useState(loadSession)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      return
    }

    sessionStorage.removeItem(SESSION_KEY)
  }, [session])

  const invitations = useMemo(() => state.invitations, [state.invitations])
  const guests = useMemo(() => state.guests, [state.guests])
  const rsvpResponses = useMemo(() => state.rsvpResponses, [state.rsvpResponses])
  const giftItems = useMemo(
    () => state.giftItems.map((gift) => enrichGift(gift, state.giftContributions)),
    [state.giftItems, state.giftContributions],
  )
  const approvedMessages = useMemo(
    () => state.guestMessages.filter((message) => message.status === 'aprobado'),
    [state.guestMessages],
  )
  const approvedSongs = useMemo(
    () => state.songSuggestions.filter((song) => song.status === 'aprobado'),
    [state.songSuggestions],
  )

  const isAuthenticated = Boolean(session?.email)

  const getInvitationByToken = useCallback(
    (token) =>
      invitations.find((invitation) => invitation.token.toLowerCase() === String(token).toLowerCase()) ?? null,
    [invitations],
  )

  const getGuestsByInvitation = useCallback(
    (invitationId) => guests.filter((guest) => guest.invitationId === invitationId),
    [guests],
  )

  const getInvitationMembers = useCallback(
    (invitationId) =>
      invitations.find((invitation) => invitation.id === invitationId)?.members ?? [],
    [invitations],
  )

  const getResponseByInvitation = useCallback(
    (invitationId) =>
      rsvpResponses.find((response) => response.invitationId === invitationId) ?? null,
    [rsvpResponses],
  )

  const buildInviteLink = useCallback((token) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/confirmar/${token}`
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const valid =
      email.toLowerCase() === state.adminUser.email.toLowerCase() &&
      password === state.adminUser.password

    if (!valid) {
      return { ok: false, message: 'Credenciales invalidas.' }
    }

    setSession({
      email: state.adminUser.email,
      name: state.adminUser.name,
      loggedAt: new Date().toISOString(),
    })

    return { ok: true }
  }, [state.adminUser.email, state.adminUser.name, state.adminUser.password])

  const logout = useCallback(() => setSession(null), [])

  const submitRsvp = useCallback(async (token, payload) => {
    const invitation = getInvitationByToken(token)

    if (!invitation) {
      return { ok: false, message: 'El enlace ya no es valido.' }
    }

    const requestedCount = payload.attending === 'si' ? Number(payload.attendingCount) : 0

    if (payload.attending === 'si' && (requestedCount < 1 || requestedCount > invitation.allowedSeats)) {
      return {
        ok: false,
        message: `Esta invitacion permite confirmar entre 1 y ${invitation.allowedSeats} ${invitation.allowedSeats === 1 ? 'persona' : 'personas'}.`,
      }
    }

    const now = new Date().toISOString()

    setState((current) => {
      const nextResponses = [...current.rsvpResponses]
      const index = nextResponses.findIndex((response) => response.invitationId === invitation.id)

      const responseRecord = {
        id: index >= 0 ? nextResponses[index].id : `rsvp-${createToken()}`,
        invitationId: invitation.id,
        status: payload.attending === 'si' ? 'confirmado' : 'rechazado',
        attendingCount: requestedCount,
        dietaryRestrictions: payload.dietaryRestrictions,
        comments: payload.comments,
        updatedAt: now,
      }

      if (index >= 0) {
        nextResponses[index] = responseRecord
      } else {
        nextResponses.push(responseRecord)
      }

      const nextInvitations = current.invitations.map((item) =>
        item.id === invitation.id
          ? {
              ...item,
              deliveryStatus: payload.attending === 'si' ? 'respondida' : 'rechazada',
            }
          : item,
      )

      const nextGuests = current.guests.map((guest) =>
        guest.invitationId === invitation.id
          ? {
              ...guest,
              inviteStatus: payload.attending === 'si' ? 'respondida' : 'rechazada',
            }
          : guest,
      )

      const nextDeliveries = [
        ...current.inviteDeliveries,
        {
          id: `delivery-${createToken()}`,
          invitationId: invitation.id,
          channel: invitation.primaryContactPhone ? 'whatsapp' : 'email',
          type: 'confirmacion',
          status: 'registrada',
          message: `Respuesta RSVP registrada para ${invitation.displayLabel}.`,
          sentAt: now,
        },
      ]

      const nextAudit = [
        ...current.auditLog,
        {
          id: `audit-${createToken()}`,
          action: 'rsvp_updated',
          entityId: invitation.id,
          detail: `${invitation.displayLabel} actualizo su RSVP.`,
          createdAt: now,
        },
      ]

      return {
        ...current,
        invitations: nextInvitations,
        guests: nextGuests,
        rsvpResponses: nextResponses,
        inviteDeliveries: nextDeliveries,
        auditLog: nextAudit,
      }
    })

    return { ok: true }
  }, [getInvitationByToken])

  const submitGiftContribution = useCallback(async (payload) => {
    const now = new Date().toISOString()

    setState((current) => ({
      ...current,
      giftContributions: [
        {
          id: `contribution-${createToken()}`,
          createdAt: now,
          status: 'pendiente_validacion',
          ...payload,
        },
        ...current.giftContributions,
      ],
      auditLog: [
        {
          id: `audit-${createToken()}`,
          action: 'gift_contribution_created',
          entityId: payload.giftItemId || 'free',
          detail: `${payload.guestName} registro un aporte.`,
          createdAt: now,
        },
        ...current.auditLog,
      ],
    }))

    return { ok: true }
  }, [])

  const setContributionStatus = useCallback((contributionId, status) => {
    const now = new Date().toISOString()

    setState((current) => ({
      ...current,
      giftContributions: current.giftContributions.map((contribution) =>
        contribution.id === contributionId ? { ...contribution, status, reviewedAt: now } : contribution,
      ),
      auditLog: [
        {
          id: `audit-${createToken()}`,
          action: 'gift_contribution_reviewed',
          entityId: contributionId,
          detail: `Aporte marcado como ${status}.`,
          createdAt: now,
        },
        ...current.auditLog,
      ],
    }))
  }, [])

  const submitSongSuggestion = useCallback(async (payload) => {
    const now = new Date().toISOString()

    setState((current) => ({
      ...current,
      songSuggestions: [
        {
          id: `song-${createToken()}`,
          createdAt: now,
          votes: 0,
          status: 'pendiente_aprobacion',
          ...payload,
        },
        ...current.songSuggestions,
      ],
    }))

    return { ok: true }
  }, [])

  const voteSong = useCallback((songId) => {
    setState((current) => ({
      ...current,
      songSuggestions: current.songSuggestions.map((song) =>
        song.id === songId ? { ...song, votes: song.votes + 1 } : song,
      ),
    }))
  }, [])

  const reviewSong = useCallback((songId, status) => {
    setState((current) => ({
      ...current,
      songSuggestions: current.songSuggestions.map((song) =>
        song.id === songId ? { ...song, status } : song,
      ),
    }))
  }, [])

  const submitMessage = useCallback(async (payload) => {
    const now = new Date().toISOString()

    setState((current) => ({
      ...current,
      guestMessages: [
        {
          id: `message-${createToken()}`,
          createdAt: now,
          status: 'pendiente_aprobacion',
          ...payload,
        },
        ...current.guestMessages,
      ],
    }))

    return { ok: true }
  }, [])

  const reviewMessage = useCallback((messageId, status) => {
    setState((current) => ({
      ...current,
      guestMessages: current.guestMessages.map((message) =>
        message.id === messageId ? { ...message, status } : message,
      ),
    }))
  }, [])

  const addGuest = useCallback((payload) => {
    const validation = validateInvitationPayload(payload, invitations)

    if (!validation.ok) {
      return validation
    }

    const now = new Date().toISOString()
    const invitationId = `invitation-${createToken()}`
    const members = validation.members
      .filter((member) => member.firstName)
      .map((member, index) => ({
        id: `member-${createToken()}`,
        firstName: member.firstName,
        lastName: member.lastName,
        email: index === validation.primaryIndex ? member.email : '',
        phone: index === validation.primaryIndex ? member.phone : '',
        isPrimary: index === validation.primaryIndex,
      }))
    const primaryMember = derivePrimaryMember(members)
    const invitation = {
      id: invitationId,
      displayLabel: validation.cleanedLabel,
      category: payload.category,
      token: createToken(),
      allowedSeats: validation.allowedSeats,
      invitationMode: validation.invitationMode,
      notes: payload.notes,
      primaryContactFirstName: primaryMember?.firstName ?? '',
      primaryContactLastName: primaryMember?.lastName ?? '',
      primaryContactEmail: primaryMember?.email ?? '',
      primaryContactPhone: primaryMember?.phone ?? '',
      deliveryStatus: 'pendiente',
      createdAt: now,
      members,
    }

    setState((current) => ({
      ...current,
      invitations: [
        invitation,
        ...current.invitations,
      ],
      guests: [
        ...flattenGuestsFromInvitations([invitation]),
        ...current.guests,
      ],
      auditLog: [
        {
          id: `audit-${createToken()}`,
          action: 'invitation_created',
          entityId: invitationId,
          detail: `${validation.cleanedLabel} fue agregada manualmente.`,
          createdAt: now,
        },
        ...current.auditLog,
      ],
    }))

    return { ok: true, invitation }
  }, [invitations])

  const importGuests = useCallback(async (file) => {
    const buffer = await file.arrayBuffer()
    let rows = []

    if (file.name.toLowerCase().endsWith('.csv')) {
      const Papa = await loadPapa()
      const text = new TextDecoder().decode(buffer)
      rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data
    } else {
      const XLSX = await loadXlsx()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
    }

    const imported = normalizeInvitationRows(rows)

    startTransition(() => {
      setState((current) => ({
        ...current,
        invitations: [...imported.map((item) => item.invitation), ...current.invitations],
        guests: [...imported.flatMap((item) => item.guestRecords), ...current.guests],
      }))
    })

    return {
      ok: true,
      importedInvitations: imported.length,
      importedGuests: imported.reduce((sum, item) => sum + item.guestRecords.length, 0),
    }
  }, [])

  const exportGuests = useCallback(async () => {
    const Papa = await loadPapa()
    const rows = invitations.map((invitation) => {
      const response = getResponseByInvitation(invitation.id)
      const contactName = buildContactName(invitation)

      return {
        invitacion: invitation.displayLabel,
        tipo: invitation.invitationMode ?? (invitation.members?.length > 1 ? 'group' : 'individual'),
        contacto_principal: contactName,
        email: invitation.primaryContactEmail,
        telefono: invitation.primaryContactPhone,
        categoria: invitation.category,
        cupo_total: invitation.allowedSeats,
        estado_envio: invitation.deliveryStatus,
        estado_rsvp: response?.status ?? 'sin_respuesta',
        asistentes_confirmados: response?.attendingCount ?? 0,
        restricciones: response?.dietaryRestrictions ?? '',
        comentarios: response?.comments ?? '',
        integrantes: (invitation.members ?? [])
          .map((member) => `${member.firstName} ${member.lastName}`.trim())
          .join(', '),
      }
    })

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'invitaciones-boda.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [getResponseByInvitation, invitations])

  const recordDelivery = useCallback((invitationId, channel, message) => {
    const now = new Date().toISOString()
    const nextStatus =
      channel === 'whatsapp'
        ? 'enviada_whatsapp'
        : channel === 'email'
          ? 'enviada_email'
          : 'recordatorio'

    setState((current) => ({
      ...current,
      invitations: current.invitations.map((invitation) =>
        invitation.id === invitationId
          ? {
              ...invitation,
              deliveryStatus: nextStatus,
            }
          : invitation,
      ),
      guests: current.guests.map((guest) =>
        guest.invitationId === invitationId
          ? {
              ...guest,
              inviteStatus: nextStatus,
            }
          : guest,
      ),
      inviteDeliveries: [
        {
          id: `delivery-${createToken()}`,
          invitationId,
          channel,
          type: 'envio_manual',
          status: 'registrada',
          message,
          sentAt: now,
        },
        ...current.inviteDeliveries,
      ],
    }))
  }, [])

  const uploadPublicFile = useCallback(async (file, kind) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
    const allowedProofTypes = [...allowedImageTypes, 'application/pdf']
    const allowedTypes = kind === 'proof' ? allowedProofTypes : allowedImageTypes
    const maxSize = kind === 'proof' ? 5 * 1024 * 1024 : 4 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      return { ok: false, message: 'Formato no permitido.' }
    }

    if (file.size > maxSize) {
      return { ok: false, message: 'El archivo supera el tamano maximo permitido.' }
    }

    const dataUrl = await toDataUrl(file)
    return {
      ok: true,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
      },
    }
  }, [])

  const metrics = useMemo(() => {
    const confirmed = rsvpResponses.filter((response) => response.status === 'confirmado')
    const rejected = rsvpResponses.filter((response) => response.status === 'rechazado')
    const totalAllowed = invitations.reduce((sum, invitation) => sum + invitation.allowedSeats, 0)
    const totalConfirmed = confirmed.reduce((sum, response) => sum + response.attendingCount, 0)
    const pendingMessages = state.guestMessages.filter((message) => message.status === 'pendiente_aprobacion').length
    const pendingSongs = state.songSuggestions.filter((song) => song.status === 'pendiente_aprobacion').length
    const pendingContributions = state.giftContributions.filter((item) => item.status === 'pendiente_validacion').length

    return {
      totalInvitations: invitations.length,
      totalGuests: guests.length,
      totalAllowed,
      totalConfirmed,
      responseRate: invitations.length
        ? Math.round((rsvpResponses.length / invitations.length) * 100)
        : 0,
      rejectedInvitations: rejected.length,
      pendingInvitations: invitations.length - rsvpResponses.length,
      pendingMessages,
      pendingSongs,
      pendingContributions,
    }
  }, [guests.length, invitations, rsvpResponses, state.giftContributions, state.guestMessages, state.songSuggestions])

  const value = useMemo(
    () => ({
      state,
      weddingEvent: state.weddingEvent,
      adminUser: state.adminUser,
      invitations,
      guests,
      rsvpResponses,
      giftItems,
      giftContributions: state.giftContributions,
      songSuggestions: state.songSuggestions,
      guestMessages: state.guestMessages,
      inviteDeliveries: state.inviteDeliveries,
      approvedMessages,
      approvedSongs,
      metrics,
      session,
      isAuthenticated,
      login,
      logout,
      buildInviteLink,
      buildInviteMessage,
      getInvitationByToken,
      getInvitationMembers,
      getGuestsByInvitation,
      getResponseByInvitation,
      submitRsvp,
      submitGiftContribution,
      setContributionStatus,
      submitSongSuggestion,
      voteSong,
      reviewSong,
      submitMessage,
      reviewMessage,
      addGuest,
      importGuests,
      exportGuests,
      recordDelivery,
      uploadPublicFile,
    }),
    [
      state,
      invitations,
      guests,
      rsvpResponses,
      giftItems,
      approvedMessages,
      approvedSongs,
      metrics,
      session,
      isAuthenticated,
      login,
      logout,
      buildInviteLink,
      getInvitationByToken,
      getInvitationMembers,
      getGuestsByInvitation,
      getResponseByInvitation,
      submitRsvp,
      submitGiftContribution,
      setContributionStatus,
      submitSongSuggestion,
      voteSong,
      reviewSong,
      submitMessage,
      reviewMessage,
      addGuest,
      importGuests,
      exportGuests,
      recordDelivery,
      uploadPublicFile,
    ],
  )

  return <WeddingContext.Provider value={value}>{children}</WeddingContext.Provider>
}

export default WeddingContext
