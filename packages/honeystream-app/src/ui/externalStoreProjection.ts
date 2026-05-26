export type ProjectionListener = () => void
export type ProjectionUnsubscribe = () => void

export interface Disposable {
  dispose(): void
}

export interface ProjectionStore<TSnapshot> {
  getSnapshot(): TSnapshot
  getVersion(): number
  setSnapshot(nextSnapshot: TSnapshot): void
  subscribe(listener: ProjectionListener): ProjectionUnsubscribe
}

export interface SessionEngineSnapshotSource<TSnapshot> {
  subscribeToSnapshots(listener: (snapshot: TSnapshot) => void): ProjectionUnsubscribe
}

export function createProjectionStore<TSnapshot>(initialSnapshot: TSnapshot): ProjectionStore<TSnapshot> {
  let snapshot = initialSnapshot
  let version = 0
  const listeners = new Set<ProjectionListener>()

  return {
    getSnapshot(): TSnapshot {
      return snapshot
    },
    getVersion(): number {
      return version
    },
    setSnapshot(nextSnapshot: TSnapshot): void {
      if (nextSnapshot === snapshot) {
        return
      }

      snapshot = nextSnapshot
      version += 1

      listeners.forEach(listener => {
        listener()
      })
    },
    subscribe(listener: ProjectionListener): ProjectionUnsubscribe {
      listeners.add(listener)

      let unsubscribed = false
      return () => {
        if (unsubscribed) {
          return
        }

        unsubscribed = true
        listeners.delete(listener)
      }
    }
  }
}

export function connectSessionEngineProjection<TSnapshot>(
  store: ProjectionStore<TSnapshot>,
  source: SessionEngineSnapshotSource<TSnapshot>
): Disposable {
  let disposed = false
  const unsubscribe = source.subscribeToSnapshots(nextSnapshot => {
    if (disposed) {
      return
    }

    store.setSnapshot(nextSnapshot)
  })

  return {
    dispose(): void {
      if (disposed) {
        return
      }

      disposed = true
      unsubscribe()
    }
  }
}
