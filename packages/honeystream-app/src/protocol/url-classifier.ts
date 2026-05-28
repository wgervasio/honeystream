import { MediaKind } from './types'

export type MediaProvider = 'youtube' | 'animepahe' | 'cineby' | 'miruro' | 'unknown'

const LOCAL_FILE_PROTOCOL = 'honeystream-local:'
const DIRECT_MEDIA_EXTENSIONS = Object.freeze([
  '.aac',
  '.flac',
  '.m3u8',
  '.m4v',
  '.mkv',
  '.mov',
  '.mp3',
  '.mp4',
  '.mpd',
  '.oga',
  '.ogg',
  '.ogv',
  '.opus',
  '.wav',
  '.webm'
])

const parseMediaUrl = (source: string): URL | undefined => {
  try {
    return new URL(source)
  } catch {
    return undefined
  }
}

const hasDirectMediaExtension = (url: URL): boolean => {
  const pathname = url.pathname.toLowerCase()
  return DIRECT_MEDIA_EXTENSIONS.some(extension => pathname.endsWith(extension))
}

const normalizeHostname = (hostname: string): string =>
  hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')

const isHostOrSubdomain = (hostname: string, domain: string): boolean =>
  hostname === domain || hostname.endsWith(`.${domain}`)

const hasSecondLevelDomain = (hostname: string, secondLevelDomain: string): boolean => {
  const labels = hostname.split('.').filter(label => label.length > 0)
  if (labels.length < 2) return false

  return labels[labels.length - 2] === secondLevelDomain
}

export const classifyMediaUrl = (source: string): MediaKind => {
  const trimmedSource = source.trim()
  if (!trimmedSource) {
    return 'url'
  }

  const parsedUrl = parseMediaUrl(trimmedSource)
  if (!parsedUrl) {
    return 'url'
  }

  if (parsedUrl.protocol === LOCAL_FILE_PROTOCOL) {
    return 'localFile'
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return 'url'
  }

  return hasDirectMediaExtension(parsedUrl) ? 'url' : 'website'
}

export const classifyMediaProvider = (source: string): MediaProvider => {
  const parsedUrl = parseMediaUrl(source.trim())
  if (!parsedUrl) return 'unknown'

  const hostname = normalizeHostname(parsedUrl.hostname)

  if (
    isHostOrSubdomain(hostname, 'youtube.com') ||
    isHostOrSubdomain(hostname, 'youtube-nocookie.com') ||
    isHostOrSubdomain(hostname, 'youtu.be')
  ) {
    return 'youtube'
  }

  if (hasSecondLevelDomain(hostname, 'animepahe')) return 'animepahe'
  if (hasSecondLevelDomain(hostname, 'cineby')) return 'cineby'
  if (hasSecondLevelDomain(hostname, 'miruro')) return 'miruro'

  return 'unknown'
}
