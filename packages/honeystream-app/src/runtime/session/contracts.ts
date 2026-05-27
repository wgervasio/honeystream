import { PlaybackEngineStateApplication } from 'playback/engine/playbackEngineContract'
import {
  ClientCommand,
  MediaSnapshot,
  ProtocolError,
  SessionSnapshot,
  SnapshotRequestReason
} from 'protocol/types'
import { PeerTransport } from 'transport/contracts'
import { PeerTransportConnectionState } from 'transport/connection-state'
import { ProjectionStore, ProjectionUnsubscribe } from 'ui/externalStoreProjection'

export type SessionRuntimeRole = 'uninitialized' | 'host' | 'guest'
export type SessionRuntimeLifecycle = 'idle' | 'starting' | 'running' | 'disposed'

export interface SessionRuntimePlaybackEngine extends PlaybackEngineStateApplication {
  dispose(): void
}

export interface SessionRuntimeProjection {
  readonly role: SessionRuntimeRole
  readonly lifecycle: SessionRuntimeLifecycle
  readonly transportState: PeerTransportConnectionState
  readonly session?: SessionSnapshot
  readonly diagnostics: readonly ProtocolError[]
  readonly runtimeErrors: readonly string[]
}

export interface StartHostSessionInput {
  readonly roomId: string
  readonly hostUsername: string
  readonly inviteSecret: string
  readonly nowHostMs?: number
}

export interface StartGuestSessionInput {
  readonly roomId: string
  readonly username: string
  readonly inviteSecret: string
}

export type HostSessionCommand =
  | {
      readonly type: 'addMedia'
      readonly media: MediaSnapshot
    }
  | {
      readonly type: 'removeMedia'
      readonly mediaId: string
    }
  | {
      readonly type: 'playPause'
      readonly playing: boolean
    }
  | {
      readonly type: 'seek'
      readonly positionMs: number
    }
  | {
      readonly type: 'setRate'
      readonly rate: number
    }
  | {
      readonly type: 'next'
    }
  | {
      readonly type: 'requestSnapshot'
      readonly reason?: SnapshotRequestReason
    }

export interface SessionRuntimeDependencies {
  readonly transport: PeerTransport<unknown, unknown>
  readonly playback: SessionRuntimePlaybackEngine
  readonly now?: () => number
  readonly queueCap?: number
  readonly diagnosticsCap?: number
  readonly runtimeErrorCap?: number
}

export interface SessionRuntimeProjectionSource {
  subscribeToSnapshots(listener: (snapshot: SessionRuntimeProjection) => void): ProjectionUnsubscribe
}

export interface SessionRuntime extends SessionRuntimeProjectionSource {
  getSnapshot(): SessionRuntimeProjection
  getProjectionStore(): ProjectionStore<SessionRuntimeProjection>
  startHostSession(input: StartHostSessionInput): Promise<void>
  startGuestSession(input: StartGuestSessionInput): Promise<void>
  dispatchHostCommand(command: HostSessionCommand): Promise<void>
  dispatchGuestCommand(command: ClientCommand): Promise<void>
  dispose(): void
}
