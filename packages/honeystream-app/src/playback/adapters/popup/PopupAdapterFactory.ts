import { DesiredPlaybackMedia, PlaybackMediaSource } from '../shared/playbackAdapter'
import {
  createPopupAdapter,
  PopupAdapter,
  PopupAdapterOpenPopup,
  PopupAdapterOptions,
  PopupAdapterWindowApi
} from './PopupAdapter'

const SUPPORTED_POPUP_MEDIA_SOURCES: readonly PlaybackMediaSource[] = ['direct-media', 'website']

const supportsPopupMediaSource = (source: PlaybackMediaSource): boolean =>
  SUPPORTED_POPUP_MEDIA_SOURCES.indexOf(source) >= 0

export interface PopupAdapterFactory {
  createAdapter(media: DesiredPlaybackMedia): PopupAdapter
}

export interface PopupAdapterFactoryOptions {
  readonly popupWindowApi?: PopupAdapterWindowApi
  readonly openPopup?: PopupAdapterOpenPopup
  readonly popupTarget?: string
  readonly popupFeatures?: string
  readonly supportsMedia?: (media: DesiredPlaybackMedia) => boolean
}

const toAdapterOptions = (options: PopupAdapterFactoryOptions): PopupAdapterOptions => ({
  popupWindowApi: options.popupWindowApi,
  openPopup: options.openPopup,
  popupTarget: options.popupTarget,
  popupFeatures: options.popupFeatures
})

export const createPopupAdapterFactory = (
  options: PopupAdapterFactoryOptions = {}
): PopupAdapterFactory => ({
  createAdapter(media: DesiredPlaybackMedia): PopupAdapter {
    const supportsMedia = options.supportsMedia
      ? options.supportsMedia(media)
      : supportsPopupMediaSource(media.source)

    if (!supportsMedia) {
      throw new Error(`PopupAdapterFactory does not support media source "${media.source}".`)
    }

    return createPopupAdapter(toAdapterOptions(options))
  }
})
