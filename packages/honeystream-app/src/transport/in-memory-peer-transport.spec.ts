import { TransportMessageValidator } from './contracts'
import { createInMemoryPeerTransportPair } from './in-memory-peer-transport-pair'

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
  validate: (value: unknown): value is ClientToHostMessage => {
    if (!isUnknownRecord(value)) {
      return false
    }

    return value.type === 'ping' && typeof value.nonce === 'number' && value.nonce >= 0
  },
  describeInvalidMessage: () => 'Expected { type: "ping", nonce: number >= 0 }'
}

const hostToClientValidator: TransportMessageValidator<HostToClientMessage> = {
  validate: (value: unknown): value is HostToClientMessage => {
    if (!isUnknownRecord(value)) {
      return false
    }

    return value.type === 'pong' && typeof value.nonce === 'number' && value.nonce >= 0
  },
  describeInvalidMessage: () => 'Expected { type: "pong", nonce: number >= 0 }'
}

describe('in-memory peer transport', () => {
  it('connects both peers and relays validated messages in both directions', async () => {
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator
    })

    const hostMessages: ClientToHostMessage[] = []
    const guestMessages: HostToClientMessage[] = []
    pair.host.subscribe(event => {
      if (event.type === 'message') {
        hostMessages.push(event.delivery.envelope.message)
      }
    })
    pair.guest.subscribe(event => {
      if (event.type === 'message') {
        guestMessages.push(event.delivery.envelope.message)
      }
    })

    await pair.host.connect()
    pair.guest.send({
      seq: 1,
      sentAtMs: 100,
      message: { type: 'ping', nonce: 7 }
    })
    pair.host.send({
      seq: 2,
      sentAtMs: 101,
      message: { type: 'pong', nonce: 7 }
    })

    expect(pair.host.getState().status).toBe('connected')
    expect(pair.guest.getState().status).toBe('connected')
    expect(hostMessages).toEqual([{ type: 'ping', nonce: 7 }])
    expect(guestMessages).toEqual([{ type: 'pong', nonce: 7 }])
  })

  it('fails the receiver when the envelope shape is invalid', async () => {
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator
    })

    const hostErrorCodes: string[] = []
    pair.host.subscribe(event => {
      if (event.type === 'error') {
        hostErrorCodes.push(event.error.code)
      }
    })

    await pair.host.connect()
    pair.guest.send({
      seq: Number.NaN,
      sentAtMs: 200,
      message: { type: 'ping', nonce: 3 }
    })

    expect(hostErrorCodes).toEqual(['invalid-envelope'])
    expect(pair.host.getState().status).toBe('failed')
    expect(pair.guest.getState().status).toBe('disconnected')
  })

  it('fails the receiver when runtime message validation fails', async () => {
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator
    })

    const hostErrorCodes: string[] = []
    pair.host.subscribe(event => {
      if (event.type === 'error') {
        hostErrorCodes.push(event.error.code)
      }
    })

    await pair.host.connect()
    pair.guest.send({
      seq: 3,
      sentAtMs: 300,
      message: { type: 'ping', nonce: -1 }
    })

    expect(hostErrorCodes).toEqual(['validation-failed'])
    expect(pair.host.getState().status).toBe('failed')
    expect(pair.guest.getState().status).toBe('disconnected')
  })

  it('is disposable and rejects calls after disposal', async () => {
    const pair = createInMemoryPeerTransportPair({
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator
    })

    await pair.host.connect()

    pair.host.dispose()
    pair.host.dispose()

    expect(pair.host.getState().status).toBe('disposed')
    expect(pair.guest.getState().status).toBe('disconnected')
    expect(() =>
      pair.host.send({
        seq: 4,
        sentAtMs: 400,
        message: { type: 'pong', nonce: 1 }
      })
    ).toThrow('[disposed]')
    expect(() => pair.host.subscribe(() => undefined)).toThrow('[disposed]')
  })
})
