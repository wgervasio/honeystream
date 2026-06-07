import { E2EWebSocketPeerTransport } from './e2e-websocket-peer-transport'
import { PeerTransportEvent } from './contracts'
import {
  FakeWebSocket,
  TestMessage,
  testMessageValidator
} from './websocket-relay-peer-transport-test-fakes'

describe('E2EWebSocketPeerTransport', () => {
  const originalWebSocketDescriptor = Object.getOwnPropertyDescriptor(global, 'WebSocket')

  beforeEach(() => {
    FakeWebSocket.reset()
    Object.defineProperty(global, 'WebSocket', {
      configurable: true,
      value: FakeWebSocket
    })
  })

  afterEach(() => {
    FakeWebSocket.reset()
    jest.useRealTimers()
    if (originalWebSocketDescriptor) {
      Object.defineProperty(global, 'WebSocket', originalWebSocketDescriptor)
      return
    }
    Reflect.deleteProperty(global, 'WebSocket')
  })

  it('connects two isolated browser seats and relays validated envelopes through the relay', async () => {
    let nowMs = 1000
    const hostMessages: TestMessage[] = []
    const host = new E2EWebSocketPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-1',
      role: 'host',
      localPeerId: 'host-peer',
      remotePeerIdHint: 'guest-peer',
      inboundValidator: testMessageValidator,
      now: () => nowMs,
      url: 'ws://127.0.0.1/__honeystream_e2e_peer_relay__'
    })
    const guest = new E2EWebSocketPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-1',
      role: 'guest',
      localPeerId: 'guest-peer',
      remotePeerIdHint: 'host-peer',
      inboundValidator: testMessageValidator,
      now: () => nowMs,
      url: 'ws://127.0.0.1/__honeystream_e2e_peer_relay__'
    })

    host.subscribe((event: PeerTransportEvent<TestMessage>) => {
      if (event.type === 'message') hostMessages.push(event.delivery.envelope.message)
    })

    try {
      await host.connect()
      await guest.connect()
      nowMs += 2
      guest.send({ seq: 1, sentAtMs: nowMs, message: { kind: 'ping', value: 'hello' } })

      expect(host.getState()).toEqual(
        expect.objectContaining({ status: 'connected', peerId: 'guest-peer' })
      )
      expect(guest.getState()).toEqual(
        expect.objectContaining({ status: 'connected', peerId: 'host-peer' })
      )
      expect(hostMessages).toEqual([{ kind: 'ping', value: 'hello' }])
    } finally {
      host.dispose()
      guest.dispose()
    }

    expect(FakeWebSocket.activeCount()).toBe(0)
  })

  it('rejects a guest handshake when the relay peer is unavailable', async () => {
    jest.useFakeTimers()
    const guest = new E2EWebSocketPeerTransport<TestMessage, TestMessage>({
      roomId: 'missing-host-room',
      role: 'guest',
      localPeerId: 'guest-peer',
      remotePeerIdHint: 'host-peer',
      inboundValidator: testMessageValidator,
      connectTimeoutMs: 10,
      url: 'ws://127.0.0.1/__honeystream_e2e_peer_relay__'
    })

    const connecting = guest.connect()
    jest.advanceTimersByTime(10)

    await expect(connecting).rejects.toThrow('e2e relay peer was not found')
    expect(guest.getState()).toEqual(
      expect.objectContaining({
        status: 'failed',
        reason: 'transport-error',
        error: expect.objectContaining({ code: 'peer-unavailable' })
      })
    )
    guest.dispose()
    expect(FakeWebSocket.activeCount()).toBe(0)
  })

  it('fails a guest handshake when the e2e relay reports the peer is unavailable', async () => {
    const guest = new E2EWebSocketPeerTransport<TestMessage, TestMessage>({
      roomId: 'relay-missing-host-room',
      role: 'guest',
      localPeerId: 'guest-peer',
      remotePeerIdHint: 'host-peer',
      inboundValidator: testMessageValidator,
      connectTimeoutMs: 1000,
      url: 'ws://127.0.0.1/__honeystream_e2e_peer_relay__'
    })

    const connecting = guest.connect()
    const socket = FakeWebSocket.getSocket('guest-peer')
    if (!socket) throw new Error('Expected guest fake WebSocket to be registered.')
    socket.deliver(
      JSON.stringify({
        kind: 'peerUnavailable',
        message: 'Network error: e2e relay peer was not found.'
      })
    )

    await expect(connecting).rejects.toThrow('e2e relay peer was not found')
    expect(guest.getState()).toEqual(
      expect.objectContaining({
        status: 'failed',
        reason: 'transport-error',
        error: expect.objectContaining({ code: 'peer-unavailable' })
      })
    )
    guest.dispose()
    expect(FakeWebSocket.activeCount()).toBe(0)
  })

  it('fails closed when the relay sends malformed control frames', async () => {
    const errors: string[] = []
    const guest = new E2EWebSocketPeerTransport<TestMessage, TestMessage>({
      roomId: 'malformed-room',
      role: 'guest',
      localPeerId: 'guest-peer',
      remotePeerIdHint: 'host-peer',
      inboundValidator: testMessageValidator,
      connectTimeoutMs: 1000,
      url: 'ws://127.0.0.1/__honeystream_e2e_peer_relay__'
    })
    guest.subscribe(event => {
      if (event.type === 'error') errors.push(event.error.message)
    })

    const connecting = guest.connect()
    const socket = FakeWebSocket.getSocket('guest-peer')
    if (!socket) throw new Error('Expected guest fake WebSocket to be registered.')
    socket.deliver('not-json')

    await expect(connecting).rejects.toThrow('E2E relay message must be an object with a kind')
    expect(errors).toEqual(['E2E relay message must be an object with a kind.'])
    expect(guest.getState()).toEqual(
      expect.objectContaining({
        status: 'failed',
        reason: 'validation-failed',
        error: expect.objectContaining({ code: 'invalid-envelope' })
      })
    )
    guest.dispose()
    expect(FakeWebSocket.activeCount()).toBe(0)
  })

  it('fails closed when a relay data frame contains an invalid typed envelope', async () => {
    const host = new E2EWebSocketPeerTransport<TestMessage, TestMessage>({
      roomId: 'invalid-envelope-room',
      role: 'host',
      localPeerId: 'host-peer',
      remotePeerIdHint: 'guest-peer',
      inboundValidator: testMessageValidator,
      url: 'ws://127.0.0.1/__honeystream_e2e_peer_relay__'
    })

    try {
      await host.connect()
      const socket = FakeWebSocket.getSocket('host-peer')
      if (!socket) throw new Error('Expected host fake WebSocket to be registered.')
      socket.deliver(
        JSON.stringify({
          kind: 'data',
          fromPeerId: 'guest-peer',
          envelope: {
            seq: 1,
            sentAtMs: 1000,
            message: { kind: 'wrong', value: 'bad' }
          }
        })
      )

      expect(host.getState()).toEqual(
        expect.objectContaining({
          status: 'failed',
          reason: 'validation-failed',
          error: expect.objectContaining({
            code: 'validation-failed',
            message: 'Expected ping message.'
          })
        })
      )
    } finally {
      host.dispose()
    }

    expect(FakeWebSocket.activeCount()).toBe(0)
  })
})
