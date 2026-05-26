export interface Disposable {
  dispose(): void
}

export type DisposeFn = () => void

export type DisposableLike = Disposable | DisposeFn

export const toDispose = (value: DisposableLike): DisposeFn =>
  typeof value === 'function' ? value : () => value.dispose()

export const makeIdempotent = (dispose: DisposeFn): DisposeFn => {
  let active = true
  return () => {
    if (!active) return
    active = false
    dispose()
  }
}

export const fromDispose = (dispose: DisposeFn): Disposable => ({
  dispose: makeIdempotent(dispose)
})
