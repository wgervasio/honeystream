import { TransportMessageValidator } from './contracts'

export type TestMessage = {
  readonly kind: 'ping'
  readonly value: string
}

type UnknownRecord = { readonly [key: string]: unknown }
type RelayRole = 'guest' | 'host'
type FakeMessageEvent = { readonly data: string }

interface FakeRelayClient {
  readonly peerId: string
  readonly role: RelayRole
  readonly roomId: string
  readonly socket: FakeWebSocket
}

interface FakeRelayRoom {
  guest?: FakeRelayClient
  host?: FakeRelayClient
}

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const isRelayRole = (value: string | null): value is RelayRole =>
  value === 'guest' || value === 'host'

export const testMessageValidator: TransportMessageValidator<TestMessage> = {
  validate: (value: unknown): value is TestMessage =>
    isUnknownRecord(value) && value.kind === 'ping' && typeof value.value === 'string',
  describeInvalidMessage: () => 'Expected ping message.'
}

export class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3

  private static readonly rooms = new Map<string, FakeRelayRoom>()
  private static readonly sockets = new Set<FakeWebSocket>()

  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  readyState = FakeWebSocket.OPEN

  private readonly peerId: string
  private readonly role: RelayRole
  private readonly roomId: string
  private messageHandler: ((event: FakeMessageEvent) => void) | null = null
  private pendingMessages: string[] = []

  constructor(urlValue: string) {
    const url = new URL(urlValue)
    const role = url.searchParams.get('role')
    const peerId = url.searchParams.get('peerId') || ''
    const roomId = url.searchParams.get('roomId') || ''
    if (!isRelayRole(role) || peerId.length === 0 || roomId.length === 0) {
      throw new Error(`Invalid fake relay socket URL: ${urlValue}`)
    }

    this.peerId = peerId
    this.role = role
    this.roomId = roomId
    FakeWebSocket.sockets.add(this)
    FakeWebSocket.register(this)
  }

  static activeCount(): number {
    return FakeWebSocket.sockets.size
  }

  static reset(): void {
    FakeWebSocket.rooms.clear()
    FakeWebSocket.sockets.clear()
  }

  static getSocket(peerId: string): FakeWebSocket | undefined {
    let matchingSocket: FakeWebSocket | undefined
    FakeWebSocket.sockets.forEach(socket => {
      if (socket.peerId === peerId) matchingSocket = socket
    })
    return matchingSocket
  }

  get onmessage(): ((event: FakeMessageEvent) => void) | null {
    return this.messageHandler
  }

  set onmessage(listener: ((event: FakeMessageEvent) => void) | null) {
    this.messageHandler = listener
    this.flushPendingMessages()
  }

  send(rawMessage: string): void {
    const message = JSON.parse(rawMessage)
    if (
      !isUnknownRecord(message) ||
      message.kind !== 'data' ||
      typeof message.toPeerId !== 'string'
    ) {
      this.close()
      return
    }

    const room = FakeWebSocket.rooms.get(this.roomId)
    const peer = room && (this.role === 'host' ? room.guest : room.host)
    if (!peer || peer.peerId !== message.toPeerId) return
    peer.socket.deliver(
      JSON.stringify({
        kind: 'data',
        fromPeerId: this.peerId,
        envelope: message.envelope
      })
    )
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.readyState = FakeWebSocket.CLOSED
    FakeWebSocket.sockets.delete(this)
    FakeWebSocket.remove(this)
    if (this.onclose) this.onclose()
  }

  deliver(message: string): void {
    if (this.readyState !== FakeWebSocket.OPEN) return
    if (!this.messageHandler) {
      this.pendingMessages = [...this.pendingMessages, message]
      return
    }
    this.messageHandler({ data: message })
  }

  private flushPendingMessages(): void {
    if (!this.messageHandler || this.pendingMessages.length === 0) return
    const pendingMessages = this.pendingMessages
    this.pendingMessages = []
    pendingMessages.forEach(message => this.deliver(message))
  }

  private static register(socket: FakeWebSocket): void {
    const room = FakeWebSocket.rooms.get(socket.roomId) || {}
    const previous = room[socket.role]
    if (previous) previous.socket.close()
    room[socket.role] = {
      peerId: socket.peerId,
      role: socket.role,
      roomId: socket.roomId,
      socket
    }
    FakeWebSocket.rooms.set(socket.roomId, room)
    FakeWebSocket.announcePeers(room)
  }

  private static remove(socket: FakeWebSocket): void {
    const room = FakeWebSocket.rooms.get(socket.roomId)
    if (!room || !room[socket.role] || room[socket.role]!.socket !== socket) return
    room[socket.role] = undefined
    const peer = socket.role === 'host' ? room.guest : room.host
    if (peer) peer.socket.deliver(JSON.stringify({ kind: 'leave', peerId: socket.peerId }))
    if (!room.host && !room.guest) FakeWebSocket.rooms.delete(socket.roomId)
  }

  private static announcePeers(room: FakeRelayRoom): void {
    if (!room.host || !room.guest) return
    room.host.socket.deliver(JSON.stringify({ kind: 'peer', peerId: room.guest.peerId }))
    room.guest.socket.deliver(JSON.stringify({ kind: 'peer', peerId: room.host.peerId }))
  }
}
