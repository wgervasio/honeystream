import {
  PeerTransportConnectionState,
  PeerTransportDisconnectReason,
  PeerTransportError
} from './connection-state'
import { Disposable } from './lifecycle'

export interface PeerTransportEnvelope<TMessage> {
  readonly seq: number
  readonly sentAtMs: number
  readonly message: TMessage
}

export interface PeerTransportMessageDelivery<TMessage> {
  readonly envelope: PeerTransportEnvelope<TMessage>
  readonly receivedAtMs: number
  readonly fromPeerId: string
}

export interface TransportMessageValidator<TMessage> {
  readonly validate: (value: unknown) => value is TMessage
  readonly describeInvalidMessage?: (value: unknown) => string
}

export type PeerTransportEvent<TMessage> =
  | {
      readonly type: 'state'
      readonly state: PeerTransportConnectionState
    }
  | {
      readonly type: 'message'
      readonly delivery: PeerTransportMessageDelivery<TMessage>
    }
  | {
      readonly type: 'error'
      readonly error: PeerTransportError
    }

export type PeerTransportListener<TMessage> = (event: PeerTransportEvent<TMessage>) => void
export type TransportUnsubscribe = () => void

export interface PeerTransport<TInboundMessage, TOutboundMessage = TInboundMessage>
  extends Disposable {
  readonly localPeerId: string
  readonly remotePeerId: string
  connect(): Promise<void>
  disconnect(reason?: PeerTransportDisconnectReason): void
  getState(): PeerTransportConnectionState
  send(envelope: PeerTransportEnvelope<TOutboundMessage>): void
  subscribe(listener: PeerTransportListener<TInboundMessage>): TransportUnsubscribe
}

export type EnvelopeValidationFailureCode = 'invalid-envelope' | 'validation-failed'

export type EnvelopeValidationResult<TMessage> =
  | {
      readonly ok: true
      readonly envelope: PeerTransportEnvelope<TMessage>
    }
  | {
      readonly ok: false
      readonly code: EnvelopeValidationFailureCode
      readonly reason: string
    }

type UnknownRecord = { readonly [key: string]: unknown }

const isObjectRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const invalidEnvelope = (
  code: EnvelopeValidationFailureCode,
  reason: string
): EnvelopeValidationResult<never> => ({
  ok: false,
  code,
  reason
})

export const validatePeerTransportEnvelope = <TMessage>(
  value: unknown,
  messageValidator: TransportMessageValidator<TMessage>
): EnvelopeValidationResult<TMessage> => {
  if (!isObjectRecord(value)) {
    return invalidEnvelope('invalid-envelope', 'Envelope must be an object')
  }

  const seq = value.seq
  if (!isFiniteNumber(seq)) {
    return invalidEnvelope('invalid-envelope', 'Envelope seq must be a finite number')
  }

  const sentAtMs = value.sentAtMs
  if (!isFiniteNumber(sentAtMs)) {
    return invalidEnvelope('invalid-envelope', 'Envelope sentAtMs must be a finite number')
  }

  const message = value.message
  if (!messageValidator.validate(message)) {
    const reason = messageValidator.describeInvalidMessage
      ? messageValidator.describeInvalidMessage(message)
      : 'Envelope message failed runtime validation'

    return invalidEnvelope('validation-failed', reason)
  }

  return {
    ok: true,
    envelope: {
      seq,
      sentAtMs,
      message
    }
  }
}
