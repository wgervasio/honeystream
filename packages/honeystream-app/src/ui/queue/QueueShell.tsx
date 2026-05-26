import React, { memo } from 'react'
import { QueueCurrentItem } from './QueueCurrentItem'
import { QueueNextButton } from './QueueNextButton'
import { QueueQueuedItems } from './QueueQueuedItems'
import { QueueIntentCallbacks, QueueMediaItemViewModel } from './types'

const EMPTY_QUEUED_ITEMS: readonly QueueMediaItemViewModel[] = Object.freeze([])

interface QueueShellProps extends QueueIntentCallbacks {
  readonly className?: string
  readonly currentItem?: QueueMediaItemViewModel
  readonly currentItemClassName?: string
  readonly currentItemEmptyLabel?: string
  readonly currentItemLabel?: string
  readonly nextButtonClassName?: string
  readonly nextButtonLabel?: string
  readonly queuedItems?: readonly QueueMediaItemViewModel[]
  readonly queuedItemsClassName?: string
  readonly queuedItemsEmptyLabel?: string
  readonly queuedItemsLabel?: string
  readonly removeLabel?: string
  readonly requestedByLabel?: string
}

const isNextDisabled = (
  currentItem: QueueMediaItemViewModel | undefined,
  queuedItems: readonly QueueMediaItemViewModel[]
): boolean => !currentItem && queuedItems.length === 0

export const QueueShell = memo(function QueueShell(props: QueueShellProps) {
  const queuedItems = props.queuedItems || EMPTY_QUEUED_ITEMS

  return (
    <section className={props.className}>
      <QueueCurrentItem
        className={props.currentItemClassName}
        item={props.currentItem}
        label={props.currentItemLabel}
        emptyLabel={props.currentItemEmptyLabel}
        requestedByLabel={props.requestedByLabel}
      />
      <QueueQueuedItems
        className={props.queuedItemsClassName}
        items={queuedItems}
        onRemove={props.onRemove}
        title={props.queuedItemsLabel}
        emptyLabel={props.queuedItemsEmptyLabel}
        removeLabel={props.removeLabel}
        requestedByLabel={props.requestedByLabel}
      />
      <QueueNextButton
        className={props.nextButtonClassName}
        onNext={props.onNext}
        label={props.nextButtonLabel}
        disabled={isNextDisabled(props.currentItem, queuedItems)}
      />
    </section>
  )
})

export type { QueueShellProps }
