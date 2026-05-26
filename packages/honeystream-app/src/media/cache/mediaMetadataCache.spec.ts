import { IMediaResponse, MediaType } from '../types'
import { MediaMetadataCache } from './mediaMetadataCache'

const createMediaResponse = (url: string): Readonly<IMediaResponse> => ({
  type: MediaType.Item,
  url,
  title: url,
  state: {}
})

describe('MediaMetadataCache', () => {
  it('uses a 32-entry default cap', () => {
    let nowMs = 100
    const cache = new MediaMetadataCache({ ttlMs: 1000, now: () => nowMs })

    for (let i = 0; i < 33; i++) {
      const key = `media:${i}`
      cache.set(key, createMediaResponse(`https://example.com/${i}`))
    }

    expect(cache.get('media:0')).toBeUndefined()
    expect(cache.get('media:1')).toEqual(createMediaResponse('https://example.com/1'))
    expect(cache.get('media:32')).toEqual(createMediaResponse('https://example.com/32'))
  })

  it('evicts the least recently used entry when capacity is exceeded', () => {
    let nowMs = 100
    const cache = new MediaMetadataCache({ capacity: 2, ttlMs: 1000, now: () => nowMs })

    cache.set('media:a', createMediaResponse('https://example.com/a'))
    cache.set('media:b', createMediaResponse('https://example.com/b'))

    // Update recency so media:b becomes least-recently-used
    expect(cache.get('media:a')).toEqual(createMediaResponse('https://example.com/a'))

    cache.set('media:c', createMediaResponse('https://example.com/c'))

    expect(cache.get('media:b')).toBeUndefined()
    expect(cache.get('media:a')).toEqual(createMediaResponse('https://example.com/a'))
    expect(cache.get('media:c')).toEqual(createMediaResponse('https://example.com/c'))
  })

  it('expires entries after ttl', () => {
    let nowMs = 100
    const cache = new MediaMetadataCache({ capacity: 2, ttlMs: 50, now: () => nowMs })

    cache.set('media:a', createMediaResponse('https://example.com/a'))

    nowMs = 149
    expect(cache.get('media:a')).toEqual(createMediaResponse('https://example.com/a'))

    nowMs = 150
    expect(cache.get('media:a')).toBeUndefined()
  })

  it('clears all entries', () => {
    const cache = new MediaMetadataCache({ capacity: 2, ttlMs: 1000 })
    cache.set('media:a', createMediaResponse('https://example.com/a'))
    cache.clear()
    expect(cache.get('media:a')).toBeUndefined()
  })
})
