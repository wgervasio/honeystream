import {
  PlaybackEngineApplyResult,
  PlaybackEngineDesiredState
} from 'playback/engine/playbackEngineContract'
import { ClientToHostEnvelope, MediaSnapshot, PROTOCOL_VERSION } from 'protocol/types'
import { TransportMessageValidator } from 'transport/contracts'
import { createInMemoryPeerTransportPair } from 'transport/in-memory-peer-transport-pair'
import { SessionRuntimePlaybackEngine } from './contracts'
import { createSessionRuntime } from './sessionRuntime'

class FakePlaybackEngine implements SessionRuntimePlaybackEngine {
  readonly desiredStates: PlaybackEngineDesiredState[] = []
  disposeCallCount = 0

  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackEngineApplyResult> {
    this.desiredStates.push(desiredState)
    return {
      adapterCreated: false,
      mediaChanged: false,
      adapterDisposed: false,
      seekToleranceMs: 250,
      appliedPlayback: desiredState.playback
    }
  }

  dispose(): void {
    this.disposeCallCount += 1
  }
}

class FailingPlaybackEngine extends FakePlaybackEngine {
  private applyCount = 0

  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackEngineApplyResult> {
    this.applyCount += 1
    if (this.applyCount === 1) {
      return super.applyDesiredState(desiredState)
    }

    this.desiredStates.push(desiredState)
    throw new Error('Playback target unavailable.')
  }
}

const acceptsUnknownMessage: TransportMessageValidator<unknown> = {
  validate(_value: unknown): _value is unknown {
    return true
  }
}

const createMedia = (mediaId: string): MediaSnapshot => ({
  mediaId,
  kind: 'url',
  source: `https://example.com/${mediaId}.mp4`,
  title: mediaId,
  durationMs: 120000
})

const flushRuntime = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('runtime/session/SessionRuntime', () => {
  it('starts host runtime and dispatches local host commands', async () => {
    let nowMs = 1000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage
    })
    const hostPlayback = new FakePlaybackEngine()
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: hostPlayback,
      now: () => nowMs++
    })

    await hostRuntime.startHostSession({
      roomId: 'room-1',
      hostUsername: 'Host',
      inviteSecret: 'invite-secret'
    })
    await hostRuntime.dispatchHostCommand({
      type: 'addMedia',
      media: createMedia('media-1')
    })

    const projection = hostRuntime.getSnapshot()
    expect(projection.role).toBe('host')
    expect(projection.lifecycle).toBe('running')
    expect(projection.session && projection.session.currentMediaId).toBe('media-1')
    expect(hostPlayback.desiredStates).toHaveLength(2)
    expect(hostPlayback.desiredStates[1].media).toEqual({
      mediaId: 'media-1',
      source: 'direct-media',
      url: 'https://example.com/media-1.mp4'
    })
  })

  it('dispatches guest commands to host through transport and updates projections', async () => {
    let nowMs = 3000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage
    })

    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: new FakePlaybackEngine(),
      now: () => nowMs++
    })
    const guestRuntime = createSessionRuntime({
      transport: pair.guest,
      playback: new FakePlaybackEngine(),
      now: () => nowMs++
    })

    await hostRuntime.startHostSession({
      roomId: 'room-1',
      hostUsername: 'Host',
      inviteSecret: 'invite-secret'
    })
    await guestRuntime.startGuestSession({
      roomId: 'room-1',
      username: 'Guest',
      inviteSecret: 'invite-secret'
    })
    await flushRuntime()

    const joinedHostSession = hostRuntime.getSnapshot().session
    expect(joinedHostSession).toBeDefined()
    if (!joinedHostSession) {
      throw new Error('Expected host projection session after guest join.')
    }
    expect(joinedHostSession.participants.guest).toBeDefined()

    await guestRuntime.dispatchGuestCommand({
      type: 'addMedia',
      media: createMedia('media-guest')
    })
    await flushRuntime()

    const hostSession = hostRuntime.getSnapshot().session
    const guestSession = guestRuntime.getSnapshot().session
    expect(hostSession).toBeDefined()
    expect(guestSession).toBeDefined()
    if (!hostSession || !guestSession) {
      throw new Error('Expected host and guest session snapshots after guest addMedia command.')
    }
    expect(hostSession.currentMediaId).toBe('media-guest')
    expect(guestSession.currentMediaId).toBe('media-guest')
    expect(guestSession.current).toEqual(createMedia('media-guest'))
  })

  it('records protocol diagnostics for malformed inbound envelopes', async () => {
    let nowMs = 5000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage
    })
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: new FakePlaybackEngine(),
      now: () => nowMs++
    })

    await hostRuntime.startHostSession({
      roomId: 'room-1',
      hostUsername: 'Host',
      inviteSecret: 'invite-secret'
    })

    pair.guest.send({
      seq: 1,
      sentAtMs: 9000,
      message: 'bad-envelope'
    })
    await flushRuntime()

    const projection = hostRuntime.getSnapshot()
    expect(projection.diagnostics).toHaveLength(1)
    expect(projection.diagnostics[0].code).toBe('invalidEnvelope')
  })

  it('rejects skipped inbound command sequences without applying stale commands', async () => {
    let nowMs = 6000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage
    })
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: new FakePlaybackEngine(),
      now: () => nowMs++
    })
    const guestRuntime = createSessionRuntime({
      transport: pair.guest,
      playback: new FakePlaybackEngine(),
      now: () => nowMs++
    })

    await hostRuntime.startHostSession({
      roomId: 'room-1',
      hostUsername: 'Host',
      inviteSecret: 'invite-secret'
    })
    await guestRuntime.startGuestSession({
      roomId: 'room-1',
      username: 'Guest',
      inviteSecret: 'invite-secret'
    })
    await flushRuntime()

    const skippedCommand: ClientToHostEnvelope = {
      version: PROTOCOL_VERSION,
      direction: 'client-to-host',
      seq: 3,
      sentAtMs: nowMs,
      command: {
        type: 'addMedia',
        media: createMedia('skipped-media')
      }
    }
    pair.guest.send({
      seq: skippedCommand.seq,
      sentAtMs: skippedCommand.sentAtMs,
      message: skippedCommand
    })
    await flushRuntime()

    let hostProjection = hostRuntime.getSnapshot()
    expect(hostProjection.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalidSequence'
        })
      ])
    )
    expect(hostProjection.session && hostProjection.session.currentMediaId).toBeUndefined()

    const recoveredCommand: ClientToHostEnvelope = {
      ...skippedCommand,
      seq: 4,
      sentAtMs: nowMs,
      command: {
        type: 'addMedia',
        media: createMedia('recovered-media')
      }
    }
    pair.guest.send({
      seq: recoveredCommand.seq,
      sentAtMs: recoveredCommand.sentAtMs,
      message: recoveredCommand
    })
    await flushRuntime()

    hostProjection = hostRuntime.getSnapshot()
    expect(hostProjection.session && hostProjection.session.currentMediaId).toBe('recovered-media')
  })

  it('keeps host snapshots moving when playback application fails', async () => {
    let nowMs = 9000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage
    })
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: new FailingPlaybackEngine(),
      now: () => nowMs++
    })
    const guestRuntime = createSessionRuntime({
      transport: pair.guest,
      playback: new FakePlaybackEngine(),
      now: () => nowMs++
    })

    await hostRuntime.startHostSession({
      roomId: 'room-1',
      hostUsername: 'Host',
      inviteSecret: 'invite-secret'
    })
    await guestRuntime.startGuestSession({
      roomId: 'room-1',
      username: 'Guest',
      inviteSecret: 'invite-secret'
    })
    await flushRuntime()

    await guestRuntime.dispatchGuestCommand({
      type: 'addMedia',
      media: {
        ...createMedia('guest-local'),
        kind: 'localFile',
        source: 'honeystream-local://guest-local'
      }
    })
    await flushRuntime()
    const hostSession = hostRuntime.getSnapshot().session
    const guestSession = guestRuntime.getSnapshot().session
    expect(hostSession && hostSession.currentMediaId).toBe('guest-local')
    expect(guestSession && guestSession.currentMediaId).toBe('guest-local')
    expect(hostRuntime.getSnapshot().runtimeErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('Playback target unavailable.')])
    )
  })

  it('disposes runtime resources and rejects commands after disposal', async () => {
    let nowMs = 7000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage
    })
    const hostPlayback = new FakePlaybackEngine()
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: hostPlayback,
      now: () => nowMs++
    })

    await hostRuntime.startHostSession({
      roomId: 'room-1',
      hostUsername: 'Host',
      inviteSecret: 'invite-secret'
    })

    hostRuntime.dispose()
    hostRuntime.dispose()

    expect(pair.host.getState().status).toBe('disposed')
    expect(hostPlayback.disposeCallCount).toBe(1)
    await expect(
      hostRuntime.dispatchHostCommand({
        type: 'next'
      })
    ).rejects.toThrow('[disposed]')
  })
})
