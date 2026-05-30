import { TransportMessageValidator } from './contracts'
import { createInMemoryPeerTransportPair } from './in-memory-peer-transport-pair'
import { ObservablePeerTransport } from './observable-peer-transport'

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
    isUnknownRecord(value) &&
    value.type === 'ping' &&
    typeof value.nonce === 'number' &&
    Number.isFinite(value.nonce),
  describeInvalidMessage: () => 'Expected ping message.'
}

const pongValidator: TransportMessageValidator<PongMessage> = {
  validate: (value: unknown): value is PongMessage =>
    isUnknownRecord(value) &&
    value.type === 'pong' &&
    typeof value.nonce === 'number' &&
    Number.isFinite(value.nonce),
  describeInvalidMessage: () => 'Expected pong message.'
}

const addFortyToPingNonce = (message: PingMessage): PingMessage => ({
  type: 'ping',
  nonce: message.nonce + 40
})

describe('observable peer transport', () => {
  it('records bounded sent, received, state, byte, and latency observations', async () => {
    let nowMs = 1000
    const pair = createInMemoryPeerTransportPair<PingMessage, PongMessage>({
      hostInboundValidator: pingValidator,
      guestInboundValidator: pongValidator,
      now: () => nowMs
    })
    const host = new ObservablePeerTransport({ transport: pair.host, now: () => nowMs })
    const guest = new ObservablePeerTransport({ transport: pair.guest, now: () => nowMs })

    try {
      await host.connect()
      nowMs = 1010
      guest.send({ seq: 1, sentAtMs: 1000, message: { type: 'ping', nonce: 1 } })

      const hostSnapshot = host.getObservationSnapshot()
      const guestSnapshot = guest.getObservationSnapshot()

      expect(guestSnapshot.sentMessages).toBe(1)
      expect(guestSnapshot.sentBytes).toBeGreaterThan(0)
      expect(guestSnapshot.maxSentFrameBytes).toBe(guestSnapshot.sentBytes)
      expect(guestSnapshot.recentObservations).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'sent', bytes: guestSnapshot.sentBytes })])
      )
      expect(hostSnapshot.receivedMessages).toBe(1)
      expect(hostSnapshot.receivedBytes).toBeGreaterThan(0)
      expect(hostSnapshot.averageReceivedLatencyMs).toBe(10)
      expect(hostSnapshot.p95ReceivedLatencyMs).toBe(10)
      expect(hostSnapshot.maxReceivedLatencyMs).toBe(10)
      expect(hostSnapshot.recentObservations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'state', state: expect.objectContaining({ status: 'connected' }) }),
          expect.objectContaining({ type: 'received', latencyMs: 10 })
        ])
      )
    } finally {
      host.dispose()
      guest.dispose()
    }
  })

  it('lets tests intercept outbound envelopes before the wrapped transport sends them', async () => {
    let nowMs = 2000
    const pair = createInMemoryPeerTransportPair<PingMessage, PongMessage>({
      hostInboundValidator: pingValidator,
      guestInboundValidator: pongValidator,
      now: () => nowMs
    })
    const host = new ObservablePeerTransport({ transport: pair.host, now: () => nowMs })
    const guest = new ObservablePeerTransport({
      transport: pair.guest,
      now: () => nowMs,
      beforeSend: envelope => ({
        ...envelope,
        message: addFortyToPingNonce(envelope.message)
      })
    })
    const received: PingMessage[] = []
    const unsubscribe = host.subscribe(event => {
      if (event.type === 'message') {
        received.push(event.delivery.envelope.message)
      }
    })

    try {
      await host.connect()
      guest.send({ seq: 1, sentAtMs: nowMs, message: { type: 'ping', nonce: 2 } })

      const sentObservation = guest
        .getObservationSnapshot()
        .recentObservations.find(observation => observation.type === 'sent')

      expect(received).toEqual([{ type: 'ping', nonce: 42 }])
      expect(sentObservation).toEqual(
        expect.objectContaining({
          envelope: expect.objectContaining({ message: { type: 'ping', nonce: 42 } })
        })
      )
    } finally {
      unsubscribe()
      host.dispose()
      guest.dispose()
    }
  })

  it('keeps observation and latency samples capped for long mock runs', async () => {
    const pair = createInMemoryPeerTransportPair<PingMessage, PongMessage>({
      hostInboundValidator: pingValidator,
      guestInboundValidator: pongValidator,
      now: () => 3000
    })
    const host = new ObservablePeerTransport({
      transport: pair.host,
      now: () => 3000,
      observationCap: 4
    })
    const guest = new ObservablePeerTransport({
      transport: pair.guest,
      now: () => 3000,
      observationCap: 4
    })

    try {
      await host.connect()
      for (let nonce = 1; nonce <= 8; nonce += 1) {
        guest.send({ seq: nonce, sentAtMs: 3000, message: { type: 'ping', nonce } })
      }

      const hostSnapshot = host.getObservationSnapshot()
      const guestSnapshot = guest.getObservationSnapshot()
      const lastHostObservation =
        hostSnapshot.recentObservations[hostSnapshot.recentObservations.length - 1]
      const firstGuestObservation = guestSnapshot.recentObservations[0]

      expect(hostSnapshot.receivedMessages).toBe(8)
      expect(hostSnapshot.recentObservations).toHaveLength(4)
      expect(lastHostObservation).toEqual(
        expect.objectContaining({
          type: 'received',
          delivery: expect.objectContaining({ envelope: expect.objectContaining({ seq: 8 }) })
        })
      )
      expect(guestSnapshot.sentMessages).toBe(8)
      expect(guestSnapshot.recentObservations).toHaveLength(4)
      expect(firstGuestObservation).toEqual(
        expect.objectContaining({
          type: 'sent',
          envelope: expect.objectContaining({ seq: 5 })
        })
      )
    } finally {
      host.dispose()
      guest.dispose()
    }
  })

  it('does not count failed sends as observed control bytes', async () => {
    const pair = createInMemoryPeerTransportPair<PingMessage, PongMessage>({
      hostInboundValidator: pingValidator,
      guestInboundValidator: pongValidator,
      now: () => 4000
    })
    const guest = new ObservablePeerTransport({ transport: pair.guest, now: () => 4000 })

    try {
      expect(() =>
        guest.send({ seq: 1, sentAtMs: 4000, message: { type: 'ping', nonce: 1 } })
      ).toThrow('cannot send while disconnected')
      expect(guest.getObservationSnapshot()).toEqual(
        expect.objectContaining({
          sentMessages: 0,
          sentBytes: 0,
          maxSentFrameBytes: 0
        })
      )
      expect(guest.getObservationSnapshot().recentObservations).toHaveLength(0)

      guest.dispose()
      expect(() =>
        guest.send({ seq: 2, sentAtMs: 4000, message: { type: 'ping', nonce: 2 } })
      ).toThrow('send called after dispose')
      const snapshotAfterDisposedSend = guest.getObservationSnapshot()
      expect(snapshotAfterDisposedSend).toEqual(
        expect.objectContaining({
          sentMessages: 0,
          sentBytes: 0,
          maxSentFrameBytes: 0
        })
      )
      expect(
        snapshotAfterDisposedSend.recentObservations.some(observation => observation.type === 'sent')
      ).toBe(false)
    } finally {
      pair.host.dispose()
      guest.dispose()
    }
  })
})
