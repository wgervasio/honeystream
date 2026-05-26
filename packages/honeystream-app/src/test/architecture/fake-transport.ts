import { parseWireEnvelope, WireEnvelope } from '../../protocol'
import {
  createInMemoryPeerTransportPair,
  InMemoryPeerTransportPair
} from '../../transport/in-memory-peer-transport-pair'
import { TransportMessageValidator } from '../../transport/contracts'

export type ClientToHostWireEnvelope = Extract<WireEnvelope, { direction: 'client-to-host' }>
export type HostToClientWireEnvelope = Extract<WireEnvelope, { direction: 'host-to-client' }>

const createWireEnvelopeValidator = <TDirection extends WireEnvelope['direction']>(
  direction: TDirection
): TransportMessageValidator<Extract<WireEnvelope, { direction: TDirection }>> => ({
  validate: (value: unknown): value is Extract<WireEnvelope, { direction: TDirection }> => {
    const parsed = parseWireEnvelope(value)
    return parsed.ok && parsed.value.direction === direction
  },
  describeInvalidMessage: () => `Expected ${direction} wire envelope payload.`
})

export interface FakeTransportPairOptions {
  readonly hostPeerId: string
  readonly guestPeerId: string
  readonly now: () => number
}

export type FakeTransportPair = InMemoryPeerTransportPair<
  ClientToHostWireEnvelope,
  HostToClientWireEnvelope
>

export const createFakeTransportPair = (
  options: FakeTransportPairOptions
): FakeTransportPair =>
  createInMemoryPeerTransportPair<ClientToHostWireEnvelope, HostToClientWireEnvelope>({
    hostPeerId: options.hostPeerId,
    guestPeerId: options.guestPeerId,
    hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
    guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
    now: options.now
  })
