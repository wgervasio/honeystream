import { BroadcastChannelPeerTransport } from './broadcast-channel-peer-transport'
import { PeerTransportEvent, TransportMessageValidator } from './contracts'

type TestMessage = {
  readonly kind: 'ping'
  readonly value: string
}

type FakeBroadcastEvent = {
  readonly data: unknown
}

class FakeBroadcastChannel {
  private static readonly channels = new Map<string, Set<FakeBroadcastChannel>>()

  onmessage: ((event: FakeBroadcastEvent) => void) | null = null
  readonly name: string

  constructor(name: string) {
    this.name = name
    const peers = FakeBroadcastChannel.channels.get(name) || new Set<FakeBroadcastChannel>()
    peers.add(this)
    FakeBroadcastChannel.channels.set(name, peers)
  }

  static activeCount(): number {
    let count = 0
    FakeBroadcastChannel.channels.forEach(peers => {
      count += peers.size
    })
    return count
  }

  postMessage(data: unknown): void {
    const peers = FakeBroadcastChannel.channels.get(this.name)
    if (!peers) return
    peers.forEach(peer => {
      if (peer !== this) {
        if (peer.onmessage) peer.onmessage({ data })
      }
    })
  }

  close(): void {
    const peers = FakeBroadcastChannel.channels.get(this.name)
    if (!peers) return
    peers.delete(this)
    if (peers.size === 0) FakeBroadcastChannel.channels.delete(this.name)
  }
}

const testMessageValidator: TransportMessageValidator<TestMessage> = {
  validate: (value: unknown): value is TestMessage =>
    typeof value === 'object' &&
    value !== null &&
    (value as TestMessage).kind === 'ping' &&
    typeof (value as TestMessage).value === 'string'
}

const flushBroadcast = (): Promise<void> =>
  Promise.resolve()

describe('BroadcastChannelPeerTransport', () => {
  const originalBroadcastChannelDescriptor = Object.getOwnPropertyDescriptor(
    global,
    'BroadcastChannel'
  )

  beforeEach(() => {
    Object.defineProperty(global, 'BroadcastChannel', {
      configurable: true,
      value: FakeBroadcastChannel
    })
  })

  afterEach(() => {
    if (originalBroadcastChannelDescriptor) {
      Object.defineProperty(global, 'BroadcastChannel', originalBroadcastChannelDescriptor)
      return
    }
    Reflect.deleteProperty(global, 'BroadcastChannel')
  })

  it('connects two page contexts, relays validated envelopes, and closes channels', async () => {
    let nowMs = 1000
    const now = () => nowMs
    const hostMessages: TestMessage[] = []
    const host = new BroadcastChannelPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-1',
      role: 'host',
      localPeerId: 'host',
      remotePeerIdHint: 'guest',
      inboundValidator: testMessageValidator,
      now
    })
    const guest = new BroadcastChannelPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-1',
      role: 'guest',
      localPeerId: 'guest',
      remotePeerIdHint: 'host',
      inboundValidator: testMessageValidator,
      now
    })

    host.subscribe((event: PeerTransportEvent<TestMessage>) => {
      if (event.type === 'message') hostMessages.push(event.delivery.envelope.message)
    })

    await host.connect()
    await guest.connect()
    nowMs += 1
    guest.send({ seq: 1, sentAtMs: nowMs, message: { kind: 'ping', value: 'hello' } })
    await flushBroadcast()

    expect(host.getState().status).toBe('connected')
    expect(guest.getState().status).toBe('connected')
    expect(hostMessages).toEqual([{ kind: 'ping', value: 'hello' }])

    host.dispose()
    guest.dispose()

    expect(FakeBroadcastChannel.activeCount()).toBe(0)
  })

  it('reuses the in-flight guest handshake instead of orphaning connection promises', async () => {
    const host = new BroadcastChannelPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-retry',
      role: 'host',
      localPeerId: 'host',
      remotePeerIdHint: 'guest',
      inboundValidator: testMessageValidator
    })
    const guest = new BroadcastChannelPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-retry',
      role: 'guest',
      localPeerId: 'guest',
      remotePeerIdHint: 'host',
      inboundValidator: testMessageValidator
    })

    try {
      const firstConnect = guest.connect()
      const secondConnect = guest.connect()
      let firstConnectResolved = false
      firstConnect.then(() => {
        firstConnectResolved = true
      })

      expect(secondConnect).toBe(firstConnect)
      expect(FakeBroadcastChannel.activeCount()).toBe(1)

      await host.connect()
      await secondConnect
      await flushBroadcast()

      expect(firstConnectResolved).toBe(true)
      expect(host.getState().status).toBe('connected')
      expect(guest.getState().status).toBe('connected')
      expect(FakeBroadcastChannel.activeCount()).toBe(2)
    } finally {
      guest.dispose()
      host.dispose()
    }

    expect(FakeBroadcastChannel.activeCount()).toBe(0)
  })

  it('closes the broadcast channel when disconnecting without disposing subscribers', async () => {
    const host = new BroadcastChannelPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-disconnect',
      role: 'host',
      localPeerId: 'host',
      remotePeerIdHint: 'guest',
      inboundValidator: testMessageValidator
    })
    const guest = new BroadcastChannelPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-disconnect',
      role: 'guest',
      localPeerId: 'guest',
      remotePeerIdHint: 'host',
      inboundValidator: testMessageValidator
    })
    const guestStates: string[] = []
    guest.subscribe(event => {
      if (event.type === 'state') guestStates.push(event.state.status)
    })

    try {
      await host.connect()
      await guest.connect()
      expect(FakeBroadcastChannel.activeCount()).toBe(2)

      guest.disconnect('manual')

      expect(guest.getState().status).toBe('disconnected')
      expect(guestStates).toEqual(expect.arrayContaining(['connected', 'disconnected']))
      expect(FakeBroadcastChannel.activeCount()).toBe(1)
    } finally {
      guest.dispose()
      host.dispose()
    }

    expect(FakeBroadcastChannel.activeCount()).toBe(0)
  })

  it('rejects an in-flight guest handshake when disposed', async () => {
    const guest = new BroadcastChannelPeerTransport<TestMessage, TestMessage>({
      roomId: 'room-dispose',
      role: 'guest',
      localPeerId: 'guest',
      remotePeerIdHint: 'host',
      inboundValidator: testMessageValidator
    })

    const connecting = guest.connect()
    expect(FakeBroadcastChannel.activeCount()).toBe(1)

    guest.dispose()

    await expect(connecting).rejects.toThrow('disposed before the browser handshake completed')
    expect(guest.getState().status).toBe('disposed')
    expect(FakeBroadcastChannel.activeCount()).toBe(0)
  })
})
