import { DesiredPlaybackModel } from '../adapters/shared/playbackAdapter'

const clampToRange = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const assertFiniteNonNegative = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`)
  }
}

const clampPosition = (positionMs: number, durationMs?: number): number => {
  if (typeof durationMs === 'undefined') return Math.max(positionMs, 0)
  return clampToRange(positionMs, 0, durationMs)
}

export const normalizeDesiredPlaybackModel = (
  desiredPlayback: DesiredPlaybackModel
): DesiredPlaybackModel => {
  assertFiniteNonNegative('positionMs', desiredPlayback.positionMs)
  assertFiniteNonNegative('updatedAtHostMs', desiredPlayback.updatedAtHostMs)

  if (!Number.isFinite(desiredPlayback.rate) || desiredPlayback.rate <= 0) {
    throw new RangeError('rate must be a finite number greater than 0.')
  }

  if (typeof desiredPlayback.durationMs !== 'undefined') {
    assertFiniteNonNegative('durationMs', desiredPlayback.durationMs)
  }

  const normalizedPositionMs = clampPosition(desiredPlayback.positionMs, desiredPlayback.durationMs)
  if (normalizedPositionMs === desiredPlayback.positionMs) return desiredPlayback

  return {
    ...desiredPlayback,
    positionMs: normalizedPositionMs
  }
}

export const deriveDesiredPlaybackPositionMs = (
  desiredPlayback: DesiredPlaybackModel,
  hostAdjustedNowMs: number
): number => {
  const normalized = normalizeDesiredPlaybackModel(desiredPlayback)
  assertFiniteNonNegative('hostAdjustedNowMs', hostAdjustedNowMs)

  if (normalized.state !== 'playing') return normalized.positionMs

  const elapsedMs = hostAdjustedNowMs - normalized.updatedAtHostMs
  const nextPositionMs = normalized.positionMs + elapsedMs * normalized.rate
  return clampPosition(nextPositionMs, normalized.durationMs)
}

export const normalizeSeekToleranceMs = (
  requestedSeekToleranceMs: number | undefined,
  defaultSeekToleranceMs: number
): number => {
  assertFiniteNonNegative('defaultSeekToleranceMs', defaultSeekToleranceMs)

  if (typeof requestedSeekToleranceMs === 'undefined') {
    return defaultSeekToleranceMs
  }

  assertFiniteNonNegative('seekToleranceMs', requestedSeekToleranceMs)
  return requestedSeekToleranceMs
}
