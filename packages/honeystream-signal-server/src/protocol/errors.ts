export enum ProtocolParseErrorCode {
  InvalidJson = 'invalid_json',
  InvalidEnvelope = 'invalid_envelope',
  UnknownMessageType = 'unknown_message_type',
  MissingField = 'missing_field',
  InvalidField = 'invalid_field'
}

export interface ProtocolParseError {
  readonly code: ProtocolParseErrorCode
  readonly message: string
  readonly field?: string
}

export type ProtocolParseResult<T> =
  | {
      readonly ok: true
      readonly value: T
    }
  | {
      readonly ok: false
      readonly error: ProtocolParseError
    }

export const parseOk = <T>(value: T): ProtocolParseResult<T> => ({
  ok: true,
  value
})

export const parseError = (
  code: ProtocolParseErrorCode,
  message: string,
  field?: string
): ProtocolParseResult<never> => ({
  ok: false,
  error: {
    code,
    message,
    field
  }
})
