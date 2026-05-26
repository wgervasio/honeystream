export const DEFAULT_EVENT_LOG_CAP = 64

export type SystemEvent =
  | {
      readonly type: 'participantJoined'
      readonly timestampMs: number
      readonly participantId: string
      readonly username: string
    }
  | {
      readonly type: 'participantLeft'
      readonly timestampMs: number
      readonly participantId: string
    }
  | {
      readonly type: 'error'
      readonly timestampMs: number
      readonly code: string
      readonly message: string
    }

const normalizeEventLogCap = (cap: number): number => {
  if (!Number.isFinite(cap) || !Number.isInteger(cap) || cap < 1) {
    return DEFAULT_EVENT_LOG_CAP
  }
  return cap
}

export const appendSystemEvent = (
  events: readonly SystemEvent[],
  event: SystemEvent,
  cap: number = DEFAULT_EVENT_LOG_CAP
): readonly SystemEvent[] => {
  const nextEvents = [...events, event]
  const normalizedCap = normalizeEventLogCap(cap)
  if (nextEvents.length <= normalizedCap) {
    return nextEvents
  }
  return nextEvents.slice(nextEvents.length - normalizedCap)
}

export const appendSystemEvents = (
  events: readonly SystemEvent[],
  next: readonly SystemEvent[],
  cap: number = DEFAULT_EVENT_LOG_CAP
): readonly SystemEvent[] => {
  let result = events
  for (const event of next) {
    result = appendSystemEvent(result, event, cap)
  }
  return result
}
