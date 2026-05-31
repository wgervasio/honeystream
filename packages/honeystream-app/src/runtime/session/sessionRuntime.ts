import { DEFAULT_QUEUE_CAP } from '../../domain/queue'
import { createSessionState, SessionState } from '../../domain/session-state'
import { PlaybackEngineDesiredState } from 'playback/engine/playbackEngineContract'
import {
  DomainError,
  transitionAdvanceQueue,
  transitionGuestJoined,
  transitionGuestLeft,
  transitionQueueMedia,
  transitionRemoveQueuedMedia,
  transitionSeekPlayback,
  transitionSetPlaybackRate,
  transitionTogglePlayback,
  TransitionResult
} from '../../domain/transitions'
import { invalidCommandError, invalidDirectionError } from 'protocol/errors'
import { parseWireEnvelope } from 'protocol/parsers'
import {
  ClientCommand,
  HostEvent,
  MediaSnapshot,
  PROTOCOL_VERSION,
  ProtocolError,
  SnapshotRequestReason,
  WireEnvelope
} from 'protocol/types'
import { validateInboundSequence } from 'protocol/sequence'
import { toProtocolHostEventsFromTransition } from 'runtime/protocol'
import {
  PeerTransportEvent,
  PeerTransportMessageDelivery,
  TransportUnsubscribe
} from 'transport/contracts'
import {
  createProjectionStore,
  ProjectionStore,
  ProjectionUnsubscribe
} from 'ui/externalStoreProjection'
import {
  HostSessionCommand,
  SessionRuntime,
  SessionRuntimeClockSyncSnapshot,
  SessionRuntimeDependencies,
  SessionRuntimePlaybackAdapterKind,
  SessionRuntimeProjection,
  StartGuestSessionInput,
  StartHostSessionInput
} from './contracts'
import {
  applyHostEventToSessionSnapshot,
  toPlaybackDesiredStateFromDomain,
  toPlaybackDesiredStateFromSnapshot,
  toSessionMediaItem,
  toSessionSnapshot,
  upsertKnownMedia
} from './mappers'

const DEFAULT_DIAGNOSTICS_CAP = 64
const DEFAULT_RUNTIME_ERROR_CAP = 32
const DEFAULT_MEDIA_CACHE_CAP = 32
const DEFAULT_SNAPSHOT_REQUEST_COOLDOWN_MS = 500
const DEFAULT_CLOCK_SYNC_SAMPLE_CAP = 5
const PLAYBACK_APPLY_FAILED_ERROR_CODE = 'playback-apply-failed'

const normalizeCap = (value: number | undefined, fallback: number): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    return fallback
  }
  return value
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  return `Unexpected runtime failure: ${String(error)}`
}

const hostCommandToClientCommand = (command: HostSessionCommand): ClientCommand => {
  switch (command.type) {
    case 'addMedia':
      return { type: 'addMedia', media: command.media }
    case 'removeMedia':
      return { type: 'removeMedia', mediaId: command.mediaId }
    case 'playPause':
      return { type: 'playPause', playing: command.playing }
    case 'seek':
      return { type: 'seek', positionMs: command.positionMs }
    case 'setRate':
      return { type: 'setRate', rate: command.rate }
    case 'next':
      return { type: 'next' }
    case 'requestSnapshot':
      return { type: 'requestSnapshot', reason: command.reason || 'manual' }
  }
}

const toProtocolErrorFromDomainError = (error: DomainError): ProtocolError =>
  invalidCommandError(error.message, `domain.${error.code}`)

const normalizeHeartbeatInterval = (value: number | undefined): number | undefined => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    return undefined
  }
  return value
}

const median = (samples: readonly number[]): number => {
  if (samples.length === 0) return 0
  const sortedSamples = samples.slice().sort((left, right) => left - right)
  return sortedSamples[Math.floor(sortedSamples.length / 2)]
}

export class DefaultSessionRuntime implements SessionRuntime {
  private readonly transport: SessionRuntimeDependencies['transport']
  private readonly playback: SessionRuntimeDependencies['playback']
  private readonly now: () => number
  private readonly queueCap: number
  private readonly diagnosticsCap: number
  private readonly runtimeErrorCap: number
  private readonly mediaCacheCap: number
  private readonly heartbeatIntervalMs?: number

  private readonly projectionStore: ProjectionStore<SessionRuntimeProjection>
  private readonly unsubscribeTransport: TransportUnsubscribe

  private role: SessionRuntimeProjection['role'] = 'uninitialized'
  private lifecycle: SessionRuntimeProjection['lifecycle'] = 'idle'
  private projection: SessionRuntimeProjection

  private hostState?: SessionState
  private hostInviteSecret?: string
  private expectedGuestRoomId?: string
  private knownGuestMedia: readonly MediaSnapshot[] = []

  private diagnostics: readonly ProtocolError[] = []
  private runtimeErrors: readonly string[] = []
  private playbackAdapterKind: SessionRuntimePlaybackAdapterKind | undefined
  private eventCursor = 0
  private sequence = 0
  private expectedInboundSeq: number | undefined
  private lastGuestSnapshotRequestAtMs: number | undefined
  private disposed = false
  private inboundQueue: Promise<void> = Promise.resolve()
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined
  private clockSync?: SessionRuntimeClockSyncSnapshot
  private clockSyncOffsetSamples: readonly number[] = []

  constructor(dependencies: SessionRuntimeDependencies) {
    this.transport = dependencies.transport
    this.playback = dependencies.playback
    this.now = dependencies.now || Date.now
    this.queueCap = normalizeCap(dependencies.queueCap, DEFAULT_QUEUE_CAP)
    this.diagnosticsCap = normalizeCap(dependencies.diagnosticsCap, DEFAULT_DIAGNOSTICS_CAP)
    this.runtimeErrorCap = normalizeCap(dependencies.runtimeErrorCap, DEFAULT_RUNTIME_ERROR_CAP)
    this.mediaCacheCap = DEFAULT_MEDIA_CACHE_CAP
    this.heartbeatIntervalMs = normalizeHeartbeatInterval(dependencies.heartbeatIntervalMs)

    this.projection = {
      role: this.role,
      lifecycle: this.lifecycle,
      transportState: this.transport.getState(),
      clockSync: this.clockSync,
      playbackAdapterKind: this.playbackAdapterKind,
      diagnostics: [],
      runtimeErrors: []
    }
    this.projectionStore = createProjectionStore(this.projection)
    this.unsubscribeTransport = this.transport.subscribe(event => {
      this.onTransportEvent(event)
    })
  }

  getSnapshot(): SessionRuntimeProjection {
    return this.projectionStore.getSnapshot()
  }

  getProjectionStore(): ProjectionStore<SessionRuntimeProjection> {
    return this.projectionStore
  }

  subscribeToSnapshots(
    listener: (snapshot: SessionRuntimeProjection) => void
  ): ProjectionUnsubscribe {
    return this.projectionStore.subscribe(() => {
      listener(this.projectionStore.getSnapshot())
    })
  }

  async startHostSession(input: StartHostSessionInput): Promise<void> {
    this.assertCanStart('startHostSession')

    this.role = 'host'
    this.lifecycle = 'starting'
    this.hostInviteSecret = input.inviteSecret.trim()
    this.eventCursor = 0
    this.expectedInboundSeq = undefined
    this.lastGuestSnapshotRequestAtMs = undefined
    this.hostState = createSessionState({
      roomId: input.roomId,
      hostId: this.transport.localPeerId,
      hostUsername: input.hostUsername,
      nowHostMs: typeof input.nowHostMs === 'number' ? input.nowHostMs : this.now()
    })

    this.updateProjection({
      session: toSessionSnapshot(this.hostState, this.eventCursor)
    })

    await this.transport.connect()
    await this.applyPlaybackDesiredState(toPlaybackDesiredStateFromDomain(this.hostState))

    this.lifecycle = 'running'
    this.updateProjection()
  }

  async startGuestSession(input: StartGuestSessionInput): Promise<void> {
    this.assertCanStart('startGuestSession')

    this.role = 'guest'
    this.lifecycle = 'starting'
    this.expectedGuestRoomId = input.roomId
    this.expectedInboundSeq = undefined
    this.lastGuestSnapshotRequestAtMs = undefined
    this.updateProjection()

    await this.transport.connect()
    this.lifecycle = 'running'
    this.updateProjection()

    await this.dispatchGuestCommand({
      type: 'join',
      username: input.username,
      inviteSecret: input.inviteSecret
    })
    this.startHeartbeatLoop()
  }

  async dispatchHostCommand(command: HostSessionCommand): Promise<void> {
    this.assertHostRunning('dispatchHostCommand')
    await this.applyHostClientCommand(
      hostCommandToClientCommand(command),
      this.transport.localPeerId,
      this.now()
    )
  }

  async dispatchGuestCommand(command: ClientCommand): Promise<void> {
    this.assertGuestRunning('dispatchGuestCommand')
    this.sendWireEnvelope({
      version: PROTOCOL_VERSION,
      direction: 'client-to-host',
      seq: this.nextSequence(),
      sentAtMs: this.now(),
      command
    })
  }

  dispose(): void {
    if (this.disposed) return

    this.disposed = true
    this.lifecycle = 'disposed'
    this.stopHeartbeatLoop()
    this.unsubscribeTransport()
    this.transport.dispose()
    this.playback.dispose()
    this.updateProjection()
  }

  private onTransportEvent(event: PeerTransportEvent<unknown>): void {
    if (this.disposed) return

    switch (event.type) {
      case 'state':
        this.updateProjection({ transportState: event.state })
        return
      case 'error':
        this.recordRuntimeError(`[transport:${event.error.code}] ${event.error.message}`)
        return
      case 'message':
        this.enqueueInboundDelivery(event.delivery)
    }
  }

  private enqueueInboundDelivery(delivery: PeerTransportMessageDelivery<unknown>): void {
    if (this.disposed) return

    this.inboundQueue = this.inboundQueue
      .then(() => {
        if (this.disposed) return undefined
        return this.handleInboundDelivery(delivery)
      })
      .catch(error => {
        if (this.disposed) return
        this.recordRuntimeError(`[inbound] ${toErrorMessage(error)}`)
      })
  }

  private async handleInboundDelivery(
    delivery: PeerTransportMessageDelivery<unknown>
  ): Promise<void> {
    if (this.disposed) return

    const parsed = parseWireEnvelope(delivery.envelope.message)
    if (!parsed.ok) {
      this.recordProtocolDiagnostic(parsed.error)
      if (this.role === 'host')
        this.trySendHostEvent(
          { type: 'protocolRejected', error: parsed.error },
          this.runtimeTimeAtOrAfter(delivery.receivedAtMs)
        )
      return
    }

    if (this.role === 'host') {
      if (parsed.value.direction !== 'client-to-host') {
        const protocolError = invalidDirectionError(parsed.value.direction)
        this.recordProtocolDiagnostic(protocolError)
        this.trySendHostEvent(
          { type: 'protocolRejected', error: protocolError },
          this.runtimeTimeAtOrAfter(delivery.receivedAtMs)
        )
        return
      }
      const sequenceError = this.validateInboundDeliverySequence(parsed.value.seq)
      if (sequenceError) {
        this.trySendHostEvent(
          { type: 'protocolRejected', error: sequenceError },
          this.runtimeTimeAtOrAfter(delivery.receivedAtMs)
        )
        return
      }
      await this.applyHostClientCommand(
        parsed.value.command,
        delivery.fromPeerId,
        delivery.receivedAtMs
      )
      return
    }

    if (this.role === 'guest') {
      if (parsed.value.direction !== 'host-to-client') {
        this.recordProtocolDiagnostic(invalidDirectionError(parsed.value.direction))
        return
      }
      const sequenceError = this.validateInboundDeliverySequence(parsed.value.seq)
      if (sequenceError) {
        this.tryRequestGuestSnapshot('resync', delivery.receivedAtMs)
        return
      }
      await this.applyGuestHostEvent(parsed.value.event, delivery.receivedAtMs)
      return
    }

    this.recordRuntimeError('Received protocol envelope before runtime startup.')
  }

  private async applyHostClientCommand(
    command: ClientCommand,
    fromPeerId: string,
    nowHostMs: number
  ): Promise<void> {
    const state = this.requireHostState()
    let nextState = state
    let domainErrors: readonly DomainError[] = []
    let transition: TransitionResult | undefined
    let requestSnapshot = command.type === 'requestSnapshot'

    switch (command.type) {
      case 'heartbeat': {
        const responseSentAtMs = this.runtimeTimeAtOrAfter(nowHostMs)
        this.trySendHostEvent(
          {
            type: 'heartbeat',
            clientSentAtMs: command.clientSentAtMs,
            hostReceivedAtMs: nowHostMs,
            hostSentAtMs: responseSentAtMs
          },
          responseSentAtMs
        )
        return
      }
      case 'join':
        if (command.inviteSecret !== this.hostInviteSecret) {
          const protocolError = invalidCommandError(
            'Invite secret was rejected by host.',
            'command.inviteSecret'
          )
          this.recordProtocolDiagnostic(protocolError)
          this.trySendHostEvent(
            { type: 'protocolRejected', error: protocolError },
            this.runtimeTimeAtOrAfter(nowHostMs)
          )
          return
        }
        transition = transitionGuestJoined(state, fromPeerId, command.username, nowHostMs)
        break
      case 'leave':
        transition = transitionGuestLeft(state, fromPeerId, nowHostMs)
        break
      case 'addMedia':
        transition = transitionQueueMedia(
          state,
          toSessionMediaItem(command.media, fromPeerId),
          nowHostMs,
          this.queueCap
        )
        break
      case 'removeMedia':
        transition = transitionRemoveQueuedMedia(state, command.mediaId, nowHostMs)
        break
      case 'playPause':
        if ((state.playback.state === 'playing') === command.playing) break
        transition = transitionTogglePlayback(state, nowHostMs)
        break
      case 'seek':
        transition = transitionSeekPlayback(state, command.positionMs, nowHostMs)
        break
      case 'setRate':
        transition = transitionSetPlaybackRate(state, command.rate, nowHostMs)
        break
      case 'next':
        transition = transitionAdvanceQueue(state, nowHostMs)
        break
      case 'requestSnapshot':
        requestSnapshot = true
    }

    if (transition) {
      nextState = transition.state
      domainErrors = transition.errors
    }

    const stateChanged = nextState !== state
    if (stateChanged) {
      this.hostState = nextState
      this.eventCursor += 1
      try {
        await this.applyPlaybackDesiredState(toPlaybackDesiredStateFromDomain(nextState))
      } catch (error) {
        const message = toErrorMessage(error)
        this.recordRuntimeError(`[playback] ${message}`)
        this.trySendHostEvent(
          {
            type: 'systemError',
            errorCode: PLAYBACK_APPLY_FAILED_ERROR_CODE,
            message: `Playback adapter failed: ${message}`
          },
          this.runtimeTimeAtOrAfter(nowHostMs)
        )
      }
    }

    for (const domainError of domainErrors) {
      const protocolError = toProtocolErrorFromDomainError(domainError)
      this.recordProtocolDiagnostic(protocolError)
    }

    const snapshot = toSessionSnapshot(this.requireHostState(), this.eventCursor)
    this.updateProjection({ session: snapshot })
    const responseSentAtMs = this.runtimeTimeAtOrAfter(nowHostMs)

    if (transition && stateChanged) {
      const events = toProtocolHostEventsFromTransition(state, transition)
      for (const event of events) {
        this.trySendHostEvent(event, responseSentAtMs)
      }
    }

    if (
      requestSnapshot ||
      (command.type === 'join' && transition && transition.errors.length === 0)
    ) {
      this.trySendHostEvent({ type: 'snapshot', snapshot }, responseSentAtMs)
    }
  }

  private async applyGuestHostEvent(event: HostEvent, receivedAtMs: number): Promise<void> {
    if (event.type === 'heartbeat') {
      this.recordClockSync(event, receivedAtMs)
      await this.reapplyGuestPlaybackAfterClockSync(receivedAtMs)
      return
    }

    if (event.type === 'protocolRejected') {
      this.recordProtocolDiagnostic(event.error)
      if (event.error.code === 'unsupportedVersion') {
        this.recordRuntimeError('Protocol version mismatch. Reload the room to reconnect safely.')
      }
    } else if (event.type === 'systemError') {
      this.recordRuntimeError(`[host:${event.errorCode}] ${event.message}`)
    }

    const nextSession = applyHostEventToSessionSnapshot(this.projection.session, event)
    if (!nextSession) return
    if (this.expectedGuestRoomId && nextSession.roomId !== this.expectedGuestRoomId) {
      this.recordRuntimeError(
        `Received snapshot room "${nextSession.roomId}" while expecting "${
          this.expectedGuestRoomId
        }".`
      )
      return
    }

    if (event.type === 'mediaQueued') {
      this.knownGuestMedia = upsertKnownMedia(this.knownGuestMedia, event.media, this.mediaCacheCap)
    }
    if (nextSession.currentMedia) {
      this.knownGuestMedia = upsertKnownMedia(
        this.knownGuestMedia,
        nextSession.currentMedia,
        this.mediaCacheCap
      )
    }
    for (const media of nextSession.queue) {
      this.knownGuestMedia = upsertKnownMedia(this.knownGuestMedia, media, this.mediaCacheCap)
    }

    this.updateProjection({ session: nextSession })
    try {
      await this.applyPlaybackDesiredState(
        toPlaybackDesiredStateFromSnapshot(
          nextSession,
          this.knownGuestMedia,
          this.toEstimatedHostTime(receivedAtMs)
        )
      )
    } catch (error) {
      this.recordRuntimeError(`[playback] ${toErrorMessage(error)}`)
    }
    this.updateProjection()
  }

  private async reapplyGuestPlaybackAfterClockSync(receivedAtMs: number): Promise<void> {
    const session = this.projection.session
    if (!session || session.playback.state !== 'playing') return

    try {
      await this.applyPlaybackDesiredState(
        toPlaybackDesiredStateFromSnapshot(
          session,
          this.knownGuestMedia,
          this.toEstimatedHostTime(receivedAtMs)
        )
      )
    } catch (error) {
      this.recordRuntimeError(`[playback] ${toErrorMessage(error)}`)
    }
  }

  private async applyPlaybackDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<void> {
    try {
      const result = await this.playback.applyDesiredState(desiredState)
      this.playbackAdapterKind = result.adapterKind
    } catch (error) {
      if (this.playback.getCurrentAdapterKind) {
        this.playbackAdapterKind = this.playback.getCurrentAdapterKind()
      }
      throw error
    }
  }

  private trySendHostEvent(event: HostEvent, sentAtMs: number = this.now()): void {
    if (this.disposed) return
    if (this.transport.getState().status !== 'connected') return
    this.sendWireEnvelope({
      version: PROTOCOL_VERSION,
      direction: 'host-to-client',
      seq: this.nextSequence(),
      sentAtMs,
      event
    })
  }

  private tryRequestGuestSnapshot(reason: SnapshotRequestReason, notBeforeMs?: number): void {
    if (this.disposed) return
    if (this.role !== 'guest') return
    if (this.transport.getState().status !== 'connected') return
    const nowMs =
      typeof notBeforeMs === 'number' ? this.runtimeTimeAtOrAfter(notBeforeMs) : this.now()
    if (
      reason === 'resync' &&
      typeof this.lastGuestSnapshotRequestAtMs === 'number' &&
      nowMs - this.lastGuestSnapshotRequestAtMs < DEFAULT_SNAPSHOT_REQUEST_COOLDOWN_MS
    ) {
      return
    }
    this.lastGuestSnapshotRequestAtMs = nowMs

    this.sendWireEnvelope({
      version: PROTOCOL_VERSION,
      direction: 'client-to-host',
      seq: this.nextSequence(),
      sentAtMs: nowMs,
      command: {
        type: 'requestSnapshot',
        reason
      }
    })
  }

  private startHeartbeatLoop(): void {
    this.stopHeartbeatLoop()
    if (typeof this.heartbeatIntervalMs !== 'number') return

    this.sendGuestHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.disposed) return
      try {
        this.sendGuestHeartbeat()
      } catch (error) {
        this.recordRuntimeError(`[heartbeat] ${toErrorMessage(error)}`)
      }
    }, this.heartbeatIntervalMs)
  }

  private stopHeartbeatLoop(): void {
    if (!this.heartbeatTimer) return
    clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = undefined
  }

  private sendGuestHeartbeat(): void {
    if (this.disposed) return
    if (this.role !== 'guest') return
    if (this.lifecycle !== 'running') return
    if (this.transport.getState().status !== 'connected') return

    const nowMs = this.now()
    this.sendWireEnvelope({
      version: PROTOCOL_VERSION,
      direction: 'client-to-host',
      seq: this.nextSequence(),
      sentAtMs: nowMs,
      command: {
        type: 'heartbeat',
        clientSentAtMs: nowMs
      }
    })
  }

  private recordClockSync(
    event: Extract<HostEvent, { readonly type: 'heartbeat' }>,
    receivedAtMs: number
  ): void {
    const hostProcessingMs = Math.max(0, event.hostSentAtMs - event.hostReceivedAtMs)
    const roundTripMs = Math.max(0, receivedAtMs - event.clientSentAtMs - hostProcessingMs)
    const estimatedHostOffsetMs =
      (event.hostReceivedAtMs - event.clientSentAtMs + event.hostSentAtMs - receivedAtMs) / 2
    this.clockSyncOffsetSamples = [
      ...this.clockSyncOffsetSamples,
      estimatedHostOffsetMs
    ].slice(-DEFAULT_CLOCK_SYNC_SAMPLE_CAP)
    this.clockSync = {
      estimatedHostOffsetMs: median(this.clockSyncOffsetSamples),
      lastRoundTripMs: roundTripMs,
      lastSyncedAtMs: receivedAtMs,
      sampleCount: this.clockSyncOffsetSamples.length
    }
    this.updateProjection({ clockSync: this.clockSync })
  }

  private toEstimatedHostTime(clientNowMs: number): number {
    const offsetMs = this.clockSync ? this.clockSync.estimatedHostOffsetMs : 0
    return clientNowMs + offsetMs
  }

  private runtimeTimeAtOrAfter(notBeforeMs: number): number {
    const nowMs = this.now()
    return Number.isFinite(notBeforeMs) ? Math.max(nowMs, notBeforeMs) : nowMs
  }

  private sendWireEnvelope(envelope: WireEnvelope): void {
    this.transport.send({
      seq: envelope.seq,
      sentAtMs: envelope.sentAtMs,
      message: envelope
    })
  }

  private nextSequence(): number {
    this.sequence += 1
    return this.sequence
  }

  private validateInboundDeliverySequence(seq: number): ProtocolError | undefined {
    const validation = validateInboundSequence(this.expectedInboundSeq, seq)
    this.expectedInboundSeq = validation.nextExpectedSeq
    if (validation.ok) {
      return undefined
    }

    this.recordProtocolDiagnostic(validation.error)
    return validation.error
  }

  private updateProjection(overrides: Partial<SessionRuntimeProjection> = {}): void {
    this.projection = {
      role: this.role,
      lifecycle: this.lifecycle,
      transportState: this.transport.getState(),
      session: this.projection.session,
      clockSync: this.clockSync,
      playbackAdapterKind: this.playbackAdapterKind,
      diagnostics: this.diagnostics,
      runtimeErrors: this.runtimeErrors,
      ...overrides
    }
    this.projectionStore.setSnapshot(this.projection)
  }

  private recordProtocolDiagnostic(error: ProtocolError): void {
    this.diagnostics = [...this.diagnostics, error]
    if (this.diagnostics.length > this.diagnosticsCap) {
      this.diagnostics = this.diagnostics.slice(this.diagnostics.length - this.diagnosticsCap)
    }
    this.updateProjection()
  }

  private recordRuntimeError(message: string): void {
    this.runtimeErrors = [...this.runtimeErrors, message]
    if (this.runtimeErrors.length > this.runtimeErrorCap) {
      this.runtimeErrors = this.runtimeErrors.slice(
        this.runtimeErrors.length - this.runtimeErrorCap
      )
    }
    this.updateProjection()
  }

  private assertCanStart(action: string): void {
    if (this.disposed) throw new Error(`[SessionRuntime] [disposed] ${action} called after dispose`)
    if (this.role !== 'uninitialized')
      throw new Error(`[SessionRuntime] ${action} may only run once`)
  }

  private assertHostRunning(action: string): void {
    if (this.disposed) throw new Error(`[SessionRuntime] [disposed] ${action} called after dispose`)
    if (this.role !== 'host' || this.lifecycle !== 'running') {
      throw new Error(`[SessionRuntime] ${action} requires a running host session`)
    }
  }

  private assertGuestRunning(action: string): void {
    if (this.disposed) throw new Error(`[SessionRuntime] [disposed] ${action} called after dispose`)
    if (this.role !== 'guest' || this.lifecycle !== 'running') {
      throw new Error(`[SessionRuntime] ${action} requires a running guest session`)
    }
  }

  private requireHostState(): SessionState {
    if (!this.hostState) throw new Error('[SessionRuntime] host state is unavailable')
    return this.hostState
  }
}

export const createSessionRuntime = (dependencies: SessionRuntimeDependencies): SessionRuntime =>
  new DefaultSessionRuntime(dependencies)
