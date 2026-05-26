export interface Disposable {
  dispose(): void
}

export type DisposeCallback = () => void

export const toDisposable = (callback: DisposeCallback): Disposable => {
  let disposed = false
  return {
    dispose() {
      if (disposed) return
      disposed = true
      callback()
    }
  }
}

export const disposeIfPresent = (disposable?: Disposable): boolean => {
  if (!disposable) return false
  disposable.dispose()
  return true
}

export const disposeAll = (disposables: readonly Disposable[]): void => {
  for (const disposable of disposables) {
    disposable.dispose()
  }
}

export class DisposableGroup implements Disposable {
  private disposed = false
  private readonly disposables = new Set<Disposable>()

  get isDisposed(): boolean {
    return this.disposed
  }

  add(disposable: Disposable): Disposable {
    if (this.disposed) {
      disposable.dispose()
      return disposable
    }

    this.disposables.add(disposable)
    return disposable
  }

  remove(disposable: Disposable): boolean {
    return this.disposables.delete(disposable)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    const tracked = Array.from(this.disposables)
    this.disposables.clear()
    disposeAll(tracked)
  }
}
