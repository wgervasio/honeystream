import { TransportMessageValidator } from './contracts'
import { SimulatedPeerTransport } from './simulated-peer-transport'
import {
  Clock,
  SimulatedPeerNetworkProfile,
  SimulatedPeerTransportMetrics
} from './simulated-peer-transport-types'

export interface SimulatedPeerTransportPairOptions<TClientToHostMessage, THostToClientMessage> {
  readonly hostPeerId?: string
  readonly guestPeerId?: string
  readonly hostInboundValidator: TransportMessageValidator<TClientToHostMessage>
  readonly guestInboundValidator: TransportMessageValidator<THostToClientMessage>
  readonly now?: Clock
  readonly random?: Clock
  readonly network?: SimulatedPeerNetworkProfile
}

export interface SimulatedPeerTransportPair<TClientToHostMessage, THostToClientMessage> {
  readonly host: SimulatedPeerTransport<TClientToHostMessage, THostToClientMessage>
  readonly guest: SimulatedPeerTransport<THostToClientMessage, TClientToHostMessage>
  flushReady(nowMs?: number): number
  flushAll(): number
  getAggregateMetrics(): AggregateSimulatedPeerTransportMetrics
}

export interface AggregateSimulatedPeerTransportMetrics {
  readonly host: SimulatedPeerTransportMetrics
  readonly guest: SimulatedPeerTransportMetrics
  readonly combinedSentBytes: number
  readonly combinedDeliveredBytes: number
  readonly combinedLostBytes: number
  readonly combinedDeliveryRate: number
  readonly combinedByteLossRate: number
  readonly combinedAverageMessageBytes: number
  readonly combinedSentMessages: number
  readonly combinedDeliveredMessages: number
  readonly combinedDroppedMessages: number
  readonly combinedAverageLatencyMs: number
  readonly combinedMaxLatencyMs: number
  readonly combinedQueuedMessages: number
}

const combineAverageLatency = (
  host: SimulatedPeerTransportMetrics,
  guest: SimulatedPeerTransportMetrics
): number => {
  const deliveredMessages = host.deliveredMessages + guest.deliveredMessages
  if (deliveredMessages === 0) return 0
  const totalLatencyMs =
    host.averageLatencyMs * host.deliveredMessages +
    guest.averageLatencyMs * guest.deliveredMessages
  return totalLatencyMs / deliveredMessages
}

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole)

export const createSimulatedPeerTransportPair = <TClientToHostMessage, THostToClientMessage>(
  options: SimulatedPeerTransportPairOptions<TClientToHostMessage, THostToClientMessage>
): SimulatedPeerTransportPair<TClientToHostMessage, THostToClientMessage> => {
  const host = new SimulatedPeerTransport<TClientToHostMessage, THostToClientMessage>({
    localPeerId: options.hostPeerId || 'host',
    remotePeerId: options.guestPeerId || 'guest',
    inboundValidator: options.hostInboundValidator,
    now: options.now,
    random: options.random,
    network: options.network
  })
  const guest = new SimulatedPeerTransport<THostToClientMessage, TClientToHostMessage>({
    localPeerId: options.guestPeerId || 'guest',
    remotePeerId: options.hostPeerId || 'host',
    inboundValidator: options.guestInboundValidator,
    now: options.now,
    random: options.random,
    network: options.network
  })
  host.linkPeer(guest)
  guest.linkPeer(host)
  return {
    host,
    guest,
    flushReady: nowMs => host.flushReady(nowMs) + guest.flushReady(nowMs),
    flushAll: () => host.flushAll() + guest.flushAll(),
    getAggregateMetrics: () => {
      const hostMetrics = host.getMetrics()
      const guestMetrics = guest.getMetrics()
      const combinedSentBytes = hostMetrics.sentBytes + guestMetrics.sentBytes
      const combinedDeliveredBytes = hostMetrics.deliveredBytes + guestMetrics.deliveredBytes
      const combinedLostBytes = hostMetrics.lostBytes + guestMetrics.lostBytes
      const combinedSentMessages = hostMetrics.sentMessages + guestMetrics.sentMessages
      const combinedDeliveredMessages =
        hostMetrics.deliveredMessages + guestMetrics.deliveredMessages
      const combinedDroppedMessages = hostMetrics.droppedMessages + guestMetrics.droppedMessages
      return {
        host: hostMetrics,
        guest: guestMetrics,
        combinedSentBytes,
        combinedDeliveredBytes,
        combinedLostBytes,
        combinedDeliveryRate: ratio(combinedDeliveredMessages, combinedSentMessages),
        combinedByteLossRate: ratio(combinedLostBytes, combinedSentBytes),
        combinedAverageMessageBytes: ratio(combinedSentBytes, combinedSentMessages),
        combinedSentMessages,
        combinedDeliveredMessages,
        combinedDroppedMessages,
        combinedAverageLatencyMs: combineAverageLatency(hostMetrics, guestMetrics),
        combinedMaxLatencyMs: Math.max(hostMetrics.maxLatencyMs, guestMetrics.maxLatencyMs),
        combinedQueuedMessages: hostMetrics.queuedMessages + guestMetrics.queuedMessages
      }
    }
  }
}
