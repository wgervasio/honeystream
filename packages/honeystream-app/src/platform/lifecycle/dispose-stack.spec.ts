import { createDisposeStack } from './dispose-stack'
import { fromDispose } from './disposable'
import { listen } from './listeners'
import { startInterval } from './timers'

class TickTarget {
  private readonly listeners = new Set<() => void>()

  addEventListener(type: 'tick', listener: () => void, options?: boolean | AddEventListenerOptions) {
    if (type === 'tick') {
      this.listeners.add(listener)
    }
  }

  removeEventListener(
    type: 'tick',
    listener: () => void,
    options?: boolean | EventListenerOptions
  ) {
    if (type === 'tick') {
      this.listeners.delete(listener)
    }
  }

  emitTick() {
    this.listeners.forEach(listener => listener())
  }
}

describe('dispose stack', () => {
  it('disposes resources in reverse order once', () => {
    const calls: string[] = []
    const stack = createDisposeStack()

    stack.add(fromDispose(() => calls.push('first')))
    stack.add(fromDispose(() => calls.push('second')))
    expect(stack.size).toBe(2)

    stack.dispose()
    stack.dispose()

    expect(calls).toEqual(['second', 'first'])
    expect(stack.disposed).toBe(true)
    expect(stack.size).toBe(0)
  })

  it('disposes newly added resources immediately after stack disposal', () => {
    const calls: string[] = []
    const stack = createDisposeStack()

    stack.dispose()
    stack.defer(() => calls.push('late'))
    stack.add(fromDispose(() => calls.push('later')))

    expect(calls).toEqual(['late', 'later'])
    expect(stack.size).toBe(0)
  })

  it('continues cleanup when one disposer throws', () => {
    const calls: string[] = []
    const stack = createDisposeStack()

    stack.defer(() => calls.push('a'))
    stack.defer(() => {
      calls.push('b')
      throw new Error('boom')
    })
    stack.defer(() => calls.push('c'))

    expect(() => stack.dispose()).toThrow('boom')
    expect(calls).toEqual(['c', 'b', 'a'])
  })

  it('owns listeners and timers through one stack', () => {
    jest.useFakeTimers()

    const stack = createDisposeStack()
    const target = new TickTarget()
    let ticks = 0
    let events = 0

    stack.add(startInterval(() => (ticks += 1), 20))
    stack.add(
      listen(target, 'tick', () => {
        events += 1
      })
    )

    target.emitTick()
    jest.advanceTimersByTime(60)

    expect(events).toBe(1)
    expect(ticks).toBe(3)

    stack.dispose()

    target.emitTick()
    jest.advanceTimersByTime(60)

    expect(events).toBe(1)
    expect(ticks).toBe(3)
    jest.useRealTimers()
  })
})
