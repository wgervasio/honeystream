import { TransportMessageValidator } from './contracts'
import { createSimulatedPeerTransportPair } from './simulated-peer-transport-pair'

type PingMessage = {
  readonly type: 'ping'
  readonly nonce: number
}

type PongMessage = {
  readonly type: 'pong'
  readonly nonce: number
}

type UnknownRecord = { readonly [key: string]: unknown }

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const pingValidator: TransportMessageValidator<PingMessage> = {
  validate: (value: unknown): value is PingMessage =>
    isUnknownRecord(value) && value.type === 'ping' && typeof value.nonce === 'number',
  describeInvalidMessage: () => 'Expected ping message.'
}

const pongValidator: TransportMessageValidator<PongMessage> = {
  validate: (value: unknown): value is PongMessage =>
    isUnknownRecord(value) && value.type === 'pong' && typeof value.nonce === 'number',
  describeInvalidMessage: () => 'Expected pong message.'
}

describe('simulated peer transport disposal', () => {
  it('disposes both mock peers and clears pending control frames', async () => {
    const nowMs = 7000
    const pair = createSimulatedPeerTransportPair({
      hostInboundValidator: pingValidator,
      guestInboundValidator: pongValidator,
      now: () => nowMs,
      network: { latencyMs: 100 }
    })

    await pair.host.connect()
    pair.guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 1 } })
    expect(pair.host.getMetrics().queuedMessages).toBe(1)

    pair.host.dispose()
    pair.guest.dispose()

    expect(pair.host.getState().status).toBe('disposed')
    expect(pair.guest.getState().status).toBe('disposed')
    expect(pair.host.getMetrics().queuedMessages).toBe(0)
    expect(pair.getAggregateMetrics().combinedQueuedMessages).toBe(0)
    expect(() =>
      pair.guest.send({ seq: 2, sentAtMs: nowMs, message: { type: 'ping', nonce: 2 } })
    ).toThrow('[disposed]')
  })
})
