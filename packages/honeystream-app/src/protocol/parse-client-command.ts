import { invalidCommandError, malformedValueError } from './errors'
import { parseProtocolInviteSecret } from './private-invite'
import { parseMediaSnapshot, snapshotRequestReasons } from './parse-shared'
import { err, ok, ProtocolResult } from './result'
import { ClientCommand, SnapshotRequestReason } from './types'
import { isBoolean, isNonEmptyString, isNonNegativeNumber, isPositiveNumber, isRecord, isString, readOptionalString } from './validation'

const includesValue = <T extends string>(value: string, allowed: readonly T[]): value is T =>
  (allowed as readonly string[]).includes(value)

const parseSnapshotReason = (
  value: unknown,
  path: string
): ProtocolResult<SnapshotRequestReason> => {
  if (!isString(value) || !includesValue(value, snapshotRequestReasons)) {
    return err(malformedValueError(path, 'Expected join, resync, or manual reason.'))
  }
  return ok(value)
}

export const parseClientCommand = (
  value: unknown,
  path: string = 'command'
): ProtocolResult<ClientCommand> => {
  if (!isRecord(value)) return err(invalidCommandError('Expected command object.', path))
  if (!isString(value.type)) return err(malformedValueError(`${path}.type`, 'Expected command type string.'))
  switch (value.type) {
    case 'join':
      if (!isNonEmptyString(value.username)) return err(malformedValueError(`${path}.username`, 'Expected non-empty username.'))
      {
        const inviteSecretResult = parseProtocolInviteSecret(value.inviteSecret, `${path}.inviteSecret`)
        if (!inviteSecretResult.ok) return inviteSecretResult
        return ok({
          type: value.type,
          username: value.username.trim(),
          inviteSecret: inviteSecretResult.value
        })
      }
    case 'leave':
      return ok({ type: value.type, reason: readOptionalString(value, 'reason') })
    case 'addMedia': {
      const mediaResult = parseMediaSnapshot(value.media, `${path}.media`)
      if (!mediaResult.ok) return mediaResult
      return ok({ type: value.type, media: mediaResult.value })
    }
    case 'removeMedia':
      if (!isNonEmptyString(value.mediaId)) return err(malformedValueError(`${path}.mediaId`, 'Expected non-empty mediaId.'))
      return ok({ type: value.type, mediaId: value.mediaId })
    case 'playPause':
      if (!isBoolean(value.playing)) return err(malformedValueError(`${path}.playing`, 'Expected boolean playing flag.'))
      return ok({ type: value.type, playing: value.playing })
    case 'seek':
      if (!isNonNegativeNumber(value.positionMs)) return err(malformedValueError(`${path}.positionMs`, 'Expected non-negative positionMs.'))
      return ok({ type: value.type, positionMs: value.positionMs })
    case 'setRate':
      if (!isPositiveNumber(value.rate)) return err(malformedValueError(`${path}.rate`, 'Expected positive playback rate.'))
      return ok({ type: value.type, rate: value.rate })
    case 'next':
      return ok({ type: value.type })
    case 'requestSnapshot': {
      const reasonResult = parseSnapshotReason(value.reason, `${path}.reason`)
      if (!reasonResult.ok) return reasonResult
      return ok({ type: value.type, reason: reasonResult.value })
    }
    default:
      return err(invalidCommandError(`Unknown command type "${value.type}".`, `${path}.type`))
  }
}
