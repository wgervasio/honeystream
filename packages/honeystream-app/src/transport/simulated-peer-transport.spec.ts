import { TransportMessageValidator } from './contracts'
import { createSimulatedPeerTransportPair } from './simulated-peer-transport-pair'
import { byteLength } from './simulated-peer-transport-types'

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

describe('simulated peer transport', () => {
  it('measures bytes with the same JSON envelope used by the simulated wire', () => {
    const envelope = {
      seq: 1,
      sentAtMs: 1000,
      message: { type: 'ping' as const, nonce: 1 }
    }

    expect(byteLength(envelope)).toBe(Buffer.byteLength(JSON.stringify(envelope), 'utf-8'))
  })

  it('delays delivery until the latency budget is met and records byte metrics', async () => {
    let nowMs = 1000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: { latencyMs: 25 }
    })
    const hostMessages: ClientToHostMessage[] = []

    pair.host.subscribe(event => {
      if (event.type === 'message') hostMessages.push(event.delivery.envelope.message)
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })

    expect(pair.flushReady()).toBe(0)
    nowMs += 24
    expect(pair.flushReady()).toBe(0)
    nowMs += 1
    expect(pair.flushReady()).toBe(1)
    expect(hostMessages).toEqual([{ type: 'ping', nonce: 1 }])

    expect(pair.guest.getMetrics().sentMessages).toBe(1)
    expect(pair.guest.getMetrics().lostBytes).toBe(0)
    expect(pair.host.getMetrics().deliveredBytes).toBeGreaterThan(0)
    expect(pair.host.getMetrics().averageLatencyMs).toBe(25)
  })

  it('aggregates host and guest latency, delivery, and byte-loss metrics', async () => {
    let nowMs = 4000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: { latencyMs: 20, dropEveryNthMessage: 3 }
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    pair.guest.send({ seq: 2, sentAtMs: nowMs, message: { type: 'ping', nonce: 2 } })
    pair.guest.send({ seq: 3, sentAtMs: nowMs, message: { type: 'ping', nonce: 3 } })
    pair.host.send({ seq: 4, sentAtMs: nowMs, message: { type: 'pong', nonce: 4 } })

    nowMs += 20
    expect(pair.flushReady()).toBe(3)

    const metrics = pair.getAggregateMetrics()
    expect(metrics.combinedSentMessages).toBe(4)
    expect(metrics.combinedDeliveredMessages).toBe(3)
    expect(metrics.combinedDroppedMessages).toBe(1)
    expect(metrics.combinedSentBytes).toBeGreaterThan(metrics.combinedDeliveredBytes)
    expect(metrics.combinedLostBytes).toBeGreaterThan(0)
    expect(metrics.combinedAverageLatencyMs).toBe(20)
    expect(metrics.combinedMaxLatencyMs).toBe(20)
    expect(metrics.combinedQueuedMessages).toBe(0)
  })

  it('can drop every nth message and report byte loss without corrupting ordering', async () => {
    let nowMs = 2000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      network: { latencyMs: 10, dropEveryNthMessage: 2 }
    })
    const hostMessages: ClientToHostMessage[] = []

    pair.host.subscribe(event => {
      if (event.type === 'message') hostMessages.push(event.delivery.envelope.message)
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    pair.guest.send({ seq: 2, sentAtMs: nowMs, message: { type: 'ping', nonce: 2 } })
    nowMs += 10
    pair.flushReady()

    expect(hostMessages).toEqual([{ type: 'ping', nonce: 1 }])
    expect(pair.guest.getMetrics().sentMessages).toBe(2)
    expect(pair.guest.getMetrics().droppedMessages).toBe(1)
    expect(pair.guest.getMetrics().lostBytes).toBeGreaterThan(0)
    expect(pair.host.getMetrics().deliveredMessages).toBe(1)
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
    expect(pair.guest.getMetrics().droppedMessages).toBe(1)

    pair.host.dispose()

    expect(pair.host.getMetrics().queuedMessages).toBe(0)
    expect(pair.host.getState().status).toBe('disposed')
  })
})
