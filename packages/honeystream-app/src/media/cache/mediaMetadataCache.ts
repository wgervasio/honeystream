import { IMediaResponse } from '../types'

export const DEFAULT_MEDIA_METADATA_CACHE_CAPACITY = 32
export const DEFAULT_MEDIA_METADATA_CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  readonly value: Readonly<IMediaResponse>
  readonly expiresAtMs: number
}

export interface MediaMetadataCacheOptions {
  readonly capacity?: number
  readonly ttlMs?: number
  readonly now?: () => number
}

const cloneMediaResponse = (media: Readonly<IMediaResponse>): Readonly<IMediaResponse> => ({
  ...media,
  thumbnails: media.thumbnails ? { ...media.thumbnails } : undefined,
  state: { ...media.state }
})

export class MediaMetadataCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly capacity: number
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(options: MediaMetadataCacheOptions = {}) {
    const capacity =
      typeof options.capacity === 'number'
        ? options.capacity
        : DEFAULT_MEDIA_METADATA_CACHE_CAPACITY
    const ttlMs =
      typeof options.ttlMs === 'number' ? options.ttlMs : DEFAULT_MEDIA_METADATA_CACHE_TTL_MS

    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Media metadata cache capacity must be a positive integer')
    }

    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('Media metadata cache ttl must be a positive finite number')
    }

    this.capacity = capacity
    this.ttlMs = ttlMs
    this.now = typeof options.now === 'function' ? options.now : Date.now
  }

  get(key: string): Readonly<IMediaResponse> | undefined {
    const entry = this.entries.get(key)
    if (!entry) {
      return undefined
    }

    if (entry.expiresAtMs <= this.now()) {
      this.entries.delete(key)
      return undefined
    }

    this.entries.delete(key)
    this.entries.set(key, entry)
    return cloneMediaResponse(entry.value)
  }

  set(key: string, value: Readonly<IMediaResponse>): void {
    this.entries.delete(key)
    this.entries.set(key, {
      value: cloneMediaResponse(value),
      expiresAtMs: this.now() + this.ttlMs
    })

    this.evictExpired()
    this.evictLeastRecentlyUsed()
  }

  clear(): void {
    this.entries.clear()
  }

  private evictExpired(): void {
    const nowMs = this.now()
    for (const [key, entry] of this.entries) {
      if (entry.expiresAtMs <= nowMs) {
        this.entries.delete(key)
      }
    }
  }

  private evictLeastRecentlyUsed(): void {
    while (this.entries.size > this.capacity) {
      const oldestEntry = this.entries.entries().next()
      if (oldestEntry.done) {
        return
      }

      const [oldestKey] = oldestEntry.value
      this.entries.delete(oldestKey)
    }
  }
}
