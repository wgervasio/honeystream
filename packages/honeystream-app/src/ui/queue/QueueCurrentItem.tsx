import React, { memo } from 'react'
import { QueueMediaItemViewModel } from './types'

interface QueueCurrentItemProps {
  readonly className?: string
  readonly emptyLabel?: string
  readonly item?: QueueMediaItemViewModel
  readonly label?: string
  readonly requestedByLabel?: string
}

const formatDurationMs = (durationMs: number | undefined): string | undefined => {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return undefined
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
  const durationLabel = formatDurationMs(props.item.durationMs)

  return (
    <section
      className={props.className}
      data-queue-current-id={props.item.id}
      data-queue-current-kind={props.item.kind}
      data-queue-current-source={props.item.source}
      data-queue-state="current"
      aria-live="polite"
    >
      <p>{props.label || 'Current item'}</p>
      <strong>
        {props.item.title}
        {durationLabel ? <span data-queue-duration="true">{durationLabel}</span> : null}
      </strong>
      <p>{`${requestedByLabel}: ${props.item.requestedBy}`}</p>
    </section>
  )
})

export type { QueueCurrentItemProps }
