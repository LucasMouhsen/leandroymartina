import { adminUser } from './adminData.js'
import { auditLog } from './auditData.js'
import { inviteDeliveries } from './deliveryData.js'
import { weddingEvent } from './eventData.js'
import { giftContributions, giftItems } from './giftData.js'
import { guests, invitations } from './guestData.js'
import { guestMessages } from './messageData.js'
import { rsvpResponses } from './rsvpData.js'
import { songSuggestions } from './songData.js'

export const initialWeddingState = {
  weddingEvent,
  adminUser,
  invitations,
  guests,
  rsvpResponses,
  giftItems,
  giftContributions,
  songSuggestions,
  guestMessages,
  inviteDeliveries,
  auditLog,
}
