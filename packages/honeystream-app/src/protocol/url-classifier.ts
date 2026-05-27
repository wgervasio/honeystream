import { MediaKind } from './types'

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
