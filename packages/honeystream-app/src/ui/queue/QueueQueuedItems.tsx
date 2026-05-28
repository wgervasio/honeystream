import React, { memo } from 'react'
import { QueueMediaItemViewModel } from './types'

interface QueueQueuedItemsProps {
  readonly className?: string
  readonly emptyLabel?: string
  readonly items: readonly QueueMediaItemViewModel[]
  readonly onRemove: (mediaId: string) => void
  readonly removeLabel?: string
  readonly requestedByLabel?: string
  readonly title?: string
}

export const QueueQueuedItems = memo(function QueueQueuedItems(props: QueueQueuedItemsProps) {
  if (props.items.length === 0) {
    return (
      <p className={props.className} data-queue-empty="true">
        {props.emptyLabel || 'Queue is empty'}
      </p>
    )
  }

  const removeLabel = props.removeLabel || 'Remove'
  const requestedByLabel = props.requestedByLabel || 'Requested by'

  return (
    <section className={props.className} aria-label={props.title || 'Queued items'}>
      <p>{props.title || 'Queued items'}</p>
      <ol>
        {props.items.map(item => (
          <li key={item.id} data-queue-item-id={item.id}>
            <span>{item.title}</span>
            <span>{` \u00b7 ${requestedByLabel}: ${item.requestedBy}`}</span>
            <button
              type="button"
              onClick={() => props.onRemove(item.id)}
              aria-label={`${removeLabel} ${item.title}`}
              data-queue-action="remove"
            >
              {removeLabel}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
})

export type { QueueQueuedItemsProps }
