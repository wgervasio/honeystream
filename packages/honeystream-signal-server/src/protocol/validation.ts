import { ClientID, RoomID, SignalPayload } from './wire-types'

const hasOwnProperty = Object.prototype.hasOwnProperty

export type JsonRecord = { readonly [key: string]: unknown }

export const hasOwn = (value: JsonRecord, field: string): boolean => hasOwnProperty.call(value, field)

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isString = (value: unknown): value is string => typeof value === 'string'

export const isClientID = (value: unknown): value is ClientID =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

export const isRoomID = (value: unknown): value is RoomID =>
  typeof value === 'string' && value.length === 64

const hasSignalField = (value: JsonRecord, field: 'sdp' | 'candidate') =>
  hasOwn(value, field) && value[field] !== undefined && value[field] !== null

export const isSignalDataPayload = (value: unknown): value is SignalPayload => {
  if (!isRecord(value)) {
    return false
  }

  return hasSignalField(value, 'sdp') || hasSignalField(value, 'candidate')
}
