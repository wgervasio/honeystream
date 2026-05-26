import { ProtocolError } from './types'

export type ProtocolResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProtocolError }

export const ok = <T>(value: T): ProtocolResult<T> => ({ ok: true, value })
export const err = <T>(error: ProtocolError): ProtocolResult<T> => ({ ok: false, error })
