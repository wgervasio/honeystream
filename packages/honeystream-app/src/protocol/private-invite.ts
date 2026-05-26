import { malformedValueError } from './errors'
import { err, ok, ProtocolResult } from './result'
import { isString } from './validation'

export const PROTOCOL_ROOM_ID_LENGTH = 64
export const PROTOCOL_INVITE_SECRET_MIN_LENGTH = 8
export const PROTOCOL_INVITE_SECRET_MAX_LENGTH = 128

const roomIdPattern = /^[a-f0-9]+$/i
const inviteSecretPattern = /^[A-Za-z0-9+/=_-]+$/

export const normalizeProtocolRoomId = (roomId: string): string =>
  roomId.trim().toLowerCase()

export const parseProtocolRoomId = (
  value: unknown,
  path: string
): ProtocolResult<string> => {
  if (!isString(value)) {
    return err(malformedValueError(path, 'Expected roomId string.'))
  }

  const normalized = normalizeProtocolRoomId(value)
  if (normalized.length !== PROTOCOL_ROOM_ID_LENGTH || !roomIdPattern.test(normalized)) {
    return err(
      malformedValueError(path, 'Expected 64-character hexadecimal roomId.')
    )
  }

  return ok(normalized)
}

export const normalizeProtocolInviteSecret = (inviteSecret: string): string =>
  inviteSecret.trim()

export const parseProtocolInviteSecret = (
  value: unknown,
  path: string
): ProtocolResult<string> => {
  if (!isString(value)) {
    return err(malformedValueError(path, 'Expected invite secret string.'))
  }

  const normalized = normalizeProtocolInviteSecret(value)
  if (normalized.length < PROTOCOL_INVITE_SECRET_MIN_LENGTH) {
    return err(
      malformedValueError(
        path,
        `Expected invite secret with at least ${PROTOCOL_INVITE_SECRET_MIN_LENGTH} characters.`
      )
    )
  }
  if (normalized.length > PROTOCOL_INVITE_SECRET_MAX_LENGTH) {
    return err(
      malformedValueError(
        path,
        `Expected invite secret with at most ${PROTOCOL_INVITE_SECRET_MAX_LENGTH} characters.`
      )
    )
  }
  if (!inviteSecretPattern.test(normalized)) {
    return err(
      malformedValueError(
        path,
        'Expected invite secret with URL-safe/base64 token characters.'
      )
    )
  }

  return ok(normalized)
}

