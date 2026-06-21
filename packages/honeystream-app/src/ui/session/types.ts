export type SessionViewState = 'idle' | 'hosting' | 'joining' | 'connected' | 'ended'
export type SessionViewStateTone = 'warming' | 'waiting' | 'joining' | 'synced' | 'ended'

export const SESSION_VIEW_STATE_LABELS: Readonly<Record<SessionViewState, string>> = Object.freeze({
  idle: 'Warming up the cozy room',
  hosting: 'Hosting the watch party',
  joining: 'Joining the fun',
  connected: 'Synced and smiling',
  ended: 'Room tucked away'
})

export const SESSION_VIEW_STATE_TONES: Readonly<
  Record<SessionViewState, SessionViewStateTone>
> = Object.freeze({
  idle: 'warming',
  hosting: 'waiting',
  joining: 'joining',
  connected: 'synced',
  ended: 'ended'
})

export type SessionSystemErrorCode =
  | 'invite-invalid'
  | 'join-rejected'
  | 'transport-disconnected'
  | 'transport-timeout'
  | 'protocol-rejected'
  | 'unknown'

export interface SessionSystemErrorViewModel {
  readonly id: string
  readonly code: SessionSystemErrorCode
  readonly message: string
}

export interface SessionParticipantUsernames {
  readonly hostUsername: string
  readonly guestUsername?: string
}
