import { DEFAULT_EVENT_LOG_CAP } from '../event-log'
import {
  appendSystemEvent,
  createErrorSystemEvent,
  createJoinSystemEvent,
  createLeaveSystemEvent,
  createSystemEventLog,
  SYSTEM_EVENT_LOG_CAP
} from './index'

describe('domain/events compatibility exports', () => {
  it('aliases the canonical event-log cap', () => {
    expect(SYSTEM_EVENT_LOG_CAP).toBe(DEFAULT_EVENT_LOG_CAP)
  })

  it('maps legacy join/leave/error constructors to canonical runtime event shape', () => {
    const events = createSystemEventLog([
      createJoinSystemEvent('host', 1),
      createLeaveSystemEvent('guest', 2),
      createErrorSystemEvent('connection lost', 3)
    ])

    expect(events).toEqual([
      {
        type: 'participantJoined',
        participantId: 'host',
        username: 'host',
        timestampMs: 1
      },
      {
        type: 'participantLeft',
        participantId: 'guest',
        username: 'guest',
        timestampMs: 2
      },
      {
        type: 'error',
        code: 'legacy-system-error',
        message: 'connection lost',
        timestampMs: 3
      }
    ])
  })

  it('retains bounded append semantics through compatibility exports', () => {
    let events = createSystemEventLog()

    for (let index = 0; index < SYSTEM_EVENT_LOG_CAP + 2; index += 1) {
      events = appendSystemEvent(events, createErrorSystemEvent(`error-${index}`, index))
    }

    expect(events).toHaveLength(SYSTEM_EVENT_LOG_CAP)
    expect(events[0]).toEqual({
      type: 'error',
      code: 'legacy-system-error',
      message: 'error-2',
      timestampMs: 2
    })
  })
})
