import { DesiredPlaybackMedia } from '../adapters/shared/playbackAdapter'

export type PlaybackRuntimeAdapterKind = 'local-file' | 'embed-extension' | 'popup'

export interface PlaybackAdapterSelectionOptions {
  readonly forcePopup?: boolean
  readonly blockedEmbedHosts?: ReadonlySet<string>
  readonly blockHttpEmbeds?: boolean
}

const parseMediaUrl = (url: string): URL | undefined => {
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

const canUseEmbedAdapter = (
  media: DesiredPlaybackMedia,
  options: PlaybackAdapterSelectionOptions
): boolean => {
  const parsedUrl = parseMediaUrl(media.url)
  if (!parsedUrl) return true

  if (options.blockHttpEmbeds !== false && parsedUrl.protocol === 'http:') {
    return false
  }

  const blockedEmbedHosts = options.blockedEmbedHosts
  if (blockedEmbedHosts && blockedEmbedHosts.has(parsedUrl.host)) {
    return false
  }

  return true
}

export const selectPlaybackAdapterKind = (
  media: DesiredPlaybackMedia,
  options: PlaybackAdapterSelectionOptions = {}
): PlaybackRuntimeAdapterKind => {
  if (media.source === 'local-file') {
    return 'local-file'
  }

  if (options.forcePopup) {
    return 'popup'
  }

  return canUseEmbedAdapter(media, options) ? 'embed-extension' : 'popup'
}
