/* eslint-disable no-unreachable */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { initialWeddingState } from '../data/initialState.js'
import { invokeWeddingFunction, isSupabaseConfigured, supabase } from '../lib/supabase.js'

const STORAGE_KEY = 'wedding-hub-state-v1'
const PUBLIC_SITE_URL = 'https://www.leandroymartina.com.ar'

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

function hasRsvpDeadlinePassed(deadline) {
  const deadlineAt = new Date(`${deadline}T23:59:59-03:00`)
  return !Number.isNaN(deadlineAt.getTime()) && new Date() > deadlineAt
}

function buildContactName(invitation) {
  return [invitation.primaryContactFirstName, invitation.primaryContactLastName]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function buildPersonName(person, fallback = 'Invitado') {
  return [person?.firstName, person?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || person?.name || fallback
}

function buildRsvpAttendeeRows(invitation, response = null) {
  const savedAttendees = response?.attendees ?? []
  const savedByMemberId = new Map(
    savedAttendees
      .filter((attendee) => attendee.memberId)
      .map((attendee) => [attendee.memberId, attendee]),
  )
  const savedCompanions = savedAttendees.filter((attendee) => attendee.type === 'companion')
  const legacyCount = response?.attendees?.length ? null : Number(response?.attendingCount ?? 0)
  const legacyDiet = response?.dietaryRestrictions ?? ''

  const memberRows = (invitation.members ?? []).map((member, index) => {
    const saved = savedByMemberId.get(member.id)
    const attending = saved
      ? Boolean(saved.attending)
      : response?.status === 'confirmado' && (legacyCount === null || index < legacyCount)

    return {
      id: saved?.id ?? `member-${member.id}`,
      type: 'member',
      memberId: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      name: buildPersonName(member, `Integrante ${index + 1}`),
      attending,
      dietaryRestrictions: saved?.dietaryRestrictions ?? (attending && index === 0 ? legacyDiet : ''),
    }
  })

  const companionSlots = Math.max((invitation.allowedSeats ?? 1) - memberRows.length, 0)
  const companionRows = Array.from({ length: companionSlots }, (_, index) => {
    const saved = savedCompanions[index]
    const attending = saved
      ? Boolean(saved.attending)
      : response?.status === 'confirmado' && legacyCount !== null && memberRows.length + index < legacyCount

    return {
      id: saved?.id ?? `companion-${index + 1}`,
      type: 'companion',
      memberId: null,
      firstName: saved?.firstName ?? '',
      lastName: saved?.lastName ?? '',
      name: saved?.name ?? `Acompanante ${index + 1}`,
      attending,
      dietaryRestrictions: saved?.dietaryRestrictions ?? '',
    }
  })

  return [...memberRows, ...companionRows]
}

function normalizeRsvpAttendees(invitation, response) {
  return buildRsvpAttendeeRows(invitation, response).map((attendee) => ({
    id: attendee.id,
    type: attendee.type,
    memberId: attendee.memberId,
    firstName: attendee.firstName ?? '',
    lastName: attendee.lastName ?? '',
    name: attendee.type === 'companion'
      ? attendee.name || buildPersonName(attendee, 'Acompanante')
      : buildPersonName(attendee),
    attending: Boolean(attendee.attending),
    dietaryRestrictions: attendee.dietaryRestrictions ?? '',
  }))
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
      email: '',
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
      email: '',
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
      primaryContactEmail: '',
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

function _migrateState(parsed) {
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
        primaryContactEmail: '',
        primaryContactPhone: invitation.primaryContactPhone ?? primaryMember?.phone ?? '',
        accessStatus: invitation.accessStatus ?? 'active',
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
    // Discard the prototype cache from previous versions. Browser storage is
    // never used as an application data source.
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('wedding-hub-active-invitation-token')
  } catch {
    // Storage can be unavailable in private browsing; the app still starts.
  }

  return initialWeddingState
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
  return `\u2728 \u00a1Nos casamos! \u2728

Hola ${name},
queremos invitarte a compartir uno de los momentos mas importantes de nuestras vidas \ud83d\udc8d

Preparamos una invitacion especial con toda la informacion del evento, confirmacion de asistencia, regalos y mas:

\ud83d\udd17 ${link}

Por favor, confirma tu asistencia hasta el 20 de agosto.

Esperamos poder celebrar este dia con vos \u2764\ufe0f`
}

function validateInvitationPayload(payload, existingInvitations = []) {
  const invitationMode = payload.invitationMode === 'individual' ? 'individual' : 'group'
  const rawMembers = invitationMode === 'individual'
    ? [
        {
          firstName: payload.individualFirstName ?? '',
          lastName: payload.individualLastName ?? '',
          phone: payload.individualPhone ?? '',
        },
      ]
    : payload.members ?? []
  const members = rawMembers.map((member) => ({
    firstName: member.firstName?.trim() ?? '',
    lastName: member.lastName?.trim() ?? '',
    phone: member.phone?.trim() ?? '',
  }))
  const fallbackLabel = invitationMode === 'individual'
    ? `${members[0]?.firstName ?? ''} ${members[0]?.lastName ?? ''}`.trim()
    : ''
  const cleanedLabel = payload.displayLabel?.trim() || fallbackLabel
  const nonEmptyMembers = members.filter(
    (member) => member.firstName || member.lastName || member.phone,
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

  if (!normalizedPhone) {
    return { ok: false, message: 'Ingresa el WhatsApp del referente.' }
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
          primaryContactPhone: phone,
          accessStatus: 'active',
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

function asArray(value) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

const mapInvitation = (item) => ({
  ...item,
  displayLabel: item.display_label,
  invitationMode: item.invitation_mode,
  allowedSeats: item.allowed_seats,
  primaryContactFirstName: item.primary_contact_first_name,
  primaryContactLastName: item.primary_contact_last_name,
  primaryContactPhone: item.primary_contact_phone,
  accessStatus: item.access_status,
  deliveryStatus: item.delivery_status,
  createdAt: item.created_at,
  rsvp_responses: asArray(item.rsvp_responses),
  members: (item.invitation_members ?? []).map((member) => ({
    ...member,
    firstName: member.first_name,
    lastName: member.last_name,
    isPrimary: member.is_primary,
  })),
})

const mapResponse = (item) => ({
  ...item,
  invitationId: item.invitation_id,
  attendingCount: item.attending_count,
  updatedAt: item.updated_at,
  attendees: asArray(item.rsvp_attendees).map((attendee) => ({
    ...attendee,
    memberId: attendee.member_id,
    type: attendee.attendee_type,
    dietaryRestrictions: attendee.dietary_restrictions,
  })),
})

export function WeddingProvider({ children }) {
  const [state, setState] = useState(loadState)
  const [session, setSession] = useState(null)
  // Tokens are intentionally memory-only: Supabase stores only their hash.
  // This lets a newly created invitation be copied in the current panel session
  // without persisting sensitive raw tokens in the browser.
  const issuedTokensRef = useRef(new Map())
  const refreshRequestRef = useRef(0)

  const refreshRemoteState = useCallback(async () => {
    if (!supabase) return

    const requestId = ++refreshRequestRef.current

    const { data: event } = await supabase.from('events').select('*').limit(1).maybeSingle()
    const [messagesResult, songsResult, invitationsResult, deliveriesResult] = await Promise.all([
      supabase.from('guest_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('song_suggestions').select('*').order('created_at', { ascending: false }),
      // These tables have admin-only RLS policies. Query them unconditionally
      // so Supabase's persisted auth token, rather than React timing, decides
      // whether rows are returned.
      supabase.from('invitations').select('*, invitation_members(*), rsvp_responses(*, rsvp_attendees(*))').order('created_at', { ascending: false }),
      supabase.from('invite_deliveries').select('*').order('created_at', { ascending: false }),
    ])

    const nextInvitations = (invitationsResult.data ?? []).map((item) => ({
      ...mapInvitation(item),
      token: issuedTokensRef.current.get(item.id),
    }))
    const responses = nextInvitations.flatMap((invitation) =>
      (invitation.rsvp_responses ?? []).map(mapResponse),
    )
    const guests = flattenGuestsFromInvitations(nextInvitations)

    if (requestId !== refreshRequestRef.current) return

    setState((current) => ({
      ...current,
      weddingEvent: event
        ? {
            ...current.weddingEvent,
            id: event.id,
            couple: event.couple,
            eventDate: event.event_date,
            location: event.location,
            rsvpDeadline: event.rsvp_deadline,
            giftInstructions: event.gift_instructions,
          }
        : current.weddingEvent,
      invitations: nextInvitations,
      guests,
      rsvpResponses: responses,
      guestMessages: (messagesResult.data ?? []).map((message) => ({
        ...message,
        guestName: message.guest_name,
        photo: message.photo_path ? { path: message.photo_path } : null,
        createdAt: message.created_at,
      })),
      songSuggestions: (songsResult.data ?? []).map((song) => ({
        ...song,
        requestedBy: song.requested_by,
        createdAt: song.created_at,
      })),
      inviteDeliveries: (deliveriesResult.data ?? []).map((delivery) => ({
        ...delivery,
        invitationId: delivery.invitation_id,
        inviteLink: delivery.invite_link,
        confirmedAt: delivery.confirmed_at,
        createdAt: delivery.created_at,
      })),
    }))
  }, [])

  useEffect(() => {
    if (!supabase) return undefined

    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void refreshRemoteState()
  }, [refreshRemoteState, session])

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

  const isAuthenticated = Boolean(session?.user)

  const getInvitationByToken = useCallback(
    (token) =>
      invitations.find(
        (invitation) =>
          invitation.accessStatus !== 'paused' &&
          invitation.token.toLowerCase() === String(token).toLowerCase(),
      ) ?? null,
    [invitations],
  )

  const fetchInvitationByToken = useCallback(async (token) => {
    if (!token) return null

    let timeoutId
    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('invitation_request_timeout')), 15_000)
      })
      const result = await Promise.race([
        invokeWeddingFunction('guest-invitation', { action: 'read', token }),
        timeout,
      ])
      if (!result?.invitation) return null
      const invitation = mapInvitation(result.invitation)
      const response = asArray(invitation.rsvp_responses)[0]
      return {
        invitation: { ...invitation, token },
        response: response ? mapResponse(response) : null,
        rsvpDeadline: result.invitation.events?.rsvp_deadline ?? state.weddingEvent.rsvpDeadline,
      }
    } catch {
      return null
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [state.weddingEvent.rsvpDeadline])

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

  const getRsvpAttendees = useCallback(
    (invitation, response = null) => buildRsvpAttendeeRows(invitation, response),
    [],
  )

  const buildInviteLink = useCallback((token) => {
    return `${PUBLIC_SITE_URL}/#/invitacion/${token}`
  }, [])

  const buildRsvpLink = useCallback((token) => {
    return `${PUBLIC_SITE_URL}/#/confirmar/${token}`
  }, [])

  const login = useCallback(async ({ email, password }) => {
    if (!supabase) {
      return { ok: false, message: 'El panel estará disponible cuando Supabase esté configurado.' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) return { ok: false, message: 'Email o contraseña incorrectos.' }
    const { data: admins, error: adminError } = await supabase.from('admins').select('user_id').limit(1)
    if (adminError || !admins?.length) {
      await supabase.auth.signOut()
      return { ok: false, message: 'Esta cuenta no tiene acceso al panel.' }
    }

    setSession(data.session)
    await refreshRemoteState()
    return { ok: true }
  }, [refreshRemoteState])

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  const submitRsvp = useCallback(async (token, payload) => {
    if (!supabase) return { ok: false, message: 'Supabase no esta configurado.' }

    try {
      const result = await invokeWeddingFunction('guest-invitation', {
        action: 'submit-rsvp',
        token,
        payload,
      })
      if (!result?.ok) return { ok: false, message: result?.error ?? 'No se pudo guardar la respuesta.' }
      return { ok: true }
    } catch {
      return { ok: false, message: 'No se pudo guardar la respuesta. Intenta nuevamente.' }
    }

    /* c8 ignore next -- legacy prototype code retained temporarily below */
    const invitation = getInvitationByToken(token)

    if (!invitation) {
      return { ok: false, message: 'El enlace ya no es valido.' }
    }

    if (hasRsvpDeadlinePassed(state.weddingEvent.rsvpDeadline)) {
      return { ok: false, message: 'El plazo para confirmar asistencia ya finalizo. Contacta a los novios si necesitas ayuda.' }
    }

    const submittedAttendees = Array.isArray(payload.attendees)
      ? payload.attendees.map((attendee, index) => ({
          id: attendee.id || `attendee-${index + 1}`,
          type: attendee.type === 'companion' ? 'companion' : 'member',
          memberId: attendee.memberId || null,
          firstName: attendee.firstName?.trim() ?? '',
          lastName: attendee.lastName?.trim() ?? '',
          name: attendee.name?.trim() || buildPersonName(attendee, attendee.type === 'companion' ? `Acompanante ${index + 1}` : `Invitado ${index + 1}`),
          attending: payload.attending === 'si' && Boolean(attendee.attending),
          dietaryRestrictions: attendee.dietaryRestrictions?.trim() ?? '',
        }))
      : []
    const requestedCount = payload.attending === 'si'
      ? submittedAttendees.filter((attendee) => attendee.attending).length || Number(payload.attendingCount ?? 0)
      : 0

    if (payload.attending === 'si' && (requestedCount < 1 || requestedCount > invitation.allowedSeats)) {
      return {
        ok: false,
        message: `Esta invitacion permite confirmar entre 1 y ${invitation.allowedSeats} ${invitation.allowedSeats === 1 ? 'persona' : 'personas'}.`,
      }
    }

    const unnamedCompanion = submittedAttendees.find(
      (attendee) => attendee.attending && attendee.type === 'companion' && !attendee.name.trim(),
    )

    if (unnamedCompanion) {
      return { ok: false, message: 'Ingresa el nombre de cada acompanante que confirme asistencia.' }
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
        attendees: normalizeRsvpAttendees(invitation, {
          status: payload.attending === 'si' ? 'confirmado' : 'rechazado',
          attendingCount: requestedCount,
          attendees: submittedAttendees,
        }),
        dietaryRestrictions: submittedAttendees
          .filter((attendee) => attendee.attending && attendee.dietaryRestrictions)
          .map((attendee) => `${attendee.name}: ${attendee.dietaryRestrictions}`)
          .join('; '),
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
        auditLog: nextAudit,
      }
    })

    return { ok: true }
  }, [getInvitationByToken, state.weddingEvent.rsvpDeadline])

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
    if (!supabase || !state.weddingEvent.id) return { ok: false, message: 'Supabase no esta configurado.' }
    try {
      const result = await invokeWeddingFunction('public-submit', {
        action: 'song', eventId: state.weddingEvent.id, payload,
      })
      if (!result?.ok) return { ok: false, message: result?.error ?? 'No se pudo enviar la cancion.' }
      await refreshRemoteState()
      return { ok: true }
    } catch {
      return { ok: false, message: 'No se pudo enviar la cancion.' }
    }

    /* c8 ignore next */
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
  }, [refreshRemoteState, state.weddingEvent.id])

  const voteSong = useCallback((songId) => {
    setState((current) => ({
      ...current,
      songSuggestions: current.songSuggestions.map((song) =>
        song.id === songId ? { ...song, votes: song.votes + 1 } : song,
      ),
    }))
  }, [])

  const reviewSong = useCallback(async (songId, status) => {
    if (!supabase) return
    await supabase.from('song_suggestions').update({ status }).eq('id', songId)
    await refreshRemoteState()
    return

    /* c8 ignore next */
    setState((current) => ({
      ...current,
      songSuggestions: current.songSuggestions.map((song) =>
        song.id === songId ? { ...song, status } : song,
      ),
    }))
  }, [refreshRemoteState])

  const submitMessage = useCallback(async (payload) => {
    if (!supabase || !state.weddingEvent.id) return { ok: false, message: 'Supabase no esta configurado.' }
    try {
      const result = await invokeWeddingFunction('public-submit', {
        action: 'message',
        eventId: state.weddingEvent.id,
        payload: { ...payload, photoPath: payload.photo?.path ?? null },
      })
      if (!result?.ok) return { ok: false, message: result?.error ?? 'No se pudo enviar el mensaje.' }
      await refreshRemoteState()
      return { ok: true }
    } catch {
      return { ok: false, message: 'No se pudo enviar el mensaje.' }
    }

    /* c8 ignore next */
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
  }, [refreshRemoteState, state.weddingEvent.id])

  const reviewMessage = useCallback(async (messageId, status) => {
    if (!supabase) return
    await supabase.from('guest_messages').update({ status }).eq('id', messageId)
    await refreshRemoteState()
    return

    /* c8 ignore next */
    setState((current) => ({
      ...current,
      guestMessages: current.guestMessages.map((message) =>
        message.id === messageId ? { ...message, status } : message,
      ),
    }))
  }, [refreshRemoteState])

  const addGuest = useCallback(async (payload) => {
    const validation = validateInvitationPayload(payload, invitations)

    if (!validation.ok) {
      return validation
    }

    if (!supabase) {
      return { ok: false, message: 'Supabase no esta configurado.' }
    }

    let eventId = state.weddingEvent.id
    if (!eventId) {
      const { data: event, error: eventError } = await supabase.from('events').select('id').limit(1).maybeSingle()
      if (eventError || !event) return { ok: false, message: 'No se pudo cargar el evento. Reintenta en unos segundos.' }
      eventId = event.id
    }

    try {
      const members = validation.members
        .filter((member) => member.firstName)
        .map((member, index) => ({
          id: `member-${createToken()}`,
          firstName: member.firstName,
          lastName: member.lastName,
          phone: index === validation.primaryIndex ? member.phone : '',
          isPrimary: index === validation.primaryIndex,
        }))
      const primaryMember = derivePrimaryMember(members)
      const { data: created, error } = await supabase.rpc('create_invitation_with_token', {
        p_event_id: eventId,
        p_display_label: validation.cleanedLabel,
        p_category: payload.category ?? 'otros',
        p_invitation_mode: validation.invitationMode,
        p_allowed_seats: validation.allowedSeats,
        p_notes: payload.notes ?? '',
        p_primary_contact_first_name: primaryMember?.firstName ?? '',
        p_primary_contact_last_name: primaryMember?.lastName ?? '',
        p_primary_contact_email: '',
        p_primary_contact_phone: primaryMember?.phone ?? '',
      }).single()
      const inserted = created?.invitation
      const token = created?.token
      if (error || !inserted || !token) {
        if (error?.code === '23505') {
          return { ok: false, message: 'Ya existe una invitacion con ese nombre. Busca la invitacion existente o utiliza un nombre diferente.' }
        }
        return { ok: false, message: error?.message ?? 'No se pudo crear la invitacion.' }
      }

      const { error: membersError } = await supabase.from('invitation_members').insert(members.map((member) => ({
        invitation_id: inserted.id,
        first_name: member.firstName,
        last_name: member.lastName,
        email: '',
        phone: member.phone,
        is_primary: member.isPrimary,
      })))
      if (membersError) return { ok: false, message: 'La invitacion fue creada, pero no se pudieron guardar sus integrantes.' }
      issuedTokensRef.current.set(inserted.id, token)
      const invitation = { ...mapInvitation({ ...inserted, invitation_members: members.map((member) => ({ ...member, first_name: member.firstName, last_name: member.lastName, is_primary: member.isPrimary })) }), token }
      await refreshRemoteState()
      return { ok: true, invitation }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'No se pudo crear la invitacion.' }
    }
  }, [invitations, refreshRemoteState, state.weddingEvent.id])

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

    let completed = 0
    for (const item of imported) {
      const invitation = item.invitation
      const primary = derivePrimaryMember(invitation.members)
      const result = await addGuest({
        displayLabel: invitation.displayLabel,
        category: invitation.category,
        invitationMode: invitation.invitationMode ?? 'group',
        allowedSeats: invitation.allowedSeats,
        notes: invitation.notes,
        members: invitation.members,
        primaryMemberIndex: invitation.members.findIndex((member) => member.isPrimary),
        individualFirstName: primary?.firstName,
        individualLastName: primary?.lastName,
        individualPhone: primary?.phone,
      })
      if (result.ok) completed += 1
    }

    return {
      ok: true,
      importedInvitations: completed,
      importedGuests: imported.slice(0, completed).reduce((sum, item) => sum + item.guestRecords.length, 0),
    }
  }, [addGuest])

  const exportGuests = useCallback(async () => {
    const Papa = await loadPapa()
    const rows = invitations.flatMap((invitation) => {
      const response = getResponseByInvitation(invitation.id)
      const contactName = buildContactName(invitation)

      return buildRsvpAttendeeRows(invitation, response).map((attendee) => ({
        invitacion: invitation.displayLabel,
        tipo: invitation.invitationMode ?? (invitation.members?.length > 1 ? 'group' : 'individual'),
        contacto_principal: contactName,
        telefono: invitation.primaryContactPhone,
        categoria: invitation.category,
        cupo_total: invitation.allowedSeats,
        estado_envio: invitation.deliveryStatus,
        estado_rsvp: response?.status ?? 'sin_respuesta',
        asistentes_confirmados: response?.attendingCount ?? 0,
        persona: attendee.name,
        tipo_persona: attendee.type === 'companion' ? 'acompanante' : 'integrante',
        asiste: response ? (attendee.attending ? 'si' : 'no') : 'sin_respuesta',
        restriccion_alimentaria: attendee.attending ? attendee.dietaryRestrictions : '',
        comentarios: response?.comments ?? '',
      }))
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

  const recordDelivery = useCallback(async (invitationId, payload) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('invite_deliveries').upsert({
      invitation_id: invitationId,
      channel: payload.channel,
      type: payload.type,
      status: payload.status ?? 'prepared',
      recipient: payload.recipient ?? '',
      message: payload.message ?? '',
      invite_link: payload.inviteLink ?? '',
      operator_id: session?.user?.id ?? null,
    }, { onConflict: 'invitation_id' }).select().single()
    if (error) return null
    await refreshRemoteState()
    return data

    /* c8 ignore next */
    const now = new Date().toISOString()
    const record = {
      id: `delivery-${createToken()}`,
      invitationId,
      channel: payload.channel,
      type: payload.type,
      status: payload.status ?? 'prepared',
      message: payload.message ?? '',
      recipient: payload.recipient ?? '',
      inviteLink: payload.inviteLink ?? '',
      operator: session?.user?.email ?? 'panel local',
      createdAt: now,
    }

    setState((current) => ({
      ...current,
      inviteDeliveries: [
        record,
        ...current.inviteDeliveries,
      ],
    }))
    return record
  }, [refreshRemoteState, session?.user?.email, session?.user?.id])

  const confirmDelivery = useCallback(async (deliveryId) => {
    if (!supabase) return
    const delivery = state.inviteDeliveries.find((item) => item.id === deliveryId)
    if (!delivery) return
    const deliveryStatus = delivery.channel === 'whatsapp' ? 'enviada_whatsapp' : 'enviada_email'
    await supabase.from('invite_deliveries').update({ status: 'sent_manual', confirmed_at: new Date().toISOString() }).eq('id', deliveryId)
    await supabase.from('invitations').update({ delivery_status: deliveryStatus }).eq('id', delivery.invitationId)
    await refreshRemoteState()
    return

    /* c8 ignore next */
    const now = new Date().toISOString()

    setState((current) => {
      const delivery = current.inviteDeliveries.find((item) => item.id === deliveryId)

      if (!delivery || delivery.status === 'sent_manual') {
        return current
      }

      const deliveryStatus = delivery.channel === 'whatsapp' ? 'enviada_whatsapp' : 'enviada_email'
      return {
        ...current,
        invitations: current.invitations.map((invitation) =>
          invitation.id === delivery.invitationId
            ? { ...invitation, deliveryStatus }
            : invitation,
        ),
        guests: current.guests.map((guest) =>
          guest.invitationId === delivery.invitationId
            ? { ...guest, inviteStatus: deliveryStatus }
            : guest,
        ),
        inviteDeliveries: current.inviteDeliveries.map((item) =>
          item.id === deliveryId
            ? { ...item, status: 'sent_manual', confirmedAt: now, confirmedBy: session?.user?.email ?? 'panel local' }
            : item,
        ),
        auditLog: [
          {
            id: `audit-${createToken()}`,
            action: 'delivery_confirmed_manually',
            entityId: delivery.invitationId,
            detail: `Envio por ${delivery.channel} confirmado para ${delivery.recipient || 'el contacto principal'}.`,
            createdAt: now,
          },
          ...current.auditLog,
        ],
      }
    })
  }, [refreshRemoteState, session?.user?.email, state.inviteDeliveries])

  const deleteInvitation = useCallback(async (invitationId) => {
    if (!supabase) return { ok: false, message: 'Supabase no esta configurado.' }

    const { data, error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .select('id')

    if (error || !data?.length) {
      return { ok: false, message: error?.message ?? 'No se pudo eliminar la invitacion.' }
    }

    issuedTokensRef.current.delete(invitationId)
    await refreshRemoteState()
    return { ok: true }
  }, [refreshRemoteState])

  const setInvitationAccess = useCallback(async (invitationId, accessStatus) => {
    if (!supabase) return
    await supabase.from('invitations').update({ access_status: accessStatus }).eq('id', invitationId)
    await refreshRemoteState()
    return

    /* c8 ignore next */
    const now = new Date().toISOString()
    setState((current) => ({
      ...current,
      invitations: current.invitations.map((invitation) =>
        invitation.id === invitationId ? { ...invitation, accessStatus } : invitation,
      ),
      auditLog: [
        {
          id: `audit-${createToken()}`,
          action: `invitation_${accessStatus}`,
          entityId: invitationId,
          detail: `Acceso de invitacion marcado como ${accessStatus}.`,
          createdAt: now,
        },
        ...current.auditLog,
      ],
    }))
  }, [refreshRemoteState])

  const regenerateInvitationToken = useCallback(async (invitationId) => {
    if (!supabase) return null
    const { data: token, error } = await supabase.rpc('regenerate_invitation_token', {
      p_invitation_id: invitationId,
    })
    if (error) return null
    issuedTokensRef.current.set(invitationId, token)
    await refreshRemoteState()
    return token

    /* c8 ignore next */
    const now = new Date().toISOString()
    const legacyToken = createToken()
    setState((current) => ({
      ...current,
      invitations: current.invitations.map((invitation) =>
        invitation.id === invitationId ? { ...invitation, token: legacyToken, accessStatus: 'active' } : invitation,
      ),
      auditLog: [
        {
          id: `audit-${createToken()}`,
          action: 'invitation_token_regenerated',
          entityId: invitationId,
          detail: 'Se regenero el enlace personalizado de la invitacion.',
          createdAt: now,
        },
        ...current.auditLog,
      ],
    }))
  }, [refreshRemoteState])

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
      isSupabaseConfigured,
      login,
      logout,
      buildInviteLink,
      buildRsvpLink,
      buildInviteMessage,
      getInvitationByToken,
      fetchInvitationByToken,
      getInvitationMembers,
      getGuestsByInvitation,
      getResponseByInvitation,
      getRsvpAttendees,
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
      confirmDelivery,
      deleteInvitation,
      setInvitationAccess,
      regenerateInvitationToken,
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
      buildRsvpLink,
      getInvitationByToken,
      fetchInvitationByToken,
      getInvitationMembers,
      getGuestsByInvitation,
      getResponseByInvitation,
      getRsvpAttendees,
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
      confirmDelivery,
      deleteInvitation,
      setInvitationAccess,
      regenerateInvitationToken,
      uploadPublicFile,
    ],
  )

  return <WeddingContext.Provider value={value}>{children}</WeddingContext.Provider>
}

export default WeddingContext
