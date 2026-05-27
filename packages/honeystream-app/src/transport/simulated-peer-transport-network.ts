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
