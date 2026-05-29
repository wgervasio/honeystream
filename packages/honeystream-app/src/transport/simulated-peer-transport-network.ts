import { MAX_SIMULATED_FRAMES, SimulatedPeerNetworkProfile } from './simulated-peer-transport-types'

type RandomSource = () => number

const toFiniteNumber = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const nonNegative = (value: number): number => Math.max(0, value)

const unitSample = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 0.999999
  return value
}

const normalizeDropRate = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

export const shouldDropFrame = (
  sentMessageCount: number,
  network: SimulatedPeerNetworkProfile,
  random: RandomSource
): boolean => {
  const every = network.dropEveryNthMessage
  if (typeof every === 'number' && every > 0 && sentMessageCount % every === 0) {
    return true
  }

  const dropRate = normalizeDropRate(network.dropRate)
  return dropRate > 0 && unitSample(random()) < dropRate
}

export const shouldRetransmitDroppedFrame = (network: SimulatedPeerNetworkProfile): boolean =>
  network.retransmitDroppedFrames === true

/*
Context: Mock host/guest connection tests model asymmetric links for streaming-site tuning.
Invariant: A directional profile describes frames arriving at that endpoint, including latency,
drop, and queue pressure.
Options considered: Sender-side drops, receiver-side drops, reliable retry, or a separate link object.
Decision: Apply drop decisions on the receiving transport and optionally model ordered reliable
retransmission as extra latency so hostNetwork and guestNetwork mean one direction consistently.
Performance impact: Drop/retry checks remain O(1), and pending frames still enter one bounded queue.
Memory/lifecycle ownership: No new resources; pending frames remain capped by the receiver profile.
Failure mode: Dropped frames return a typed network-drop outcome; retried frames deliver later.
Validation: Covered by simulated-peer-transport asymmetric profile tests.
*/

export const resolveFrameLatencyMs = (
  network: SimulatedPeerNetworkProfile,
  random: RandomSource
): number => {
  const latencyMs = nonNegative(toFiniteNumber(network.latencyMs, 0))
  const jitterMs = nonNegative(toFiniteNumber(network.jitterMs, 0))
  if (jitterMs === 0) return latencyMs

  const jitterOffsetMs = (unitSample(random()) * 2 - 1) * jitterMs
  return nonNegative(latencyMs + jitterOffsetMs)
}

export const resolveRetransmitDelayMs = (network: SimulatedPeerNetworkProfile): number =>
  nonNegative(toFiniteNumber(network.retransmitDelayMs, toFiniteNumber(network.latencyMs, 0)))

export const resolveMaxQueuedFrames = (network: SimulatedPeerNetworkProfile): number => {
  const maxQueuedFrames = network.maxQueuedFrames
  if (
    typeof maxQueuedFrames === 'number' &&
    Number.isFinite(maxQueuedFrames) &&
    Number.isInteger(maxQueuedFrames) &&
    maxQueuedFrames > 0
  ) {
    return maxQueuedFrames
  }

  return MAX_SIMULATED_FRAMES
}
