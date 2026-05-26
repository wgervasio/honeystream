import { startInterval, startTimeout } from './timers'

describe('timer cleanup helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('cancels timeout idempotently', () => {
    let calls = 0
    const timeout = startTimeout(() => {
      calls += 1
    }, 50)

    timeout.dispose()
    timeout.dispose()
    jest.advanceTimersByTime(200)

    expect(calls).toBe(0)
  })

  it('cancels interval idempotently', () => {
    let calls = 0
    const interval = startInterval(() => {
      calls += 1
    }, 25)

    jest.advanceTimersByTime(100)
    expect(calls).toBe(4)

    interval.dispose()
    interval.dispose()
    jest.advanceTimersByTime(100)

    expect(calls).toBe(4)
  })

  it('supports callback arguments', () => {
    let result = ''
    const timeout = startTimeout(
      (prefix: string, id: number) => {
        result = `${prefix}:${id}`
      },
      10,
      'item',
      7
    )

    jest.advanceTimersByTime(10)
    expect(result).toBe('item:7')
    timeout.dispose()
  })
})
