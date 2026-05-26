import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createErrorSystemEvent,
  createJoinSystemEvent,
  SYSTEM_EVENT_LOG_CAP
} from '../../domain/events'
import { SystemEventFeed } from './SystemEventFeed'

describe('SystemEventFeed', () => {
  it('presents the event cap when the feed receives overflowed events', () => {
    const events = Array.from({ length: SYSTEM_EVENT_LOG_CAP + 2 }, (_, index) =>
      createJoinSystemEvent(`user-${index}`, index)
    )

    const html = renderToStaticMarkup(<SystemEventFeed events={events} />)

    expect(html).toContain(`Showing latest ${SYSTEM_EVENT_LOG_CAP} of ${SYSTEM_EVENT_LOG_CAP + 2} events.`)
    expect(html).not.toContain('user-0 joined')
    expect(html).not.toContain('user-1 joined')
    expect(html).toContain('user-2 joined')
    expect(html).toContain(`user-${SYSTEM_EVENT_LOG_CAP + 1} joined`)
  })

  it('renders empty state when no events are provided', () => {
    const html = renderToStaticMarkup(<SystemEventFeed events={[]} />)

    expect(html).toContain('No system events yet.')
    expect(html).not.toContain('<li')
  })

  it('renders error events with an explicit error label', () => {
    const html = renderToStaticMarkup(
      <SystemEventFeed events={[createErrorSystemEvent('Connection timed out', 10)]} />
    )

    expect(html).toContain('Error: Connection timed out')
    expect(html).toContain('data-system-event-type="error"')
  })
})
