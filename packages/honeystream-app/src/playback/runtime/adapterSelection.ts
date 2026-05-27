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

const normalizeHost = (host: string): string =>
  host
    .trim()
    .toLowerCase()
    .replace(/^\./, '')

const hostMatches = (parsedUrl: URL, blockedHost: string): boolean => {
  const normalizedBlockedHost = normalizeHost(blockedHost)
  if (!normalizedBlockedHost) return false

  const normalizedHost = normalizeHost(parsedUrl.host)
  if (normalizedHost === normalizedBlockedHost) return true

  const normalizedHostname = normalizeHost(parsedUrl.hostname)
  return (
    normalizedHostname === normalizedBlockedHost ||
    normalizedHostname.endsWith(`.${normalizedBlockedHost}`)
  )
}

const isBlockedEmbedHost = (parsedUrl: URL, blockedEmbedHosts?: ReadonlySet<string>): boolean => {
  if (!blockedEmbedHosts) return false

  for (const blockedHost of blockedEmbedHosts) {
    if (hostMatches(parsedUrl, blockedHost)) return true
  }

  return false
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

  if (isBlockedEmbedHost(parsedUrl, options.blockedEmbedHosts)) {
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
