import { PROTOCOL_VERSION } from '../../protocol'
import { createFakeClock, createFixedIdGenerator } from './index'
import { createFakeTransportPair } from './fake-transport'

describe('architecture fake transport', () => {
  it('relays validated host and guest wire envelopes with deterministic IDs and clocks', async () => {
    const clock = createFakeClock(200)
    const peerIds = createFixedIdGenerator(['host-peer', 'guest-peer'])
    const pair = createFakeTransportPair({
      hostPeerId: peerIds.next(),
      guestPeerId: peerIds.next(),
      now: clock.nowMs
    })

    const hostCommands: string[] = []
    const guestEvents: string[] = []

    pair.host.subscribe(event => {
      if (event.type === 'message') {
        hostCommands.push(event.delivery.envelope.message.command.type)
      }
    })

    pair.guest.subscribe(event => {
      if (event.type === 'message') {
        guestEvents.push(event.delivery.envelope.message.event.type)
      }
    })

    await pair.host.connect()

    pair.guest.send({
      seq: 1,
      sentAtMs: clock.nowMs(),
      message: {
        version: PROTOCOL_VERSION,
        seq: 1,
        sentAtMs: clock.nowMs(),
        direction: 'client-to-host',
        command: {
          type: 'requestSnapshot',
          reason: 'manual'
        }
      }
    })

    clock.advanceBy(25)
    pair.host.send({
      seq: 2,
      sentAtMs: clock.nowMs(),
      message: {
        version: PROTOCOL_VERSION,
        seq: 2,
        sentAtMs: clock.nowMs(),
        direction: 'host-to-client',
        event: {
          type: 'participantLeft',
          peerId: 'guest-peer'
        }
      }
    })

    expect(hostCommands).toEqual(['requestSnapshot'])
    expect(guestEvents).toEqual(['participantLeft'])
    expect(pair.host.getState().status).toBe('connected')
    expect(pair.guest.getState().status).toBe('connected')
  })
})
