import {
  Disposable,
  ProjectionStore,
  connectSessionEngineProjection,
  createProjectionStore
} from '../externalStoreProjection'
import { SessionRuntime, SessionRuntimeSnapshot } from './types'

export interface SessionRuntimeProjectionBoundary extends Disposable {
  readonly projectionStore: ProjectionStore<SessionRuntimeSnapshot>
}

export function createSessionRuntimeProjectionBoundary(
  runtime: SessionRuntime
): SessionRuntimeProjectionBoundary {
  const projectionStore = createProjectionStore(runtime.getSnapshot())
  const projectionConnection = connectSessionEngineProjection(projectionStore, runtime)

  let disposed = false
  return {
    projectionStore,
    dispose(): void {
      if (disposed) {
        return
      }

      disposed = true
      projectionConnection.dispose()
      runtime.dispose()
    }
  }
}
