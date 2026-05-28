import { MediaKind } from './types'

export type MediaProvider = 'youtube' | 'animepahe' | 'cineby' | 'miruro' | 'unknown'
type KnownMediaProvider = Exclude<MediaProvider, 'unknown'>

interface ProviderDomainSet {
  readonly provider: KnownMediaProvider
  readonly domains: readonly string[]
}

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
const PROVIDER_DOMAIN_SETS: readonly ProviderDomainSet[] = [
  {
    provider: 'youtube',
    domains: ['youtube.com', 'youtube-nocookie.com', 'youtu.be']
  },
  {
    provider: 'animepahe',
    domains: ['animepahe.com', 'animepahe.ru', 'animepahe.si']
  },
  {
    provider: 'cineby',
    domains: ['cineby.app', 'cineby.ru', 'cineby.to']
  },
  {
    provider: 'miruro',
    domains: ['miruro.to', 'miruro.tv']
  }
]

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

  if (classifyMediaProvider(parsedUrl.toString()) !== 'unknown') {
    return 'website'
  }

  return hasDirectMediaExtension(parsedUrl) ? 'url' : 'website'
}

export const classifyMediaProvider = (source: string): MediaProvider => {
  const parsedUrl = parseMediaUrl(source.trim())
  if (!parsedUrl) return 'unknown'

  const hostname = normalizeHostname(parsedUrl.hostname)

  for (const domainSet of PROVIDER_DOMAIN_SETS) {
    if (domainSet.domains.some(domain => isHostOrSubdomain(hostname, domain))) {
      return domainSet.provider
    }
  }

  return 'unknown'
}
