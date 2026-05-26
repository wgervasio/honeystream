import { appendSystemEvent, DEFAULT_EVENT_LOG_CAP, SystemEvent } from './event-log'

describe('domain/event-log', () => {
  it('keeps only the most recent events when cap is exceeded', () => {
    let events: readonly SystemEvent[] = []
    for (let i = 0; i < DEFAULT_EVENT_LOG_CAP + 5; i++) {
      events = appendSystemEvent(events, {
        type: 'error',
        timestampMs: i,
        code: `E${i}`,
        message: 'overflow'
      })
    }

    expect(events).toHaveLength(DEFAULT_EVENT_LOG_CAP)
    expect(events[0]).toEqual({
      type: 'error',
      timestampMs: 5,
      code: 'E5',
      message: 'overflow'
    })
  })
})
