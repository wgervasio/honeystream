export type SessionViewState = 'idle' | 'hosting' | 'joining' | 'connected' | 'ended'
export type SessionViewStateTone = 'warming' | 'waiting' | 'joining' | 'synced' | 'ended'

export const SESSION_VIEW_STATE_LABELS: Readonly<Record<SessionViewState, string>> = Object.freeze({
  idle: 'Idle',
  hosting: 'Hosting',
  joining: 'Joining',
  connected: 'Connected',
  ended: 'Ended'
})

export const SESSION_VIEW_STATE_TONES: Readonly<Record<SessionViewState, SessionViewStateTone>> =
  Object.freeze({
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
