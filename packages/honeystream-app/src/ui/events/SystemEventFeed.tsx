import React, { memo } from 'react'
import { DEFAULT_EVENT_LOG_CAP, SystemEvent } from '../../domain/event-log'

const DEFAULT_EMPTY_LABEL = 'No system events yet.'
const DEFAULT_ERROR_LABEL = 'Error'
const DEFAULT_TITLE = 'System events'
const EVENT_ICONS = Object.freeze({
  participantJoined: '🐰',
  participantLeft: '👋',
  error: '⚠️'
})

export type SystemEventTone = 'positive' | 'neutral' | 'alert'

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
    return DEFAULT_EVENT_LOG_CAP
  }

  return maxVisibleEvents
}

const toEventMessage = (event: SystemEvent, errorLabel: string): string => {
  switch (event.type) {
    case 'participantJoined':
      return `${event.username} joined`
    case 'participantLeft':
      return `${event.username || event.participantId} left`
    case 'error':
      return `${errorLabel}: ${event.message}`
  }
}

const getSystemEventIcon = (event: SystemEvent): string => {
  switch (event.type) {
    case 'participantJoined':
      return EVENT_ICONS.participantJoined
    case 'participantLeft':
      return EVENT_ICONS.participantLeft
    case 'error':
      return EVENT_ICONS.error
  }
}

export const getSystemEventTone = (event: SystemEvent): SystemEventTone => {
  switch (event.type) {
    case 'participantJoined':
      return 'positive'
    case 'participantLeft':
      return 'neutral'
    case 'error':
      return 'alert'
  }
}

export const SystemEventFeed = memo(function SystemEventFeed(props: SystemEventFeedProps) {
  const maxVisibleEvents = normalizeMaxVisibleEvents(
    typeof props.maxVisibleEvents === 'number' ? props.maxVisibleEvents : DEFAULT_EVENT_LOG_CAP
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
            <li
              key={`${event.type}-${event.timestampMs}-${index}`}
              data-system-event-type={event.type}
              data-system-event-tone={getSystemEventTone(event)}
            >
              <span aria-hidden="true" data-system-event-icon={event.type}>
                {getSystemEventIcon(event)}
              </span>{' '}
              <span>{toEventMessage(event, errorLabel)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
})
