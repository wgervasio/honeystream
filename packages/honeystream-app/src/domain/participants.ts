import { sanitizeUsername } from './usernames'

export const enum ParticipantRole {
  Host = 'host',
  Guest = 'guest'
}

export interface Participant {
  readonly id: string
  readonly username: string
  readonly role: ParticipantRole
}

export interface ParticipantsState {
  readonly host: Participant
  readonly guest?: Participant
}

const normalizeParticipantId = (id: string): string => id.trim()

export const isValidParticipantId = (value: unknown): value is string =>
  typeof value === 'string' && normalizeParticipantId(value).length > 0

const sanitizeParticipantId = (id: string): string => {
  const normalized = normalizeParticipantId(id)
  return normalized.length > 0 ? normalized : 'unknown-participant'
}

export const createParticipant = (
  id: string,
  username: unknown,
  role: ParticipantRole
): Participant => ({
  id: sanitizeParticipantId(id),
  username: sanitizeUsername(username),
  role
})

export const createParticipantsState = (
  hostId: string,
  hostUsername: unknown
): ParticipantsState => ({
  host: createParticipant(hostId, hostUsername, ParticipantRole.Host)
})

export const addGuestParticipant = (
  participants: ParticipantsState,
  guestId: string,
  guestUsername: unknown
): ParticipantsState => ({
  ...participants,
  guest: createParticipant(guestId, guestUsername, ParticipantRole.Guest)
})

export const removeGuestParticipant = (
  participants: ParticipantsState,
  participantId: string
): ParticipantsState => {
  const guest = participants.guest
  if (!guest || guest.id !== participantId) return participants
  return { host: participants.host }
}

export const getParticipantById = (
  participants: ParticipantsState,
  participantId: string
): Participant | undefined => {
  if (participants.host.id === participantId) return participants.host
  if (participants.guest && participants.guest.id === participantId) return participants.guest
  return undefined
}

export const isHostParticipant = (participants: ParticipantsState, participantId: string): boolean =>
  participants.host.id === participantId

export const isGuestParticipant = (participants: ParticipantsState, participantId: string): boolean =>
  !!participants.guest && participants.guest.id === participantId
