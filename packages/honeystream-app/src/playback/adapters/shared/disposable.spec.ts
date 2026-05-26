import { DisposableGroup, disposeAll, disposeIfPresent, toDisposable } from './disposable'

describe('playback adapter disposables', () => {
  it('makes wrapped callbacks idempotent', () => {
    let callCount = 0
    const disposable = toDisposable(() => {
      callCount += 1
    })

    disposable.dispose()
    disposable.dispose()

    expect(callCount).toBe(1)
  })

  it('disposes every item in a collection', () => {
    let firstCalls = 0
    let secondCalls = 0

    disposeAll([
      toDisposable(() => {
        firstCalls += 1
      }),
      toDisposable(() => {
        secondCalls += 1
      })
    ])

    expect(firstCalls).toBe(1)
    expect(secondCalls).toBe(1)
  })

  it('returns false when no disposable is present', () => {
    expect(disposeIfPresent()).toBe(false)
  })

  it('disposes and tracks items in a group', () => {
    const group = new DisposableGroup()
    let firstCalls = 0
    let secondCalls = 0

    group.add(
      toDisposable(() => {
        firstCalls += 1
      })
    )
    group.add(
      toDisposable(() => {
        secondCalls += 1
      })
    )

    group.dispose()
    group.dispose()

    expect(group.isDisposed).toBe(true)
    expect(firstCalls).toBe(1)
    expect(secondCalls).toBe(1)
  })

  it('disposes items immediately when added after disposal', () => {
    const group = new DisposableGroup()
    let calls = 0

    group.dispose()
    group.add(
      toDisposable(() => {
        calls += 1
      })
    )

    expect(calls).toBe(1)
  })
})
