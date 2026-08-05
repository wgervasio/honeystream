import { SessionMediaItem } from '../../domain/session-state'
import {
  mapSessionMediaItemToQueueMediaItem,
  mapSessionQueueStateToQueueProps,
  mapSessionQueueStateToQueueViewProps
} from './mapQueueStateToProps'

const makeMedia = (id: string, title: string, requestedBy: string): SessionMediaItem => ({
  id,
  title,
  requestedBy,
  url: `https://example.com/${id}`
})

describe('mapSessionMediaItemToQueueMediaItem', () => {
  it('maps session media item fields used by queue UI', () => {
    const mapped = mapSessionMediaItemToQueueMediaItem(makeMedia('media-1', 'Title', 'HostUser'))

    expect(mapped).toEqual({
      id: 'media-1',
      title: 'Title',
      requestedBy: 'HostUser',
      durationMs: undefined,
      kind: undefined,
      source: 'https://example.com/media-1'
    })
  })
})

describe('mapSessionQueueStateToQueueViewProps', () => {
  it('maps current and queued items from session queue state', () => {
    const mapped = mapSessionQueueStateToQueueViewProps({
      current: makeMedia('current-1', 'Current title', 'HostUser'),
      queue: [makeMedia('queued-1', 'Queued title', 'GuestUser')]
    })

    expect(mapped.currentItem).toEqual({
      id: 'current-1',
      title: 'Current title',
      requestedBy: 'HostUser',
      durationMs: undefined,
      kind: undefined,
      source: 'https://example.com/current-1'
    })
    expect(mapped.queuedItems).toEqual([
      {
        id: 'queued-1',
        title: 'Queued title',
        requestedBy: 'GuestUser',
        durationMs: undefined,
        kind: undefined,
        source: 'https://example.com/queued-1'
      }
    ])
  })

  it('returns undefined current item when there is no active media', () => {
    const mapped = mapSessionQueueStateToQueueViewProps({
      current: undefined,
      queue: []
    })

    expect(mapped.currentItem).toBeUndefined()
    expect(mapped.queuedItems).toEqual([])
  })
})

describe('mapSessionQueueStateToQueueProps', () => {
  it('adds next and remove intents as passthrough callbacks', () => {
    const onNext = jest.fn()
    const onRemove = jest.fn()

    const mapped = mapSessionQueueStateToQueueProps(
      {
        current: undefined,
        queue: [makeMedia('queued-1', 'Queued title', 'HostUser')]
      },
      {
        onNext,
        onRemove
      }
    )

    expect(mapped.onNext).toBe(onNext)
    expect(mapped.onRemove).toBe(onRemove)
    expect(mapped.queuedItems).toHaveLength(1)
    expect(mapped.currentItem).toBeUndefined()
  })
})
