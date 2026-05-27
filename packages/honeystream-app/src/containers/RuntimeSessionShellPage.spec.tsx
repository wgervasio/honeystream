import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RouteComponentProps } from 'react-router'
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

describe('RuntimeSessionShellPage', () => {
  it('renders route-owned runtime session shell details for the lobby route', () => {
    const html = renderToStaticMarkup(<RuntimeSessionShellPage {...createRouteProps('room-123')} />)

    expect(html).toContain('Runtime session shell')
    expect(html).toContain('Cozy watch room for two')
    expect(html).toContain('Lobby: room-123')
    expect(html).toContain('Room warming up')
    expect(html).toContain('Cat-side host: Host')
    expect(html).toContain('Rabbit-side guest: Waiting for your watch buddy')
    expect(html).toContain('host/local only')
  })
})

describe('createRuntimeSessionShellRouteBoundary', () => {
  it('starts a route-owned host runtime and projects the host session snapshot', async () => {
    const boundary = createRuntimeSessionShellRouteBoundary('room-123', {
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
})
