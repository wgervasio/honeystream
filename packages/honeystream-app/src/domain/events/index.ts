import {
  createErrorSystemEvent as createRuntimeErrorSystemEvent,
  createParticipantJoinedSystemEvent,
  createParticipantLeftSystemEvent
} from '../event-log'

export {
  appendSystemEvent,
  appendSystemEvents,
  createSystemEventLog,
  DEFAULT_EVENT_LOG_CAP as SYSTEM_EVENT_LOG_CAP
} from '../event-log'

export type {
  ErrorSystemEvent,
  ParticipantJoinedSystemEvent as JoinSystemEvent,
  ParticipantLeftSystemEvent as LeaveSystemEvent,
  SystemEvent,
  SystemEventLog
} from '../event-log'

export const createJoinSystemEvent = (
  username: string,
  occurredAtMs: number
) =>
  createParticipantJoinedSystemEvent(username, username, occurredAtMs)

export const createLeaveSystemEvent = (
  username: string,
  occurredAtMs: number
) =>
  createParticipantLeftSystemEvent(username, occurredAtMs, username)

export const createErrorSystemEvent = (
  message: string,
  occurredAtMs: number
) =>
  createRuntimeErrorSystemEvent(message, occurredAtMs, 'legacy-system-error')
