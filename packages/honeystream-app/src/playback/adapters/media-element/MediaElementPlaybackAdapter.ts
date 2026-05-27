import {
  DesiredPlaybackMedia,
  PlaybackAdapter,
  PlaybackAdapterApplyRequest,
  PlaybackAdapterLoadRequest
} from '../shared/playbackAdapter'
import { LocalFileAdapter, localFileMediaUrlToKey } from '../local-file'

export interface MediaElementPlaybackAdapterOptions {
  readonly getMediaElement: () => HTMLMediaElement | null
  readonly localFiles?: LocalFileAdapter
}

const DEFAULT_SEEK_TOLERANCE_MS = 250

const requireMediaElement = (getMediaElement: () => HTMLMediaElement | null): HTMLMediaElement => {
  const mediaElement = getMediaElement()
  if (!mediaElement) {
    throw new Error('Media element playback target is unavailable.')
  }

  return mediaElement
}

const resolveMediaUrl = (
  media: DesiredPlaybackMedia,
  localFiles: LocalFileAdapter | undefined
): string => {
  if (media.source !== 'local-file') {
    return media.url
  }

  const key = localFileMediaUrlToKey(media.url)
  if (!key || !localFiles) {
    throw new Error('Local file playback requires a registered local file.')
  }

  const objectUrl = localFiles.getLocalFileUrlByKey(key)
  if (!objectUrl) {
    throw new Error('Local file playback object URL is unavailable.')
  }

  return objectUrl
}

export class MediaElementPlaybackAdapter implements PlaybackAdapter {
  readonly kind = 'media-element'

  private readonly getMediaElement: () => HTMLMediaElement | null
  private readonly localFiles?: LocalFileAdapter
  private disposed = false
  private currentMediaId?: string

  constructor(options: MediaElementPlaybackAdapterOptions) {
    this.getMediaElement = options.getMediaElement
    this.localFiles = options.localFiles
  }

  loadMedia(request: PlaybackAdapterLoadRequest): void {
    this.assertNotDisposed()

    const mediaElement = requireMediaElement(this.getMediaElement)
    const mediaUrl = resolveMediaUrl(request.media, this.localFiles)
    if (this.currentMediaId === request.media.mediaId && mediaElement.currentSrc === mediaUrl) {
      return
    }

    this.currentMediaId = request.media.mediaId
    mediaElement.src = mediaUrl
    mediaElement.load()
  }

  async applyPlayback(request: PlaybackAdapterApplyRequest): Promise<void> {
    this.assertNotDisposed()

    const mediaElement = requireMediaElement(this.getMediaElement)
    const seekToleranceMs = request.seekToleranceMs || DEFAULT_SEEK_TOLERANCE_MS
    const desiredPositionSeconds = request.desiredPlayback.positionMs / 1000
    const seekToleranceSeconds = seekToleranceMs / 1000

    mediaElement.playbackRate = request.desiredPlayback.rate
    if (Math.abs(mediaElement.currentTime - desiredPositionSeconds) > seekToleranceSeconds) {
      mediaElement.currentTime = desiredPositionSeconds
    }

    if (request.desiredPlayback.state === 'playing') {
      await mediaElement.play()
      return
    }

    mediaElement.pause()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    const mediaElement = this.getMediaElement()
    if (mediaElement) {
      mediaElement.pause()
      mediaElement.removeAttribute('src')
      mediaElement.load()
    }
    this.currentMediaId = undefined
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('Media element playback adapter has been disposed.')
    }
  }
}

