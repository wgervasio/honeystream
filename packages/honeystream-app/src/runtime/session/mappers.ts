import { SessionMediaItem, SessionMediaKind, SessionState } from 'domain/session-state'
import { PlaybackEngineDesiredState } from 'playback/engine/playbackEngineContract'
import { PlaybackMediaSource } from 'playback/adapters/shared/playbackAdapter'
import { HostEvent, MediaSnapshot, SessionSnapshot } from 'protocol/types'
import { classifyMediaUrl } from 'runtime/protocol/url-classifier'

const toSessionMediaKind = (kind: MediaSnapshot['kind'] | SessionMediaKind | undefined): SessionMediaKind =>
  kind === 'localFile' || kind === 'website' ? kind : 'url'

const toPlaybackMediaSource = (
  kind: MediaSnapshot['kind'] | SessionMediaKind | undefined
): PlaybackMediaSource => {
  switch (kind) {
    case 'localFile':
      return 'local-file'
    case 'website':
      return 'website'
    default:
      return 'direct-media'
  }
}

const toMediaSnapshot = (media: SessionMediaItem): MediaSnapshot => ({
  mediaId: media.id,
  kind: toSessionMediaKind(media.kind || classifyMediaUrl(media.url)),
  source: media.url,
  title: media.title,
  durationMs: media.durationMs
})

export const toSessionMediaItem = (
  media: MediaSnapshot,
  requestedBy: string
): SessionMediaItem => ({
  id: media.mediaId,
  url: media.source,
  title: media.title,
  kind: toSessionMediaKind(media.kind),
  durationMs: media.durationMs,
  requestedBy
})

export const toSessionSnapshot = (
  state: SessionState,
  eventCursor: number
): SessionSnapshot => ({
  roomId: state.roomId,
  status: state.status,
  participants: {
    host: {
      peerId: state.participants.host.id,
      username: state.participants.host.username,
      role: 'host'
    },
    guest: state.participants.guest
      ? {
          peerId: state.participants.guest.id,
          username: state.participants.guest.username,
          role: 'guest'
        }
      : undefined
  },
  queue: state.queue.map(toMediaSnapshot),
  currentMediaId: state.current ? state.current.id : undefined,
  currentMedia: state.current ? toMediaSnapshot(state.current) : undefined,
  playback: {
    state: state.playback.state,
    positionMs: state.playback.positionMs,
    updatedAtHostMs: state.playback.updatedAtHostMs,
    rate: state.playback.rate,
    durationMs: state.playback.durationMs
  },
  eventCursor
})

const toPlaybackDesiredState = (
  playback: SessionSnapshot['playback'],
  media: MediaSnapshot | undefined
): PlaybackEngineDesiredState => ({
  media: media
    ? {
        mediaId: media.mediaId,
        source: toPlaybackMediaSource(media.kind),
        url: media.source
      }
    : undefined,
  playback: {
    state: playback.state,
    positionMs: playback.positionMs,
    updatedAtHostMs: playback.updatedAtHostMs,
    rate: playback.rate,
    durationMs: playback.durationMs
  }
})

export const toPlaybackDesiredStateFromDomain = (
  state: SessionState
): PlaybackEngineDesiredState =>
  toPlaybackDesiredState(
    {
      state: state.playback.state,
      positionMs: state.playback.positionMs,
      updatedAtHostMs: state.playback.updatedAtHostMs,
      rate: state.playback.rate,
      durationMs: state.playback.durationMs
    },
    state.current ? toMediaSnapshot(state.current) : undefined
  )

export const resolveCurrentMediaSnapshot = (
  snapshot: SessionSnapshot,
  knownMedia: readonly MediaSnapshot[]
): MediaSnapshot | undefined => {
  const currentMediaId = snapshot.currentMediaId
  if (!currentMediaId) return undefined
  if (snapshot.currentMedia && snapshot.currentMedia.mediaId === currentMediaId) {
    return snapshot.currentMedia
  }

  const queueMatch = snapshot.queue.find(media => media.mediaId === currentMediaId)
  if (queueMatch) return queueMatch

  for (let index = 0; index < knownMedia.length; index += 1) {
    const media = knownMedia[index]
    if (media.mediaId === currentMediaId) return media
  }

  return undefined
}

export const toPlaybackDesiredStateFromSnapshot = (
  snapshot: SessionSnapshot,
  knownMedia: readonly MediaSnapshot[]
): PlaybackEngineDesiredState =>
  toPlaybackDesiredState(snapshot.playback, resolveCurrentMediaSnapshot(snapshot, knownMedia))

export const upsertKnownMedia = (
  knownMedia: readonly MediaSnapshot[],
  media: MediaSnapshot,
  cap: number
): readonly MediaSnapshot[] => {
  const deduped = [media, ...knownMedia.filter(entry => entry.mediaId !== media.mediaId)]
  if (deduped.length <= cap) return deduped
  return deduped.slice(0, cap)
}

const nextCursor = (snapshot: SessionSnapshot): number => snapshot.eventCursor + 1

export const applyHostEventToSessionSnapshot = (
  current: SessionSnapshot | undefined,
  event: HostEvent
): SessionSnapshot | undefined => {
  if (event.type === 'snapshot') {
    return event.snapshot
  }

  if (!current) {
    return undefined
  }

  switch (event.type) {
    case 'participantJoined':
      return event.participant.role === 'guest'
        ? {
            ...current,
            status: 'connected',
            participants: {
              host: current.participants.host,
              guest: event.participant
            },
            eventCursor: nextCursor(current)
          }
        : {
            ...current,
            participants: {
              ...current.participants,
              host: event.participant
            },
            eventCursor: nextCursor(current)
          }
    case 'participantLeft':
      return current.participants.guest &&
        current.participants.guest.peerId === event.peerId
        ? {
            ...current,
            status: 'hosting',
            participants: {
              host: current.participants.host
            },
            eventCursor: nextCursor(current)
          }
        : {
            ...current,
            eventCursor: nextCursor(current)
          }
    case 'mediaQueued': {
      const existing = current.queue.filter(media => media.mediaId !== event.media.mediaId)
      const insertionIndex = Math.max(0, Math.min(event.position, existing.length))
      return {
        ...current,
        queue: [
          ...existing.slice(0, insertionIndex),
          event.media,
          ...existing.slice(insertionIndex)
        ],
        eventCursor: nextCursor(current)
      }
    }
    case 'mediaRemoved':
      return {
        ...current,
        queue: current.queue.filter(media => media.mediaId !== event.mediaId),
        currentMediaId:
          current.currentMediaId && current.currentMediaId === event.mediaId
            ? undefined
            : current.currentMediaId,
        currentMedia:
          current.currentMedia && current.currentMedia.mediaId === event.mediaId
            ? undefined
            : current.currentMedia,
        eventCursor: nextCursor(current)
      }
    case 'currentMediaChanged':
      return {
        ...current,
        currentMediaId: event.mediaId,
        currentMedia:
          current.currentMedia && current.currentMedia.mediaId === event.mediaId
            ? current.currentMedia
            : undefined,
        eventCursor: nextCursor(current)
      }
    case 'playbackChanged':
      return {
        ...current,
        playback: event.playback,
        eventCursor: nextCursor(current)
      }
    case 'systemError':
    case 'protocolRejected':
      return {
        ...current,
        eventCursor: nextCursor(current)
      }
  }
}
