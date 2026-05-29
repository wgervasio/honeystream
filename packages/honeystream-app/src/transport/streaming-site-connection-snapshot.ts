import { classifyMediaUrl } from 'protocol'
import { MediaSnapshot, PlaybackSnapshot } from 'protocol/types'

const DEFAULT_DURATION_MS = 180000

interface StreamingSiteConnectionFixtureLike {
  readonly durationMs?: number | null
  readonly id: string
  readonly source: string
  readonly title?: string
}

export const toStreamingSiteMediaSnapshot = (
  fixture: StreamingSiteConnectionFixtureLike,
  index: number
): MediaSnapshot => {
  const source = fixture.source.trim()
  const durationMs =
    fixture.durationMs === null ? undefined : fixture.durationMs || DEFAULT_DURATION_MS

  return {
    mediaId: fixture.id || `streaming-site-${index + 1}`,
    kind: classifyMediaUrl(source),
    source,
    title: fixture.title || fixture.id,
    durationMs
  }
}

export const toStreamingSitePlaybackSnapshot = (
  media: MediaSnapshot,
  nowHostMs: number,
  positionMs: number,
  rate: number
): PlaybackSnapshot => ({
  state: 'playing',
  positionMs,
  updatedAtHostMs: nowHostMs,
  rate,
  durationMs: media.durationMs
})

export const resolveStreamingSiteSeekPositionMs = (media: MediaSnapshot, index: number): number => {
  const requestedPositionMs = 24000 + index * 1000
  if (typeof media.durationMs !== 'number') return requestedPositionMs
  return Math.min(requestedPositionMs, Math.max(0, media.durationMs - 1000))
}
