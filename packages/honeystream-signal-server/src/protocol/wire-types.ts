/** 64-char hex public key. */
export type RoomID = string

export type ClientID = number

/**
 * Signal payload kept intentionally generic for compatibility with existing signaling exchange
 * objects while still forcing runtime shape validation at parser boundaries.
 */
export interface SignalPayload {
  readonly sdp?: unknown
  readonly candidate?: unknown
}
