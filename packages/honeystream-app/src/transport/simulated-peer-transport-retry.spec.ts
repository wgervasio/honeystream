import { TransportMessageValidator } from './contracts'
import { evaluateSimulatedPeerTransportBudget } from './simulated-peer-transport-performance'
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

describe('simulated peer transport reliable retry', () => {
  it('models reliable retries as latency instead of application byte loss', async () => {
    let nowMs = 8400
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: {
        latencyMs: 4,
        dropEveryNthMessage: 2,
        retransmitDroppedFrames: true,
        retransmitDelayMs: 8
      }
    })
    const hostMessages: ClientToHostMessage[] = []
    const guestMessages: HostToClientMessage[] = []

    pair.host.subscribe(event => {
      if (event.type === 'message') hostMessages.push(event.delivery.envelope.message)
    })
    pair.guest.subscribe(event => {
      if (event.type === 'message') guestMessages.push(event.delivery.envelope.message)
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    pair.guest.send({ seq: 2, sentAtMs: nowMs, message: { type: 'ping', nonce: 2 } })
    pair.guest.send({ seq: 3, sentAtMs: nowMs, message: { type: 'ping', nonce: 3 } })
    pair.host.send({ seq: 1, sentAtMs: nowMs, message: { type: 'pong', nonce: 1 } })
    pair.host.send({ seq: 2, sentAtMs: nowMs, message: { type: 'pong', nonce: 2 } })
    pair.host.send({ seq: 3, sentAtMs: nowMs, message: { type: 'pong', nonce: 3 } })

    pair.flushAll()

    const metrics = pair.getAggregateMetrics()
    expect(hostMessages).toEqual([
      { type: 'ping', nonce: 1 },
      { type: 'ping', nonce: 2 },
      { type: 'ping', nonce: 3 }
    ])
    expect(guestMessages).toEqual([
      { type: 'pong', nonce: 1 },
      { type: 'pong', nonce: 2 },
      { type: 'pong', nonce: 3 }
    ])
    expect(metrics.combinedSentMessages).toBe(6)
    expect(metrics.combinedDeliveredMessages).toBe(6)
    expect(metrics.combinedDroppedMessages).toBe(0)
    expect(metrics.combinedRetransmittedMessages).toBe(2)
    expect(metrics.combinedRetransmittedBytes).toBeGreaterThan(0)
    expect(metrics.combinedRetransmissionRate).toBe(2 / 6)
    expect(metrics.maxDirectionalRetransmissionRate).toBe(1 / 3)
    expect(metrics.recentFrames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ direction: 'guest->host', outcome: 'retransmitted', seq: 2 }),
        expect.objectContaining({ direction: 'host->guest', outcome: 'retransmitted', seq: 2 })
      ])
    )
    expect(metrics.combinedOutOfOrderMessages).toBe(0)
    expect(metrics.combinedSequenceGapMessages).toBe(0)
    expect(metrics.combinedLostBytes).toBe(0)
    expect(metrics.combinedByteLossRate).toBe(0)
    expect(metrics.combinedMaxLatencyMs).toBe(12)
    expect(metrics.combinedP95LatencyMs).toBe(12)
    expect(evaluateSimulatedPeerTransportBudget(metrics)).toEqual({
      ok: true,
      failures: []
    })
  })

  it('rejects reliable retries when recovery latency breaks the streaming budget', async () => {
    let nowMs = 8600
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: {
        latencyMs: 4,
        dropEveryNthMessage: 2,
        retransmitDroppedFrames: true,
        retransmitDelayMs: 40
      }
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    pair.guest.send({ seq: 2, sentAtMs: nowMs, message: { type: 'ping', nonce: 2 } })
    pair.flushAll()

    const metrics = pair.getAggregateMetrics()
    expect(metrics.combinedDroppedMessages).toBe(0)
    expect(metrics.combinedRetransmittedMessages).toBe(1)
    expect(metrics.combinedLostBytes).toBe(0)
    expect(metrics.combinedMaxLatencyMs).toBe(44)

    const budgetResult = evaluateSimulatedPeerTransportBudget(metrics)
    expect(budgetResult.ok).toBe(false)
    expect(budgetResult.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'combinedP95LatencyMs' }),
        expect.objectContaining({ metric: 'estimatedRoundTripP95LatencyMs' })
      ])
    )
  })
})
