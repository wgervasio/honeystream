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

describe('simulated peer transport retransmission budget', () => {
  it('fails when a mock connection overuses retransmission recovery', async () => {
    let nowMs = 8500
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: {
        latencyMs: 2,
        dropEveryNthMessage: 1,
        retransmitDroppedFrames: true,
        retransmitDelayMs: 1
      }
    })

    await pair.host.connect()
    for (let nonce = 1; nonce <= 4; nonce += 1) {
      pair.guest.send({ seq: nonce, sentAtMs: nowMs, message: { type: 'ping', nonce } })
      pair.host.send({
        seq: nonce + 10,
        sentAtMs: nowMs,
        message: { type: 'pong', nonce }
      })
      nowMs += 1
    }
    pair.flushAll()

    const metrics = pair.getAggregateMetrics()
    expect(metrics.combinedDroppedMessages).toBe(0)
    expect(metrics.combinedByteLossRate).toBe(0)
    expect(metrics.combinedRetransmissionRate).toBeGreaterThan(
      STREAMING_SITE_TRANSPORT_BUDGET.maxRetransmissionRate
    )
    expect(metrics.maxDirectionalRetransmissionRate).toBeGreaterThan(
      STREAMING_SITE_TRANSPORT_BUDGET.maxDirectionalRetransmissionRate
    )

    const budgetResult = evaluateSimulatedPeerTransportBudget(metrics)
    expect(budgetResult.ok).toBe(false)
    expect(budgetResult.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'combinedRetransmissionRate'
        }),
        expect.objectContaining({
          metric: 'maxDirectionalRetransmissionRate'
        })
      ])
    )
  })
})
