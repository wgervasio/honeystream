import NetConnection, { NetUniqueId } from 'network/connection'
import {
  NetConnectionPeerTransport,
  PeerTransportError
} from './net-connection-peer-transport'
import {
  PeerTransportConnectionState,
  PeerTransportMessage,
  isPeerTransportMessage
} from './peer-transport.contract'

class TestConnection extends NetConnection {
  sent: Buffer[] = []
  closeCount = 0

  constructor(connected: boolean) {
    super(new NetUniqueId(new Uint8Array([1, 2, 3, 4])))
    this.connected = connected
  }

  send(data: Buffer): void {
    this.sent.push(data)
  }

  close = (): void => {
    this.closeCount += 1
    this.connected = false
    this.emit('close')
  }
}

describe('NetConnectionPeerTransport', () => {
  it('starts in connecting state when the connection is not connected', () => {
    const connection = new TestConnection(false)
    const transport = new NetConnectionPeerTransport({ connection })

    expect(transport.state).toBe('connecting')

    transport.dispose()
  })

  it('starts in connected state when the connection is already connected', () => {
    const connection = new TestConnection(true)
    const transport = new NetConnectionPeerTransport({ connection })

    expect(transport.state).toBe('connected')

    transport.dispose()
  })

  it('serializes and sends outbound messages', () => {
    const connection = new TestConnection(true)
    const transport = new NetConnectionPeerTransport({ connection })
    const message = { type: 'playPause', payload: { paused: false } }

    transport.send(message)

    expect(connection.sent).toHaveLength(1)
    const outbound = JSON.parse(connection.sent[0].toString('utf-8')) as PeerTransportMessage
    expect(outbound).toEqual(message)

    transport.dispose()
  })

  it('emits typed state transitions from connection lifecycle events', () => {
    const connection = new TestConnection(false)
    const transport = new NetConnectionPeerTransport({ connection })
    const states: PeerTransportConnectionState[] = []

    transport.addStateListener(state => states.push(state))

    connection.emit('connect')
    connection.emit('disconnect')
    connection.emit('reconnect')
    transport.dispose()

    expect(states).toEqual(['connected', 'disconnected', 'connected', 'closed'])
  })

  it('parses inbound messages and notifies listeners', () => {
    const connection = new TestConnection(true)
    const transport = new NetConnectionPeerTransport({ connection })
    const received: PeerTransportMessage[] = []

    transport.addMessageListener(message => received.push(message))

    connection.emit(
      'data',
      Buffer.from(JSON.stringify({ type: 'snapshot', payload: { version: 1 } }), 'utf-8')
    )

    expect(received).toEqual([{ type: 'snapshot', payload: { version: 1 } }])

    transport.dispose()
  })

  it('reports parse failures for invalid inbound data', () => {
    const connection = new TestConnection(true)
    const transport = new NetConnectionPeerTransport({ connection })
    const errors: PeerTransportError[] = []

    transport.addErrorListener(error => {
      if (error instanceof PeerTransportError) {
        errors.push(error)
      }
    })

    connection.emit('data', Buffer.from('not json', 'utf-8'))

    expect(errors).toHaveLength(1)
    expect(errors[0].code).toBe('parse-failed')

    transport.dispose()
  })

  it('reports invalid inbound messages that do not match the transport shape', () => {
    const connection = new TestConnection(true)
    const transport = new NetConnectionPeerTransport({ connection })
    const errors: PeerTransportError[] = []

    transport.addErrorListener(error => {
      if (error instanceof PeerTransportError) {
        errors.push(error)
      }
    })

    connection.emit('data', Buffer.from(JSON.stringify({ payload: { foo: 'bar' } }), 'utf-8'))

    expect(errors).toHaveLength(1)
    expect(errors[0].code).toBe('invalid-inbound-message')

    transport.dispose()
  })

  it('throws a typed error when sending while disconnected', () => {
    const connection = new TestConnection(false)
    const transport = new NetConnectionPeerTransport({ connection })
    let thrown: unknown

    try {
      transport.send({ type: 'noop' })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(PeerTransportError)
    if (!(thrown instanceof PeerTransportError)) {
      throw new Error('Expected a PeerTransportError')
    }
    expect(thrown.code).toBe('not-connected')

    transport.dispose()
  })

  it('detaches listeners without closing unowned connections during dispose', () => {
    const connection = new TestConnection(true)
    const transport = new NetConnectionPeerTransport({ connection, ownsConnection: false })
    const messages: PeerTransportMessage[] = []

    transport.addMessageListener(message => messages.push(message))
    transport.dispose()

    connection.emit('data', Buffer.from(JSON.stringify({ type: 'should-not-deliver' }), 'utf-8'))

    expect(messages).toEqual([])
    expect(connection.closeCount).toBe(0)
  })

  it('closes owned connections during dispose', () => {
    const connection = new TestConnection(true)
    const transport = new NetConnectionPeerTransport({ connection, ownsConnection: true })

    transport.dispose()

    expect(connection.closeCount).toBe(1)
  })

  it('exports a runtime validator for transport messages', () => {
    expect(isPeerTransportMessage({ type: 'play' })).toBe(true)
    expect(isPeerTransportMessage({ payload: true })).toBe(false)
  })
})
