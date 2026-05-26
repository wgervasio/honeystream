export const SYSTEM_EVENT_LOG_CAP = 64

type SystemEventBase = {
  readonly occurredAtMs: number
}

export type JoinSystemEvent = SystemEventBase & {
  readonly type: 'join'
  readonly username: string
}

export type LeaveSystemEvent = SystemEventBase & {
  readonly type: 'leave'
  readonly username: string
}

export type ErrorSystemEvent = SystemEventBase & {
  readonly type: 'error'
  readonly message: string
}

export type SystemEvent = JoinSystemEvent | LeaveSystemEvent | ErrorSystemEvent
export type SystemEventLog = readonly SystemEvent[]

export function createJoinSystemEvent(username: string, occurredAtMs: number): JoinSystemEvent {
  return {
    type: 'join',
    username,
    occurredAtMs
  }
}

export function createLeaveSystemEvent(username: string, occurredAtMs: number): LeaveSystemEvent {
  return {
    type: 'leave',
    username,
    occurredAtMs
  }
}

export function createErrorSystemEvent(message: string, occurredAtMs: number): ErrorSystemEvent {
  return {
    type: 'error',
    message,
    occurredAtMs
  }
}

function toBoundedSystemEventLog(events: readonly SystemEvent[]): SystemEventLog {
  if (events.length <= SYSTEM_EVENT_LOG_CAP) {
    return [...events]
  }

  return events.slice(events.length - SYSTEM_EVENT_LOG_CAP)
}

export function createSystemEventLog(events: readonly SystemEvent[] = []): SystemEventLog {
  return toBoundedSystemEventLog(events)
}

export function appendSystemEvent(
  eventLog: readonly SystemEvent[],
  event: SystemEvent
): SystemEventLog {
  return toBoundedSystemEventLog([...eventLog, event])
}
