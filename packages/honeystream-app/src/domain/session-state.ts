import { SystemEvent } from './event-log'
import { createParticipantsState, ParticipantsState } from './participants'
import { createPlaybackClock, PlaybackClockModel } from './playback-clock'

export type SessionStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'ended'

export interface SessionMediaItem {
  readonly id: string
  readonly url: string
  readonly title: string
  readonly durationMs?: number
  readonly requestedBy: string
}

export interface SessionState {
  readonly roomId: string
  readonly status: SessionStatus
  readonly participants: ParticipantsState
  readonly queue: readonly SessionMediaItem[]
  readonly current?: SessionMediaItem
  readonly playback: PlaybackClockModel
  readonly events: readonly SystemEvent[]
}

export interface CreateSessionStateInput {
  readonly roomId: string
  readonly hostId: string
  readonly hostUsername: unknown
  readonly nowHostMs: number
}

const normalizeRoomId = (roomId: string): string => roomId.trim()

export const createSessionState = (input: CreateSessionStateInput): SessionState => ({
  roomId: normalizeRoomId(input.roomId),
  status: 'hosting',
  participants: createParticipantsState(input.hostId, input.hostUsername),
  queue: [],
  current: undefined,
  playback: createPlaybackClock(input.nowHostMs),
  events: []
})

export const withSessionStatus = (state: SessionState, status: SessionStatus): SessionState => ({
  ...state,
  status
})

export const hasGuest = (state: SessionState): boolean => typeof state.participants.guest !== 'undefined'
