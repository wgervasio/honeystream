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

describe('simulated peer transport asymmetric profiles', () => {
  it('models different host and guest latency budgets', async () => {
    let nowMs = 7000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: () => nowMs,
      hostNetwork: { latencyMs: 30 },
      guestNetwork: { latencyMs: 5 }
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
    pair.host.send({ seq: 1, sentAtMs: nowMs, message: { type: 'pong', nonce: 1 } })

    nowMs += 5
    expect(pair.flushReady()).toBe(1)
    expect(hostMessages).toEqual([])
    expect(guestMessages).toEqual([{ type: 'pong', nonce: 1 }])

    nowMs += 25
    expect(pair.flushReady()).toBe(1)
    expect(hostMessages).toEqual([{ type: 'ping', nonce: 1 }])

    const metrics = pair.getAggregateMetrics()
    expect(metrics.host.averageLatencyMs).toBe(30)
    expect(metrics.guest.averageLatencyMs).toBe(5)
    expect(metrics.combinedP95LatencyMs).toBe(30)
  })
})
