import { ClientCommand, SessionSnapshot } from 'protocol'

export interface SessionRuntimeSystemErrorSnapshot {
  readonly id: string
  readonly code: string
  readonly message: string
}

export interface SessionRuntimeProjectionSnapshot {
  readonly session: SessionSnapshot
  readonly systemErrors: readonly SessionRuntimeSystemErrorSnapshot[]
}

export interface HostSessionIntent {
  readonly type: 'host'
  readonly roomId: string
  readonly username: string
}

export type JoinSessionIntent = Extract<ClientCommand, { readonly type: 'join' }>
export type LeaveSessionIntent = Extract<ClientCommand, { readonly type: 'leave' }>
export type PlaybackSessionIntent = Extract<
  ClientCommand,
  { readonly type: 'playPause' | 'seek' | 'setRate' | 'next' }
>

export interface SessionRuntimeIntentCallbacks {
  readonly onHostIntent: (intent: HostSessionIntent) => void
  readonly onJoinIntent: (intent: JoinSessionIntent) => void
  readonly onLeaveIntent: (intent: LeaveSessionIntent) => void
  readonly onPlaybackIntent: (intent: PlaybackSessionIntent) => void
}
