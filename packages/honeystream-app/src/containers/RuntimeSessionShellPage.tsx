import React, { useEffect, useMemo } from 'react'
import { RouteComponentProps } from 'react-router'
import { ProtocolError, SessionSnapshot, WireEnvelope, parseWireEnvelope } from '../protocol'
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
import styles from './RuntimeSessionShellPage.css'

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
const RUNTIME_SESSION_STATE_LABELS = Object.freeze({
  idle: 'Room warming up',
  hosting: 'Hosting a cozy room',
  joining: 'Joining the invite',
  connected: 'Synced together',
  ended: 'Room ended'
})
const LOCAL_ONLY_WARNING: SessionRuntimeSystemErrorSnapshot = Object.freeze({
  id: 'runtime-shell-local-only',
  code: 'unsupported-runtime-network',
  message:
    'Runtime session shell is currently host/local only while live runtime transport credentials are pending.'
})
const RUNTIME_ROOM_PROMISES = Object.freeze([
  {
    label: 'Host truth',
    text: 'Cat-side owns playback state so the room never becomes a tug-of-war.'
  },
  {
    label: 'Guest comfort',
    text: 'Rabbit-side sees simple status and sends typed intents instead of mystery state.'
  },
  {
    label: 'Easy websites',
    text: 'Both browsers load the same page locally while sync messages stay tiny.'
  }
])
const RUNTIME_SETUP_STEPS = Object.freeze([
  {
    label: 'Start',
    text: 'Host opens the room and keeps the source of truth.'
  },
  {
    label: 'Invite',
    text: 'Guest uses the private link and takes the second seat.'
  },
  {
    label: 'Watch',
    text: 'Websites, direct links, and local files flow through one queue.'
  }
])
const STREAMING_SITE_CARDS = Object.freeze([
  {
    name: 'YouTube',
    url: 'youtube.com',
    note: 'baseline web-video path'
  },
  {
    name: 'AnimePahe',
    url: 'animepahe.ru',
    note: 'anime episode pages'
  },
  {
    name: 'Cineby',
    url: 'cineby.app',
    note: 'movie and TV pages'
  },
  {
    name: 'Miruro',
    url: 'miruro.to',
    note: 'HD anime watch pages'
  }
])
const SYNC_QUALITY_CHIPS = Object.freeze([
  '0% byte loss target',
  '24 ms lab latency budget',
  'Tiny host snapshots'
])
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

const createFallbackSessionSnapshot = (roomId: string, hostUsername: string): SessionSnapshot => ({
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
  const playbackEngineFactory =
    dependencies.createPlaybackEngine || (() => new HostLocalPlaybackEngine())

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

export const RuntimeSessionShellPage = ({ match }: RouteComponentProps<IRouteParams>) => {
  const lobbyId = match.params.lobbyId
  const boundary = useMemo(() => createRuntimeSessionShellRouteBoundary(lobbyId), [lobbyId])

  useEffect(() => {
    void boundary.start()

    return () => {
      boundary.dispose()
    }
  }, [boundary])

  return (
    <section className={styles.container}>
      <div data-runtime-session-shell="true" className={styles.shell}>
        <header className={styles.heroCard}>
          <p className={styles.kicker}>Runtime session shell</p>
          <h1>Cozy watch room for two</h1>
          <p>
            Host-authoritative playback with a soft cat-side and rabbit-side layout while live
            transport credentials finish moving into the runtime path.
          </p>
          <div
            id="runtime_room_motif"
            className={styles.roomMotif}
            aria-label="Two-person room motif"
          >
            <span className={styles.catNode}>Cat-side host</span>
            <span className={styles.syncLine} />
            <span className={styles.rabbitNode}>Rabbit-side guest</span>
          </div>
          <div id="runtime_room_checklist" className={styles.roomChecklist}>
            <span>{`Lobby: ${lobbyId}`}</span>
            <span>Private invite</span>
            <span>Synced controls</span>
          </div>
          <ol id="runtime_setup_rail" className={styles.setupRail} aria-label="Runtime setup path">
            {RUNTIME_SETUP_STEPS.map((step, index) => (
              <li key={step.label}>
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <div
            id="runtime_room_promises"
            className={styles.roomPromises}
            aria-label="Runtime room promises"
          >
            {RUNTIME_ROOM_PROMISES.map(promise => (
              <article key={promise.label}>
                <strong>{promise.label}</strong>
                <span>{promise.text}</span>
              </article>
            ))}
          </div>
          <div
            id="runtime_streaming_site_lab"
            className={styles.siteLab}
            aria-label="Streaming site test lab"
          >
            <div className={styles.siteLabHeader}>
              <strong>Happy streaming lab</strong>
              <span>URL safety checked test paths</span>
            </div>
            <div className={styles.siteGrid}>
              {STREAMING_SITE_CARDS.map(site => (
                <article key={site.name}>
                  <strong>{site.name}</strong>
                  <span>{site.url}</span>
                  <em>{site.note}</em>
                </article>
              ))}
            </div>
            <div id="runtime_sync_quality" className={styles.syncQuality}>
              {SYNC_QUALITY_CHIPS.map(chip => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          </div>
        </header>
        <SessionRuntimeShellContainer
          className={styles.runtimePanel}
          store={boundary.store}
          intents={NOOP_INTENTS}
          errorTitle="Sync notes"
          hostLabel="Cat-side host"
          guestLabel="Rabbit-side guest"
          waitingForGuestLabel="Waiting for your watch buddy"
          stateLabels={RUNTIME_SESSION_STATE_LABELS}
        />
      </div>
    </section>
  )
}
