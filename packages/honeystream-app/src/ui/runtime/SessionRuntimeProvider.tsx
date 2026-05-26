import React, { ReactNode, createContext, memo, useContext, useEffect, useMemo } from 'react'
import { useProjectionSelector } from '../useProjectionSelector'
import { createSessionRuntimeProjectionBoundary } from './runtimeProjectionBoundary'
import { SessionRuntime, SessionRuntimeContextValue, SessionRuntimeSnapshot } from './types'

interface SessionRuntimeProviderProps {
  readonly runtime: SessionRuntime
  readonly children?: ReactNode
}

const SessionRuntimeContext = createContext<SessionRuntimeContextValue | undefined>(undefined)

export const SessionRuntimeProvider = memo(function SessionRuntimeProvider(
  props: SessionRuntimeProviderProps
) {
  const projectionBoundary = useMemo(
    () => createSessionRuntimeProjectionBoundary(props.runtime),
    [props.runtime]
  )

  useEffect(() => {
    return () => {
      projectionBoundary.dispose()
    }
  }, [projectionBoundary])

  const contextValue = useMemo<SessionRuntimeContextValue>(
    () => ({
      runtime: props.runtime,
      projectionStore: projectionBoundary.projectionStore
    }),
    [projectionBoundary.projectionStore, props.runtime]
  )

  return (
    <SessionRuntimeContext.Provider value={contextValue}>{props.children}</SessionRuntimeContext.Provider>
  )
})

export function useSessionRuntimeContext(): SessionRuntimeContextValue {
  const context = useContext(SessionRuntimeContext)
  if (!context) {
    throw new Error('useSessionRuntimeContext must be used within a SessionRuntimeProvider')
  }

  return context
}

export function useSessionRuntime(): SessionRuntime {
  return useSessionRuntimeContext().runtime
}

export function useSessionRuntimeProjectionSelector<TSelection>(
  selector: (snapshot: SessionRuntimeSnapshot) => TSelection,
  isEqual?: (previousSelection: TSelection, nextSelection: TSelection) => boolean
): TSelection {
  const { projectionStore } = useSessionRuntimeContext()
  return useProjectionSelector({
    store: projectionStore,
    selector,
    isEqual
  })
}
