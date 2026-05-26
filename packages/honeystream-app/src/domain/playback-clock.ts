export type PlaybackClockState = 'idle' | 'playing' | 'paused'

export interface PlaybackClockModel {
  readonly state: PlaybackClockState
  readonly positionMs: number
  readonly updatedAtHostMs: number
  readonly rate: number
  readonly durationMs?: number
}

export const MIN_PLAYBACK_RATE = 0.25
export const MAX_PLAYBACK_RATE = 4
export const DEFAULT_PLAYBACK_RATE = 1

const normalizeFinite = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback

const normalizeHostTime = (timestampMs: number): number => normalizeFinite(timestampMs, 0)

const normalizeDuration = (durationMs: number | undefined): number | undefined =>
  typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0
    ? durationMs
    : undefined

export const clampPlaybackPosition = (positionMs: number, durationMs?: number): number => {
  const normalized = Math.max(0, normalizeFinite(positionMs, 0))
  if (typeof durationMs !== 'number') return normalized
  return Math.min(normalized, durationMs)
}

export const clampPlaybackRate = (rate: number): number =>
  Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, normalizeFinite(rate, DEFAULT_PLAYBACK_RATE)))

export const createPlaybackClock = (nowHostMs: number): PlaybackClockModel => ({
  state: 'idle',
  positionMs: 0,
  updatedAtHostMs: normalizeHostTime(nowHostMs),
  rate: DEFAULT_PLAYBACK_RATE
})

export const resetPlaybackClock = (nowHostMs: number): PlaybackClockModel => createPlaybackClock(nowHostMs)

export const derivePlaybackPosition = (
  playback: PlaybackClockModel,
  nowAdjustedToHostMs: number
): number => {
  const durationMs = normalizeDuration(playback.durationMs)
  const basePosition = clampPlaybackPosition(playback.positionMs, durationMs)
  if (playback.state !== 'playing') {
    return basePosition
  }

  const now = normalizeHostTime(nowAdjustedToHostMs)
  const updatedAt = normalizeHostTime(playback.updatedAtHostMs)
  const elapsed = Math.max(0, now - updatedAt)
  const rate = clampPlaybackRate(playback.rate)
  return clampPlaybackPosition(basePosition + elapsed * rate, durationMs)
}

const withPlaybackState = (
  playback: PlaybackClockModel,
  state: PlaybackClockState,
  nowHostMs: number
): PlaybackClockModel => {
  const now = normalizeHostTime(nowHostMs)
  const positionMs = derivePlaybackPosition(playback, now)
  const durationMs = normalizeDuration(playback.durationMs)
  return {
    ...playback,
    state,
    positionMs,
    updatedAtHostMs: now,
    rate: clampPlaybackRate(playback.rate),
    durationMs
  }
}

export const playPlayback = (playback: PlaybackClockModel, nowHostMs: number): PlaybackClockModel =>
  withPlaybackState(playback, 'playing', nowHostMs)

export const pausePlayback = (playback: PlaybackClockModel, nowHostMs: number): PlaybackClockModel =>
  withPlaybackState(playback, 'paused', nowHostMs)

export const seekPlayback = (
  playback: PlaybackClockModel,
  positionMs: number,
  nowHostMs: number
): PlaybackClockModel => ({
  ...playback,
  positionMs: clampPlaybackPosition(positionMs, normalizeDuration(playback.durationMs)),
  updatedAtHostMs: normalizeHostTime(nowHostMs),
  rate: clampPlaybackRate(playback.rate),
  durationMs: normalizeDuration(playback.durationMs)
})

export const setPlaybackRate = (
  playback: PlaybackClockModel,
  rate: number,
  nowHostMs: number
): PlaybackClockModel => {
  const now = normalizeHostTime(nowHostMs)
  const positionMs = derivePlaybackPosition(playback, now)
  return {
    ...playback,
    positionMs,
    updatedAtHostMs: now,
    rate: clampPlaybackRate(rate),
    durationMs: normalizeDuration(playback.durationMs)
  }
}

export const setPlaybackDuration = (
  playback: PlaybackClockModel,
  durationMs: number | undefined,
  nowHostMs: number
): PlaybackClockModel => {
  const normalizedDuration = normalizeDuration(durationMs)
  const now = normalizeHostTime(nowHostMs)
  const positionMs = derivePlaybackPosition(playback, now)
  return {
    ...playback,
    positionMs: clampPlaybackPosition(positionMs, normalizedDuration),
    updatedAtHostMs: now,
    durationMs: normalizedDuration,
    rate: clampPlaybackRate(playback.rate)
  }
}
