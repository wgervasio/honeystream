import { TransportMessageValidator } from './contracts'
import {
  evaluateSimulatedPeerTransportBudget,
  STREAMING_SITE_TRANSPORT_BUDGET
} from './simulated-peer-transport-performance'
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

describe('simulated peer transport queue pressure', () => {
  it('reports transient queue pressure even after the mock connection drains', async () => {
    let nowMs = 11000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: { latencyMs: 50, maxQueuedFrames: 2 }
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    pair.guest.send({ seq: 2, sentAtMs: nowMs, message: { type: 'ping', nonce: 2 } })
    pair.guest.send({ seq: 3, sentAtMs: nowMs, message: { type: 'ping', nonce: 3 } })

    expect(pair.host.getMetrics().queuedMessages).toBe(2)
    expect(pair.host.getMetrics().peakQueuedMessages).toBe(2)
    expect(pair.guest.getMetrics().recentFrames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'dropped', reason: 'queue-overflow', seq: 3 })
      ])
    )

    nowMs += 50
    pair.flushAll()

    const metrics = pair.getAggregateMetrics()
    expect(metrics.combinedQueuedMessages).toBe(0)
    expect(metrics.combinedPeakQueuedMessages).toBe(2)
    expect(metrics.maxDirectionalPeakQueuedMessages).toBe(2)

    const budgetResult = evaluateSimulatedPeerTransportBudget(metrics, {
      ...STREAMING_SITE_TRANSPORT_BUDGET,
      minDeliveryRate: 1,
      maxDroppedMessages: 1,
      maxByteLossRate: 1,
      maxAverageLatencyMs: 50,
      maxP95LatencyMs: 50,
      maxMaxLatencyMs: 50,
      maxQueuedMessages: 0,
      maxDirectionalAverageLatencyMs: 50,
      maxDirectionalLatencySkewMs: 50,
      maxDirectionalByteLossRate: 1,
      maxDirectionalQueuedMessages: 0,
      maxCombinedPeakQueuedMessages: 1,
      maxDirectionalPeakQueuedMessages: 1,
      maxEstimatedRoundTripP95LatencyMs: 100,
      maxEstimatedRoundTripMaxLatencyMs: 100
    })
    expect(budgetResult.ok).toBe(false)
    expect(budgetResult.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'combinedPeakQueuedMessages' }),
        expect.objectContaining({ metric: 'maxDirectionalPeakQueuedMessages' })
      ])
    )
  })

  it('does not deliver stale queued frames after a disconnect and reconnect', async () => {
    let nowMs = 12000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: { latencyMs: 1000 }
    })
    const hostMessages: ClientToHostMessage[] = []

    pair.host.subscribe(event => {
      if (event.type === 'message') hostMessages.push(event.delivery.envelope.message)
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    expect(pair.host.getMetrics().queuedMessages).toBe(1)

    pair.guest.disconnect()
    expect(pair.host.getMetrics().queuedMessages).toBe(0)

    await pair.host.connect()
    nowMs += 1000

    expect(pair.flushAll()).toBe(0)
    expect(hostMessages).toEqual([])
  })
})
