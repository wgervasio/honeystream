import { parseHostEvent, parseProtocolError, parseWireEnvelope } from './parsers'
import { PROTOCOL_VERSION } from './types'

const roomId = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const host = { peerId: 'host-1', username: 'HostUser', role: 'host' as const }
const guest = { peerId: 'guest-1', username: 'GuestUser', role: 'guest' as const }
const media = {
  mediaId: 'media-1',
  kind: 'url' as const,
  source: 'https://example.com/video',
  title: 'Example Video',
  durationMs: 120000
}
const playback = {
  state: 'paused' as const,
  positionMs: 5000,
  updatedAtHostMs: 123456,
  rate: 1
}

describe('protocol foundation parsers', () => {
  it('accepts a valid client command envelope', () => {
    const result = parseWireEnvelope({
      version: PROTOCOL_VERSION,
      seq: 1,
      sentAtMs: 12345,
      direction: 'client-to-host',
      command: {
        type: 'join',
        username: '  GuestUser  ',
        inviteSecret: '  invite-secret  '
      }
    })

    expect(result.ok).toBeTruthy()
    if (result.ok) {
      expect(result.value.direction).toBe('client-to-host')
      if (result.value.direction === 'client-to-host') {
        expect(result.value.command).toEqual({
          type: 'join',
          username: 'GuestUser',
          inviteSecret: 'invite-secret'
        })
      }
    }
  })

  it('accepts a valid host snapshot envelope', () => {
    const result = parseWireEnvelope({
      version: PROTOCOL_VERSION,
      seq: 2,
      sentAtMs: 12400,
      direction: 'host-to-client',
      event: {
        type: 'snapshot',
        snapshot: {
          roomId,
          status: 'connected',
          participants: { host, guest },
          queue: [media],
          current: media,
          currentMediaId: media.mediaId,
          currentMedia: media,
          playback,
          eventCursor: 7
        }
      }
    })

    expect(result.ok).toBeTruthy()
    if (result.ok) {
      expect(result.value.direction).toBe('host-to-client')
      if (result.value.direction === 'host-to-client') expect(result.value.event.type).toBe('snapshot')
    }
  })

  it('rejects unknown protocol versions', () => {
    const result = parseWireEnvelope({
      version: 999,
      seq: 1,
      sentAtMs: 1,
      direction: 'client-to-host',
      command: { type: 'next' }
    })

    expect(result.ok).toBeFalsy()
    if (!result.ok) expect(result.error.code).toBe('unsupportedVersion')
  })

  it('rejects malformed client commands', () => {
    const result = parseWireEnvelope({
      version: PROTOCOL_VERSION,
      seq: 4,
      sentAtMs: 14000,
      direction: 'client-to-host',
      command: { type: 'seek', positionMs: -10 }
    })

    expect(result.ok).toBeFalsy()
    if (!result.ok) expect(result.error.code).toBe('malformedValue')
  })

  it('rejects snapshots whose current media metadata does not match currentMediaId', () => {
    const result = parseHostEvent({
      type: 'snapshot',
      snapshot: {
        roomId,
        status: 'connected',
        participants: { host, guest },
        queue: [],
        currentMediaId: media.mediaId,
        currentMedia: {
          ...media,
          mediaId: 'other-media'
        },
        playback,
        eventCursor: 8
      }
    })

    expect(result.ok).toBeFalsy()
    if (!result.ok) expect(result.error.path).toBe('event.snapshot.currentMedia.mediaId')
  })

  it('rejects join commands with invalid invite secrets', () => {
    const result = parseWireEnvelope({
      version: PROTOCOL_VERSION,
      seq: 5,
      sentAtMs: 15000,
      direction: 'client-to-host',
      command: { type: 'join', username: 'GuestUser', inviteSecret: 'bad secret' }
    })

    expect(result.ok).toBeFalsy()
    if (!result.ok) expect(result.error.path).toBe('envelope.command.inviteSecret')
  })

  it('rejects malformed snapshot events', () => {
    const result = parseHostEvent({
      type: 'snapshot',
      snapshot: {
        roomId,
        status: 'connected',
        participants: { host },
        queue: [media],
        playback,
        eventCursor: -1
      }
    })

    expect(result.ok).toBeFalsy()
    if (!result.ok) expect(result.error.code).toBe('malformedValue')
  })

  it('parses protocol error payloads', () => {
    const result = parseProtocolError({
      type: 'protocolError',
      version: PROTOCOL_VERSION,
      code: 'invalidDirection',
      message: 'Invalid wire direction.',
      receivedDirection: 'unknown'
    })

    expect(result.ok).toBeTruthy()
    if (result.ok) expect(result.value.code).toBe('invalidDirection')
  })
})
