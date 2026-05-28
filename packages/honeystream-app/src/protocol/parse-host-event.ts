import { invalidEventError, malformedValueError } from './errors'
import { parseProtocolError } from './parse-protocol-error'
import { parseMediaSnapshot, parseParticipantSnapshot, parsePlaybackSnapshot, parseSessionSnapshot } from './parse-shared'
import { err, ok, ProtocolResult } from './result'
import { HostEvent } from './types'
import { isNonEmptyString, isNonNegativeInteger, isRecord, isString } from './validation'

export const parseHostEvent = (value: unknown, path: string = 'event'): ProtocolResult<HostEvent> => {
  if (!isRecord(value)) return err(invalidEventError('Expected event object.', path))
  if (!isString(value.type)) return err(malformedValueError(`${path}.type`, 'Expected event type string.'))
  switch (value.type) {
    case 'snapshot': {
      const snapshotResult = parseSessionSnapshot(value.snapshot, `${path}.snapshot`)
      if (!snapshotResult.ok) return snapshotResult
      return ok({ type: value.type, snapshot: snapshotResult.value })
    }
    case 'participantJoined': {
      const participantResult = parseParticipantSnapshot(value.participant, `${path}.participant`)
      if (!participantResult.ok) return participantResult
      return ok({ type: value.type, participant: participantResult.value })
    }
    case 'participantLeft':
      if (!isNonEmptyString(value.peerId)) return err(malformedValueError(`${path}.peerId`, 'Expected non-empty peerId.'))
      return ok({ type: value.type, peerId: value.peerId })
    case 'mediaQueued': {
      const mediaResult = parseMediaSnapshot(value.media, `${path}.media`)
      if (!mediaResult.ok) return mediaResult
      if (!isNonNegativeInteger(value.position)) return err(malformedValueError(`${path}.position`, 'Expected non-negative integer position.'))
      return ok({ type: value.type, media: mediaResult.value, position: value.position })
    }
    case 'mediaRemoved':
      if (!isNonEmptyString(value.mediaId)) return err(malformedValueError(`${path}.mediaId`, 'Expected non-empty mediaId.'))
      return ok({ type: value.type, mediaId: value.mediaId })
    case 'currentMediaChanged':
      if (value.mediaId !== undefined && !isNonEmptyString(value.mediaId)) {
        return err(malformedValueError(`${path}.mediaId`, 'Expected non-empty mediaId when provided.'))
      }
      if (value.media === undefined) return ok({ type: value.type, mediaId: value.mediaId })
      {
        const mediaResult = parseMediaSnapshot(value.media, `${path}.media`)
        if (!mediaResult.ok) return mediaResult
        if (value.mediaId !== undefined && mediaResult.value.mediaId !== value.mediaId) {
          return err(malformedValueError(`${path}.media.mediaId`, 'Expected media id to match mediaId.'))
        }
        return ok({
          type: value.type,
          mediaId: value.mediaId || mediaResult.value.mediaId,
          media: mediaResult.value
        })
      }
    case 'playbackChanged': {
      const playbackResult = parsePlaybackSnapshot(value.playback, `${path}.playback`)
      if (!playbackResult.ok) return playbackResult
      return ok({ type: value.type, playback: playbackResult.value })
    }
    case 'systemError':
      if (!isNonEmptyString(value.errorCode)) return err(malformedValueError(`${path}.errorCode`, 'Expected non-empty errorCode.'))
      if (!isNonEmptyString(value.message)) return err(malformedValueError(`${path}.message`, 'Expected non-empty message.'))
      return ok({ type: value.type, errorCode: value.errorCode, message: value.message })
    case 'protocolRejected': {
      const errorResult = parseProtocolError(value.error, `${path}.error`)
      if (!errorResult.ok) return errorResult
      return ok({ type: value.type, error: errorResult.value })
    }
    default:
      return err(invalidEventError(`Unknown event type "${value.type}".`, `${path}.type`))
  }
}
