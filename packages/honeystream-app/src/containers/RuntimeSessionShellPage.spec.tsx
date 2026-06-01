import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RouteComponentProps } from 'react-router'

jest.mock('components/TitleBar', () => ({
  TitleBar: () => null
}))

import {
  createRuntimeSessionShellRouteBoundary,
  RuntimeSessionShellPage
} from './RuntimeSessionShellPage'
import { parseWireEnvelope, ClientCommand, WireEnvelope } from '../protocol'
import {
  HostSessionCommand,
  SessionRuntime as RuntimeSession,
  SessionRuntimeDependencies,
  SessionRuntimeProjection,
  SessionRuntimePlaybackEngine
} from '../runtime/session'
import { createInMemoryPeerTransportPair } from '../transport/in-memory-peer-transport-pair'
import { TransportMessageValidator } from '../transport/contracts'
import {
  PlaybackEngineApplyResult,
  PlaybackEngineDesiredState
} from '../playback/engine/playbackEngineContract'
import { LocalFileMetadata } from '../playback/adapters/local-file'
import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
  STREAMING_SITE_CONNECTION_PROFILE_MAX_QUEUED_BYTES,
  STREAMING_SITE_CONNECTION_PROVIDER_COVERAGE,
  STREAMING_SITE_CONNECTION_PROFILES,
  STREAMING_SITE_CONNECTION_TRIAL_COUNT
} from '../transport/streaming-site-connection-defaults'
import { createProjectionStore } from '../ui'

interface RouteParams {
  lobbyId: string
}

function createRouteProps(lobbyId: string): RouteComponentProps<RouteParams> {
  return {
    history: {} as RouteComponentProps<RouteParams>['history'],
    location: {} as RouteComponentProps<RouteParams>['location'],
    match: {
      isExact: true,
      params: { lobbyId },
      path: '/join/:lobbyId',
      url: `/join/${lobbyId}`
    },
    staticContext: undefined
  }
}

type ClientToHostWireEnvelope = Extract<WireEnvelope, { direction: 'client-to-host' }>
type HostToClientWireEnvelope = Extract<WireEnvelope, { direction: 'host-to-client' }>

const createWireEnvelopeValidator = <TDirection extends WireEnvelope['direction']>(
  direction: TDirection
): TransportMessageValidator<Extract<WireEnvelope, { direction: TDirection }>> => ({
  validate: (value: unknown): value is Extract<WireEnvelope, { direction: TDirection }> => {
    const parsed = parseWireEnvelope(value)
    return parsed.ok && parsed.value.direction === direction
  },
  describeInvalidMessage: () => `Expected ${direction} wire envelope payload.`
})

const createRouteTransportPair = (now: () => number) =>
  createInMemoryPeerTransportPair<ClientToHostWireEnvelope, HostToClientWireEnvelope>({
    hostPeerId: 'host-peer',
    guestPeerId: 'guest-peer',
    hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
    guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
    now
  })

class FakePlaybackEngine implements SessionRuntimePlaybackEngine {
  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackEngineApplyResult> {
    return {
      adapterCreated: false,
      mediaChanged: false,
      adapterDisposed: false,
      seekToleranceMs: desiredState.seekToleranceMs || 250,
      appliedPlayback: desiredState.playback
    }
  }

  dispose(): void {
    return
  }
}

class FakeLocalFilePlaybackEngine extends FakePlaybackEngine {
  registerLocalFile(file: File): LocalFileMetadata {
    return {
      kind: 'local-file',
      key: 'local-key',
      name: file.name,
      size: file.size,
      type: file.type || undefined,
      lastModified: file.lastModified || undefined
    }
  }
}

class TestFile implements File {
  readonly lastModified = 123
  readonly name = 'local-movie.mp4'
  readonly size = 10
  readonly type = 'video/mp4'
  readonly webkitRelativePath = '';
  readonly [Symbol.toStringTag] = 'File'

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(0))
  }

  slice(): Blob {
    throw new Error('TestFile.slice() is not used in this test suite.')
  }

  stream(): ReadableStream<Uint8Array> {
    throw new Error('TestFile.stream() is not used in this test suite.')
  }

  text(): Promise<string> {
    return Promise.resolve('')
  }
}

const installCryptoMock = (): (() => void) => {
  const originalCrypto = globalThis.crypto
  const cryptoMock = {
    getRandomValues(bytes: Uint8Array): Uint8Array {
      bytes.fill(1)
      return bytes
    }
  }

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: cryptoMock
  })

  return () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto
    })
  }
}

describe('RuntimeSessionShellPage', () => {
  it('renders route-owned runtime session shell details for the lobby route', () => {
    const restoreCrypto = installCryptoMock()

    let html = ''
    try {
      html = renderToStaticMarkup(<RuntimeSessionShellPage {...createRouteProps('room-123')} />)
    } finally {
      restoreCrypto()
    }

    expect(html).toContain('Cozy watch room')
    expect(html).toContain('id="runtime_buddy_scene"')
    expect(html).toContain('Cat checks the source')
    expect(html).toContain('Rabbit gets one hop')
    expect(html).toContain('Tiny sync lane')
    expect(html).toContain('Room code')
    expect(html).toContain('room-123')
    expect(html).toContain('0 control bytes')
    expect(html).toContain(`&lt;=${STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS}ms mock RT`)
    expect(html).toContain(`${STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS}ms best mock RT`)
    expect(html).toContain(`${STREAMING_SITE_CONNECTION_FIXTURES.length} local fixtures`)
    expect(html).toContain('Recovered retries counted')
    expect(html).toContain('Paste a supported website')
    expect(html).toContain('Website lane')
    expect(html).toContain('Direct MP4')
    expect(html).toContain('Miruro')
    expect(html).toContain('data-source-suggestion="youtube"')
    expect(html).toContain('Room feels ready when')
    expect(html).toContain('Source picked')
    expect(html).toContain('Controls obvious')
    expect(html).toContain('Sync budget green')
    expect(html).toContain(
      `Mock host/guest control round trips stay at or under ${STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS}ms P95`
    )
    expect(html).toContain('visible recovered retries')
    expect(html).toContain('no skipped controls')
    expect(html).toContain('capped jitter')
    expect(html).toContain('id="runtime_connection_lab_proof"')
    expect(html).toContain('Connection lab proof')
    expect(html).toContain('Ultra-low latency lane wins')
    expect(html).toContain(
      `${STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS}ms mock round-trip lane`
    )
    expect(html).toContain('Retry lane stays green')
    expect(html).toContain('Site matrix covered')
    for (const coverage of STREAMING_SITE_CONNECTION_PROVIDER_COVERAGE) {
      expect(html).toContain(`x${coverage.siteCount}`)
    }
    expect(html).toContain('YouTube x16')
    expect(html).toContain('AnimePahe x13')
    expect(html).toContain('Cineby x14')
    expect(html).toContain('Miruro x12')
    expect(html).toContain('every named provider keeps at least two fixtures')
    expect(html).toContain('Bursts stay calm')
    expect(html).toContain('Rapid seek, pause, resume, and rate bursts')
    expect(html).toContain('include next/resync controls')
    expect(html).toContain(
      `${STREAMING_SITE_CONNECTION_PROFILES.length} lanes run for ` +
        `${STREAMING_SITE_CONNECTION_TRIAL_COUNT} deterministic trials`
    )
    expect(html).toContain('id="runtime_merge_gate"')
    expect(html).toContain('Streaming merge gate')
    expect(html).toContain('Zero-loss required')
    expect(html).toContain('Byte loss gate')
    expect(html).toContain('0%')
    expect(html).toContain('deliver every control byte before latency ranking')
    expect(html).toContain('Tail latency gate')
    expect(html).toContain(`&lt;=${STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS}ms P95`)
    expect(html).toContain('Host and guest mock round trips stay under the merge budget')
    expect(html).toContain('Balance gate')
    expect(html).toContain(
      `&lt;=${STREAMING_SITE_CONNECTION_BUDGET.maxDirectionalLatencySkewMs}ms skew`
    )
    expect(html).toContain('averages cannot hide lag')
    expect(html).toContain('Payload gate')
    expect(html).toContain(`&lt;=${STREAMING_SITE_CONNECTION_BUDGET.maxMessageBytes}B`)
    expect(html).toContain('Typed play, pause, seek, rate, and next frames stay compact')
    expect(html).toContain('Retry count gate')
    expect(html).toContain('Recovered retry count stays budgeted')
    expect(html).toContain('Retry byte gate')
    expect(html).toContain(
      `&lt;=${STREAMING_SITE_CONNECTION_BUDGET.maxRetransmissionByteRate * 100}%`
    )
    expect(html).toContain('Recovered retry bytes stay budgeted')
    expect(html).toContain('Coverage gate')
    expect(html).toContain(`${STREAMING_SITE_CONNECTION_FIXTURES.length} sites`)
    expect(html).toContain('YouTube, AnimePahe, Cineby, Miruro, and generic pages')
    expect(html).toContain('Per-site proof')
    expect(html).toContain(`${STREAMING_SITE_CONNECTION_FIXTURES.length} observed`)
    expect(html).toContain(
      'Each site fixture records delivered controls, lost bytes, retry bytes, skipped controls, payload size, directional skew, and round-trip latency'
    )
    expect(html).toContain('Provider gate')
    expect(html).toContain('4 providers')
    expect(html).toContain(
      'YouTube, AnimePahe, Cineby, and Miruro each keep their own multi-fixture loss, retry, skipped-control, directional-skew, and latency proof'
    )
    expect(html).toContain('Buddy e2e gate')
    expect(html).toContain('4 site lanes')
    expect(html).toContain(
      'Two browser pages queue, pause, resume, seek, advance, and sync YouTube, AnimePahe, Cineby, and Miruro before merge'
    )
    expect(html).toContain('data-merge-gate-metric="browser-pair-matrix"')
    expect(html).toContain('Merge command')
    expect(html).toContain('unit + dual e2e')
    expect(html).toContain(
      'The default test command runs unit checks, broadcast e2e, and isolated live e2e before merge'
    )
    expect(html).toContain('data-merge-gate-metric="merge-command"')
    expect(html).toContain('Trace gate')
    expect(html).toContain('64 recent frames')
    expect(html).toContain('bounded sent, received, state, and error observations')
    expect(html).toContain('Cat-side cue')
    expect(html).toContain('Rabbit-side hop')
    expect(html).toContain('Zero-byte-loss controls')
    expect(html).toContain('No skipped controls')
    expect(html).toContain(`${STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS}ms best mock RT`)
    expect(html).toContain(`${STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS}ms lab round trip`)
    expect(html).toContain(`${STREAMING_SITE_CONNECTION_PROFILE_MAX_QUEUED_BYTES}B queue cap`)
    expect(html).toContain('Jitter-guarded frames')
    expect(html).toContain('Reliable retry guard')
    expect(html).toContain('Observable trace cap')
    expect(html).toContain('Merge-ready e2e')
    expect(html).toContain('Happy sync glow')
    expect(html).toContain('Cozy command bar')
    expect(html).toContain('Best next tap')
    expect(html).toContain('id="runtime_readiness_meter"')
    expect(html).toContain('data-readiness-state="next"')
    expect(html).toContain('data-readiness-state="waiting"')
    expect(html).toContain('>Source</b>')
    expect(html).toContain('>Invite</b>')
    expect(html).toContain('>Buddy</b>')
    expect(html).toContain('>Play</b>')
    expect(html).toContain('data-streaming-proof="byte-loss"')
    expect(html).toContain('data-byte-loss-rate="0"')
    expect(html).toContain(
      `data-round-trip-p95-budget-ms="${STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS}"`
    )
    expect(html).toContain(
      `data-best-round-trip-ms="${STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS}"`
    )
    expect(html).toContain(`data-site-count="${STREAMING_SITE_CONNECTION_FIXTURES.length}"`)
    expect(html).toContain(
      `data-provider-coverage="YouTube x16 / AnimePahe x13 / Cineby x14 / Miruro x12 / generic x3"`
    )
    expect(html).toContain(`data-profile-count="${STREAMING_SITE_CONNECTION_PROFILES.length}"`)
    expect(html).toContain(`data-trial-count="${STREAMING_SITE_CONNECTION_TRIAL_COUNT}"`)
    expect(html).toContain('data-connection-lab-proof="site-matrix"')
    expect(html).toContain('data-provider-count="4"')
    expect(html).toContain(
      `data-queue-byte-cap="${STREAMING_SITE_CONNECTION_PROFILE_MAX_QUEUED_BYTES}"`
    )
    expect(html).toContain('data-trace-cap="64"')
    expect(html).toContain('data-zero-loss-required="true"')
    expect(html).toContain('data-merge-gate-metric="byte-loss"')
    expect(html).toContain('data-merge-gate-value="0%"')
    expect(html).toContain('data-merge-gate-metric="provider-lost-bytes"')
    expect(html).toContain('data-merge-gate-value="0B"')
    expect(html).toContain('data-merge-gate-metric="two-way-delivery"')
    expect(html).toContain('data-merge-gate-value="both ways"')
    expect(html).toContain('Every site fixture must deliver guest commands and host events')
    expect(html).toContain('data-merge-gate-metric="queue-byte-pressure"')
    expect(html).toContain('fast paths cannot hide byte-pressure buffering')
    expect(html).toContain('data-merge-gate-metric="trace-cap"')
    expect(html).toContain('Paste source')
    expect(html).toContain('href="#runtime-add-media-url"')
    expect(html).toContain('href="#runtime_invite_panel"')
    expect(html).toContain('href="#runtime_playback_controls"')
    expect(html).toContain('id="runtime_invite_panel"')
    expect(html).toContain('id="runtime_playback_controls"')
    expect(html).toContain('id="runtime_pair_guide"')
    expect(html).toContain('Pair guide')
    expect(html).toContain('Cat cue')
    expect(html).toContain('Rabbit cue')
    expect(html).toContain('Together cue')
    expect(html).toContain('Pick the exact source')
    expect(html).toContain('Press play when both seats feel ready')
    expect(html).toContain('Tonight dashboard')
    expect(html).toContain('Choose a first stream')
    expect(html).toContain('Guest seat')
    expect(html).toContain('0 picks queued')
    expect(html).toContain('Waiting for play')
    expect(html).toContain('Tonight launchpad')
    expect(html).toContain('0/4 ready')
    expect(html).toContain('Next best move')
    expect(html).toContain('Pick the first source')
    expect(html).toContain('data-next-launch-state="next"')
    expect(html).toContain('Buddy passport')
    expect(html).toContain('Rabbit seat saved')
    expect(html).toContain('Two seats only')
    expect(html).toContain('Same source, local load')
    expect(html).toContain('Next tap stays visible')
    expect(html).toContain('Send one private invite')
    expect(html).toContain('Wait for rabbit-side')
    expect(html).toContain('Press play when ready')
    expect(html).toContain('data-launch-state="next"')
    expect(html).toContain('Warming up')
    expect(html).toContain('Cat-side: Host')
    expect(html).toContain('Rabbit-side: Waiting for rabbit-side guest...')
    expect(html).toContain('Invite your watch buddy')
    expect(html).toContain('Copy the full invite link first')
    expect(html).toContain('data-invite-description="true"')
    expect(html).toContain('Pick the next cozy stream')
    expect(html).toContain('URL Safety Results')
    expect(html).toContain('Pick a cozy first stream')
    expect(html).toContain(
      'Shorthand links like youtube.com/watch get https:// added automatically'
    )
    expect(html).toContain('Host-led playback')
    expect(html).toContain('Guest follows clearly')
    expect(html).toContain('Zero video-byte sharing')
    expect(html).toContain('Low-latency control lane')
    expect(html).toContain('Adapter warming')
    expect(html).toContain('data-playback-adapter-kind="warming"')
    expect(html).toContain('Heartbeat clock check warms up after rabbit joins')
    expect(html).toContain('data-clock-sync-state="warming"')
    expect(html).toContain('id="runtime_site_handoff"')
    expect(html).toContain('Website opens locally')
    expect(html).toContain('Popup fallback ready')
    expect(html).toContain('Only controls sync')
    expect(html).toContain('Recovered drops stay ordered')
    expect(html).toContain('retries transient control drops as latency')
    expect(html).toContain('Sync controls')
    expect(html).toContain('Rewind 10s')
    expect(html).toContain('Fast forward 10s')
    expect(html).toContain('Queue a source first')
    expect(html).toContain('without sharing video bytes')
    expect(html).toContain('Sync check')
    expect(html).toContain('syncs only the tiny control stream')
    expect(html).toContain('typed commands')
    expect(html).toContain('All quiet. The room is cozy.')
    expect((html.match(/>Copy</g) || []).length).toBe(3)
  })
})

describe('createRuntimeSessionShellRouteBoundary', () => {
  it('starts a route-owned host runtime and projects the host session snapshot', async () => {
    const boundary = createRuntimeSessionShellRouteBoundary('room-123', {
      createTransportPair: createRouteTransportPair,
      now: () => 1000
    })

    try {
      await boundary.start()
      const snapshot = boundary.store.getSnapshot()

      expect(snapshot.session.roomId).toBe('room-123')
      expect(snapshot.session.status).toBe('hosting')
      expect(snapshot.session.participants.host.username).toBe('Host')
      expect(snapshot.systemErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'runtime-shell-local-only'
          })
        ])
      )
    } finally {
      boundary.dispose()
    }
  })

  it('disposes route runtime resources once on repeated boundary disposal', async () => {
    const transportPair = createInMemoryPeerTransportPair<
      ClientToHostWireEnvelope,
      HostToClientWireEnvelope
    >({
      hostPeerId: 'host-peer',
      guestPeerId: 'guest-peer',
      hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
      guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
      now: () => 2000
    })
    const guestDisposeSpy = jest.spyOn(transportPair.guest, 'dispose')
    const runtimeDisposeSpy = jest.fn()
    const startHostSessionSpy = jest.fn(async () => undefined)
    const unsubscribeSpy = jest.fn()

    const runtimeProjection: SessionRuntimeProjection = {
      role: 'host',
      lifecycle: 'idle',
      transportState: transportPair.host.getState(),
      diagnostics: [],
      runtimeErrors: []
    }

    const runtime: RuntimeSession = {
      getSnapshot(): SessionRuntimeProjection {
        return runtimeProjection
      },
      getProjectionStore() {
        return createProjectionStore(runtimeProjection)
      },
      subscribeToSnapshots(): () => void {
        return unsubscribeSpy
      },
      startHostSession: startHostSessionSpy,
      startGuestSession: async () => undefined,
      dispatchHostCommand: async (_command: HostSessionCommand) => undefined,
      dispatchGuestCommand: async (_command: ClientCommand) => undefined,
      dispose: runtimeDisposeSpy
    }

    const boundary = createRuntimeSessionShellRouteBoundary('room-456', {
      createRuntime: (_deps: SessionRuntimeDependencies) => runtime,
      createPlaybackEngine: () => new FakePlaybackEngine(),
      createTransportPair: () => transportPair
    })

    await boundary.start()
    boundary.dispose()
    boundary.dispose()

    expect(startHostSessionSpy).toHaveBeenCalledWith({
      roomId: 'room-456',
      hostUsername: 'Host',
      inviteSecret: 'runtime-route-local:room-456'
    })
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1)
    expect(runtimeDisposeSpy).toHaveBeenCalledTimes(1)
    expect(guestDisposeSpy).toHaveBeenCalledTimes(1)
  })

  it('dispatches URL media additions through the runtime command path', async () => {
    const transportPair = createRouteTransportPair(() => 3000)
    const dispatchHostCommandSpy = jest.fn(async (_command: HostSessionCommand) => undefined)
    const runtimeProjection: SessionRuntimeProjection = {
      role: 'host',
      lifecycle: 'running',
      transportState: transportPair.host.getState(),
      diagnostics: [],
      runtimeErrors: []
    }
    const runtime: RuntimeSession = {
      getSnapshot(): SessionRuntimeProjection {
        return runtimeProjection
      },
      getProjectionStore() {
        return createProjectionStore(runtimeProjection)
      },
      subscribeToSnapshots(): () => void {
        return () => undefined
      },
      startHostSession: async () => undefined,
      startGuestSession: async () => undefined,
      dispatchHostCommand: dispatchHostCommandSpy,
      dispatchGuestCommand: async (_command: ClientCommand) => undefined,
      dispose: jest.fn()
    }

    const boundary = createRuntimeSessionShellRouteBoundary('room-789', {
      createRuntime: (_deps: SessionRuntimeDependencies) => runtime,
      createPlaybackEngine: () => new FakePlaybackEngine(),
      createTransportPair: () => transportPair,
      now: () => 3000
    })

    try {
      await boundary.start()
      boundary.addMediaUrl('https://example.com/movie.mp4')

      expect(dispatchHostCommandSpy).toHaveBeenCalledWith({
        type: 'addMedia',
        media: {
          mediaId: 'runtime-media-3000-1',
          kind: 'url',
          source: 'https://example.com/movie.mp4',
          title: 'movie.mp4'
        }
      })
    } finally {
      boundary.dispose()
    }
  })

  it('dispatches supported streaming-site URLs with friendly website titles', async () => {
    const transportPair = createRouteTransportPair(() => 3100)
    const dispatchHostCommandSpy = jest.fn(async (_command: HostSessionCommand) => undefined)
    const runtimeProjection: SessionRuntimeProjection = {
      role: 'host',
      lifecycle: 'running',
      transportState: transportPair.host.getState(),
      diagnostics: [],
      runtimeErrors: []
    }
    const runtime: RuntimeSession = {
      getSnapshot(): SessionRuntimeProjection {
        return runtimeProjection
      },
      getProjectionStore() {
        return createProjectionStore(runtimeProjection)
      },
      subscribeToSnapshots(): () => void {
        return () => undefined
      },
      startHostSession: async () => undefined,
      startGuestSession: async () => undefined,
      dispatchHostCommand: dispatchHostCommandSpy,
      dispatchGuestCommand: async (_command: ClientCommand) => undefined,
      dispose: jest.fn()
    }

    const boundary = createRuntimeSessionShellRouteBoundary('room-sites', {
      createRuntime: (_deps: SessionRuntimeDependencies) => runtime,
      createPlaybackEngine: () => new FakePlaybackEngine(),
      createTransportPair: () => transportPair,
      now: () => 3100
    })

    try {
      await boundary.start()
      boundary.addMediaUrl('https://www.youtube.com/watch?v=honeystream-demo')
      boundary.addMediaUrl('https://animepahe.ru/play/honeystream-demo')
      boundary.addMediaUrl('https://cineby.app/movie/honeystream-demo')
      boundary.addMediaUrl('https://miruro.to/watch/honeystream-demo')

      expect(dispatchHostCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          media: expect.objectContaining({
            kind: 'website',
            title: 'YouTube watch page'
          })
        })
      )
      expect(dispatchHostCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          media: expect.objectContaining({
            kind: 'website',
            title: 'AnimePahe watch page'
          })
        })
      )
      expect(dispatchHostCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          media: expect.objectContaining({
            kind: 'website',
            title: 'Cineby watch page'
          })
        })
      )
      expect(dispatchHostCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          media: expect.objectContaining({
            kind: 'website',
            title: 'Miruro watch page'
          })
        })
      )
    } finally {
      boundary.dispose()
    }
  })

  it('normalizes shorthand URL media additions before dispatching them', async () => {
    const transportPair = createRouteTransportPair(() => 3500)
    const dispatchHostCommandSpy = jest.fn(async (_command: HostSessionCommand) => undefined)
    const runtimeProjection: SessionRuntimeProjection = {
      role: 'host',
      lifecycle: 'running',
      transportState: transportPair.host.getState(),
      diagnostics: [],
      runtimeErrors: []
    }
    const runtime: RuntimeSession = {
      getSnapshot(): SessionRuntimeProjection {
        return runtimeProjection
      },
      getProjectionStore() {
        return createProjectionStore(runtimeProjection)
      },
      subscribeToSnapshots(): () => void {
        return () => undefined
      },
      startHostSession: async () => undefined,
      startGuestSession: async () => undefined,
      dispatchHostCommand: dispatchHostCommandSpy,
      dispatchGuestCommand: async (_command: ClientCommand) => undefined,
      dispose: jest.fn()
    }

    const boundary = createRuntimeSessionShellRouteBoundary('room-shorthand', {
      createRuntime: (_deps: SessionRuntimeDependencies) => runtime,
      createPlaybackEngine: () => new FakePlaybackEngine(),
      createTransportPair: () => transportPair,
      now: () => 3500
    })

    try {
      await boundary.start()
      boundary.addMediaUrl('youtube.com/watch?v=honeystream-demo')

      expect(dispatchHostCommandSpy).toHaveBeenCalledWith({
        type: 'addMedia',
        media: {
          mediaId: 'runtime-media-3500-1',
          kind: 'website',
          source: 'https://youtube.com/watch?v=honeystream-demo',
          title: 'YouTube watch page'
        }
      })
    } finally {
      boundary.dispose()
    }
  })

  it('dispatches host local-file media additions through the runtime command path', async () => {
    const transportPair = createRouteTransportPair(() => 4000)
    const dispatchHostCommandSpy = jest.fn(async (_command: HostSessionCommand) => undefined)
    const runtimeProjection: SessionRuntimeProjection = {
      role: 'host',
      lifecycle: 'running',
      transportState: transportPair.host.getState(),
      diagnostics: [],
      runtimeErrors: []
    }
    const runtime: RuntimeSession = {
      getSnapshot(): SessionRuntimeProjection {
        return runtimeProjection
      },
      getProjectionStore() {
        return createProjectionStore(runtimeProjection)
      },
      subscribeToSnapshots(): () => void {
        return () => undefined
      },
      startHostSession: async () => undefined,
      startGuestSession: async () => undefined,
      dispatchHostCommand: dispatchHostCommandSpy,
      dispatchGuestCommand: async (_command: ClientCommand) => undefined,
      dispose: jest.fn()
    }

    const boundary = createRuntimeSessionShellRouteBoundary('room-local', {
      createRuntime: (_deps: SessionRuntimeDependencies) => runtime,
      createPlaybackEngine: () => new FakeLocalFilePlaybackEngine(),
      createTransportPair: () => transportPair,
      now: () => 4000
    })

    try {
      await boundary.start()
      boundary.addLocalFile(new TestFile())

      expect(dispatchHostCommandSpy).toHaveBeenCalledWith({
        type: 'addMedia',
        media: {
          mediaId: 'runtime-media-4000-1',
          kind: 'localFile',
          source: 'honeystream-local://local-key',
          title: 'local-movie.mp4'
        }
      })
    } finally {
      boundary.dispose()
    }
  })
})
