import { PlaybackEngineDesiredState } from 'playback/engine/playbackEngineContract'
import { ProtocolError, ProtocolErrorCode, WireDirection } from 'protocol/types'
import {
  PeerTransportConnectionState,
  PeerTransportError,
  PeerTransportErrorCode
} from 'transport/connection-state'

/**
 * Context: Runtime diagnostics should keep only a small rolling window of failures.
 * Invariant: Protocol, transport, and playback diagnostics stay memory-bounded.
 * Options considered: unbounded arrays, one shared buffer, per-scope bounded buffers.
 * Decision: Use a 64-entry cap for each diagnostics primitive.
 * Performance impact: Bounded O(64) copy/append behavior on writes.
 * Memory/lifecycle ownership: Session runtime owners create and clear diagnostics explicitly.
 * Failure mode: Oldest entries are evicted when the cap is reached.
 * Validation: runtime/diagnostics/boundedRuntimeDiagnostics.spec.ts covers caps and immutability.
 */
export const RUNTIME_DIAGNOSTIC_CAP = 64

type RuntimeDiagnosticBase = {
  readonly occurredAtMs: number
  readonly message: string
}

export type ProtocolRuntimeDiagnostic = RuntimeDiagnosticBase & {
  readonly scope: 'protocol'
  readonly code: ProtocolErrorCode
  readonly direction: WireDirection
  readonly path?: string
}

export type TransportRuntimeDiagnostic = RuntimeDiagnosticBase & {
  readonly scope: 'transport'
  readonly code: PeerTransportErrorCode
  readonly state: PeerTransportConnectionState['status']
}

export type PlaybackRuntimeErrorCode =
  | 'adapter-unavailable'
  | 'adapter-load-failed'
  | 'adapter-apply-failed'
  | 'adapter-dispose-failed'
  | 'invalid-desired-state'

export type PlaybackRuntimeDiagnostic = RuntimeDiagnosticBase & {
  readonly scope: 'playback'
  readonly code: PlaybackRuntimeErrorCode
  readonly playbackState: PlaybackEngineDesiredState['playback']['state']
  readonly mediaId?: string
}

export type RuntimeDiagnostic =
  | ProtocolRuntimeDiagnostic
  | TransportRuntimeDiagnostic
  | PlaybackRuntimeDiagnostic

export interface ProtocolRuntimeDiagnosticInput {
  readonly error: ProtocolError
  readonly direction: WireDirection
  readonly occurredAtMs: number
}

export const createProtocolRuntimeDiagnostic = (
  input: ProtocolRuntimeDiagnosticInput
): ProtocolRuntimeDiagnostic => ({
  scope: 'protocol',
  code: input.error.code,
  direction: input.direction,
  occurredAtMs: input.occurredAtMs,
  message: input.error.message,
  path: input.error.path
})

export interface TransportRuntimeDiagnosticInput {
  readonly error: PeerTransportError
  readonly state: PeerTransportConnectionState['status']
  readonly occurredAtMs: number
}

export const createTransportRuntimeDiagnostic = (
  input: TransportRuntimeDiagnosticInput
): TransportRuntimeDiagnostic => ({
  scope: 'transport',
  code: input.error.code,
  state: input.state,
  occurredAtMs: input.occurredAtMs,
  message: input.error.message
})

export interface PlaybackRuntimeDiagnosticInput {
  readonly code: PlaybackRuntimeErrorCode
  readonly message: string
  readonly playbackState: PlaybackEngineDesiredState['playback']['state']
  readonly occurredAtMs: number
  readonly mediaId?: string
}

export const createPlaybackRuntimeDiagnostic = (
  input: PlaybackRuntimeDiagnosticInput
): PlaybackRuntimeDiagnostic => ({
  scope: 'playback',
  code: input.code,
  message: input.message,
  playbackState: input.playbackState,
  occurredAtMs: input.occurredAtMs,
  mediaId: input.mediaId
})
