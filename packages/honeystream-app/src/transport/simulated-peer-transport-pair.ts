import { TransportMessageValidator } from './contracts'
import { SimulatedPeerTransport } from './simulated-peer-transport'
import { Clock, SimulatedPeerNetworkProfile } from './simulated-peer-transport-types'

export interface SimulatedPeerTransportPairOptions<TClientToHostMessage, THostToClientMessage> {
  readonly hostPeerId?: string
  readonly guestPeerId?: string
  readonly hostInboundValidator: TransportMessageValidator<TClientToHostMessage>
  readonly guestInboundValidator: TransportMessageValidator<THostToClientMessage>
  readonly now?: Clock
  readonly network?: SimulatedPeerNetworkProfile
}

export interface SimulatedPeerTransportPair<TClientToHostMessage, THostToClientMessage> {
  readonly host: SimulatedPeerTransport<TClientToHostMessage, THostToClientMessage>
  readonly guest: SimulatedPeerTransport<THostToClientMessage, TClientToHostMessage>
  flushReady(nowMs?: number): number
  flushAll(): number
}

export const createSimulatedPeerTransportPair = <TClientToHostMessage, THostToClientMessage>(
  options: SimulatedPeerTransportPairOptions<TClientToHostMessage, THostToClientMessage>
): SimulatedPeerTransportPair<TClientToHostMessage, THostToClientMessage> => {
  const host = new SimulatedPeerTransport<TClientToHostMessage, THostToClientMessage>({
    localPeerId: options.hostPeerId || 'host',
    remotePeerId: options.guestPeerId || 'guest',
    inboundValidator: options.hostInboundValidator,
    now: options.now,
    network: options.network
  })
  const guest = new SimulatedPeerTransport<THostToClientMessage, TClientToHostMessage>({
    localPeerId: options.guestPeerId || 'guest',
    remotePeerId: options.hostPeerId || 'host',
    inboundValidator: options.guestInboundValidator,
    now: options.now,
    network: options.network
  })
  host.linkPeer(guest)
  guest.linkPeer(host)
  return {
    host,
    guest,
    flushReady: nowMs => host.flushReady(nowMs) + guest.flushReady(nowMs),
    flushAll: () => host.flushAll() + guest.flushAll()
  }
}
