import { PROTOCOL_VERSION, ProtocolError } from './types'

export type InboundSequenceValidation =
  | {
      readonly ok: true
      readonly nextExpectedSeq: number
    }
  | {
      readonly ok: false
      readonly error: ProtocolError
      readonly nextExpectedSeq: number
    }

const createSequenceOrderError = (receivedSeq: number, expectedSeq: number): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'invalidSequence',
  message: `Unexpected message sequence ${receivedSeq}. Expected ${expectedSeq}.`,
  field: 'seq',
  receivedValue: receivedSeq,
  path: 'seq'
})

export const validateInboundSequence = (
  expectedSeq: number | undefined,
  receivedSeq: number
): InboundSequenceValidation => {
  if (typeof expectedSeq !== 'number') {
    return {
      ok: true,
      nextExpectedSeq: receivedSeq + 1
    }
  }

  if (receivedSeq === expectedSeq) {
    return {
      ok: true,
      nextExpectedSeq: expectedSeq + 1
    }
  }

  return {
    ok: false,
    error: createSequenceOrderError(receivedSeq, expectedSeq),
    nextExpectedSeq: receivedSeq > expectedSeq ? receivedSeq + 1 : expectedSeq
  }
}
