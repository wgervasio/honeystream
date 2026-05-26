import {
  appendSystemEvent,
  appendSystemEvents,
  createErrorSystemEvent,
  createParticipantJoinedSystemEvent,
  createParticipantLeftSystemEvent,
  createSystemEventLog,
  DEFAULT_EVENT_LOG_CAP
} from './event-log'

describe('domain/event-log', () => {
  it('models participant join, leave, and error events', () => {
    const events = createSystemEventLog([
      createParticipantJoinedSystemEvent('host-peer', 'host', 1),
      createParticipantLeftSystemEvent('guest-peer', 2, 'guest'),
      createErrorSystemEvent('connection lost', 3, 'network-error')
    ])

    expect(events).toEqual([
      {
        type: 'participantJoined',
        participantId: 'host-peer',
        username: 'host',
        timestampMs: 1
      },
      {
        type: 'participantLeft',
        participantId: 'guest-peer',
        username: 'guest',
        timestampMs: 2
      },
      {
        type: 'error',
        code: 'network-error',
        message: 'connection lost',
        timestampMs: 3
      }
    ])
  })

  it('caps seeded logs to 64 events', () => {
    const seed = Array.from({ length: DEFAULT_EVENT_LOG_CAP + 3 }, (_, index) =>
      createParticipantJoinedSystemEvent(`peer-${index}`, `user-${index}`, index)
    )

    const events = createSystemEventLog(seed)

    expect(events).toHaveLength(DEFAULT_EVENT_LOG_CAP)
    expect(events[0]).toEqual(
      createParticipantJoinedSystemEvent('peer-3', 'user-3', 3)
    )
    expect(events[DEFAULT_EVENT_LOG_CAP - 1]).toEqual(
      createParticipantJoinedSystemEvent(
        `peer-${DEFAULT_EVENT_LOG_CAP + 2}`,
        `user-${DEFAULT_EVENT_LOG_CAP + 2}`,
        DEFAULT_EVENT_LOG_CAP + 2
      )
    )
  })

  it('keeps only the most recent events when cap is exceeded', () => {
    let events = createSystemEventLog()
    for (let i = 0; i < DEFAULT_EVENT_LOG_CAP + 5; i++) {
      events = appendSystemEvent(events, createErrorSystemEvent('overflow', i, `E${i}`))
    }

    expect(events).toHaveLength(DEFAULT_EVENT_LOG_CAP)
    expect(events[0]).toEqual({
      type: 'error',
      timestampMs: 5,
      code: 'E5',
      message: 'overflow'
    })
  })

  it('does not mutate prior logs when appending events', () => {
    const original = createSystemEventLog([
      createParticipantJoinedSystemEvent('host-peer', 'host', 1)
    ])
    const next = appendSystemEvent(
      original,
      createParticipantLeftSystemEvent('guest-peer', 2, 'guest')
    )

    expect(original).toEqual([
      createParticipantJoinedSystemEvent('host-peer', 'host', 1)
    ])
    expect(next).toEqual([
      createParticipantJoinedSystemEvent('host-peer', 'host', 1),
      createParticipantLeftSystemEvent('guest-peer', 2, 'guest')
    ])
  })

  it('appends batches with the same bounded-cap semantics', () => {
    const batch = Array.from({ length: DEFAULT_EVENT_LOG_CAP + 4 }, (_, index) =>
      createErrorSystemEvent(`error-${index}`, index, `E${index}`)
    )

    const events = appendSystemEvents(createSystemEventLog(), batch)

    expect(events).toHaveLength(DEFAULT_EVENT_LOG_CAP)
    expect(events[0]).toEqual(createErrorSystemEvent('error-4', 4, 'E4'))
    expect(events[DEFAULT_EVENT_LOG_CAP - 1]).toEqual(
      createErrorSystemEvent(
        `error-${DEFAULT_EVENT_LOG_CAP + 3}`,
        DEFAULT_EVENT_LOG_CAP + 3,
        `E${DEFAULT_EVENT_LOG_CAP + 3}`
      )
    )
  })
})
