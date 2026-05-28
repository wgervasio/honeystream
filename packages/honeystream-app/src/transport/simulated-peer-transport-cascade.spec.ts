import { TransportMessageValidator } from './contracts'
import { createSimulatedPeerTransportPair } from './simulated-peer-transport-pair'

type ClientToHostMessage = { readonly type: 'ping'; readonly nonce: number }
type HostToClientMessage = { readonly type: 'pong'; readonly nonce: number }
type UnknownRecord = { readonly [key: string]: unknown }

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const clientToHostValidator: TransportMessageValidator<ClientToHostMessage> = {
  validate: (value: unknown): value is ClientToHostMessage =>
    isUnknownRecord(value) &&
    value.type === 'ping' &&
    typeof value.nonce === 'number' &&
    value.nonce >= 0
}

const hostToClientValidator: TransportMessageValidator<HostToClientMessage> = {
  validate: (value: unknown): value is HostToClientMessage =>
    isUnknownRecord(value) &&
    value.type === 'pong' &&
    typeof value.nonce === 'number' &&
    value.nonce >= 0
}

describe('simulated peer transport cascaded replies', () => {
  it('uses delivery time while draining cascaded mock connection replies', async () => {
    let nowMs = 7000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: { latencyMs: 12 }
    })
    const hostMessages: ClientToHostMessage[] = []
    const guestMessages: HostToClientMessage[] = []

    pair.host.subscribe(event => {
      if (event.type !== 'message') return
      const message = event.delivery.envelope.message
      hostMessages.push(message)
      pair.host.send({
        seq: 100 + message.nonce,
        sentAtMs: event.delivery.receivedAtMs,
        message: { type: 'pong', nonce: message.nonce }
      })
    })
    pair.guest.subscribe(event => {
      if (event.type !== 'message') return
      const message = event.delivery.envelope.message
      guestMessages.push(message)
      if (message.nonce === 1) {
        pair.guest.send({
          seq: 2,
          sentAtMs: event.delivery.receivedAtMs,
          message: { type: 'ping', nonce: 2 }
        })
      }
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })

    expect(pair.flushAll()).toBe(4)
    expect(hostMessages).toEqual([{ type: 'ping', nonce: 1 }, { type: 'ping', nonce: 2 }])
    expect(guestMessages).toEqual([{ type: 'pong', nonce: 1 }, { type: 'pong', nonce: 2 }])
    expect(pair.host.getMetrics().recentFrames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'sent', seq: 101, recordedAtMs: 7012 }),
        expect.objectContaining({ outcome: 'delivered', seq: 2, recordedAtMs: 7036 })
      ])
    )
    expect(pair.guest.getMetrics().recentFrames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'delivered', seq: 101, recordedAtMs: 7024 }),
        expect.objectContaining({ outcome: 'delivered', seq: 102, recordedAtMs: 7048 })
      ])
    )
    expect(pair.getAggregateMetrics().estimatedRoundTripMaxLatencyMs).toBe(24)
    expect(pair.getAggregateMetrics().combinedQueuedMessages).toBe(0)
  })
})
