export type QueueMediaItemKind = 'url' | 'localFile' | 'website'

export interface QueueMediaItemViewModel {
  readonly id: string
  readonly title: string
  readonly requestedBy: string
  readonly durationMs?: number
  readonly kind?: QueueMediaItemKind
  readonly source?: string
}

export interface QueueStateViewProps {
  readonly currentItem?: QueueMediaItemViewModel
  readonly queuedItems: readonly QueueMediaItemViewModel[]
}

export interface QueueIntentCallbacks {
  readonly onNext: () => void
  readonly onRemove: (mediaId: string) => void
}
