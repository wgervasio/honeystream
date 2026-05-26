import { cleanObject } from 'utils/object'
import compose from './compose'

import { IMediaMiddleware, IMediaRequest, IMediaResponse, IMediaContext, MediaType } from './types'

import baseMware from './middleware/base'
import subredditMware from './middleware/subreddit'
import youTubeMware from './middleware/youtube'
import youTubePlaylistMware from './middleware/youtube-playlist'
import httpHeadMware from './middleware/httpHead'
import mediaMware from './middleware/media'
import htmlMware from './middleware/html'
import openGraphMware from './middleware/openGraph'
import oEmbedMware from './middleware/oembed'
import autoplayMware from './middleware/autoplay'
import microdataMware from './middleware/microdata'
import imgurMware from './middleware/imgur'
import preventDownloadMware from './middleware/preventDownload'
import { MediaMetadataCache } from './cache/mediaMetadataCache'

import { IMediaItem } from 'lobby/reducers/mediaPlayer'

// prettier-ignore
const middlewares: IMediaMiddleware[] = [
  baseMware,

  subredditMware,
  youTubePlaylistMware,

  httpHeadMware,
  preventDownloadMware,
  mediaMware,
  htmlMware,

  youTubeMware,
  imgurMware,

  openGraphMware,
  oEmbedMware,
  microdataMware,
  autoplayMware
];

type MediaUrl = URL
const mediaMetadataCache = new MediaMetadataCache()

/**
 * Context: Media requests frequently repeat the same URL in short windows.
 * Invariant: Metadata lookup must stay bounded and preserve middleware behavior on misses.
 * Options considered: no cache, unbounded map, bounded TTL+LRU cache.
 * Decision: Use a 32-entry default LRU/TTL cache at the resolver boundary.
 * Performance impact: Avoids repeated metadata fetches for hot URLs.
 * Memory/lifecycle ownership: media/index.ts owns the cache and exposes clearMediaResolverCache().
 * Failure mode: Expired or evicted entries transparently fall back to middleware resolution.
 * Validation: media/cache/mediaMetadataCache.spec.ts covers cap, LRU recency, TTL, and clear.
 */
export const clearMediaResolverCache = () => {
  mediaMetadataCache.clear()
}

const createContext = (url: MediaUrl) => {
  const req: IMediaRequest = {
    type: MediaType.Item,
    url,

    // TODO: add user info for logging middleware
    user: null
  }

  const res: IMediaResponse = {
    type: MediaType.Item,
    url: url.href,
    state: {}
  }

  const ctx: IMediaContext = {
    req,
    res,
    state: {}
  }

  return ctx
}

const finalizeMedia = (media: IMediaResponse) => {
  if (media.description) {
    const desc = media.description.trim()
    media.description = desc || undefined
  }
  return cleanObject(media)
}

export const resolveMediaUrl = async (url: string): Promise<Readonly<IMediaResponse> | null> => {
  const urlObj: MediaUrl = new URL(url)
  if (!urlObj.href) {
    return null
  }

  const cachedMedia = mediaMetadataCache.get(urlObj.href)
  if (cachedMedia) {
    return cachedMedia
  }

  const ctx = createContext(urlObj)

  const fn = compose(middlewares)
  const result = (await fn(ctx)) || ctx.res
  const finalizedMedia = finalizeMedia(result)
  mediaMetadataCache.set(urlObj.href, finalizedMedia)
  console.debug('Resolved media', ctx)
  return finalizedMedia
}

export const resolveMediaPlaylist = async (
  media: IMediaItem
): Promise<Readonly<IMediaResponse> | null> => {
  const urlObj: MediaUrl = new URL(media.url)
  if (!urlObj.href) {
    return null
  }

  const ctx = createContext(urlObj)

  // Transfer old state to new request
  ctx.req = {
    ...ctx.req,
    type: media.type,
    state: media.state
  }

  console.log('resolving playlist', ctx)

  const fn = compose(middlewares)
  const result = (await fn(ctx)) || ctx.res
  return finalizeMedia(result)
}
