export const DEFAULT_EVENT_LOG_CAP = 64

type SystemEventBase = {
  readonly timestampMs: number
}

export type ParticipantJoinedSystemEvent = SystemEventBase & {
  readonly type: 'participantJoined'
  readonly participantId: string
  readonly username: string
}

export type ParticipantLeftSystemEvent = SystemEventBase & {
  readonly type: 'participantLeft'
  readonly participantId: string
  readonly username?: string
}

export type ErrorSystemEvent = SystemEventBase & {
  readonly type: 'error'
  readonly code: string
  readonly message: string
}

export type SystemEvent =
  | ParticipantJoinedSystemEvent
  | ParticipantLeftSystemEvent
  | ErrorSystemEvent

export type SystemEventLog = readonly SystemEvent[]

const normalizeEventLogCap = (cap: number): number => {
  if (!Number.isFinite(cap) || !Number.isInteger(cap) || cap < 1) {
    return DEFAULT_EVENT_LOG_CAP
  }
  return cap
}

const toBoundedSystemEventLog = (
  events: readonly SystemEvent[],
  cap: number = DEFAULT_EVENT_LOG_CAP
): SystemEventLog => {
  const normalizedCap = normalizeEventLogCap(cap)
  if (events.length <= normalizedCap) {
    return [...events]
  }
  return events.slice(events.length - normalizedCap)
}

export const createParticipantJoinedSystemEvent = (
  participantId: string,
  username: string,
  timestampMs: number
): ParticipantJoinedSystemEvent => ({
  type: 'participantJoined',
  participantId,
  username,
  timestampMs
})

export const createParticipantLeftSystemEvent = (
  participantId: string,
  timestampMs: number,
  username?: string
): ParticipantLeftSystemEvent =>
  typeof username === 'string'
    ? { type: 'participantLeft', participantId, username, timestampMs }
    : { type: 'participantLeft', participantId, timestampMs }

export const createErrorSystemEvent = (
  message: string,
  timestampMs: number,
  code: string = 'system-error'
): ErrorSystemEvent => ({
  type: 'error',
  code,
  message,
  timestampMs
})

export const createSystemEventLog = (
  events: readonly SystemEvent[] = [],
  cap: number = DEFAULT_EVENT_LOG_CAP
): SystemEventLog => toBoundedSystemEventLog(events, cap)

export const appendSystemEvent = (
  events: readonly SystemEvent[],
  event: SystemEvent,
  cap: number = DEFAULT_EVENT_LOG_CAP
): SystemEventLog => toBoundedSystemEventLog([...events, event], cap)

export const appendSystemEvents = (
  events: readonly SystemEvent[],
  next: readonly SystemEvent[],
  cap: number = DEFAULT_EVENT_LOG_CAP
): SystemEventLog => {
  let result = events
  for (const event of next) {
    result = appendSystemEvent(result, event, cap)
  }
  return result
}
