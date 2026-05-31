import React, { memo } from 'react'
import { QueueMediaItemViewModel } from './types'

interface QueueCurrentItemProps {
  readonly className?: string
  readonly emptyLabel?: string
  readonly item?: QueueMediaItemViewModel
  readonly label?: string
  readonly requestedByLabel?: string
}

export const QueueCurrentItem = memo(function QueueCurrentItem(props: QueueCurrentItemProps) {
  if (!props.item) {
    return (
      <p className={props.className} data-queue-current-empty="true" data-queue-state="empty">
        {props.emptyLabel || 'No stream on stage yet'}
      </p>
    )
  }

  const requestedByLabel = props.requestedByLabel || 'Requested by'

  return (
    <section
      className={props.className}
      data-queue-current-id={props.item.id}
      data-queue-state="current"
      aria-live="polite"
    >
      <p>{props.label || 'Current item'}</p>
      <strong>{props.item.title}</strong>
      <p>{`${requestedByLabel}: ${props.item.requestedBy}`}</p>
    </section>
  )
})

export type { QueueCurrentItemProps }
