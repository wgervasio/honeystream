import { useEffect, useState } from 'react'
import { ProjectionStore } from './externalStoreProjection'

export interface ProjectionSelectorConfig<TSnapshot, TSelection> {
  store: ProjectionStore<TSnapshot>
  selector: (snapshot: TSnapshot) => TSelection
  isEqual?: (previousSelection: TSelection, nextSelection: TSelection) => boolean
}

function strictEqual<TSelection>(left: TSelection, right: TSelection): boolean {
  return left === right
}

export function useProjectionSelector<TSnapshot, TSelection>({
  store,
  selector,
  isEqual
}: ProjectionSelectorConfig<TSnapshot, TSelection>): TSelection {
  const [selection, setSelection] = useState<TSelection>(() => selector(store.getSnapshot()))

  useEffect(() => {
    const compareSelection = isEqual || strictEqual

    const updateSelection = () => {
      const nextSelection = selector(store.getSnapshot())
      setSelection(previousSelection =>
        compareSelection(previousSelection, nextSelection) ? previousSelection : nextSelection
      )
    }

    const unsubscribe = store.subscribe(updateSelection)
    updateSelection()

    return () => {
      unsubscribe()
    }
  }, [isEqual, selector, store])

  return selection
}
