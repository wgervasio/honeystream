import {
  appendSystemEvent,
  createErrorSystemEvent,
  createJoinSystemEvent,
  createLeaveSystemEvent,
  createSystemEventLog,
  SystemEvent,
  SystemEventLog
} from 'domain/events'

/**
 * Temporary legacy boundary:
 * maps Redux chat notices into the new bounded domain SystemEventLog.
 *
 * Removal condition: delete this adapter when lobby chat Redux state is removed
 * and session UI reads events directly from SessionRuntime projection state.
 */
export type LegacySystemNotice =
  | {
      readonly kind: 'join'
      readonly username: string
    }
  | {
      readonly kind: 'leave'
      readonly username: string
    }
  | {
      readonly kind: 'error'
      readonly message?: string
    }

export interface LegacySystemNoticeMessage {
  readonly content: string
  readonly timestamp: number
  readonly legacySystemNotice?: LegacySystemNotice
}

export const createLegacySystemEventLog = (): SystemEventLog => createSystemEventLog()

const toSystemEvent = (message: LegacySystemNoticeMessage): SystemEvent | undefined => {
  const notice = message.legacySystemNotice
  if (!notice) return

  switch (notice.kind) {
    case 'join':
      return createJoinSystemEvent(notice.username, message.timestamp)
    case 'leave':
      return createLeaveSystemEvent(notice.username, message.timestamp)
    case 'error':
      return createErrorSystemEvent(notice.message || message.content, message.timestamp)
  }
}

export const appendLegacySystemNoticeEvent = (
  eventLog: SystemEventLog,
  message: LegacySystemNoticeMessage
): SystemEventLog => {
  const event = toSystemEvent(message)
  if (!event) return eventLog
  return appendSystemEvent(eventLog, event)
}
