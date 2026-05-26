import {
  appendSystemEvent,
  createErrorSystemEvent,
  createParticipantJoinedSystemEvent,
  createParticipantLeftSystemEvent,
  SystemEvent
} from './event-log'
import { addGuestParticipant, removeGuestParticipant } from './participants'
import { pausePlayback, playPlayback, resetPlaybackClock, seekPlayback, setPlaybackDuration, setPlaybackRate } from './playback-clock'
import { getPrivateInviteParticipantRejectionReason } from './private-invite'
import { appendQueueItem, DEFAULT_QUEUE_CAP, removeFirstQueueItem, takeNextQueueItem } from './queue'
import { SessionMediaItem, SessionState } from './session-state'
import { sanitizeUsername } from './usernames'

export type DomainErrorCode =
  | 'invalid-participant'
  | 'guest-slot-occupied'
  | 'guest-not-found'
  | 'queue-cap-reached'
  | 'queue-item-not-found'
  | 'queue-empty'
  | 'missing-current-media'

export interface DomainError {
  readonly code: DomainErrorCode
  readonly message: string
}

export interface TransitionResult {
  readonly state: SessionState
  readonly events: readonly SystemEvent[]
  readonly errors: readonly DomainError[]
}
const withEvent = (state: SessionState, event: SystemEvent): SessionState => ({ ...state, events: appendSystemEvent(state.events, event) })
const success = (state: SessionState, events: readonly SystemEvent[] = []): TransitionResult => ({ state, events, errors: [] })
const failure = (state: SessionState, nowHostMs: number, code: DomainErrorCode, message: string): TransitionResult => {
  const error: DomainError = { code, message }
  const event = createErrorSystemEvent(message, nowHostMs, code)
  return { state: withEvent(state, event), events: [event], errors: [error] }
}

export const transitionGuestJoined = (
  state: SessionState,
  guestId: string,
  guestUsername: unknown,
  nowHostMs: number
): TransitionResult => {
  const participantRejectionReason = getPrivateInviteParticipantRejectionReason(
    state.participants,
    guestId
  )
  if (participantRejectionReason === 'invalid-participant-id') {
    return failure(state, nowHostMs, 'invalid-participant', 'Guest id must be non-empty and different from host id.')
  }
  if (participantRejectionReason === 'participant-limit-reached') {
    return failure(state, nowHostMs, 'guest-slot-occupied', 'Only one guest may join a session.')
  }

  const normalizedGuestId = guestId.trim()
  const existingGuest = state.participants.guest
  if (existingGuest && existingGuest.id === normalizedGuestId) return success(state)

  const username = sanitizeUsername(guestUsername)
  const event = createParticipantJoinedSystemEvent(normalizedGuestId, username, nowHostMs)
  const nextState: SessionState = {
    ...state,
    status: 'connected',
    participants: addGuestParticipant(state.participants, normalizedGuestId, username),
    events: appendSystemEvent(state.events, event)
  }
  return success(nextState, [event])
}

export const transitionGuestLeft = (
  state: SessionState,
  guestId: string,
  nowHostMs: number
): TransitionResult => {
  const guest = state.participants.guest
  if (!guest || guest.id !== guestId) return failure(state, nowHostMs, 'guest-not-found', 'Guest was not found in session state.')

  const event = createParticipantLeftSystemEvent(guestId, nowHostMs, guest.username)
  const nextState: SessionState = {
    ...state,
    status: 'hosting',
    participants: removeGuestParticipant(state.participants, guestId),
    events: appendSystemEvent(state.events, event)
  }
  return success(nextState, [event])
}

export const transitionQueueMedia = (
  state: SessionState,
  media: SessionMediaItem,
  nowHostMs: number,
  queueCap: number = DEFAULT_QUEUE_CAP
): TransitionResult => {
  if (!state.current) {
    const playback = playPlayback(resetPlaybackClock(nowHostMs), nowHostMs)
    return success({ ...state, current: media, playback })
  }

  const queued = appendQueueItem(state.queue, media, queueCap)
  if (!queued.accepted) return failure(state, nowHostMs, 'queue-cap-reached', 'Queue cap reached.')
  return success({ ...state, queue: queued.queue })
}

export const transitionRemoveQueuedMedia = (
  state: SessionState,
  mediaId: string,
  nowHostMs: number
): TransitionResult => {
  const nextQueue = removeFirstQueueItem(state.queue, media => media.id === mediaId)
  if (!nextQueue.accepted) return failure(state, nowHostMs, 'queue-item-not-found', 'Media id was not found in queue.')
  return success({ ...state, queue: nextQueue.queue })
}

export const transitionAdvanceQueue = (state: SessionState, nowHostMs: number): TransitionResult => {
  const nextQueueItem = takeNextQueueItem(state.queue)
  if (!nextQueueItem.accepted || typeof nextQueueItem.removed === 'undefined') {
    if (!state.current) return failure(state, nowHostMs, 'queue-empty', 'Cannot advance because queue is empty.')
    return success({
      ...state,
      current: undefined,
      queue: nextQueueItem.queue,
      playback: resetPlaybackClock(nowHostMs)
    })
  }

  const playback = playPlayback(resetPlaybackClock(nowHostMs), nowHostMs)
  return success({
    ...state,
    current: nextQueueItem.removed,
    queue: nextQueueItem.queue,
    playback
  })
}

export const transitionTogglePlayback = (
  state: SessionState,
  nowHostMs: number
): TransitionResult => {
  if (!state.current) return failure(state, nowHostMs, 'missing-current-media', 'Playback requires an active current media item.')

  const playbackWithDuration = setPlaybackDuration(state.playback, state.current.durationMs, nowHostMs)
  const playback =
    playbackWithDuration.state === 'playing'
      ? pausePlayback(playbackWithDuration, nowHostMs)
      : playPlayback(playbackWithDuration, nowHostMs)

  return success({ ...state, playback })
}

export const transitionSeekPlayback = (
  state: SessionState,
  positionMs: number,
  nowHostMs: number
): TransitionResult => {
  if (!state.current) return failure(state, nowHostMs, 'missing-current-media', 'Cannot seek playback without current media.')

  const playbackWithDuration = setPlaybackDuration(state.playback, state.current.durationMs, nowHostMs)
  const playback = seekPlayback(playbackWithDuration, positionMs, nowHostMs)
  return success({ ...state, playback })
}

export const transitionSetPlaybackRate = (
  state: SessionState,
  rate: number,
  nowHostMs: number
): TransitionResult =>
  success({
    ...state,
    playback: setPlaybackRate(state.playback, rate, nowHostMs)
  })
