import { invalidSnapshotError, malformedValueError } from './errors'
import { err, ok, ProtocolResult } from './result'
import {
  MediaSnapshot,
  ParticipantRole,
  ParticipantSnapshot,
  PlaybackSnapshot,
  SessionSnapshot,
  SessionStatus,
  SnapshotRequestReason
} from './types'
import { isNonEmptyString, isNonNegativeInteger, isNonNegativeNumber, isPositiveNumber, isRecord, isString } from './validation'

const participantRoles: readonly ParticipantRole[] = ['host', 'guest']
const sessionStatuses: readonly SessionStatus[] = ['idle', 'hosting', 'joining', 'connected', 'ended']
const mediaKinds = ['url', 'localFile', 'website'] as const
const playbackStates = ['idle', 'playing', 'paused'] as const
export const snapshotRequestReasons: readonly SnapshotRequestReason[] = ['join', 'resync', 'manual']

const includesValue = <T extends string>(value: string, allowed: readonly T[]): value is T =>
  (allowed as readonly string[]).includes(value)

export const parseParticipantSnapshot = (
  value: unknown,
  path: string
): ProtocolResult<ParticipantSnapshot> => {
  if (!isRecord(value)) return err(malformedValueError(path, 'Expected participant object.'))
  if (!isNonEmptyString(value.peerId)) return err(malformedValueError(`${path}.peerId`, 'Expected non-empty string.'))
  if (!isNonEmptyString(value.username)) return err(malformedValueError(`${path}.username`, 'Expected non-empty string.'))
  if (!isString(value.role) || !includesValue(value.role, participantRoles)) {
    return err(malformedValueError(`${path}.role`, 'Expected host or guest role.'))
  }
  return ok({ peerId: value.peerId, username: value.username, role: value.role })
}

export const parseMediaSnapshot = (value: unknown, path: string): ProtocolResult<MediaSnapshot> => {
  if (!isRecord(value)) return err(malformedValueError(path, 'Expected media object.'))
  if (!isNonEmptyString(value.mediaId)) return err(malformedValueError(`${path}.mediaId`, 'Expected non-empty string.'))
  if (!isString(value.kind) || !includesValue(value.kind, mediaKinds)) {
    return err(malformedValueError(`${path}.kind`, 'Expected url, localFile, or website media kind.'))
  }
  if (!isNonEmptyString(value.source)) return err(malformedValueError(`${path}.source`, 'Expected non-empty string.'))
  if (!isNonEmptyString(value.title)) return err(malformedValueError(`${path}.title`, 'Expected non-empty string.'))
  if (value.durationMs !== undefined && !isNonNegativeNumber(value.durationMs)) {
    return err(malformedValueError(`${path}.durationMs`, 'Expected non-negative number when provided.'))
  }
  return ok({
    mediaId: value.mediaId,
    kind: value.kind,
    source: value.source,
    title: value.title,
    durationMs: value.durationMs
  })
}

export const parsePlaybackSnapshot = (
  value: unknown,
  path: string
): ProtocolResult<PlaybackSnapshot> => {
  if (!isRecord(value)) return err(malformedValueError(path, 'Expected playback object.'))
  if (!isString(value.state) || !includesValue(value.state, playbackStates)) {
    return err(malformedValueError(`${path}.state`, 'Expected idle, playing, or paused state.'))
  }
  if (!isNonNegativeNumber(value.positionMs)) return err(malformedValueError(`${path}.positionMs`, 'Expected non-negative number.'))
  if (!isNonNegativeNumber(value.updatedAtHostMs)) return err(malformedValueError(`${path}.updatedAtHostMs`, 'Expected non-negative number.'))
  if (!isPositiveNumber(value.rate)) return err(malformedValueError(`${path}.rate`, 'Expected positive playback rate.'))
  if (value.durationMs !== undefined && !isNonNegativeNumber(value.durationMs)) {
    return err(malformedValueError(`${path}.durationMs`, 'Expected non-negative number when provided.'))
  }
  return ok({
    state: value.state,
    positionMs: value.positionMs,
    updatedAtHostMs: value.updatedAtHostMs,
    rate: value.rate,
    durationMs: value.durationMs
  })
}

export const parseSessionSnapshot = (
  value: unknown,
  path: string = 'snapshot'
): ProtocolResult<SessionSnapshot> => {
  if (!isRecord(value)) return err(invalidSnapshotError('Expected snapshot object.', path))
  if (!isNonEmptyString(value.roomId)) return err(malformedValueError(`${path}.roomId`, 'Expected non-empty string.'))
  if (!isString(value.status) || !includesValue(value.status, sessionStatuses)) {
    return err(malformedValueError(`${path}.status`, 'Expected valid session status.'))
  }
  if (!isRecord(value.participants)) return err(malformedValueError(`${path}.participants`, 'Expected participants object.'))
  const hostResult = parseParticipantSnapshot(value.participants.host, `${path}.participants.host`)
  if (!hostResult.ok) return hostResult
  const guestResult =
    value.participants.guest === undefined
      ? undefined
      : parseParticipantSnapshot(value.participants.guest, `${path}.participants.guest`)
  if (guestResult && !guestResult.ok) return guestResult
  if (!Array.isArray(value.queue)) return err(malformedValueError(`${path}.queue`, 'Expected queue array.'))
  const queue: MediaSnapshot[] = []
  for (let index = 0; index < value.queue.length; index += 1) {
    const media = parseMediaSnapshot(value.queue[index], `${path}.queue[${index}]`)
    if (!media.ok) return media
    queue.push(media.value)
  }
  if (value.currentMediaId !== undefined && !isNonEmptyString(value.currentMediaId)) {
    return err(malformedValueError(`${path}.currentMediaId`, 'Expected non-empty string when provided.'))
  }
  const playbackResult = parsePlaybackSnapshot(value.playback, `${path}.playback`)
  if (!playbackResult.ok) return playbackResult
  if (!isNonNegativeInteger(value.eventCursor)) {
    return err(malformedValueError(`${path}.eventCursor`, 'Expected non-negative integer.'))
  }
  return ok({
    roomId: value.roomId,
    status: value.status,
    participants: { host: hostResult.value, guest: guestResult ? guestResult.value : undefined },
    queue,
    currentMediaId: value.currentMediaId,
    playback: playbackResult.value,
    eventCursor: value.eventCursor
  })
}
