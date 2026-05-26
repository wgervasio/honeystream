import { appendQueueItem, takeNextQueueItem } from './queue'

describe('domain/queue', () => {
  it('rejects appends when cap is reached', () => {
    const baseQueue = ['a', 'b']
    const result = appendQueueItem(baseQueue, 'c', 2)
    expect(result.accepted).toBe(false)
    expect(result.queue).toEqual(baseQueue)
  })

  it('returns the next item without mutating the original queue', () => {
    const baseQueue = ['a', 'b']
    const result = takeNextQueueItem(baseQueue)
    expect(result.accepted).toBe(true)
    expect(result.removed).toBe('a')
    expect(result.queue).toEqual(['b'])
    expect(baseQueue).toEqual(['a', 'b'])
  })
})
