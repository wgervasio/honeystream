import { EventEmitter } from 'events'
import { PROTOCOL_VERSION, WireEnvelope } from '../../protocol'
import { LegacyNetWireTransport, LEGACY_NET_WIRE_HEADER, toPeerTransportEnvelope } from './index'

class FakeConnection extends EventEmitter {
  readonly id: { toString: () => string }
  connected: boolean = true
  readonly sent: Buffer[] = []

  constructor(peerId: string) {
    super()
    this.id = {
      toString: () => peerId
    }
  }

  send(data: Buffer): void {
    this.sent.push(data)
  }

  close(): void {
    if (!this.connected) return
    this.connected = false
    this.emit('close')
  }
}

class FakeServer extends EventEmitter {
  readonly isHost: boolean
  connected: boolean
  closeCount: number = 0
  readonly sentTo: Array<{ readonly clientId: string; readonly data: Buffer }> = []
  readonly sentToHost: Buffer[] = []
  private readonly clients = new Map<string, FakeConnection>()

  constructor(isHost: boolean) {
    super()
    this.isHost = isHost
    this.connected = isHost
  }

  connectPeer(peerId: string): FakeConnection {
    const connection = new FakeConnection(peerId)
    this.clients.set(peerId, connection)
    this.connected = true
    this.emit('connect', connection)
    return connection
  }

  emitPeerData(connection: FakeConnection, data: Buffer): void {
    this.emit('data', connection, data)
  }

  getClientById(clientId: string): FakeConnection | undefined {
    return this.clients.get(clientId)
  }

  sendTo(clientId: string, data: Buffer): void {
    this.sentTo.push({ clientId, data })
  }

  sendToHost(data: Buffer): void {
    this.sentToHost.push(data)
  }

  close(): void {
    this.closeCount += 1
    this.connected = false
    this.emit('close')
  }
}

const createClientToHostWireEnvelope = (seq: number): WireEnvelope => ({
  version: PROTOCOL_VERSION,
  direction: 'client-to-host',
  seq,
  sentAtMs: 1000 + seq,
  command: {
    type: 'requestSnapshot',
    reason: 'manual'
  }
})

const createHostToClientWireEnvelope = (seq: number): WireEnvelope => ({
  version: PROTOCOL_VERSION,
  direction: 'host-to-client',
  seq,
  sentAtMs: 2000 + seq,
  event: {
    type: 'participantLeft',
    peerId: 'guest-1'
  }
})

const encodeWireFrame = (wireEnvelope: WireEnvelope): Buffer => {
  return Buffer.concat([
    LEGACY_NET_WIRE_HEADER,
    Buffer.from(JSON.stringify(wireEnvelope), 'utf-8')
  ])
}

describe('LegacyNetWireTransport', () => {
  it('sends host-to-client wire envelopes through legacy NetServer.sendTo', async () => {
    const server = new FakeServer(true)
    const transport = new LegacyNetWireTransport({
      server,
      localPeerId: 'host-1'
    })

    await transport.connect()
    server.connectPeer('guest-1')

    const outboundWireEnvelope = createHostToClientWireEnvelope(1)
    transport.send(toPeerTransportEnvelope(outboundWireEnvelope))

    expect(server.sentTo).toHaveLength(1)
    expect(server.sentTo[0].clientId).toBe('guest-1')
    const framedPayload = server.sentTo[0].data
    expect(
      framedPayload
        .slice(0, LEGACY_NET_WIRE_HEADER.length)
        .equals(LEGACY_NET_WIRE_HEADER)
    ).toBeTruthy()
    const parsedPayload = JSON.parse(
      framedPayload.slice(LEGACY_NET_WIRE_HEADER.length).toString('utf-8')
    ) as WireEnvelope
    expect(parsedPayload).toEqual(outboundWireEnvelope)
  })

  it('receives framed wire envelopes and ignores non-wire legacy middleware payloads', async () => {
    const server = new FakeServer(true)
    const transport = new LegacyNetWireTransport({
      server,
      localPeerId: 'host-1'
    })
    const received: WireEnvelope[] = []
    transport.subscribe(event => {
      if (event.type === 'message') {
        received.push(event.delivery.envelope.message)
      }
    })

    await transport.connect()
    const connection = server.connectPeer('guest-1')
    server.emitPeerData(connection, Buffer.from('SYNC{"type":"UPDATE"}', 'utf-8'))
    server.emitPeerData(connection, encodeWireFrame(createClientToHostWireEnvelope(7)))

    expect(received).toEqual([createClientToHostWireEnvelope(7)])
    expect(transport.getState().status).toBe('connected')
  })

  it('removes listeners and closes owned servers during dispose', async () => {
    const server = new FakeServer(false)
    const transport = new LegacyNetWireTransport({
      server,
      localPeerId: 'guest-1',
      ownsServer: true
    })
    const received: WireEnvelope[] = []
    transport.subscribe(event => {
      if (event.type === 'message') {
        received.push(event.delivery.envelope.message)
      }
    })

    await transport.connect()
    const connection = server.connectPeer('host-1')
    expect(server.listenerCount('data')).toBe(1)

    transport.dispose()
    transport.dispose()

    expect(server.listenerCount('data')).toBe(0)
    expect(server.closeCount).toBe(1)
    expect(transport.getState().status).toBe('disposed')

    server.emitPeerData(connection, encodeWireFrame(createHostToClientWireEnvelope(2)))
    expect(received).toEqual([])
  })
})
