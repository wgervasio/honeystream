import React, { useEffect, useMemo } from 'react'
import { RouteComponentProps } from 'react-router'
import {
  ProtocolError,
  SessionSnapshot,
  WireEnvelope,
  parseWireEnvelope
} from '../protocol'
import {
  PlaybackEngineApplyResult,
  PlaybackEngineDesiredState
} from '../playback/engine/playbackEngineContract'
import {
  SessionRuntime as RuntimeSession,
  SessionRuntimeDependencies,
  SessionRuntimePlaybackEngine,
  SessionRuntimeProjection,
  createSessionRuntime
} from '../runtime/session'
import { TransportMessageValidator } from '../transport/contracts'
import {
  InMemoryPeerTransportPair,
  createInMemoryPeerTransportPair
} from '../transport/in-memory-peer-transport-pair'
import {
  Disposable,
  ProjectionStore,
  createProjectionStore,
  connectSessionEngineProjection,
  SessionRuntimeIntentCallbacks,
  SessionRuntimeProjectionSnapshot,
  SessionRuntimeShellContainer,
  SessionRuntimeSystemErrorSnapshot
} from '../ui'

interface IRouteParams {
  lobbyId: string
}

type ClientToHostWireEnvelope = Extract<WireEnvelope, { direction: 'client-to-host' }>
type HostToClientWireEnvelope = Extract<WireEnvelope, { direction: 'host-to-client' }>
type RuntimeRouteTransportPair = InMemoryPeerTransportPair<
  ClientToHostWireEnvelope,
  HostToClientWireEnvelope
>

interface RuntimeSessionShellRouteBoundaryDependencies {
  readonly createPlaybackEngine?: () => SessionRuntimePlaybackEngine
  readonly createRuntime?: (dependencies: SessionRuntimeDependencies) => RuntimeSession
  readonly createTransportPair?: (now: () => number) => RuntimeRouteTransportPair
  readonly hostUsername?: string
  readonly now?: () => number
}

export interface RuntimeSessionShellRouteBoundary extends Disposable {
  readonly store: ProjectionStore<SessionRuntimeProjectionSnapshot>
  start(): Promise<void>
}

const HOST_USERNAME = 'Host'
const LOCAL_ONLY_WARNING: SessionRuntimeSystemErrorSnapshot = Object.freeze({
  id: 'runtime-shell-local-only',
  code: 'unsupported-runtime-network',
  message:
    'Runtime session shell is currently host/local only while live runtime transport credentials are pending.'
})
const STARTUP_ERROR_ID = 'runtime-shell-startup'
const DEFAULT_SEEK_TOLERANCE_MS = 250

const NOOP_INTENTS: SessionRuntimeIntentCallbacks = Object.freeze({
  onHostIntent: () => undefined,
  onJoinIntent: () => undefined,
  onLeaveIntent: () => undefined,
  onPlaybackIntent: () => undefined
})

class HostLocalPlaybackEngine implements SessionRuntimePlaybackEngine {
  private disposed = false

  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackEngineApplyResult> {
    if (this.disposed) {
      throw new Error('HostLocalPlaybackEngine cannot apply playback state after dispose.')
    }

    return {
      adapterCreated: false,
      mediaChanged: false,
      adapterDisposed: false,
      seekToleranceMs: desiredState.seekToleranceMs || DEFAULT_SEEK_TOLERANCE_MS,
      appliedPlayback: desiredState.playback
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
  }
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return `Unexpected runtime session startup failure: ${String(error)}`
}

const createWireEnvelopeValidator = <TDirection extends WireEnvelope['direction']>(
  direction: TDirection
): TransportMessageValidator<Extract<WireEnvelope, { direction: TDirection }>> => ({
  validate: (value: unknown): value is Extract<WireEnvelope, { direction: TDirection }> => {
    const parsed = parseWireEnvelope(value)
    return parsed.ok && parsed.value.direction === direction
  },
  describeInvalidMessage: () => `Expected ${direction} wire envelope payload.`
})

const createRuntimeRouteTransportPair = (now: () => number): RuntimeRouteTransportPair =>
  createInMemoryPeerTransportPair<ClientToHostWireEnvelope, HostToClientWireEnvelope>({
    hostPeerId: 'runtime-route-host',
    guestPeerId: 'runtime-route-guest',
    hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
    guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
    now
  })

const mapLifecycleToSessionStatus = (
  lifecycle: SessionRuntimeProjection['lifecycle']
): SessionSnapshot['status'] => {
  switch (lifecycle) {
    case 'running':
      return 'hosting'
    case 'disposed':
      return 'ended'
    case 'starting':
      return 'joining'
    case 'idle':
    default:
      return 'idle'
  }
}

const createFallbackSessionSnapshot = (
  roomId: string,
  hostUsername: string
): SessionSnapshot => ({
  roomId,
  status: 'idle',
  participants: {
    host: {
      peerId: 'runtime-route-host',
      username: hostUsername,
      role: 'host'
    }
  },
  queue: [],
  playback: {
    state: 'idle',
    positionMs: 0,
    updatedAtHostMs: 0,
    rate: 1
  },
  eventCursor: 0
})

const mapProtocolErrorToSystemError = (
  error: ProtocolError,
  index: number
): SessionRuntimeSystemErrorSnapshot => ({
  id: `runtime-shell-protocol-${index}`,
  code: 'protocol-rejected',
  message: error.message
})

const mapRuntimeErrorToSystemError = (
  error: string,
  index: number
): SessionRuntimeSystemErrorSnapshot => ({
  id: `runtime-shell-runtime-${index}`,
  code: 'unknown',
  message: error
})

const mapProjectionToShellSnapshot = (
  projection: SessionRuntimeProjection,
  fallbackSession: SessionSnapshot
): SessionRuntimeProjectionSnapshot => {
  const session = projection.session || {
    ...fallbackSession,
    status: mapLifecycleToSessionStatus(projection.lifecycle)
  }

  return {
    session,
    systemErrors: [
      LOCAL_ONLY_WARNING,
      ...projection.diagnostics.map(mapProtocolErrorToSystemError),
      ...projection.runtimeErrors.map(mapRuntimeErrorToSystemError)
    ]
  }
}

export const createRuntimeSessionShellRouteBoundary = (
  lobbyId: string,
  dependencies: RuntimeSessionShellRouteBoundaryDependencies = {}
): RuntimeSessionShellRouteBoundary => {
  const roomId = lobbyId.trim()
  const now = dependencies.now || Date.now
  const hostUsername = dependencies.hostUsername || HOST_USERNAME
  const transportPairFactory = dependencies.createTransportPair || createRuntimeRouteTransportPair
  const runtimeFactory = dependencies.createRuntime || createSessionRuntime
  const playbackEngineFactory = dependencies.createPlaybackEngine || (() => new HostLocalPlaybackEngine())

  const transportPair = transportPairFactory(now)
  const runtime = runtimeFactory({
    now,
    transport: transportPair.host,
    playback: playbackEngineFactory()
  })
  const fallbackSession = createFallbackSessionSnapshot(roomId, hostUsername)
  const store = createProjectionStore(
    mapProjectionToShellSnapshot(runtime.getSnapshot(), fallbackSession)
  )
  const projectionConnection = connectSessionEngineProjection(store, {
    subscribeToSnapshots(listener) {
      return runtime.subscribeToSnapshots(projection => {
        listener(mapProjectionToShellSnapshot(projection, fallbackSession))
      })
    }
  })

  let started = false
  let disposed = false

  const recordStartupError = (message: string): void => {
    const snapshot = store.getSnapshot()
    store.setSnapshot({
      session: snapshot.session,
      systemErrors: [
        ...snapshot.systemErrors,
        {
          id: STARTUP_ERROR_ID,
          code: 'unknown',
          message
        }
      ]
    })
  }

  return {
    store,
    async start(): Promise<void> {
      if (disposed) {
        throw new Error('Runtime session shell boundary cannot be started after disposal.')
      }

      if (started) {
        return
      }

      started = true
      try {
        await runtime.startHostSession({
          roomId,
          hostUsername,
          inviteSecret: `runtime-route-local:${roomId}`
        })
      } catch (error) {
        recordStartupError(toErrorMessage(error))
      }
    },
    dispose(): void {
      if (disposed) {
        return
      }

      disposed = true
      projectionConnection.dispose()
      runtime.dispose()
      transportPair.guest.dispose()
    }
  }
}

export const RuntimeSessionShellPage = ({
  match
}: RouteComponentProps<IRouteParams>) => {
  const lobbyId = match.params.lobbyId
  const boundary = useMemo(() => createRuntimeSessionShellRouteBoundary(lobbyId), [lobbyId])

  useEffect(() => {
    void boundary.start()

    return () => {
      boundary.dispose()
    }
  }, [boundary])

  return (
    <section data-runtime-session-shell="true">
      <h1>Runtime session shell</h1>
      <p>{`Lobby: ${lobbyId}`}</p>
      <SessionRuntimeShellContainer store={boundary.store} intents={NOOP_INTENTS} errorTitle="Session issues" />
    </section>
  )
}
