import { MessageType } from './message-types'
import { ProtocolParseErrorCode, ProtocolParseResult, parseError, parseOk } from './errors'
import { ClientID, RoomID, SignalPayload } from './wire-types'
import {
  JsonRecord,
  hasOwn,
  isClientID,
  isRecord,
  isRoomID,
  isSignalDataPayload,
  isString
} from './validation'

export type ClientSignalRequest =
  | { readonly t: MessageType.Ping }
  | { readonly t: MessageType.CreateRoom; readonly id: RoomID }
  | { readonly t: MessageType.AuthResponse; readonly c: string }
  | { readonly t: MessageType.JoinRoom; readonly id: RoomID; readonly o: SignalPayload }
  | { readonly t: MessageType.CandidateOffer; readonly o: SignalPayload; readonly f?: ClientID; readonly to?: ClientID }

type ClientRequestType = ClientSignalRequest['t']

const isClientRequestType = (value: unknown): value is ClientRequestType => {
  switch (value) {
    case MessageType.Ping:
    case MessageType.CreateRoom:
    case MessageType.AuthResponse:
    case MessageType.JoinRoom:
    case MessageType.CandidateOffer:
      return true
    default:
      return false
  }
}

const missingField = (field: string): ProtocolParseResult<never> =>
  parseError(ProtocolParseErrorCode.MissingField, `Missing '${field}' field`, field)

const invalidField = (field: string, reason: string): ProtocolParseResult<never> =>
  parseError(ProtocolParseErrorCode.InvalidField, `Invalid '${field}' field: ${reason}`, field)

const parseMessageType = (payload: JsonRecord): ProtocolParseResult<ClientRequestType> => {
  if (!hasOwn(payload, 't')) return missingField('t')
  const value = payload.t
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return invalidField('t', 'expected integer message type')
  }
  if (!isClientRequestType(value)) {
    return parseError(ProtocolParseErrorCode.UnknownMessageType, `Unknown request message type '${value}'`, 't')
  }
  return parseOk(value)
}

const parseRoomIDField = (payload: JsonRecord): ProtocolParseResult<RoomID> => {
  if (!hasOwn(payload, 'id')) return missingField('id')
  if (!isRoomID(payload.id)) return invalidField('id', 'expected 64-char hex room ID')
  return parseOk(payload.id)
}

const parseChallengeField = (payload: JsonRecord): ProtocolParseResult<string> => {
  if (!hasOwn(payload, 'c')) return missingField('c')
  if (!isString(payload.c)) return invalidField('c', 'expected challenge string')
  return parseOk(payload.c)
}

const parseOfferField = (payload: JsonRecord): ProtocolParseResult<SignalPayload> => {
  if (!hasOwn(payload, 'o')) return missingField('o')
  if (!isSignalDataPayload(payload.o)) return invalidField('o', "expected signal payload with 'sdp' or 'candidate'")
  return parseOk(payload.o)
}

const parseOptionalClientIDField = (payload: JsonRecord, field: 'f' | 'to'): ProtocolParseResult<ClientID | undefined> => {
  if (!hasOwn(payload, field)) return parseOk(undefined)
  const value = payload[field]
  if (!isClientID(value)) return invalidField(field, 'expected positive integer client ID')
  return parseOk(value)
}

export const parseClientRequest = (payload: unknown): ProtocolParseResult<ClientSignalRequest> => {
  if (!isRecord(payload)) return parseError(ProtocolParseErrorCode.InvalidEnvelope, 'Request must be a JSON object')
  const typeResult = parseMessageType(payload)
  if (!typeResult.ok) return typeResult

  switch (typeResult.value) {
    case MessageType.Ping:
      return parseOk({ t: MessageType.Ping })
    case MessageType.CreateRoom: {
      const idResult = parseRoomIDField(payload)
      return idResult.ok ? parseOk({ t: MessageType.CreateRoom, id: idResult.value }) : idResult
    }
    case MessageType.AuthResponse: {
      const challengeResult = parseChallengeField(payload)
      return challengeResult.ok ? parseOk({ t: MessageType.AuthResponse, c: challengeResult.value }) : challengeResult
    }
    case MessageType.JoinRoom: {
      const idResult = parseRoomIDField(payload)
      if (!idResult.ok) return idResult
      const offerResult = parseOfferField(payload)
      return offerResult.ok ? parseOk({ t: MessageType.JoinRoom, id: idResult.value, o: offerResult.value }) : offerResult
    }
    case MessageType.CandidateOffer: {
      const offerResult = parseOfferField(payload)
      if (!offerResult.ok) return offerResult
      const fromResult = parseOptionalClientIDField(payload, 'f')
      if (!fromResult.ok) return fromResult
      const toResult = parseOptionalClientIDField(payload, 'to')
      if (!toResult.ok) return toResult
      return parseOk({ t: MessageType.CandidateOffer, o: offerResult.value, f: fromResult.value, to: toResult.value })
    }
  }
}

export const parseClientRequestJson = (rawPayload: string): ProtocolParseResult<ClientSignalRequest> => {
  let payload: unknown
  try {
    payload = JSON.parse(rawPayload)
  } catch {
    return parseError(ProtocolParseErrorCode.InvalidJson, 'Invalid JSON payload')
  }
  return parseClientRequest(payload)
}
