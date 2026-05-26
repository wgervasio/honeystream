import {
  createPlaybackClock,
  derivePlaybackPosition,
  playPlayback,
  seekPlayback,
  setPlaybackDuration,
  setPlaybackRate
} from './playback-clock'

describe('domain/playback-clock', () => {
  it('derives position from host-adjusted clock time while playing', () => {
    const playback = playPlayback(createPlaybackClock(1000), 1000)
    expect(derivePlaybackPosition(playback, 2500)).toBe(1500)
  })

  it('preserves current position when playback rate changes', () => {
    const started = playPlayback(createPlaybackClock(0), 0)
    const next = setPlaybackRate(started, 2, 1000)
    expect(next.positionMs).toBe(1000)
    expect(next.rate).toBe(2)
  })

  it('clamps seek position to known duration', () => {
    const withDuration = setPlaybackDuration(createPlaybackClock(0), 5000, 0)
    const next = seekPlayback(withDuration, 9000, 100)
    expect(next.positionMs).toBe(5000)
  })
})
