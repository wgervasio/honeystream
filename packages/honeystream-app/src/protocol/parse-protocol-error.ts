import { malformedValueError, unsupportedVersionError } from './errors'
import { err, ok, ProtocolResult } from './result'
import { PROTOCOL_VERSION, ProtocolError, ProtocolErrorCode } from './types'
import { isNonEmptyString, isNonNegativeNumber, isRecord, isString } from './validation'

const errorCodes: readonly ProtocolErrorCode[] = [
  'unsupportedVersion',
  'invalidDirection',
  'invalidSequence',
  'invalidEnvelope',
  'invalidCommand',
  'invalidEvent',
  'invalidSnapshot',
  'malformedValue'
]

const includesValue = <T extends string>(value: string, allowed: readonly T[]): value is T =>
  (allowed as readonly string[]).includes(value)

export const parseProtocolError = (
  value: unknown,
  path: string = 'error'
): ProtocolResult<ProtocolError> => {
  if (!isRecord(value)) return err(malformedValueError(path, 'Expected protocol error object.'))
  if (value.type !== 'protocolError') return err(malformedValueError(`${path}.type`, 'Expected protocolError type.'))
  if (!isNonNegativeNumber(value.version)) return err(malformedValueError(`${path}.version`, 'Expected numeric protocol version.'))
  if (value.version !== PROTOCOL_VERSION) return err(unsupportedVersionError(value.version))
  if (!isString(value.code) || !includesValue(value.code, errorCodes)) {
    return err(malformedValueError(`${path}.code`, 'Expected known protocol error code.'))
  }
  if (!isNonEmptyString(value.message)) return err(malformedValueError(`${path}.message`, 'Expected non-empty message.'))
  const base = {
    type: 'protocolError' as const,
    version: PROTOCOL_VERSION,
    code: value.code,
    message: value.message,
    path: isString(value.path) ? value.path : undefined
  }
  switch (value.code) {
    case 'unsupportedVersion':
      if (!isNonNegativeNumber(value.receivedVersion)) {
        return err(malformedValueError(`${path}.receivedVersion`, 'Expected receivedVersion number.'))
      }
      return ok({ ...base, code: value.code, receivedVersion: value.receivedVersion, expectedVersion: PROTOCOL_VERSION })
    case 'invalidDirection':
      if (!isString(value.receivedDirection)) {
        return err(malformedValueError(`${path}.receivedDirection`, 'Expected receivedDirection string.'))
      }
      return ok({ ...base, code: value.code, receivedDirection: value.receivedDirection })
    case 'invalidSequence':
      if (value.field !== 'seq' && value.field !== 'sentAtMs') {
        return err(malformedValueError(`${path}.field`, 'Expected seq or sentAtMs sequence field.'))
      }
      if (!isNonNegativeNumber(value.receivedValue)) {
        return err(malformedValueError(`${path}.receivedValue`, 'Expected numeric received sequence value.'))
      }
      return ok({ ...base, code: value.code, field: value.field, receivedValue: value.receivedValue })
    case 'invalidEnvelope':
    case 'invalidCommand':
    case 'invalidEvent':
    case 'invalidSnapshot':
    case 'malformedValue':
      return ok({ ...base, code: value.code })
  }
}
