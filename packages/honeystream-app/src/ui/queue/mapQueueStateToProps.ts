import { SessionMediaItem, SessionState } from '../../domain/session-state'
import { QueueIntentCallbacks, QueueMediaItemViewModel, QueueStateViewProps } from './types'

export type SessionQueueState = Pick<SessionState, 'current' | 'queue'>

export const mapSessionMediaItemToQueueMediaItem = (
  mediaItem: SessionMediaItem
): QueueMediaItemViewModel => ({
  id: mediaItem.id,
  title: mediaItem.title,
  requestedBy: mediaItem.requestedBy,
  durationMs: mediaItem.durationMs,
  kind: mediaItem.kind,
  source: mediaItem.url
})

export const mapSessionQueueStateToQueueViewProps = (
  state: SessionQueueState
): QueueStateViewProps => ({
  currentItem: state.current ? mapSessionMediaItemToQueueMediaItem(state.current) : undefined,
  queuedItems: state.queue.map(mapSessionMediaItemToQueueMediaItem)
})

export const mapSessionQueueStateToQueueProps = (
  state: SessionQueueState,
  intents: QueueIntentCallbacks
): QueueStateViewProps & QueueIntentCallbacks => ({
  ...mapSessionQueueStateToQueueViewProps(state),
  onNext: intents.onNext,
  onRemove: intents.onRemove
})
