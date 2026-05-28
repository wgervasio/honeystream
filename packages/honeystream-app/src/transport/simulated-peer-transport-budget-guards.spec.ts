import { TransportMessageValidator } from './contracts'
import {
  evaluateSimulatedPeerTransportBudget,
  STREAMING_SITE_TRANSPORT_BUDGET
} from './simulated-peer-transport-performance'
import { createSimulatedPeerTransportPair } from './simulated-peer-transport-pair'

type ControlMessage = {
  readonly type: 'control'
  readonly nonce: number
  readonly payload?: string
}

type UnknownRecord = { readonly [key: string]: unknown }

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const controlMessageValidator: TransportMessageValidator<ControlMessage> = {
  validate: (value: unknown): value is ControlMessage =>
    isUnknownRecord(value) &&
    value.type === 'control' &&
    typeof value.nonce === 'number' &&
    value.nonce >= 0 &&
    (typeof value.payload === 'undefined' || typeof value.payload === 'string'),
  describeInvalidMessage: () => 'Expected control message.'
}

describe('simulated peer transport budget guards', () => {
  it('fails the streaming budget when mock connection jitter is unstable', async () => {
    let nowMs = 8200
    const randomSamples = [1, 0, 1]
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: controlMessageValidator,
      guestInboundValidator: controlMessageValidator,
      now: () => nowMs,
      random: () => {
        const sample = randomSamples.shift()
        return typeof sample === 'number' ? sample : 0.5
      },
      network: { latencyMs: 20, jitterMs: 20 }
    })

    await pair.host.connect()

    for (let nonce = 1; nonce <= 3; nonce += 1) {
      pair.guest.send({ seq: nonce, sentAtMs: nowMs, message: { type: 'control', nonce } })
      pair.flushAll()
      nowMs += 50
    }

    const metrics = pair.getAggregateMetrics()
    expect(metrics.maxDirectionalAverageLatencyJitterMs).toBeGreaterThan(30)
    expect(metrics.maxDirectionalLatencyJitterMs).toBeGreaterThan(30)

    const budgetResult = evaluateSimulatedPeerTransportBudget(metrics, {
      ...STREAMING_SITE_TRANSPORT_BUDGET,
      maxAverageLatencyMs: 50,
      maxP95LatencyMs: 50,
      maxMaxLatencyMs: 50,
      maxDirectionalAverageLatencyMs: 50,
      maxDirectionalLatencySkewMs: 50,
      maxEstimatedRoundTripP95LatencyMs: 80,
      maxEstimatedRoundTripMaxLatencyMs: 80
    })
    expect(budgetResult.ok).toBe(false)
    expect(budgetResult.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'maxDirectionalAverageLatencyJitterMs'
        }),
        expect.objectContaining({
          metric: 'maxDirectionalLatencyJitterMs'
        })
      ])
    )
  })

  it('fails the streaming budget when one control frame exceeds the byte cap', async () => {
    let nowMs = 8300
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: controlMessageValidator,
      guestInboundValidator: controlMessageValidator,
      now: () => nowMs,
      network: { latencyMs: 4 }
    })

    await pair.host.connect()
    pair.guest.send({
      seq: 1,
      sentAtMs: nowMs,
      message: { type: 'control', nonce: 1, payload: 'x'.repeat(2200) }
    })
    nowMs += 4
    pair.flushAll()

    const budgetResult = evaluateSimulatedPeerTransportBudget(pair.getAggregateMetrics())
    expect(budgetResult.ok).toBe(false)
    expect(budgetResult.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'combinedMaxMessageBytes'
        })
      ])
    )
  })
})
