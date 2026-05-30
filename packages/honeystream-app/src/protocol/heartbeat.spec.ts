import { parseWireEnvelope } from './parsers'
import { PROTOCOL_VERSION } from './types'

describe('protocol heartbeat parser', () => {
  it('accepts heartbeat command and event envelopes for clock sync', () => {
    const commandResult = parseWireEnvelope({
      version: PROTOCOL_VERSION,
      seq: 2,
      sentAtMs: 2000,
      direction: 'client-to-host',
      command: { type: 'heartbeat', clientSentAtMs: 2000 }
    })
    const eventResult = parseWireEnvelope({
      version: PROTOCOL_VERSION,
      seq: 3,
      sentAtMs: 2020,
      direction: 'host-to-client',
      event: {
        type: 'heartbeat',
        clientSentAtMs: 2000,
        hostReceivedAtMs: 2010,
        hostSentAtMs: 2020
      }
    })

    expect(commandResult.ok).toBeTruthy()
    expect(eventResult.ok).toBeTruthy()
  })
})
