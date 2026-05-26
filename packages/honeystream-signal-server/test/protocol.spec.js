const { ProtocolParseErrorCode, parseClientRequest, parseClientRequestJson } = require('../lib/protocol')

const MessageType = {
  CreateRoom: 0,
  JoinRoom: 2,
  CandidateOffer: 5
}

describe('signal protocol parser', () => {
  const roomID = 'a'.repeat(64)

  it('parses create room requests', () => {
    const result = parseClientRequest({
      t: MessageType.CreateRoom,
      id: roomID
    })

    expect(result).toEqual({
      ok: true,
      value: {
        t: MessageType.CreateRoom,
        id: roomID
      }
    })
  })

  it('rejects malformed json payloads', () => {
    const result = parseClientRequestJson('{"t":')

    expect(result.ok).toEqual(false)
    expect(result.error.code).toEqual(ProtocolParseErrorCode.InvalidJson)
  })

  it('rejects unknown request types', () => {
    const result = parseClientRequest({ t: 999 })

    expect(result.ok).toEqual(false)
    expect(result.error.code).toEqual(ProtocolParseErrorCode.UnknownMessageType)
  })

  it('rejects join-room requests without an offer payload', () => {
    const result = parseClientRequest({
      t: MessageType.JoinRoom,
      id: roomID
    })

    expect(result.ok).toEqual(false)
    expect(result.error.code).toEqual(ProtocolParseErrorCode.MissingField)
    expect(result.error.field).toEqual('o')
  })

  it('rejects candidate offers with invalid recipient ids', () => {
    const result = parseClientRequest({
      t: MessageType.CandidateOffer,
      o: { candidate: { candidate: 'candidate:1' } },
      to: '1'
    })

    expect(result.ok).toEqual(false)
    expect(result.error.code).toEqual(ProtocolParseErrorCode.InvalidField)
    expect(result.error.field).toEqual('to')
  })

  it('parses candidate offers with optional routing', () => {
    const result = parseClientRequest({
      t: MessageType.CandidateOffer,
      o: { sdp: 'v=0' },
      f: 1,
      to: 2
    })

    expect(result).toEqual({
      ok: true,
      value: {
        t: MessageType.CandidateOffer,
        o: { sdp: 'v=0' },
        f: 1,
        to: 2
      }
    })
  })
})
