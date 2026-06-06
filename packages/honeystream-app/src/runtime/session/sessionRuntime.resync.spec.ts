import {
  PlaybackEngineApplyResult,
  PlaybackEngineDesiredState
} from 'playback/engine/playbackEngineContract'
import {
  ClientToHostEnvelope,
  HostToClientEnvelope,
  PROTOCOL_VERSION,
  ProtocolError
} from 'protocol/types'
import { parseWireEnvelope } from 'protocol'
import { TransportMessageValidator } from 'transport/contracts'
import { createInMemoryPeerTransportPair } from 'transport/in-memory-peer-transport-pair'
import { SessionRuntimePlaybackEngine } from './contracts'
import { createSessionRuntime } from './sessionRuntime'

class FakePlaybackEngine implements SessionRuntimePlaybackEngine {
  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackEngineApplyResult> {
    return {
      adapterCreated: false,
      mediaChanged: false,
      adapterDisposed: false,
      seekToleranceMs: 250,
      appliedPlayback: desiredState.playback
    }
  }

  dispose(): void {}
}

const acceptsUnknownMessage: TransportMessageValidator<unknown> = {
  validate(_value: unknown): _value is unknown {
    return true
  }
}

const flushRuntime = async (): Promise<void> => {
  for (let pass = 0; pass < 8; pass += 1) {
    await Promise.resolve()
  }
}

const createUnsupportedVersionError = (receivedVersion: number): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'unsupportedVersion',
  message: `Unsupported protocol version ${receivedVersion}. Expected ${PROTOCOL_VERSION}.`,
  receivedVersion,
  expectedVersion: PROTOCOL_VERSION
})

describe('runtime/session resync and protocol recovery', () => {
  it('requests a bounded guest snapshot resync when host event sequencing skips ahead', async () => {
    let nowMs = 10000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage,
      now: () => nowMs
    })
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: new FakePlaybackEngine(),
      now: () => nowMs
    })
    const guestRuntime = createSessionRuntime({
      transport: pair.guest,
      playback: new FakePlaybackEngine(),
      now: () => nowMs
    })
    const snapshotRequestTimes: number[] = []
    const unsubscribeHostProbe = pair.host.subscribe(event => {
      if (event.type !== 'message') return
      const parsed = parseWireEnvelope(event.delivery.envelope.message)
      if (!parsed.ok || parsed.value.direction !== 'client-to-host') return
      if (parsed.value.command.type === 'requestSnapshot') {
        snapshotRequestTimes.push(parsed.value.sentAtMs)
      }
    })

    try {
      await hostRuntime.startHostSession({
        roomId: 'resync-room',
        hostUsername: 'Host',
        inviteSecret: 'invite-secret'
      })
      await guestRuntime.startGuestSession({
        roomId: 'resync-room',
        username: 'Guest',
        inviteSecret: 'invite-secret'
      })
      await flushRuntime()

      const skippedHostEvent: HostToClientEnvelope = {
        version: PROTOCOL_VERSION,
        direction: 'host-to-client',
        seq: 4,
        sentAtMs: nowMs,
        event: {
          type: 'playbackChanged',
          playback: {
            state: 'playing',
            positionMs: 12000,
            updatedAtHostMs: nowMs,
            rate: 1
          }
        }
      }
      pair.host.send({
        seq: skippedHostEvent.seq,
        sentAtMs: skippedHostEvent.sentAtMs,
        message: skippedHostEvent
      })
      await flushRuntime()
      expect(snapshotRequestTimes).toEqual([nowMs])

      nowMs += 250
      pair.host.send({
        seq: 7,
        sentAtMs: nowMs,
        message: { ...skippedHostEvent, seq: 7, sentAtMs: nowMs }
      })
      await flushRuntime()
      expect(snapshotRequestTimes).toHaveLength(1)

      nowMs += 501
      pair.host.send({
        seq: 9,
        sentAtMs: nowMs,
        message: { ...skippedHostEvent, seq: 9, sentAtMs: nowMs }
      })
      await flushRuntime()

      expect(snapshotRequestTimes).toEqual([10000, 10751])
      expect(guestRuntime.getSnapshot().diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'invalidSequence' })])
      )

      const hostSnapshot = hostRuntime.getSnapshot().session
      if (!hostSnapshot) {
        throw new Error('Expected host snapshot for resync repair.')
      }
      const repairSnapshot: HostToClientEnvelope = {
        version: PROTOCOL_VERSION,
        direction: 'host-to-client',
        seq: 10,
        sentAtMs: nowMs,
        event: {
          type: 'snapshot',
          snapshot: hostSnapshot
        }
      }
      pair.host.send({
        seq: repairSnapshot.seq,
        sentAtMs: repairSnapshot.sentAtMs,
        message: repairSnapshot
      })
      await flushRuntime()

      expect(guestRuntime.getSnapshot().session).toMatchObject({
        roomId: 'resync-room',
        status: 'connected'
      })
    } finally {
      unsubscribeHostProbe()
      hostRuntime.dispose()
      guestRuntime.dispose()
    }
  })

  it('records wrong-direction envelopes at host and guest protocol boundaries', async () => {
    let nowMs = 20000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage,
      now: () => nowMs
    })
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: new FakePlaybackEngine(),
      now: () => nowMs
    })
    const guestRuntime = createSessionRuntime({
      transport: pair.guest,
      playback: new FakePlaybackEngine(),
      now: () => nowMs
    })

    try {
      await hostRuntime.startHostSession({
        roomId: 'direction-room',
        hostUsername: 'Host',
        inviteSecret: 'invite-secret'
      })
      await guestRuntime.startGuestSession({
        roomId: 'direction-room',
        username: 'Guest',
        inviteSecret: 'invite-secret'
      })
      await flushRuntime()

      const wrongHostInbound: HostToClientEnvelope = {
        version: PROTOCOL_VERSION,
        direction: 'host-to-client',
        seq: 99,
        sentAtMs: nowMs,
        event: {
          type: 'protocolRejected',
          error: createUnsupportedVersionError(2)
        }
      }
      pair.guest.send({
        seq: wrongHostInbound.seq,
        sentAtMs: wrongHostInbound.sentAtMs,
        message: wrongHostInbound
      })
      await flushRuntime()

      const wrongGuestInbound: ClientToHostEnvelope = {
        version: PROTOCOL_VERSION,
        direction: 'client-to-host',
        seq: 100,
        sentAtMs: nowMs,
        command: {
          type: 'requestSnapshot',
          reason: 'manual'
        }
      }
      pair.host.send({
        seq: wrongGuestInbound.seq,
        sentAtMs: wrongGuestInbound.sentAtMs,
        message: wrongGuestInbound
      })
      await flushRuntime()

      expect(hostRuntime.getSnapshot().diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'invalidDirection' })])
      )
      expect(guestRuntime.getSnapshot().diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'invalidDirection' })])
      )
    } finally {
      hostRuntime.dispose()
      guestRuntime.dispose()
    }
  })

  it('surfaces protocol version mismatch guidance from host rejection events', async () => {
    let nowMs = 30000
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: acceptsUnknownMessage,
      guestInboundValidator: acceptsUnknownMessage,
      now: () => nowMs
    })
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: new FakePlaybackEngine(),
      now: () => nowMs
    })
    const guestRuntime = createSessionRuntime({
      transport: pair.guest,
      playback: new FakePlaybackEngine(),
      now: () => nowMs
    })

    try {
      await hostRuntime.startHostSession({
        roomId: 'version-room',
        hostUsername: 'Host',
        inviteSecret: 'invite-secret'
      })
      await guestRuntime.startGuestSession({
        roomId: 'version-room',
        username: 'Guest',
        inviteSecret: 'invite-secret'
      })
      await flushRuntime()

      const rejection: HostToClientEnvelope = {
        version: PROTOCOL_VERSION,
        direction: 'host-to-client',
        seq: 3,
        sentAtMs: nowMs,
        event: {
          type: 'protocolRejected',
          error: createUnsupportedVersionError(2)
        }
      }
      pair.host.send({
        seq: rejection.seq,
        sentAtMs: rejection.sentAtMs,
        message: rejection
      })
      await flushRuntime()

      expect(guestRuntime.getSnapshot().diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'unsupportedVersion' })])
      )
      expect(guestRuntime.getSnapshot().runtimeErrors).toEqual(
        expect.arrayContaining([
          'Protocol version mismatch. Reload the room to reconnect safely.'
        ])
      )
    } finally {
      hostRuntime.dispose()
      guestRuntime.dispose()
    }
  })
})
