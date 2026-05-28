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

describe('simulated peer transport performance budget', () => {
  it('evaluates aggregate metrics against a streaming transport budget', async () => {
    let nowMs = 7000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      random: () => 1,
      network: { latencyMs: 12, jitterMs: 4 }
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    pair.host.send({ seq: 2, sentAtMs: nowMs, message: { type: 'pong', nonce: 1 } })
    nowMs += 16
    pair.flushReady()

    expect(evaluateSimulatedPeerTransportBudget(pair.getAggregateMetrics())).toEqual({
      ok: true,
      failures: []
    })

    const degradedBudget = evaluateSimulatedPeerTransportBudget(pair.getAggregateMetrics(), {
      ...STREAMING_SITE_TRANSPORT_BUDGET,
      maxAverageLatencyMs: 4
    })
    expect(degradedBudget.ok).toBe(false)
    expect(degradedBudget.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'combinedAverageLatencyMs'
        })
      ])
    )

    const degradedTailBudget = evaluateSimulatedPeerTransportBudget(pair.getAggregateMetrics(), {
      ...STREAMING_SITE_TRANSPORT_BUDGET,
      maxP95LatencyMs: 4
    })
    expect(degradedTailBudget.ok).toBe(false)
    expect(degradedTailBudget.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'combinedP95LatencyMs'
        })
      ])
    )

    const oversizedMessageBudget = evaluateSimulatedPeerTransportBudget(pair.getAggregateMetrics(), {
      ...STREAMING_SITE_TRANSPORT_BUDGET,
      maxAverageMessageBytes: 1
    })
    expect(oversizedMessageBudget.ok).toBe(false)
    expect(oversizedMessageBudget.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'combinedAverageMessageBytes'
        })
      ])
    )
  })

  it('keeps a bursty host and guest mock connection inside the streaming budget', async () => {
    let nowMs = 9000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      random: () => 0.5,
      network: { latencyMs: 10, jitterMs: 2, maxQueuedFrames: 128 }
    })

    await pair.host.connect()

    for (let nonce = 1; nonce <= 24; nonce += 1) {
      pair.guest.send({ seq: nonce, sentAtMs: nowMs, message: { type: 'ping', nonce } })
      pair.host.send({
        seq: nonce + 100,
        sentAtMs: nowMs,
        message: { type: 'pong', nonce }
      })
      nowMs += 1
    }

    pair.flushAll()

    const metrics = pair.getAggregateMetrics()
    expect(metrics.combinedSentMessages).toBe(48)
    expect(metrics.combinedDeliveredMessages).toBe(48)
    expect(metrics.combinedLostBytes).toBe(0)
    expect(metrics.combinedQueuedMessages).toBe(0)
    expect(metrics.combinedAverageMessageBytes).toBeLessThan(96)
    expect(metrics.combinedAverageLatencyMs).toBeLessThanOrEqual(12)
    expect(metrics.combinedP95LatencyMs).toBeLessThanOrEqual(12)
    expect(evaluateSimulatedPeerTransportBudget(metrics)).toEqual({
      ok: true,
      failures: []
    })
  })
})
