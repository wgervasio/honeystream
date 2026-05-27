import { Participant, SessionMediaItem, SessionState } from '../../domain'
import {
  HostEvent,
  MediaSnapshot,
  ParticipantSnapshot,
  PlaybackSnapshot,
  SessionSnapshot
} from '../../protocol/types'
import { classifyMediaUrl } from '../../protocol/url-classifier'

export type ResolveMediaKind = (media: SessionMediaItem) => MediaSnapshot['kind']

export interface SessionSnapshotBridgeOptions {
  readonly eventCursor?: number
  readonly resolveMediaKind?: ResolveMediaKind
}

const defaultResolveMediaKind: ResolveMediaKind = media => media.kind || classifyMediaUrl(media.url)

const toParticipantSnapshot = (participant: Participant): ParticipantSnapshot => ({
  peerId: participant.id,
  username: participant.username,
  role: participant.role
})

const resolveEventCursor = (state: SessionState, eventCursor: number | undefined): number => {
  if (typeof eventCursor === 'number' && Number.isInteger(eventCursor) && eventCursor >= 0) {
    return eventCursor
  }

  return state.events.length
}

export const toProtocolMediaSnapshot = (
  media: SessionMediaItem,
  resolveMediaKind: ResolveMediaKind = defaultResolveMediaKind
): MediaSnapshot => ({
  mediaId: media.id,
  kind: resolveMediaKind(media),
  source: media.url,
  title: media.title,
  durationMs: media.durationMs
})

export const toProtocolPlaybackSnapshot = (
  playback: SessionState['playback']
): PlaybackSnapshot => ({
  state: playback.state,
  positionMs: playback.positionMs,
  updatedAtHostMs: playback.updatedAtHostMs,
  rate: playback.rate,
  durationMs: playback.durationMs
})

export const toProtocolSessionSnapshot = (
  state: SessionState,
  options: SessionSnapshotBridgeOptions = {}
): SessionSnapshot => {
  const resolveMediaKind = options.resolveMediaKind || defaultResolveMediaKind
  return {
    roomId: state.roomId,
    status: state.status,
    participants: {
      host: toParticipantSnapshot(state.participants.host),
      guest: state.participants.guest ? toParticipantSnapshot(state.participants.guest) : undefined
    },
    queue: state.queue.map(media => toProtocolMediaSnapshot(media, resolveMediaKind)),
    currentMediaId: state.current ? state.current.id : undefined,
    playback: toProtocolPlaybackSnapshot(state.playback),
    eventCursor: resolveEventCursor(state, options.eventCursor)
  }
}

export const toProtocolSnapshotHostEvent = (
  state: SessionState,
  options: SessionSnapshotBridgeOptions = {}
): HostEvent => ({
  type: 'snapshot',
  snapshot: toProtocolSessionSnapshot(state, options)
})
