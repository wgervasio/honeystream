import { PROTOCOL_VERSION, ProtocolError } from './types'

export const unsupportedVersionError = (receivedVersion: number): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'unsupportedVersion',
  message: `Unsupported protocol version ${receivedVersion}. Expected ${PROTOCOL_VERSION}.`,
  receivedVersion,
  expectedVersion: PROTOCOL_VERSION
})

export const invalidDirectionError = (receivedDirection: string): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'invalidDirection',
  message: `Invalid wire direction "${receivedDirection}".`,
  receivedDirection,
  path: 'direction'
})

export const invalidSequenceError = (
  field: 'seq' | 'sentAtMs',
  receivedValue: number
): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'invalidSequence',
  message: `Invalid sequence field "${field}".`,
  field,
  receivedValue,
  path: field
})

export const invalidEnvelopeError = (message: string, path?: string): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'invalidEnvelope',
  message,
  path
})

export const invalidCommandError = (message: string, path?: string): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'invalidCommand',
  message,
  path
})

export const invalidEventError = (message: string, path?: string): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'invalidEvent',
  message,
  path
})

export const invalidSnapshotError = (message: string, path?: string): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'invalidSnapshot',
  message,
  path
})

export const malformedValueError = (path: string, message: string): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'malformedValue',
  message,
  path
})
