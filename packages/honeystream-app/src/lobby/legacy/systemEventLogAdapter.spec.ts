import { SYSTEM_EVENT_LOG_CAP } from 'domain/events'
import {
  appendLegacySystemNoticeEvent,
  createLegacySystemEventLog,
  LegacySystemNoticeMessage
} from './systemEventLogAdapter'

const createMessage = (
  message: Partial<LegacySystemNoticeMessage> = {}
): LegacySystemNoticeMessage => ({
  content: 'notice',
  timestamp: 1,
  ...message
})

describe('lobby/legacy/systemEventLogAdapter', () => {
  it('maps join notices into join system events', () => {
    const eventLog = appendLegacySystemNoticeEvent(
      createLegacySystemEventLog(),
      createMessage({
        timestamp: 10,
        legacySystemNotice: {
          kind: 'join',
          username: 'host'
        }
      })
    )

    expect(eventLog).toEqual([
      {
        type: 'join',
        username: 'host',
        occurredAtMs: 10
      }
    ])
  })

  it('maps leave notices into leave system events', () => {
    const eventLog = appendLegacySystemNoticeEvent(
      createLegacySystemEventLog(),
      createMessage({
        timestamp: 20,
        legacySystemNotice: {
          kind: 'leave',
          username: 'guest'
        }
      })
    )

    expect(eventLog).toEqual([
      {
        type: 'leave',
        username: 'guest',
        occurredAtMs: 20
      }
    ])
  })

  it('maps error notices into error system events', () => {
    const eventLog = appendLegacySystemNoticeEvent(
      createLegacySystemEventLog(),
      createMessage({
        content: 'network timeout',
        timestamp: 30,
        legacySystemNotice: {
          kind: 'error'
        }
      })
    )

    expect(eventLog).toEqual([
      {
        type: 'error',
        message: 'network timeout',
        occurredAtMs: 30
      }
    ])
  })

  it('ignores chat messages without system notice metadata', () => {
    const eventLog = appendLegacySystemNoticeEvent(
      createLegacySystemEventLog(),
      createMessage({
        content: 'regular chat message',
        timestamp: 40
      })
    )

    expect(eventLog).toEqual([])
  })

  it('keeps only the newest bounded events', () => {
    let eventLog = createLegacySystemEventLog()

    for (let index = 0; index < SYSTEM_EVENT_LOG_CAP + 4; index += 1) {
      eventLog = appendLegacySystemNoticeEvent(
        eventLog,
        createMessage({
          content: `error-${index}`,
          timestamp: index,
          legacySystemNotice: {
            kind: 'error'
          }
        })
      )
    }

    expect(eventLog).toHaveLength(SYSTEM_EVENT_LOG_CAP)
    expect(eventLog[0]).toEqual({
      type: 'error',
      message: 'error-4',
      occurredAtMs: 4
    })
    expect(eventLog[SYSTEM_EVENT_LOG_CAP - 1]).toEqual({
      type: 'error',
      message: `error-${SYSTEM_EVENT_LOG_CAP + 3}`,
      occurredAtMs: SYSTEM_EVENT_LOG_CAP + 3
    })
  })
})
