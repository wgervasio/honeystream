import { DesiredPlaybackMedia, PlaybackMediaSource } from '../shared/playbackAdapter'
import {
  createEmbedExtensionAdapter,
  EmbedExtensionAdapter,
  EmbedExtensionAdapterOptions,
  EmbedExtensionMessageTarget,
  EmbedExtensionOutboundDispatcher,
  EmbedExtensionRouting
} from './EmbedExtensionAdapter'
import { EmbedFrameOwnership } from './contracts'

const SUPPORTED_EMBED_MEDIA_SOURCES: readonly PlaybackMediaSource[] = ['direct-media', 'website']

const supportsEmbedMediaSource = (source: PlaybackMediaSource): boolean =>
  SUPPORTED_EMBED_MEDIA_SOURCES.indexOf(source) >= 0

export interface EmbedExtensionAdapterFactory {
  createAdapter(media: DesiredPlaybackMedia): EmbedExtensionAdapter
}

export interface EmbedExtensionAdapterFactoryOptions {
  readonly allowedOrigin: string
  readonly messageTarget: EmbedExtensionMessageTarget
  readonly outbound: EmbedExtensionOutboundDispatcher
  readonly resolveOwnership: (media: DesiredPlaybackMedia) => EmbedFrameOwnership
  readonly resolveRouting?: (media: DesiredPlaybackMedia) => EmbedExtensionRouting | undefined
  readonly diagnosticsLimit?: number
  readonly now?: () => number
  readonly dispatchToAllFrames?: boolean
  readonly supportsMedia?: (media: DesiredPlaybackMedia) => boolean
}

const toAdapterOptions = (
  media: DesiredPlaybackMedia,
  options: EmbedExtensionAdapterFactoryOptions
): EmbedExtensionAdapterOptions => ({
  allowedOrigin: options.allowedOrigin,
  ownership: options.resolveOwnership(media),
  routing: options.resolveRouting ? options.resolveRouting(media) : undefined,
  messageTarget: options.messageTarget,
  outbound: options.outbound,
  diagnosticsLimit: options.diagnosticsLimit,
  now: options.now,
  dispatchToAllFrames: options.dispatchToAllFrames
})

export const createEmbedExtensionAdapterFactory = (
  options: EmbedExtensionAdapterFactoryOptions
): EmbedExtensionAdapterFactory => ({
  createAdapter(media: DesiredPlaybackMedia): EmbedExtensionAdapter {
    const supportsMedia = options.supportsMedia
      ? options.supportsMedia(media)
      : supportsEmbedMediaSource(media.source)

    if (!supportsMedia) {
      throw new Error(`EmbedExtensionAdapterFactory does not support media source "${media.source}".`)
    }

    return createEmbedExtensionAdapter(toAdapterOptions(media, options))
  }
})
