export type BroadcastRole = 'guest' | 'host'

export type BroadcastControlMessage = {
  readonly kind: 'hello' | 'leave'
  readonly roomId: string
  readonly role: BroadcastRole
  readonly fromPeerId: string
}

type BroadcastDataMessage = {
  readonly kind: 'data'
  readonly roomId: string
  readonly fromPeerId: string
  readonly toPeerId: string
  readonly envelope: unknown
}

export type BroadcastMessage = BroadcastControlMessage | BroadcastDataMessage

const isObjectRecord = (value: unknown): value is { readonly [key: string]: unknown } =>
  typeof value === 'object' && value !== null

const isBroadcastRole = (value: unknown): value is BroadcastRole =>
  value === 'guest' || value === 'host'

export const isBroadcastMessage = (value: unknown): value is BroadcastMessage => {
  if (!isObjectRecord(value)) return false
  if (value.kind !== 'hello' && value.kind !== 'leave' && value.kind !== 'data') return false
  if (typeof value.roomId !== 'string') return false
  if (typeof value.fromPeerId !== 'string') return false
  if (value.kind === 'data') {
    return typeof value.toPeerId === 'string' && 'envelope' in value
  }

  return isBroadcastRole(value.role)
}
