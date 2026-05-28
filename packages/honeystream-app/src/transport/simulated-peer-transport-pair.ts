import { TransportMessageValidator } from './contracts'
import { SimulatedPeerTransport } from './simulated-peer-transport'
import {
  Clock,
  SimulatedPeerNetworkProfile,
  SimulatedPeerTransportFrameSample,
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
  readonly hostNetwork?: SimulatedPeerNetworkProfile
  readonly guestNetwork?: SimulatedPeerNetworkProfile
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
  readonly combinedMaxMessageBytes: number
  readonly combinedSentMessages: number
  readonly combinedDeliveredMessages: number
  readonly combinedDroppedMessages: number
  readonly combinedOutOfOrderMessages: number
  readonly combinedSequenceGapMessages: number
  readonly combinedAverageLatencyMs: number
  readonly maxDirectionalAverageLatencyJitterMs: number
  readonly combinedP50LatencyMs: number
  readonly combinedP95LatencyMs: number
  readonly combinedMaxLatencyMs: number
  readonly maxDirectionalLatencyJitterMs: number
  readonly combinedQueuedMessages: number
  readonly combinedPeakQueuedMessages: number
  readonly maxDirectionalAverageLatencyMs: number
  readonly directionalAverageLatencySkewMs: number
  readonly maxDirectionalByteLossRate: number
  readonly maxDirectionalQueuedMessages: number
  readonly maxDirectionalPeakQueuedMessages: number
  readonly estimatedRoundTripP95LatencyMs: number
  readonly estimatedRoundTripMaxLatencyMs: number
  readonly recentFrames: readonly SimulatedPeerTransportFrameSample[]
}

const MAX_AGGREGATE_RECENT_FRAMES = 128
const MAX_PAIR_FLUSH_PASSES = 64

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

const combineRecentFrames = (
  host: SimulatedPeerTransportMetrics,
  guest: SimulatedPeerTransportMetrics
): readonly SimulatedPeerTransportFrameSample[] =>
  [...host.recentFrames, ...guest.recentFrames]
    .sort((left, right) => left.recordedAtMs - right.recordedAtMs || left.seq - right.seq)
    .slice(-MAX_AGGREGATE_RECENT_FRAMES)

export const createSimulatedPeerTransportPair = <TClientToHostMessage, THostToClientMessage>(
  options: SimulatedPeerTransportPairOptions<TClientToHostMessage, THostToClientMessage>
): SimulatedPeerTransportPair<TClientToHostMessage, THostToClientMessage> => {
  const host = new SimulatedPeerTransport<TClientToHostMessage, THostToClientMessage>({
    localPeerId: options.hostPeerId || 'host',
    remotePeerId: options.guestPeerId || 'guest',
    inboundValidator: options.hostInboundValidator,
    now: options.now,
    random: options.random,
    network: options.hostNetwork || options.network
  })
  const guest = new SimulatedPeerTransport<THostToClientMessage, TClientToHostMessage>({
    localPeerId: options.guestPeerId || 'guest',
    remotePeerId: options.hostPeerId || 'host',
    inboundValidator: options.guestInboundValidator,
    now: options.now,
    random: options.random,
    network: options.guestNetwork || options.network
  })
  host.linkPeer(guest)
  guest.linkPeer(host)
  return {
    host,
    guest,
    flushReady: nowMs => host.flushReady(nowMs) + guest.flushReady(nowMs),
    flushAll: () => {
      let delivered = 0
      for (let pass = 0; pass < MAX_PAIR_FLUSH_PASSES; pass += 1) {
        const passDelivered = host.flushAll() + guest.flushAll()
        delivered += passDelivered
        if (passDelivered === 0) return delivered
      }
      throw new Error('SimulatedPeerTransportPair.flushAll exceeded the bounded flush pass cap.')
    },
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
      const combinedOutOfOrderMessages =
        hostMetrics.outOfOrderMessages + guestMetrics.outOfOrderMessages
      const combinedSequenceGapMessages =
        hostMetrics.sequenceGapMessages + guestMetrics.sequenceGapMessages
      const combinedPeakQueuedMessages =
        hostMetrics.peakQueuedMessages + guestMetrics.peakQueuedMessages
      const maxDirectionalAverageLatencyMs = Math.max(
        hostMetrics.averageLatencyMs,
        guestMetrics.averageLatencyMs
      )
      return {
        host: hostMetrics,
        guest: guestMetrics,
        combinedSentBytes,
        combinedDeliveredBytes,
        combinedLostBytes,
        combinedDeliveryRate: ratio(combinedDeliveredMessages, combinedSentMessages),
        combinedByteLossRate: ratio(combinedLostBytes, combinedSentBytes),
        combinedAverageMessageBytes: ratio(combinedSentBytes, combinedSentMessages),
        combinedMaxMessageBytes: Math.max(
          hostMetrics.maxMessageBytes,
          guestMetrics.maxMessageBytes
        ),
        combinedSentMessages,
        combinedDeliveredMessages,
        combinedDroppedMessages,
        combinedOutOfOrderMessages,
        combinedSequenceGapMessages,
        combinedAverageLatencyMs: combineAverageLatency(hostMetrics, guestMetrics),
        maxDirectionalAverageLatencyJitterMs: Math.max(
          hostMetrics.averageLatencyJitterMs,
          guestMetrics.averageLatencyJitterMs
        ),
        combinedP50LatencyMs: Math.max(hostMetrics.p50LatencyMs, guestMetrics.p50LatencyMs),
        combinedP95LatencyMs: Math.max(hostMetrics.p95LatencyMs, guestMetrics.p95LatencyMs),
        combinedMaxLatencyMs: Math.max(hostMetrics.maxLatencyMs, guestMetrics.maxLatencyMs),
        maxDirectionalLatencyJitterMs: Math.max(
          hostMetrics.maxLatencyJitterMs,
          guestMetrics.maxLatencyJitterMs
        ),
        combinedQueuedMessages: hostMetrics.queuedMessages + guestMetrics.queuedMessages,
        combinedPeakQueuedMessages,
        maxDirectionalAverageLatencyMs,
        directionalAverageLatencySkewMs: Math.abs(
          hostMetrics.averageLatencyMs - guestMetrics.averageLatencyMs
        ),
        maxDirectionalByteLossRate: Math.max(hostMetrics.byteLossRate, guestMetrics.byteLossRate),
        maxDirectionalQueuedMessages: Math.max(
          hostMetrics.queuedMessages,
          guestMetrics.queuedMessages
        ),
        maxDirectionalPeakQueuedMessages: Math.max(
          hostMetrics.peakQueuedMessages,
          guestMetrics.peakQueuedMessages
        ),
        estimatedRoundTripP95LatencyMs: hostMetrics.p95LatencyMs + guestMetrics.p95LatencyMs,
        estimatedRoundTripMaxLatencyMs: hostMetrics.maxLatencyMs + guestMetrics.maxLatencyMs,
        recentFrames: combineRecentFrames(hostMetrics, guestMetrics)
      }
    }
  }
}
