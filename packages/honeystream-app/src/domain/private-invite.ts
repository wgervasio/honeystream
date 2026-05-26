import { isValidParticipantId, ParticipantsState } from './participants'

export const PRIVATE_ROOM_ID_MAX_LENGTH = 128
export const PRIVATE_INVITE_SECRET_MIN_LENGTH = 8
export const PRIVATE_INVITE_SECRET_MAX_LENGTH = 128
export const PRIVATE_SESSION_MAX_PARTICIPANTS = 2

const roomIdPattern = /^[a-z0-9-]+$/i
const inviteSecretPattern = /^[A-Za-z0-9+/=_-]+$/

export type PrivateInviteJoinRejectionReason =
  | 'invalid-room-id'
  | 'invalid-invite-secret'
  | 'invite-secret-mismatch'
  | 'invalid-participant-id'
  | 'participant-limit-reached'

export type RoomIdValidationIssue = 'not-string' | 'empty' | 'invalid-format'
export type InviteSecretValidationIssue = 'not-string' | 'too-short' | 'too-long' | 'invalid-format'

export interface RoomIdValidationResult {
  readonly ok: boolean
  readonly normalized: string
  readonly issue?: RoomIdValidationIssue
}

export interface InviteSecretValidationResult {
  readonly ok: boolean
  readonly normalized: string
  readonly issue?: InviteSecretValidationIssue
}

export interface NormalizedPrivateInviteJoinRequest {
  readonly roomId: string
  readonly inviteSecret: string
  readonly participantId: string
}

export type NormalizePrivateInviteJoinRequestResult =
  | {
      readonly ok: true
      readonly value: NormalizedPrivateInviteJoinRequest
    }
  | {
      readonly ok: false
      readonly reason: Extract<
        PrivateInviteJoinRejectionReason,
        'invalid-room-id' | 'invalid-invite-secret' | 'invalid-participant-id'
      >
    }

export const normalizeRoomId = (roomId: string): string => roomId.trim().toLowerCase()

export const validateRoomId = (value: unknown): RoomIdValidationResult => {
  if (typeof value !== 'string') {
    return { ok: false, normalized: '', issue: 'not-string' }
  }

  const normalized = normalizeRoomId(value)
  if (normalized.length === 0) {
    return { ok: false, normalized, issue: 'empty' }
  }
  if (
    normalized.length > PRIVATE_ROOM_ID_MAX_LENGTH ||
    !roomIdPattern.test(normalized)
  ) {
    return { ok: false, normalized, issue: 'invalid-format' }
  }

  return { ok: true, normalized }
}

export const normalizeInviteSecret = (inviteSecret: string): string => inviteSecret.trim()

export const validateInviteSecret = (
  value: unknown
): InviteSecretValidationResult => {
  if (typeof value !== 'string') {
    return { ok: false, normalized: '', issue: 'not-string' }
  }

  const normalized = normalizeInviteSecret(value)
  if (normalized.length < PRIVATE_INVITE_SECRET_MIN_LENGTH) {
    return { ok: false, normalized, issue: 'too-short' }
  }
  if (normalized.length > PRIVATE_INVITE_SECRET_MAX_LENGTH) {
    return { ok: false, normalized, issue: 'too-long' }
  }
  if (!inviteSecretPattern.test(normalized)) {
    return { ok: false, normalized, issue: 'invalid-format' }
  }

  return { ok: true, normalized }
}

export const normalizePrivateInviteJoinRequest = (input: {
  readonly roomId: unknown
  readonly inviteSecret: unknown
  readonly participantId: unknown
}): NormalizePrivateInviteJoinRequestResult => {
  const roomIdResult = validateRoomId(input.roomId)
  if (!roomIdResult.ok) {
    return { ok: false, reason: 'invalid-room-id' }
  }

  const inviteSecretResult = validateInviteSecret(input.inviteSecret)
  if (!inviteSecretResult.ok) {
    return { ok: false, reason: 'invalid-invite-secret' }
  }

  if (!isValidParticipantId(input.participantId)) {
    return { ok: false, reason: 'invalid-participant-id' }
  }

  return {
    ok: true,
    value: {
      roomId: roomIdResult.normalized,
      inviteSecret: inviteSecretResult.normalized,
      participantId: input.participantId.trim()
    }
  }
}

export const validatePrivateInviteSecretMatch = (
  expectedInviteSecret: unknown,
  inviteSecret: string
): Extract<
  PrivateInviteJoinRejectionReason,
  'invalid-invite-secret' | 'invite-secret-mismatch'
> | undefined => {
  const expectedResult = validateInviteSecret(expectedInviteSecret)
  if (!expectedResult.ok) {
    return 'invalid-invite-secret'
  }

  return expectedResult.normalized === inviteSecret ? undefined : 'invite-secret-mismatch'
}

export const getPrivateSessionParticipantCount = (
  participants: ParticipantsState
): number => {
  return participants.guest ? PRIVATE_SESSION_MAX_PARTICIPANTS : 1
}

export const getPrivateInviteParticipantRejectionReason = (
  participants: ParticipantsState,
  participantId: unknown
): Extract<
  PrivateInviteJoinRejectionReason,
  'invalid-participant-id' | 'participant-limit-reached'
> | undefined => {
  if (!isValidParticipantId(participantId)) {
    return 'invalid-participant-id'
  }

  const normalizedParticipantId = participantId.trim()
  if (participants.host.id === normalizedParticipantId) {
    return 'invalid-participant-id'
  }

  const guest = participants.guest
  if (guest && guest.id !== normalizedParticipantId) {
    return 'participant-limit-reached'
  }

  return undefined
}
