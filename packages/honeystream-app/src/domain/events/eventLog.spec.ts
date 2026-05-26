import {
  appendSystemEvent,
  createErrorSystemEvent,
  createJoinSystemEvent,
  createLeaveSystemEvent,
  createSystemEventLog,
  SYSTEM_EVENT_LOG_CAP
} from './eventLog'

describe('domain event log', () => {
  it('models join, leave, and error events', () => {
    const events = createSystemEventLog([
      createJoinSystemEvent('host', 1),
      createLeaveSystemEvent('guest', 2),
      createErrorSystemEvent('connection lost', 3)
    ])

    expect(events).toEqual([
      {
        type: 'join',
        username: 'host',
        occurredAtMs: 1
      },
      {
        type: 'leave',
        username: 'guest',
        occurredAtMs: 2
      },
      {
        type: 'error',
        message: 'connection lost',
        occurredAtMs: 3
      }
    ])
  })

  it('caps seeded logs to 64 events', () => {
    const seed = Array.from({ length: SYSTEM_EVENT_LOG_CAP + 3 }, (_, index) =>
      createJoinSystemEvent(`user-${index}`, index)
    )

    const events = createSystemEventLog(seed)

    expect(events).toHaveLength(SYSTEM_EVENT_LOG_CAP)
    expect(events[0]).toEqual(createJoinSystemEvent('user-3', 3))
    expect(events[SYSTEM_EVENT_LOG_CAP - 1]).toEqual(
      createJoinSystemEvent('user-66', SYSTEM_EVENT_LOG_CAP + 2)
    )
  })

  it('caps appended logs to 64 events', () => {
    let events = createSystemEventLog()

    for (let index = 0; index < SYSTEM_EVENT_LOG_CAP + 5; index += 1) {
      events = appendSystemEvent(events, createJoinSystemEvent(`user-${index}`, index))
    }

    expect(events).toHaveLength(SYSTEM_EVENT_LOG_CAP)
    expect(events[0]).toEqual(createJoinSystemEvent('user-5', 5))
    expect(events[SYSTEM_EVENT_LOG_CAP - 1]).toEqual(createJoinSystemEvent('user-68', 68))
  })

  it('does not mutate prior logs when appending events', () => {
    const original = createSystemEventLog([createJoinSystemEvent('host', 1)])
    const next = appendSystemEvent(original, createLeaveSystemEvent('guest', 2))

    expect(original).toEqual([createJoinSystemEvent('host', 1)])
    expect(next).toEqual([
      createJoinSystemEvent('host', 1),
      createLeaveSystemEvent('guest', 2)
    ])
  })
})
