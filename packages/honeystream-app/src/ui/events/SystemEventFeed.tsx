import React, { memo } from 'react'
import { SystemEvent, SYSTEM_EVENT_LOG_CAP } from '../../domain/events'

const DEFAULT_EMPTY_LABEL = 'No system events yet.'
const DEFAULT_ERROR_LABEL = 'Error'
const DEFAULT_TITLE = 'System events'

export interface SystemEventFeedProps {
  readonly className?: string
  readonly emptyLabel?: string
  readonly errorLabel?: string
  readonly events: readonly SystemEvent[]
  readonly maxVisibleEvents?: number
  readonly title?: string
}

const normalizeMaxVisibleEvents = (maxVisibleEvents: number): number => {
  if (!Number.isInteger(maxVisibleEvents) || maxVisibleEvents < 1) {
    return SYSTEM_EVENT_LOG_CAP
  }

  return maxVisibleEvents
}

const toEventMessage = (event: SystemEvent, errorLabel: string): string => {
  switch (event.type) {
    case 'join':
      return `${event.username} joined`
    case 'leave':
      return `${event.username} left`
    case 'error':
      return `${errorLabel}: ${event.message}`
  }
}

export const SystemEventFeed = memo(function SystemEventFeed(props: SystemEventFeedProps) {
  const maxVisibleEvents = normalizeMaxVisibleEvents(
    typeof props.maxVisibleEvents === 'number' ? props.maxVisibleEvents : SYSTEM_EVENT_LOG_CAP
  )
  const title = props.title || DEFAULT_TITLE
  const emptyLabel = props.emptyLabel || DEFAULT_EMPTY_LABEL
  const errorLabel = props.errorLabel || DEFAULT_ERROR_LABEL
  const hasOverflow = props.events.length > maxVisibleEvents
  const visibleEvents = hasOverflow
    ? props.events.slice(props.events.length - maxVisibleEvents)
    : props.events

  return (
    <section className={props.className} aria-live="polite">
      <p>{title}</p>
      {hasOverflow ? (
        <p>
          Showing latest {maxVisibleEvents} of {props.events.length} events.
        </p>
      ) : null}
      {visibleEvents.length === 0 ? (
        <p>{emptyLabel}</p>
      ) : (
        <ol>
          {visibleEvents.map((event, index) => (
            <li key={`${event.type}-${event.occurredAtMs}-${index}`} data-system-event-type={event.type}>
              {toEventMessage(event, errorLabel)}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
})
