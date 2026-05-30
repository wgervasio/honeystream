import { ClientCommand, SessionSnapshot } from 'protocol'

type SessionRuntimeProjectionRole = 'uninitialized' | 'host' | 'guest'

export interface SessionRuntimeSystemErrorSnapshot {
  readonly id: string
  readonly code: string
  readonly message: string
}

export interface SessionRuntimeClockSyncSnapshot {
  readonly estimatedHostOffsetMs: number
  readonly lastRoundTripMs: number
  readonly lastSyncedAtMs: number
  readonly sampleCount: number
}

export interface SessionRuntimeProjectionSnapshot {
  readonly role: SessionRuntimeProjectionRole
  readonly session: SessionSnapshot
  readonly clockSync?: SessionRuntimeClockSyncSnapshot
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
