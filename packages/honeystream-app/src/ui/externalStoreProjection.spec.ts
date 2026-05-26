import {
  createProjectionStore,
  connectSessionEngineProjection,
  SessionEngineSnapshotSource
} from './externalStoreProjection'

describe('externalStoreProjection', () => {
  it('updates version and notifies listeners when snapshot changes', () => {
    const store = createProjectionStore({ value: 1 })
    const listener = jest.fn()

    store.subscribe(listener)
    store.setSnapshot({ value: 2 })

    expect(store.getVersion()).toBe(1)
    expect(store.getSnapshot()).toEqual({ value: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not notify listeners for the same snapshot identity', () => {
    const initialSnapshot = { value: 1 }
    const store = createProjectionStore(initialSnapshot)
    const listener = jest.fn()

    store.subscribe(listener)
    store.setSnapshot(initialSnapshot)

    expect(store.getVersion()).toBe(0)
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops notifying a listener after unsubscribe', () => {
    const store = createProjectionStore({ value: 1 })
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.setSnapshot({ value: 2 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('bridges a session snapshot source and cleans up subscription', () => {
    const store = createProjectionStore('initial')
    let onSnapshot: ((snapshot: string) => void) | undefined
    let unsubscribeCount = 0

    const source: SessionEngineSnapshotSource<string> = {
      subscribeToSnapshots(listener) {
        onSnapshot = listener
        return () => {
          unsubscribeCount += 1
        }
      }
    }

    const projection = connectSessionEngineProjection(store, source)

    expect(onSnapshot).toBeDefined()
    if (!onSnapshot) {
      throw new Error('Expected session snapshot listener to be registered')
    }

    onSnapshot('next')
    expect(store.getSnapshot()).toBe('next')
    expect(store.getVersion()).toBe(1)

    projection.dispose()
    projection.dispose()

    expect(unsubscribeCount).toBe(1)

    onSnapshot('after-dispose')
    expect(store.getSnapshot()).toBe('next')
  })
})
