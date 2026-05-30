export interface HeartbeatCommand {
  readonly type: 'heartbeat'
  readonly clientSentAtMs: number
}

export interface HeartbeatEvent {
  readonly type: 'heartbeat'
  readonly clientSentAtMs: number
  readonly hostReceivedAtMs: number
  readonly hostSentAtMs: number
}
