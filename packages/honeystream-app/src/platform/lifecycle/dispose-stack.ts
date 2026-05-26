import { Disposable, DisposableLike, DisposeFn, makeIdempotent, toDispose } from './disposable'

export interface DisposeStack extends Disposable {
  add<T extends DisposableLike>(resource: T): T
  defer(dispose: DisposeFn): void
  readonly disposed: boolean
  readonly size: number
}

export const createDisposeStack = (): DisposeStack => {
  let disposed = false
  let disposers: DisposeFn[] = []

  const add = <T extends DisposableLike>(resource: T): T => {
    const disposer = makeIdempotent(toDispose(resource))
    if (disposed) {
      disposer()
      return resource
    }

    disposers.push(disposer)
    return resource
  }

  const dispose = () => {
    if (disposed) return
    disposed = true

    const pending = disposers
    disposers = []

    let firstError: unknown
    for (let i = pending.length - 1; i >= 0; i--) {
      try {
        pending[i]()
      } catch (error) {
        if (typeof firstError === 'undefined') {
          firstError = error
        }
      }
    }

    if (typeof firstError !== 'undefined') {
      throw firstError
    }
  }

  return {
    add,
    defer(disposeFn: DisposeFn) {
      add(disposeFn)
    },
    dispose,
    get disposed() {
      return disposed
    },
    get size() {
      return disposers.length
    }
  }
}
