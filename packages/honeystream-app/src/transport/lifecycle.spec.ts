import { createDisposableGroup } from './lifecycle'

describe('transport lifecycle', () => {
  it('disposes resources in reverse registration order', () => {
    const disposeOrder: string[] = []
    const group = createDisposableGroup()

    group.add(() => disposeOrder.push('first'))
    group.add(() => disposeOrder.push('second'))

    group.dispose()

    expect(disposeOrder).toEqual(['second', 'first'])
  })

  it('immediately disposes resources added after disposal', () => {
    const disposeOrder: string[] = []
    const group = createDisposableGroup()

    group.dispose()
    group.add(() => disposeOrder.push('late'))

    expect(disposeOrder).toEqual(['late'])
  })

  it('is idempotent', () => {
    let disposeCount = 0
    const group = createDisposableGroup()
    group.add(() => {
      disposeCount += 1
    })

    group.dispose()
    group.dispose()

    expect(disposeCount).toBe(1)
    expect(group.isDisposed).toBeTruthy()
  })
})
