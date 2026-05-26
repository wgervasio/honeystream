import { TransportMessageValidator } from './contracts'
import { InMemoryPeerTransport } from './in-memory-peer-transport'

type Clock = () => number

export interface InMemoryPeerTransportPairOptions<TClientToHostMessage, THostToClientMessage> {
  readonly hostPeerId?: string
  readonly guestPeerId?: string
  readonly hostInboundValidator: TransportMessageValidator<TClientToHostMessage>
  readonly guestInboundValidator: TransportMessageValidator<THostToClientMessage>
  readonly now?: Clock
}

export interface InMemoryPeerTransportPair<TClientToHostMessage, THostToClientMessage> {
  readonly host: InMemoryPeerTransport<TClientToHostMessage, THostToClientMessage>
  readonly guest: InMemoryPeerTransport<THostToClientMessage, TClientToHostMessage>
}

export const createInMemoryPeerTransportPair = <TClientToHostMessage, THostToClientMessage>(
  options: InMemoryPeerTransportPairOptions<TClientToHostMessage, THostToClientMessage>
): InMemoryPeerTransportPair<TClientToHostMessage, THostToClientMessage> => {
  const hostPeerId = options.hostPeerId || 'host'
  const guestPeerId = options.guestPeerId || 'guest'
  const now = options.now

  const host = new InMemoryPeerTransport<TClientToHostMessage, THostToClientMessage>({
    localPeerId: hostPeerId,
    remotePeerId: guestPeerId,
    inboundValidator: options.hostInboundValidator,
    now
  })

  const guest = new InMemoryPeerTransport<THostToClientMessage, TClientToHostMessage>({
    localPeerId: guestPeerId,
    remotePeerId: hostPeerId,
    inboundValidator: options.guestInboundValidator,
    now
  })

  host.linkPeer(guest)
  guest.linkPeer(host)

  return { host, guest }
}
