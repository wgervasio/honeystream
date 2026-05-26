import {
  createFakeClock,
  createFakeIdGenerator,
  createFixedIdGenerator,
  expectBoundedArray,
  expectBoundedLength,
  expectBoundedMap,
  expectBoundedSet,
  expectCleanupCalledOnce,
  expectCleanupCalledTimes,
  expectAllCleanupsCalledOnce
} from './index'

describe('architecture test fixtures', () => {
  describe('fake clocks', () => {
    it('reads, advances, and sets time deterministically', () => {
      const clock = createFakeClock(10)

      expect(clock.now()).toBe(10)
      expect(clock.nowMs()).toBe(10)
      expect(clock.advanceBy(2.5)).toBe(12.5)
      expect(clock.set(3)).toBe(3)
      expect(clock.nowMs()).toBe(3)
    })

    it('rejects non-finite values', () => {
      expect(() => createFakeClock(Number.NaN)).toThrow('initialMs must be a finite number')

      const clock = createFakeClock(0)
      expect(() => clock.advanceBy(Number.POSITIVE_INFINITY)).toThrow(
        'deltaMs must be a finite number'
      )
    })
  })

  describe('fake IDs', () => {
    it('generates deterministic incremental IDs', () => {
      const ids = createFakeIdGenerator('peer', 7)

      expect(ids.next()).toBe('peer-7')
      expect(ids.nextId()).toBe('peer-8')
      expect(ids.issuedIds()).toEqual(['peer-7', 'peer-8'])
    })

    it('supports fixed ID sequences', () => {
      const ids = createFixedIdGenerator(['host', 'guest'])

      expect(ids.next()).toBe('host')
      expect(ids.remaining()).toBe(1)
      expect(ids.nextId()).toBe('guest')
      expect(ids.remaining()).toBe(0)
      expect(() => ids.next()).toThrow('no fake IDs remaining')
    })
  })

  describe('bounded assertions', () => {
    it('passes when values stay within bounds', () => {
      expectBoundedLength(2, 2, 'events')
      expectBoundedArray([1, 2], 2, 'queue')
      expectBoundedMap(new Map<string, number>([['meta', 1]]), 1, 'cache')
      expectBoundedSet(new Set<string>(['host', 'guest']), 2, 'participants')
    })

    it('throws when values exceed bounds', () => {
      expect(() => expectBoundedArray([1, 2], 1, 'queue')).toThrow(
        'queue exceeded max size 1; got 2'
      )
    })
  })

  describe('resource cleanup assertions', () => {
    it('asserts cleanup call counts', () => {
      const dispose = jest.fn((): void => undefined)
      dispose()

      expectCleanupCalledOnce(dispose, 'transport')
      expectCleanupCalledTimes(dispose, 1, 'transport')
      expect(() => expectCleanupCalledTimes(dispose, 0, 'transport')).toThrow(
        'transport cleanup called 1 times; expected 0'
      )
    })

    it('asserts multiple cleanup trackers together', () => {
      const disposePeer = jest.fn((): void => undefined)
      const disposeChannel = jest.fn((): void => undefined)

      disposePeer()
      disposeChannel()

      expectAllCleanupsCalledOnce({
        peer: disposePeer,
        channel: disposeChannel
      })
    })
  })
})
