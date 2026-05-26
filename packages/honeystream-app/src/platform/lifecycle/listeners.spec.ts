import { listen } from './listeners'

type Listener = (event: { readonly type: string }) => void

class TestListenerTarget {
  readonly addCalls: Array<boolean | AddEventListenerOptions | undefined> = []
  readonly removeCalls: Array<boolean | EventListenerOptions | undefined> = []

  private readonly listeners = new Map<string, Set<Listener>>()

  addEventListener(type: string, listener: Listener, options?: boolean | AddEventListenerOptions) {
    this.addCalls.push(options)
    const listeners = this.listeners.get(type) || new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: Listener, options?: boolean | EventListenerOptions) {
    this.removeCalls.push(options)
    const listeners = this.listeners.get(type)
    if (!listeners) return
    listeners.delete(listener)
  }

  emit(type: string) {
    const listeners = this.listeners.get(type)
    if (!listeners) return
    listeners.forEach(listener => listener({ type }))
  }
}

describe('listener cleanup helper', () => {
  it('unsubscribes listeners idempotently', () => {
    const target = new TestListenerTarget()
    const calls: string[] = []
    const disposable = listen(target, 'tick', event => calls.push(event.type))

    target.emit('tick')
    disposable.dispose()
    disposable.dispose()
    target.emit('tick')

    expect(calls).toEqual(['tick'])
    expect(target.addCalls).toEqual([undefined])
    expect(target.removeCalls).toEqual([undefined])
  })

  it('passes options through removeEventListener', () => {
    const target = new TestListenerTarget()
    const options = { capture: true }
    const disposable = listen(target, 'tick', () => undefined, options)

    disposable.dispose()

    expect(target.addCalls[0]).toBe(options)
    expect(target.removeCalls[0]).toBe(options)
  })
})
