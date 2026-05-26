import { EMBED_BRIDGE_DIAGNOSTIC_LIMIT } from './contracts'

export type EmbedBridgeDiagnosticDirection = 'inbound' | 'outbound'

export type EmbedBridgeDiagnosticCode =
  | 'invalid-message-shape'
  | 'invalid-message-type'
  | 'unsupported-message-type'
  | 'invalid-message-payload'
  | 'invalid-origin'
  | 'invalid-frame-ownership'
  | 'invalid-webview-id'

export type EmbedBridgeDiagnostic = {
  readonly code: EmbedBridgeDiagnosticCode
  readonly direction: EmbedBridgeDiagnosticDirection
  readonly reason: string
  readonly receivedAtMs: number
  readonly rawType?: string
}

export class EmbedBridgeDiagnostics {
  private readonly entries: EmbedBridgeDiagnostic[] = []

  constructor(private readonly limit: number = EMBED_BRIDGE_DIAGNOSTIC_LIMIT) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('EmbedBridgeDiagnostics limit must be a positive integer')
    }
  }

  push(entry: EmbedBridgeDiagnostic): void {
    if (this.entries.length >= this.limit) {
      this.entries.shift()
    }

    this.entries.push(entry)
  }

  snapshot(): readonly EmbedBridgeDiagnostic[] {
    return this.entries.slice()
  }

  clear(): void {
    this.entries.length = 0
  }

  get size(): number {
    return this.entries.length
  }
}
