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

const createIntegrityPair = () =>
  createSimulatedPeerTransportPair({
    hostInboundValidator: clientToHostValidator,
    guestInboundValidator: hostToClientValidator,
    now: () => 12000,
    network: { latencyMs: 0, maxQueuedFrames: 16 }
  })

describe('simulated peer transport sequence integrity', () => {
  it('fails the streaming budget when delivered control frames skip a sequence number', async () => {
    const pair = createIntegrityPair()

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: 12000, message: { type: 'ping', nonce: 1 } })
    pair.guest.send({ seq: 3, sentAtMs: 12000, message: { type: 'ping', nonce: 3 } })
    pair.flushAll()

    const metrics = pair.getAggregateMetrics()
    expect(metrics.host.sequenceGapMessages).toBe(1)
    expect(metrics.host.outOfOrderMessages).toBe(0)
    expect(metrics.combinedSequenceGapMessages).toBe(1)
    expect(metrics.combinedOutOfOrderMessages).toBe(0)
    expect(evaluateSimulatedPeerTransportBudget(metrics).failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'combinedSequenceGapMessages' })
      ])
    )
  })

  it('fails the streaming budget when delivered control frames arrive out of order', async () => {
    const pair = createIntegrityPair()

    await pair.host.connect()
    pair.guest.send({ seq: 2, sentAtMs: 12000, message: { type: 'ping', nonce: 2 } })
    pair.guest.send({ seq: 1, sentAtMs: 12000, message: { type: 'ping', nonce: 1 } })
    pair.flushAll()

    const metrics = pair.getAggregateMetrics()
    expect(metrics.host.outOfOrderMessages).toBe(1)
    expect(metrics.host.sequenceGapMessages).toBe(0)
    expect(metrics.combinedOutOfOrderMessages).toBe(1)
    expect(metrics.combinedSequenceGapMessages).toBe(0)
    expect(evaluateSimulatedPeerTransportBudget(metrics).failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'combinedOutOfOrderMessages' })
      ])
    )
  })
})
