import { UnknownRecord } from './types'

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isString = (value: unknown): value is string => typeof value === 'string'
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
export const isNonNegativeNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0
export const isPositiveNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value > 0
export const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && isNonNegativeNumber(value)
export const isNonEmptyString = (value: unknown): value is string =>
  isString(value) && value.trim().length > 0

export const readOptionalString = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key]
  return value === undefined ? undefined : isString(value) ? value : undefined
}
