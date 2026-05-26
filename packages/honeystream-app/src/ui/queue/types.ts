export interface QueueMediaItemViewModel {
  readonly id: string
  readonly title: string
  readonly requestedBy: string
  readonly durationMs?: number
}

export interface QueueStateViewProps {
  readonly currentItem?: QueueMediaItemViewModel
  readonly queuedItems: readonly QueueMediaItemViewModel[]
}

export interface QueueIntentCallbacks {
  readonly onNext: () => void
  readonly onRemove: (mediaId: string) => void
}
