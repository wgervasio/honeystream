import { IMediaItem, IMediaPlayerState, PlaybackState } from 'lobby/reducers/mediaPlayer'
import { ConnectionStatus, ISessionState } from 'lobby/reducers/session'
import { IUser, IUsersState } from 'lobby/reducers/users'
import {
  MediaKind,
  MediaSnapshot,
  PlaybackSnapshot,
  SessionSnapshot,
  SessionStatus
} from 'protocol/types'

const LOCAL_FILE_SCHEME = 'honeystream-local://'
const DIRECT_MEDIA_URL_PATTERN = /\.(mp4|m4v|webm|mkv|avi|mov|mp3|m4a|wav|oga|ogg|ogv|m3u8)(?:$|[?#])/i

interface LegacyLocalFileState {
  readonly kind: 'local-file'
}

export interface LegacySessionBridgeState {
  readonly session: ISessionState
  readonly mediaPlayer: IMediaPlayerState
  readonly users: IUsersState
}

export interface CreateLegacySessionSnapshotOptions {
  readonly eventCursor: number
  readonly nowMs: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toNonNegativeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

const toNonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const toEventCursor = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0

const normalizePlaybackRate = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 1

const normalizeUsername = (value: unknown, fallback: string): string => {
  const username = toNonEmptyString(value)
  return username || fallback
}

const isLocalFileState = (value: unknown): value is LegacyLocalFileState =>
  isRecord(value) && value.kind === 'local-file'

const isDirectMediaSource = (source: string): boolean => {
  if (source.startsWith('blob:')) return true
  if (source.startsWith('data:video/') || source.startsWith('data:audio/')) return true
  return DIRECT_MEDIA_URL_PATTERN.test(source)
}

const toMediaKind = (media: IMediaItem, source: string): MediaKind => {
  if (source.startsWith(LOCAL_FILE_SCHEME) || isLocalFileState(media.state)) {
    return 'localFile'
  }

  if (isDirectMediaSource(source) || isDirectMediaSource(media.url)) {
    return 'url'
  }

  return 'website'
}

const toMediaSnapshot = (media: IMediaItem): MediaSnapshot => {
  const source = toNonEmptyString(media.requestUrl) || toNonEmptyString(media.url) || 'about:blank'
  return {
    mediaId: media.id,
    kind: toMediaKind(media, source),
    source,
    title: normalizeUsername(media.title, source),
    durationMs: toNonNegativeNumber(media.duration)
  }
}

const mapPlaybackState = (playback: PlaybackState): PlaybackSnapshot['state'] => {
  switch (playback) {
    case PlaybackState.Playing:
      return 'playing'
    case PlaybackState.Paused:
      return 'paused'
    default:
      return 'idle'
  }
}

const derivePlaybackPositionMs = (state: LegacySessionBridgeState, nowMs: number): number => {
  const rate = normalizePlaybackRate(state.mediaPlayer.playbackRate)
  const durationMs = toNonNegativeNumber(
    state.mediaPlayer.current && state.mediaPlayer.current.duration
  )

  let positionMs = 0
  switch (state.mediaPlayer.playback) {
    case PlaybackState.Playing: {
      const startTime = toNonNegativeNumber(state.mediaPlayer.startTime)
      if (typeof startTime === 'number') {
        const deltaTime = nowMs - (startTime + state.mediaPlayer.serverClockSkew)
        positionMs = Math.max(0, deltaTime * rate)
      }
      break
    }
    case PlaybackState.Paused:
      positionMs = Math.max(0, toNonNegativeNumber(state.mediaPlayer.pauseTime) || 0)
      break
    default:
      positionMs = 0
  }

  if (typeof durationMs === 'number') {
    return Math.min(positionMs, durationMs)
  }

  return positionMs
}

const deriveUpdatedAtHostMs = (
  state: LegacySessionBridgeState,
  nowMs: number,
  positionMs: number
): number => {
  const sessionStartTime = toNonNegativeNumber(state.session.startTime)
  if (typeof sessionStartTime === 'number') return sessionStartTime

  const mediaStartTime = toNonNegativeNumber(state.mediaPlayer.startTime)
  if (typeof mediaStartTime === 'number') return mediaStartTime

  if (positionMs === 0) return nowMs

  const playbackRate = normalizePlaybackRate(state.mediaPlayer.playbackRate)
  return Math.max(0, nowMs - positionMs / playbackRate)
}

const mapPlaybackSnapshot = (state: LegacySessionBridgeState, nowMs: number): PlaybackSnapshot => {
  const positionMs = derivePlaybackPositionMs(state, nowMs)
  return {
    state: mapPlaybackState(state.mediaPlayer.playback),
    positionMs,
    updatedAtHostMs: deriveUpdatedAtHostMs(state, nowMs, positionMs),
    rate: normalizePlaybackRate(state.mediaPlayer.playbackRate),
    durationMs: toNonNegativeNumber(state.mediaPlayer.current && state.mediaPlayer.current.duration)
  }
}

const mapSessionStatus = (state: LegacySessionBridgeState): SessionStatus => {
  if (typeof state.session.disconnectReason !== 'undefined') return 'ended'
  if (!toNonEmptyString(state.session.id)) return 'idle'

  if (
    state.session.connectionStatus === ConnectionStatus.Pending ||
    state.session.authorized === false
  ) {
    return 'joining'
  }

  if (
    state.session.connectionStatus === ConnectionStatus.Connected ||
    state.session.authorized === true
  ) {
    return 'connected'
  }

  return 'hosting'
}

const listSortedUserIds = (users: IUsersState): readonly string[] =>
  Object.keys(users.map).sort((left, right) => left.localeCompare(right))

const getHostPeerId = (state: LegacySessionBridgeState): string => {
  const explicitHost = toNonEmptyString(state.users.host)
  if (explicitHost) return explicitHost

  const userIds = listSortedUserIds(state.users)
  if (userIds.length > 0) return userIds[0]

  return 'host'
}

const toParticipant = (user: IUser | undefined, fallbackId: string, role: 'host' | 'guest') => {
  const peerId = toNonEmptyString(user && user.id) || fallbackId
  return {
    peerId,
    username: normalizeUsername(user && user.name, peerId),
    role
  } as const
}

const mapParticipants = (state: LegacySessionBridgeState): SessionSnapshot['participants'] => {
  const hostPeerId = getHostPeerId(state)
  const host = toParticipant(state.users.map[hostPeerId], hostPeerId, 'host')

  const guestUser = listSortedUserIds(state.users)
    .filter(peerId => peerId !== hostPeerId)
    .map(peerId => state.users.map[peerId])
    .find((user): user is IUser => Boolean(user))

  const guest = guestUser ? toParticipant(guestUser, guestUser.id, 'guest') : undefined
  return { host, guest }
}

const mapQueue = (state: LegacySessionBridgeState): readonly MediaSnapshot[] => {
  const items: IMediaItem[] = []
  if (state.mediaPlayer.current) {
    items.push(state.mediaPlayer.current)
  }
  items.push(...state.mediaPlayer.queue)

  const seenMediaIds = new Set<string>()
  const queue: MediaSnapshot[] = []
  for (const media of items) {
    const mediaId = toNonEmptyString(media.id)
    if (!mediaId || seenMediaIds.has(mediaId)) {
      continue
    }

    seenMediaIds.add(mediaId)
    queue.push(toMediaSnapshot(media))
  }

  return queue
}

export const createLegacySessionSnapshot = (
  state: LegacySessionBridgeState,
  options: CreateLegacySessionSnapshotOptions
): SessionSnapshot => {
  const roomId = toNonEmptyString(state.session.id) || 'legacy-session'
  const currentMediaId = toNonEmptyString(state.mediaPlayer.current && state.mediaPlayer.current.id)
  const nowMs = Math.max(0, options.nowMs)

  return {
    roomId,
    status: mapSessionStatus(state),
    participants: mapParticipants(state),
    queue: mapQueue(state),
    currentMediaId,
    playback: mapPlaybackSnapshot(state, nowMs),
    eventCursor: toEventCursor(options.eventCursor)
  }
}
