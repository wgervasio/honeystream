export interface Disposable {
  dispose(): void
}

export type DisposableResource = Disposable | (() => void)

const isDisposable = (resource: DisposableResource): resource is Disposable => {
  if (typeof resource !== 'object' || resource === null) {
    return false
  }

  const maybeDisposable = resource as { dispose?: unknown }
  return typeof maybeDisposable.dispose === 'function'
}

export const toDisposable = (resource: DisposableResource): Disposable => {
  if (isDisposable(resource)) {
    return resource
  }

  return {
    dispose: resource
  }
}

export interface DisposableGroup extends Disposable {
  readonly isDisposed: boolean
  add(resource: DisposableResource): void
  size(): number
}

export const createDisposableGroup = (): DisposableGroup => {
  const resources: Disposable[] = []
  let disposed = false

  return {
    get isDisposed(): boolean {
      return disposed
    },

    add(resource: DisposableResource): void {
      const disposable = toDisposable(resource)
      if (disposed) {
        disposable.dispose()
        return
      }

      resources.push(disposable)
    },

    size(): number {
      return resources.length
    },

    dispose(): void {
      if (disposed) {
        return
      }

      disposed = true
      while (resources.length > 0) {
        const disposable = resources.pop()
        if (disposable) {
          disposable.dispose()
        }
      }
    }
  }
}
