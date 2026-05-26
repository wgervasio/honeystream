import {
  PlaybackRuntimeDiagnostic,
  ProtocolRuntimeDiagnostic,
  RUNTIME_DIAGNOSTIC_CAP,
  RuntimeDiagnostic,
  TransportRuntimeDiagnostic
} from './contracts'

const assertDiagnosticCap = (cap: number): void => {
  if (!Number.isInteger(cap) || cap < 1) {
    throw new Error('Runtime diagnostics cap must be a positive integer')
  }
}

const cloneRuntimeDiagnostic = <TDiagnostic extends RuntimeDiagnostic>(
  diagnostic: TDiagnostic
): TDiagnostic => ({
  ...diagnostic
})

export const toBoundedRuntimeDiagnostics = <TDiagnostic extends RuntimeDiagnostic>(
  diagnostics: readonly TDiagnostic[],
  cap: number = RUNTIME_DIAGNOSTIC_CAP
): readonly TDiagnostic[] => {
  assertDiagnosticCap(cap)
  const firstIndex = diagnostics.length > cap ? diagnostics.length - cap : 0
  const bounded: TDiagnostic[] = []

  for (let index = firstIndex; index < diagnostics.length; index += 1) {
    bounded.push(cloneRuntimeDiagnostic(diagnostics[index]))
  }

  return bounded
}

export const appendRuntimeDiagnostic = <TDiagnostic extends RuntimeDiagnostic>(
  diagnostics: readonly TDiagnostic[],
  diagnostic: TDiagnostic,
  cap: number = RUNTIME_DIAGNOSTIC_CAP
): readonly TDiagnostic[] => {
  return toBoundedRuntimeDiagnostics([...diagnostics, diagnostic], cap)
}

export interface RuntimeDiagnosticsBuffer<TDiagnostic extends RuntimeDiagnostic> {
  readonly cap: number
  readonly size: number
  record(diagnostic: TDiagnostic): void
  snapshot(): readonly TDiagnostic[]
  clear(): void
}

export class BoundedRuntimeDiagnostics<TDiagnostic extends RuntimeDiagnostic>
  implements RuntimeDiagnosticsBuffer<TDiagnostic> {
  readonly cap: number
  private diagnostics: readonly TDiagnostic[] = []

  constructor(cap: number = RUNTIME_DIAGNOSTIC_CAP) {
    assertDiagnosticCap(cap)
    this.cap = cap
  }

  get size(): number {
    return this.diagnostics.length
  }

  record(diagnostic: TDiagnostic): void {
    this.diagnostics = appendRuntimeDiagnostic(this.diagnostics, diagnostic, this.cap)
  }

  snapshot(): readonly TDiagnostic[] {
    return this.diagnostics.map(cloneRuntimeDiagnostic)
  }

  clear(): void {
    this.diagnostics = []
  }
}

export const createProtocolRuntimeDiagnostics = (
  cap: number = RUNTIME_DIAGNOSTIC_CAP
): RuntimeDiagnosticsBuffer<ProtocolRuntimeDiagnostic> =>
  new BoundedRuntimeDiagnostics<ProtocolRuntimeDiagnostic>(cap)

export const createTransportRuntimeDiagnostics = (
  cap: number = RUNTIME_DIAGNOSTIC_CAP
): RuntimeDiagnosticsBuffer<TransportRuntimeDiagnostic> =>
  new BoundedRuntimeDiagnostics<TransportRuntimeDiagnostic>(cap)

export const createPlaybackRuntimeDiagnostics = (
  cap: number = RUNTIME_DIAGNOSTIC_CAP
): RuntimeDiagnosticsBuffer<PlaybackRuntimeDiagnostic> =>
  new BoundedRuntimeDiagnostics<PlaybackRuntimeDiagnostic>(cap)
