import { TransportMessageValidator } from './contracts'
import { createSimulatedPeerTransportPair } from './simulated-peer-transport-pair'

type ClientToHostMessage = {
  readonly type: 'ping'
  readonly nonce: number
}

type HostToClientMessage = {
  readonly type: 'pong'
  readonly nonce: number
}

type UnknownRecord = { readonly [key: string]: unknown }

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const clientToHostValidator: TransportMessageValidator<ClientToHostMessage> = {
  validate: (value: unknown): value is ClientToHostMessage =>
    isUnknownRecord(value) &&
    value.type === 'ping' &&
    typeof value.nonce === 'number' &&
    value.nonce >= 0,
  describeInvalidMessage: () => 'Expected ping message.'
}

const hostToClientValidator: TransportMessageValidator<HostToClientMessage> = {
  validate: (value: unknown): value is HostToClientMessage =>
    isUnknownRecord(value) &&
    value.type === 'pong' &&
    typeof value.nonce === 'number' &&
    value.nonce >= 0,
  describeInvalidMessage: () => 'Expected pong message.'
}

describe('simulated peer transport observability', () => {
  it('records recent sent, delivered, and dropped frame samples', async () => {
    let nowMs = 1000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: { latencyMs: 25, dropEveryNthMessage: 2 }
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    pair.guest.send({ seq: 2, sentAtMs: nowMs, message: { type: 'ping', nonce: 2 } })
    nowMs += 25
    pair.flushAll()

    expect(pair.guest.getMetrics().recentFrames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'sent', seq: 1, recordedAtMs: 1000 }),
        expect.objectContaining({ outcome: 'dropped', seq: 2, reason: 'network-drop' })
      ])
    )
    expect(pair.host.getMetrics().recentFrames).toEqual([
      expect.objectContaining({ outcome: 'delivered', seq: 1, latencyMs: 25, recordedAtMs: 1025 })
    ])
    expect(pair.getAggregateMetrics().recentFrames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'sent', seq: 1 }),
        expect.objectContaining({ outcome: 'delivered', seq: 1 }),
        expect.objectContaining({ outcome: 'dropped', seq: 2 })
      ])
    )
  })

  it('keeps recent mock-frame samples bounded for connection tuning', async () => {
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => 7000,
      network: { latencyMs: 0 }
    })

    await pair.host.connect()

    for (let nonce = 1; nonce <= 70; nonce += 1) {
      pair.guest.send({ seq: nonce, sentAtMs: 7000, message: { type: 'ping', nonce } })
    }

    pair.flushAll()

    const senderFrames = pair.guest.getMetrics().recentFrames
    const aggregateFrames = pair.getAggregateMetrics().recentFrames
    expect(senderFrames).toHaveLength(64)
    expect(senderFrames[0]).toEqual(expect.objectContaining({ outcome: 'sent', seq: 7 }))
    expect(senderFrames[63]).toEqual(expect.objectContaining({ outcome: 'sent', seq: 70 }))
    expect(aggregateFrames.length).toBeLessThanOrEqual(128)
    expect(aggregateFrames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'delivered', seq: 70, latencyMs: 0 })
      ])
    )
  })

  it('bounds queued simulated frames and clears them on dispose', async () => {
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      network: { latencyMs: 1000, maxQueuedFrames: 1 }
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: 3000, message: { type: 'ping', nonce: 1 } })
    pair.guest.send({ seq: 2, sentAtMs: 3000, message: { type: 'ping', nonce: 2 } })

    expect(pair.host.getMetrics().queuedMessages).toBe(1)
    expect(pair.host.getMetrics().peakQueuedMessages).toBe(1)
    expect(pair.guest.getMetrics().droppedMessages).toBe(1)

    pair.host.dispose()

    expect(pair.host.getMetrics().queuedMessages).toBe(0)
    expect(pair.host.getState().status).toBe('disposed')
  })
})
