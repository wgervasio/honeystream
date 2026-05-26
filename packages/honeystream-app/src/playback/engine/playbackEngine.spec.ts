import {
  DesiredPlaybackMedia,
  DesiredPlaybackModel,
  PlaybackAdapter,
  PlaybackAdapterApplyRequest,
  PlaybackAdapterLoadRequest
} from '../adapters/shared/playbackAdapter'
import { PlaybackEngine } from './playbackEngine'

class FakePlaybackAdapter implements PlaybackAdapter {
  public readonly kind = 'fake-playback-adapter'
  public readonly loadRequests: PlaybackAdapterLoadRequest[] = []
  public readonly applyRequests: PlaybackAdapterApplyRequest[] = []
  public disposeCallCount = 0

  loadMedia(request: PlaybackAdapterLoadRequest): void {
    this.loadRequests.push(request)
  }

  applyPlayback(request: PlaybackAdapterApplyRequest): void {
    this.applyRequests.push(request)
  }

  dispose(): void {
    this.disposeCallCount += 1
  }
}

const createMedia = (mediaId: string): DesiredPlaybackMedia => ({
  mediaId,
  source: 'direct-media',
  url: `https://example.com/${mediaId}.mp4`
})

const createPlayback = (overrides: Partial<DesiredPlaybackModel> = {}): DesiredPlaybackModel => ({
  state: 'playing',
  positionMs: 1000,
  updatedAtHostMs: 5000,
  rate: 1,
  durationMs: 20000,
  ...overrides
})

const createHarness = () => {
  const createdAdapters: FakePlaybackAdapter[] = []
  const adapterMedia: DesiredPlaybackMedia[] = []

  const engine = new PlaybackEngine({
    adapterFactory: {
      createAdapter(media) {
        adapterMedia.push(media)
        const adapter = new FakePlaybackAdapter()
        createdAdapters.push(adapter)
        return adapter
      }
    },
    defaultSeekToleranceMs: 180
  })

  return {
    engine,
    createdAdapters,
    adapterMedia
  }
}

describe('PlaybackEngine', () => {
  it('creates an adapter and applies playback for first media', async () => {
    const { engine, createdAdapters, adapterMedia } = createHarness()
    const media = createMedia('media-1')
    const playback = createPlayback()

    const result = await engine.applyDesiredState({ media, playback })

    expect(adapterMedia).toEqual([media])
    expect(createdAdapters).toHaveLength(1)
    expect(createdAdapters[0].loadRequests).toHaveLength(1)
    expect(createdAdapters[0].applyRequests).toHaveLength(1)
    expect(result.adapterCreated).toBe(true)
    expect(result.mediaChanged).toBe(false)
    expect(result.adapterDisposed).toBe(false)
    expect(result.seekToleranceMs).toBe(180)
    expect(result.appliedPlayback).toEqual(playback)
  })

  it('reuses the current adapter when media does not change', async () => {
    const { engine, createdAdapters } = createHarness()
    const media = createMedia('media-1')

    await engine.applyDesiredState({ media, playback: createPlayback({ positionMs: 1000 }) })
    const result = await engine.applyDesiredState({
      media,
      playback: createPlayback({ positionMs: 2000 })
    })

    expect(createdAdapters).toHaveLength(1)
    expect(createdAdapters[0].loadRequests).toHaveLength(1)
    expect(createdAdapters[0].applyRequests).toHaveLength(2)
    expect(result.adapterCreated).toBe(false)
    expect(result.adapterDisposed).toBe(false)
    expect(result.mediaChanged).toBe(false)
  })

  it('disposes the previous adapter when media changes', async () => {
    const { engine, createdAdapters } = createHarness()

    await engine.applyDesiredState({
      media: createMedia('media-1'),
      playback: createPlayback()
    })
    const result = await engine.applyDesiredState({
      media: createMedia('media-2'),
      playback: createPlayback({ positionMs: 500 })
    })

    expect(createdAdapters).toHaveLength(2)
    expect(createdAdapters[0].disposeCallCount).toBe(1)
    expect(createdAdapters[1].disposeCallCount).toBe(0)
    expect(result.adapterCreated).toBe(true)
    expect(result.adapterDisposed).toBe(true)
    expect(result.mediaChanged).toBe(true)
  })

  it('disposes the active adapter when desired media is cleared', async () => {
    const { engine, createdAdapters } = createHarness()

    await engine.applyDesiredState({
      media: createMedia('media-1'),
      playback: createPlayback()
    })
    const result = await engine.applyDesiredState({
      playback: createPlayback({
        state: 'idle',
        positionMs: 0
      })
    })

    expect(createdAdapters).toHaveLength(1)
    expect(createdAdapters[0].disposeCallCount).toBe(1)
    expect(createdAdapters[0].applyRequests).toHaveLength(1)
    expect(result.adapterCreated).toBe(false)
    expect(result.adapterDisposed).toBe(true)
  })

  it('throws when applying state after disposal', async () => {
    const { engine } = createHarness()
    engine.dispose()

    await expect(
      engine.applyDesiredState({
        media: createMedia('media-1'),
        playback: createPlayback()
      })
    ).rejects.toThrow('PlaybackEngine has been disposed.')
  })

  it('stores the last desired state snapshot', async () => {
    const { engine } = createHarness()
    const media = createMedia('media-1')
    const playback = createPlayback({ positionMs: 7500 })

    await engine.applyDesiredState({ media, playback, seekToleranceMs: 90 })

    expect(engine.getLastDesiredState()).toEqual({
      media,
      playback,
      seekToleranceMs: 90
    })
  })
})
