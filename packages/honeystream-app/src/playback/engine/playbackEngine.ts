import { Disposable } from '../adapters/shared/disposable'
import { DesiredPlaybackMedia } from '../adapters/shared/playbackAdapter'
import {
  normalizeDesiredPlaybackModel,
  normalizeSeekToleranceMs
} from './desiredPlayback'
import {
  PlaybackAdapterFactory,
  PlaybackEngineApplyResult,
  PlaybackEngineDesiredState,
  PlaybackEngineStateApplication
} from './playbackEngineContract'

const DEFAULT_SEEK_TOLERANCE_MS = 250

const cloneMedia = (media: DesiredPlaybackMedia): DesiredPlaybackMedia => ({
  ...media
})

const cloneDesiredState = (desiredState: PlaybackEngineDesiredState): PlaybackEngineDesiredState => ({
  media: desiredState.media ? cloneMedia(desiredState.media) : undefined,
  playback: { ...desiredState.playback },
  seekToleranceMs: desiredState.seekToleranceMs
})

export interface PlaybackEngineOptions {
  readonly adapterFactory: PlaybackAdapterFactory
  readonly defaultSeekToleranceMs?: number
}

export class PlaybackEngine implements PlaybackEngineStateApplication, Disposable {
  private readonly adapterFactory: PlaybackAdapterFactory
  private readonly defaultSeekToleranceMs: number

  private disposed = false
  private currentMediaId?: string
  private currentAdapter?: ReturnType<PlaybackAdapterFactory['createAdapter']>
  private lastDesiredState?: PlaybackEngineDesiredState

  constructor(options: PlaybackEngineOptions) {
    this.adapterFactory = options.adapterFactory
    this.defaultSeekToleranceMs = normalizeSeekToleranceMs(
      options.defaultSeekToleranceMs,
      DEFAULT_SEEK_TOLERANCE_MS
    )
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  getLastDesiredState(): PlaybackEngineDesiredState | undefined {
    return this.lastDesiredState ? cloneDesiredState(this.lastDesiredState) : undefined
  }

  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackEngineApplyResult> {
    this.assertNotDisposed()

    const normalizedPlayback = normalizeDesiredPlaybackModel(desiredState.playback)
    const seekToleranceMs = normalizeSeekToleranceMs(
      desiredState.seekToleranceMs,
      this.defaultSeekToleranceMs
    )
    const media = desiredState.media

    let adapterCreated = false
    let adapterDisposed = false
    let mediaChanged = false

    if (!media) {
      adapterDisposed = this.disposeCurrentAdapter()
      this.lastDesiredState = {
        playback: normalizedPlayback,
        seekToleranceMs
      }
      return {
        adapterCreated,
        mediaChanged,
        adapterDisposed,
        seekToleranceMs,
        appliedPlayback: normalizedPlayback
      }
    }

    const previousMediaId = this.currentMediaId
    const needsNewAdapter = !this.currentAdapter || previousMediaId !== media.mediaId

    if (needsNewAdapter) {
      adapterDisposed = this.disposeCurrentAdapter()
      mediaChanged = typeof previousMediaId === 'string' && previousMediaId !== media.mediaId
      this.currentAdapter = this.adapterFactory.createAdapter(media)
      this.currentMediaId = media.mediaId
      adapterCreated = true
      await this.currentAdapter.loadMedia({ media: cloneMedia(media) })
    }

    const activeAdapter = this.currentAdapter
    if (!activeAdapter) {
      throw new Error('PlaybackAdapter is unavailable for desired media.')
    }

    await activeAdapter.applyPlayback({
      desiredPlayback: normalizedPlayback,
      seekToleranceMs
    })

    this.lastDesiredState = {
      media: cloneMedia(media),
      playback: normalizedPlayback,
      seekToleranceMs
    }

    return {
      adapterCreated,
      mediaChanged,
      adapterDisposed,
      seekToleranceMs,
      appliedPlayback: normalizedPlayback
    }
  }

  dispose(): void {
    if (this.disposed) return

    this.disposed = true
    this.disposeCurrentAdapter()
    this.lastDesiredState = undefined
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('PlaybackEngine has been disposed.')
    }
  }

  private disposeCurrentAdapter(): boolean {
    if (!this.currentAdapter) return false

    const adapter = this.currentAdapter
    this.currentAdapter = undefined
    this.currentMediaId = undefined
    adapter.dispose()
    return true
  }
}
