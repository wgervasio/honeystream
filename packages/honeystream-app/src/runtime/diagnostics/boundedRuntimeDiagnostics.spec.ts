import { PROTOCOL_VERSION } from 'protocol/types'
import { expectBoundedArray } from 'test/architecture'
import {
  appendRuntimeDiagnostic,
  createPlaybackRuntimeDiagnostic,
  createPlaybackRuntimeDiagnostics,
  createProtocolRuntimeDiagnostic,
  createProtocolRuntimeDiagnostics,
  createTransportRuntimeDiagnostic,
  createTransportRuntimeDiagnostics,
  ProtocolRuntimeDiagnostic,
  RUNTIME_DIAGNOSTIC_CAP
} from './index'

const createProtocolDiagnostic = (index: number): ProtocolRuntimeDiagnostic =>
  createProtocolRuntimeDiagnostic({
    direction: 'client-to-host',
    occurredAtMs: index,
    error: {
      type: 'protocolError',
      version: PROTOCOL_VERSION,
      code: 'invalidEnvelope',
      message: `protocol-${index}`
    }
  })

const createTransportDiagnostic = (index: number) =>
  createTransportRuntimeDiagnostic({
    occurredAtMs: index,
    state: 'failed',
    error: {
      code: 'validation-failed',
      message: `transport-${index}`
    }
  })

const createPlaybackDiagnostic = (index: number) =>
  createPlaybackRuntimeDiagnostic({
    code: 'adapter-apply-failed',
    message: `playback-${index}`,
    playbackState: 'paused',
    occurredAtMs: index,
    mediaId: `media-${index}`
  })

type MutableProtocolRuntimeDiagnostic = {
  -readonly [Key in keyof ProtocolRuntimeDiagnostic]: ProtocolRuntimeDiagnostic[Key]
}

describe('runtime diagnostics primitives', () => {
  it('caps protocol diagnostics at 64 entries by default', () => {
    const diagnostics = createProtocolRuntimeDiagnostics()
    for (let index = 0; index < RUNTIME_DIAGNOSTIC_CAP + 3; index += 1) {
      diagnostics.record(createProtocolDiagnostic(index))
    }

    const snapshot = diagnostics.snapshot()
    expectBoundedArray(snapshot, RUNTIME_DIAGNOSTIC_CAP, 'protocol diagnostics')
    expect(snapshot).toHaveLength(RUNTIME_DIAGNOSTIC_CAP)
    expect(snapshot[0].message).toBe('protocol-3')
    expect(snapshot[RUNTIME_DIAGNOSTIC_CAP - 1].message).toBe(
      `protocol-${RUNTIME_DIAGNOSTIC_CAP + 2}`
    )
  })

  it('supports custom caps for transport and playback diagnostics', () => {
    const transportDiagnostics = createTransportRuntimeDiagnostics(2)
    const playbackDiagnostics = createPlaybackRuntimeDiagnostics(2)

    for (let index = 0; index < 3; index += 1) {
      transportDiagnostics.record(createTransportDiagnostic(index))
      playbackDiagnostics.record(createPlaybackDiagnostic(index))
    }

    expect(transportDiagnostics.snapshot().map(diagnostic => diagnostic.message)).toEqual([
      'transport-1',
      'transport-2'
    ])
    expect(playbackDiagnostics.snapshot().map(diagnostic => diagnostic.message)).toEqual([
      'playback-1',
      'playback-2'
    ])
  })

  it('appends diagnostics without mutating prior arrays', () => {
    const original = [createProtocolDiagnostic(0)]
    const next = appendRuntimeDiagnostic(original, createProtocolDiagnostic(1), 1)

    expect(original).toEqual([createProtocolDiagnostic(0)])
    expect(next).toEqual([createProtocolDiagnostic(1)])
  })

  it('isolates stored diagnostics from caller and snapshot mutation', () => {
    const diagnostics = createProtocolRuntimeDiagnostics(2)
    const mutableDiagnostic: MutableProtocolRuntimeDiagnostic = {
      scope: 'protocol',
      code: 'invalidEnvelope',
      direction: 'client-to-host',
      occurredAtMs: 10,
      message: 'original',
      path: 'envelope'
    }

    diagnostics.record(mutableDiagnostic)
    mutableDiagnostic.message = 'mutated-after-record'

    const mutableSnapshot = diagnostics.snapshot() as MutableProtocolRuntimeDiagnostic[]
    mutableSnapshot[0].message = 'mutated-in-snapshot'
    mutableSnapshot.push({
      scope: 'protocol',
      code: 'invalidEnvelope',
      direction: 'client-to-host',
      occurredAtMs: 11,
      message: 'extra'
    })

    const stableSnapshot = diagnostics.snapshot()
    expect(stableSnapshot).toHaveLength(1)
    expect(stableSnapshot[0].message).toBe('original')
  })

  it('rejects invalid diagnostic caps', () => {
    expect(() => createProtocolRuntimeDiagnostics(0)).toThrow(
      'Runtime diagnostics cap must be a positive integer'
    )
    expect(() => createTransportRuntimeDiagnostics(Number.NaN)).toThrow(
      'Runtime diagnostics cap must be a positive integer'
    )
  })
})
