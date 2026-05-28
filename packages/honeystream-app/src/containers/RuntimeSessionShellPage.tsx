import React, { useEffect, useMemo } from 'react'
import { RouteComponentProps } from 'react-router'
import LayoutMain from 'components/layout/Main'
import { createErrorSystemEvent, createSystemEventLog, SystemEvent } from '../domain/event-log'
import { createDefaultMinimalSettings, MinimalSettings } from '../domain/settings/minimalSettings'
import {
  ProtocolError,
  SessionSnapshot,
  WireEnvelope,
  classifyMediaUrl,
  parseWireEnvelope
} from '../protocol'
import { ClientCommand, MediaSnapshot } from '../protocol/types'
import {
  PlaybackEngineApplyResult,
  PlaybackEngineDesiredState
} from '../playback/engine/playbackEngineContract'
import {
  createPlaybackRuntime,
  PlaybackRuntimeAdapterContext
} from '../playback/runtime'
import { MediaElementPlaybackAdapter } from '../playback/adapters/media-element'
import { createPopupAdapterFactory } from '../playback/adapters/popup'
import { LocalFileMetadata, localFileToMediaUrl } from '../playback/adapters/local-file'
import {
  HostSessionCommand,
  SessionRuntime as RuntimeSession,
  SessionRuntimeDependencies,
  SessionRuntimePlaybackEngine,
  SessionRuntimeProjection,
  createSessionRuntime
} from '../runtime/session'
import { TransportMessageValidator } from '../transport/contracts'
import { LegacyNetWireTransport } from '../transport/legacy-net'
import { LegacyNetServerLike } from '../transport/legacy-net'
import {
  InMemoryPeerTransportPair,
  createInMemoryPeerTransportPair
} from '../transport/in-memory-peer-transport-pair'
import {
  Disposable,
  InviteLinkPanel,
  PlaybackRuntimeControlIntents,
  PlaybackRuntimeControls,
  PlaybackRuntimeSessionModel,
  ProjectionStore,
  PrivateInviteCredentials,
  QueueIntentCallbacks,
  QueueMediaItemViewModel,
  QueueShell,
  RuntimeAddMediaPanel,
  SettingsRuntimePanel,
  SessionRuntimeIntentCallbacks,
  SessionRuntimeProjectionSnapshot,
  SessionRuntimeShellContainer,
  SessionRuntimeShellViewModel,
  SessionRuntimeSystemErrorSnapshot,
  SystemEventFeed,
  createProjectionStore,
  connectSessionEngineProjection
} from '../ui'
import { SessionShell } from '../ui/session'
import { useProjectionSelector } from '../ui/useProjectionSelector'
import styles from './RuntimeSessionShellPage.css'

interface IRouteParams {
  lobbyId: string
}

type ClientToHostWireEnvelope = Extract<WireEnvelope, { direction: 'client-to-host' }>
type HostToClientWireEnvelope = Extract<WireEnvelope, { direction: 'host-to-client' }>
type RuntimeRouteTransportPair = InMemoryPeerTransportPair<
  ClientToHostWireEnvelope,
  HostToClientWireEnvelope
>

interface RuntimeSessionShellRouteBoundaryDependencies {
  readonly createPlaybackEngine?: () => SessionRuntimePlaybackEngine
  readonly createRuntime?: (dependencies: SessionRuntimeDependencies) => RuntimeSession
  readonly createTransportPair?: (now: () => number) => RuntimeRouteTransportPair
  readonly hostUsername?: string
  readonly inviteSecret?: string
  readonly now?: () => number
}

interface RuntimeRouteRuntimeHandle extends Disposable {
  readonly runtime: RuntimeSession
  readonly playback: SessionRuntimePlaybackEngine
  readonly role: 'host' | 'guest'
}

interface RuntimeRoutePlatform {
  readonly ready: Promise<void>
  createLobby(options: { readonly p2p?: boolean; readonly websocket?: boolean }): Promise<void>
  joinLobby(roomId: string): Promise<void>
  leaveLobby(roomId: string): boolean
  getLocalId(): { toString(): string }
  getServer(): LegacyNetServerLike | undefined
}

interface RuntimeRoutePlatformModule {
  readonly PlatformService: {
    get(): RuntimeRoutePlatform
  }
}

interface RuntimeRouteRuntimeHandleInput {
  readonly createPlaybackEngine: () => SessionRuntimePlaybackEngine
  readonly createRuntime: (dependencies: SessionRuntimeDependencies) => RuntimeSession
  readonly createTransportPair?: (now: () => number) => RuntimeRouteTransportPair
  readonly now: () => number
  readonly roomId: string
}

interface LocalFilePlaybackRegistry {
  registerLocalFile(file: File): LocalFileMetadata
}

export interface RuntimeSessionShellRouteBoundary extends Disposable {
  readonly store: ProjectionStore<SessionRuntimeProjectionSnapshot>
  readonly settingsStore: ProjectionStore<MinimalSettings>
  readonly invite: PrivateInviteCredentials
  readonly mediaElementRef: React.RefObject<HTMLVideoElement>
  readonly playbackIntents: PlaybackRuntimeControlIntents
  readonly queueIntents: QueueIntentCallbacks
  readonly sessionIntents: SessionRuntimeIntentCallbacks
  addLocalFile(file: File): void
  addMediaUrl(url: string): void
  copyText(value: string): void
  updateSettings(nextSettings: MinimalSettings): void
  start(): Promise<void>
}

const HOST_USERNAME = 'Host'
const LOCAL_ONLY_WARNING: SessionRuntimeSystemErrorSnapshot = Object.freeze({
  id: 'runtime-shell-local-only',
  code: 'unsupported-runtime-network',
  message: 'Runtime session shell is using an injected local-only transport.'
})
const STARTUP_ERROR_ID = 'runtime-shell-startup'
const DEFAULT_SEEK_TOLERANCE_MS = 250
const DEFAULT_INVITE_BASE_URL = 'https://honeystream.local'
const QUEUE_REQUESTED_BY_LABEL = 'Session'
const SYSTEM_ERROR_EVENT_TIMESTAMP_OFFSET = 1
const BOUNDARY_SYSTEM_ERROR_CAP = 64
const INVITE_SECRET_BYTES = 16
const HAPPY_PATH_STEPS = [
  {
    id: 'paste',
    title: 'Paste a website',
    detail: 'YouTube, anime pages, movie pages, or anything both browsers can open.'
  },
  {
    id: 'invite',
    title: 'Invite your person',
    detail: 'One private link opens the rabbit-side seat and keeps the room tiny.'
  },
  {
    id: 'sync',
    title: 'Hit play together',
    detail: 'Host-led controls keep play, pause, seek, and speed changes obvious.'
  }
] as const
const SOURCE_LANES = [
  {
    id: 'website',
    title: 'Website lane',
    detail: 'Paste the page you already want to watch and let each browser load it locally.'
  },
  {
    id: 'local',
    title: 'Local file lane',
    detail: 'Pick a file when both sides have it; Honeystream shares only metadata and controls.'
  },
  {
    id: 'direct',
    title: 'Direct link lane',
    detail: 'Drop a clean MP4, WebM, audio, or stream URL straight into the queue.'
  }
] as const
const ADD_MEDIA_SUGGESTIONS = [
  {
    id: 'youtube',
    label: 'YouTube',
    detail: 'Video page',
    url: 'https://www.youtube.com/watch?v=honeystream-demo'
  },
  {
    id: 'animepahe',
    label: 'AnimePahe',
    detail: 'Anime watch page',
    url: 'https://animepahe.ru/play/example'
  },
  {
    id: 'cineby',
    label: 'Cineby',
    detail: 'Movie page',
    url: 'https://cineby.app/movie/example'
  },
  {
    id: 'miruro',
    label: 'Miruro',
    detail: 'Anime watch page',
    url: 'https://www.miruro.tv/watch/example'
  },
  {
    id: 'direct',
    label: 'Direct MP4',
    detail: 'Clean media URL',
    url: 'https://example.com/watch-night.mp4'
  }
] as const
const ROOM_READY_SIGNALS = [
  {
    id: 'source',
    label: 'Source picked',
    detail: 'Exact website page, direct media URL, or local file is queued.'
  },
  {
    id: 'invite',
    label: 'Invite sent',
    detail: 'Room code plus secret gets only the rabbit-side guest in.'
  },
  {
    id: 'playback',
    label: 'Controls obvious',
    detail: 'Host-led play, pause, seek, rate, and next stay in one place.'
  },
  {
    id: 'notes',
    label: 'Notes visible',
    detail: 'Errors and room events stay bounded, readable, and calm.'
  }
] as const
const COMMAND_BAR_LINKS = [
  { label: 'Paste source', href: '#runtime-add-media-url' },
  { label: 'Copy invite', href: '#runtime_invite_panel' },
  { label: 'Play together', href: '#runtime_playback_controls' }
] as const
const ROOM_MOOD_CHIPS = ['Cat-side cue', 'Rabbit-side hop', 'Website-ready queue'] as const
/*
Context: The runtime route chooses browser playback adapters for mixed streaming sites.
Invariant: Media bytes stay local; only typed playback commands cross the session transport.
Options considered: Popup all websites, embed all websites, or reuse provider-aware selection.
Decision: Reuse PlaybackRuntime selection and only prefer popups for providers likely to block embeds.
Performance impact: YouTube/direct media keep the lower-friction embed path while popup-heavy sites avoid failed embeds.
Memory/lifecycle ownership: PlaybackRuntime owns adapter creation and disposal for each media change.
Failure mode: Unsupported pages surface through existing adapter/runtime errors without hidden fallbacks.
Validation: Covered by adapterSelection, RuntimeSessionShellPage, streaming-site runtime, and e2e tests.
*/
const STREAMING_SITE_PROVIDER_ADAPTER_PREFERENCES = [
  { provider: 'animepahe' as const, adapterKind: 'popup' as const },
  { provider: 'cineby' as const, adapterKind: 'popup' as const },
  { provider: 'miruro' as const, adapterKind: 'popup' as const }
] as const

type LaunchStepState = 'complete' | 'next' | 'waiting'

interface LaunchStep {
  readonly detail: string
  readonly id: string
  readonly state: LaunchStepState
  readonly title: string
}

const COMPLETE_LAUNCH_STEP: LaunchStep = Object.freeze({
  id: 'complete',
  title: 'Room is ready',
  detail: 'The source, invite, guest, and playback controls are all set.',
  state: 'complete'
})

class HostLocalPlaybackEngine implements SessionRuntimePlaybackEngine {
  private disposed = false

  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackEngineApplyResult> {
    if (this.disposed) {
      throw new Error('HostLocalPlaybackEngine cannot apply playback state after dispose.')
    }

    return {
      adapterCreated: false,
      mediaChanged: false,
      adapterDisposed: false,
      seekToleranceMs: desiredState.seekToleranceMs || DEFAULT_SEEK_TOLERANCE_MS,
      appliedPlayback: desiredState.playback
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
  }
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return `Unexpected runtime session startup failure: ${String(error)}`
}

const toHexByte = (value: number): string => value.toString(16).padStart(2, '0')

const createSecureInviteSecret = (): string => {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random invite secret generation is unavailable.')
  }

  const bytes = new Uint8Array(INVITE_SECRET_BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(toHexByte)
    .join('')
}

const createWireEnvelopeValidator = <TDirection extends WireEnvelope['direction']>(
  direction: TDirection
): TransportMessageValidator<Extract<WireEnvelope, { direction: TDirection }>> => ({
  validate: (value: unknown): value is Extract<WireEnvelope, { direction: TDirection }> => {
    const parsed = parseWireEnvelope(value)
    return parsed.ok && parsed.value.direction === direction
  },
  describeInvalidMessage: () => `Expected ${direction} wire envelope payload.`
})

const createRuntimeRouteTransportPair = (now: () => number): RuntimeRouteTransportPair =>
  createInMemoryPeerTransportPair<ClientToHostWireEnvelope, HostToClientWireEnvelope>({
    hostPeerId: 'runtime-route-host',
    guestPeerId: 'runtime-route-guest',
    hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
    guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
    now
  })

const getRuntimeRoutePlatform = (): RuntimeRoutePlatform => {
  const platformModule = require('../platform') as RuntimeRoutePlatformModule
  return platformModule.PlatformService.get()
}

const createRuntimeFromTransport = (
  input: RuntimeRouteRuntimeHandleInput,
  transport: SessionRuntimeDependencies['transport']
): {
  readonly runtime: RuntimeSession
  readonly playback: SessionRuntimePlaybackEngine
} => {
  const playback = input.createPlaybackEngine()
  const runtime = input.createRuntime({
    now: input.now,
    transport,
    playback
  })

  return { runtime, playback }
}

const createMediaElementAdapter = (
  context: PlaybackRuntimeAdapterContext,
  getMediaElement: () => HTMLMediaElement | null
): MediaElementPlaybackAdapter =>
  new MediaElementPlaybackAdapter({
    getMediaElement,
    localFiles: context.localFiles
  })

const createBrowserPlaybackRuntime = (
  getMediaElement: () => HTMLMediaElement | null
): SessionRuntimePlaybackEngine => {
  const popupFactory = createPopupAdapterFactory()

  return createPlaybackRuntime({
    adapters: {
      createLocalFileAdapter: context => createMediaElementAdapter(context, getMediaElement),
      createEmbedExtensionAdapter: context => createMediaElementAdapter(context, getMediaElement),
      createPopupAdapter: context => popupFactory.createAdapter(context.media)
    },
    selection: {
      providerAdapterPreferences: STREAMING_SITE_PROVIDER_ADAPTER_PREFERENCES
    }
  })
}

const createLocalRuntimeHandle = (
  input: RuntimeRouteRuntimeHandleInput,
  createTransportPair: (now: () => number) => RuntimeRouteTransportPair
): RuntimeRouteRuntimeHandle => {
  const transportPair = createTransportPair(input.now)
  const { runtime, playback } = createRuntimeFromTransport(input, transportPair.host)
  let disposed = false

  return {
    runtime,
    playback,
    role: 'host',
    dispose(): void {
      if (disposed) return
      disposed = true
      runtime.dispose()
      transportPair.guest.dispose()
    }
  }
}

const createLiveRuntimeHandle = async (
  input: RuntimeRouteRuntimeHandleInput
): Promise<RuntimeRouteRuntimeHandle> => {
  const platform = getRuntimeRoutePlatform()
  await platform.ready
  const localPeerId = platform.getLocalId().toString()
  const role = input.roomId === localPeerId ? 'host' : 'guest'

  try {
    if (role === 'host') {
      await platform.createLobby({ p2p: true, websocket: true })
    } else {
      await platform.joinLobby(input.roomId)
    }

    const server = platform.getServer()
    if (!server) {
      throw new Error('Live runtime transport could not find an active lobby server.')
    }

    const transport = new LegacyNetWireTransport({
      server,
      localPeerId,
      now: input.now
    })
    const { runtime, playback } = createRuntimeFromTransport(input, transport)
    let disposed = false

    return {
      runtime,
      playback,
      role,
      dispose(): void {
        if (disposed) return
        disposed = true
        runtime.dispose()
        platform.leaveLobby(input.roomId)
      }
    }
  } catch (error) {
    platform.leaveLobby(input.roomId)
    throw error
  }
}

const createRuntimeHandle = (
  input: RuntimeRouteRuntimeHandleInput
): Promise<RuntimeRouteRuntimeHandle> =>
  input.createTransportPair
    ? Promise.resolve(createLocalRuntimeHandle(input, input.createTransportPair))
    : createLiveRuntimeHandle(input)

const createFallbackRuntimeProjection = (now: () => number): SessionRuntimeProjection => ({
  role: 'uninitialized',
  lifecycle: 'idle',
  transportState: { status: 'idle', changedAtMs: now() },
  diagnostics: [],
  runtimeErrors: []
})

const mapLifecycleToSessionStatus = (
  lifecycle: SessionRuntimeProjection['lifecycle']
): SessionSnapshot['status'] => {
  switch (lifecycle) {
    case 'running':
      return 'hosting'
    case 'disposed':
      return 'ended'
    case 'starting':
      return 'joining'
    case 'idle':
    default:
      return 'idle'
  }
}

const createFallbackSessionSnapshot = (roomId: string, hostUsername: string): SessionSnapshot => ({
  roomId,
  status: 'idle',
  participants: {
    host: {
      peerId: 'runtime-route-host',
      username: hostUsername,
      role: 'host'
    }
  },
  queue: [],
  playback: {
    state: 'idle',
    positionMs: 0,
    updatedAtHostMs: 0,
    rate: 1
  },
  eventCursor: 0
})

const mapProtocolErrorToSystemError = (
  error: ProtocolError,
  index: number
): SessionRuntimeSystemErrorSnapshot => ({
  id: `runtime-shell-protocol-${index}`,
  code: 'protocol-rejected',
  message: error.message
})

const mapRuntimeErrorToSystemError = (
  error: string,
  index: number
): SessionRuntimeSystemErrorSnapshot => ({
  id: `runtime-shell-runtime-${index}`,
  code: 'unknown',
  message: error
})

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

const dispatchRuntimeCommand = (
  runtime: RuntimeSession,
  command: HostSessionCommand
): Promise<void> => {
  const projection = runtime.getSnapshot()
  return projection.role === 'host'
    ? runtime.dispatchHostCommand(command)
    : runtime.dispatchGuestCommand(hostCommandToClientCommand(command))
}

const runBoundaryCommand = (
  command: () => Promise<void>,
  recordError: (message: string) => void
): void => {
  void command().catch(error => {
    recordError(toErrorMessage(error))
  })
}

const mapProjectionToShellSnapshot = (
  projection: SessionRuntimeProjection,
  fallbackSession: SessionSnapshot,
  includeLocalWarning: boolean,
  boundaryErrors: readonly SessionRuntimeSystemErrorSnapshot[] = []
): SessionRuntimeProjectionSnapshot => {
  const session = projection.session || {
    ...fallbackSession,
    status: mapLifecycleToSessionStatus(projection.lifecycle)
  }

  return {
    role: projection.role,
    session,
    systemErrors: [
      ...(includeLocalWarning ? [LOCAL_ONLY_WARNING] : []),
      ...projection.diagnostics.map(mapProtocolErrorToSystemError),
      ...projection.runtimeErrors.map(mapRuntimeErrorToSystemError),
      ...boundaryErrors
    ]
  }
}

const mapMediaSnapshotToQueueItem = (media: MediaSnapshot): QueueMediaItemViewModel => ({
  id: media.mediaId,
  title: media.title,
  requestedBy: QUEUE_REQUESTED_BY_LABEL,
  durationMs: media.durationMs
})

const mapSessionSnapshotToQueueItems = (
  snapshot: SessionSnapshot
): {
  readonly currentItem?: QueueMediaItemViewModel
  readonly queuedItems: readonly QueueMediaItemViewModel[]
} => ({
  currentItem: snapshot.current ? mapMediaSnapshotToQueueItem(snapshot.current) : undefined,
  queuedItems: snapshot.queue.map(mapMediaSnapshotToQueueItem)
})

const mapSessionSnapshotToPlaybackModel = (
  snapshot: SessionSnapshot
): PlaybackRuntimeSessionModel => ({
  status: snapshot.status,
  hasCurrentMedia: Boolean(snapshot.current || snapshot.currentMediaId),
  hasNextMedia: snapshot.queue.length > 0,
  canIssuePlaybackIntents: snapshot.status !== 'idle' && snapshot.status !== 'ended'
})

const mapSystemErrorsToEvents = (
  errors: readonly SessionRuntimeSystemErrorSnapshot[]
): readonly SystemEvent[] =>
  createSystemEventLog(
    errors.map((error, index) =>
      createErrorSystemEvent(error.message, index + SYSTEM_ERROR_EVENT_TIMESTAMP_OFFSET, error.code)
    )
  )

const getInviteBaseUrl = (): string =>
  typeof window === 'undefined' ? DEFAULT_INVITE_BASE_URL : window.location.origin

const getClipboardWriter = (): Clipboard | undefined => {
  if (typeof navigator === 'undefined') {
    return undefined
  }

  return navigator.clipboard
}

const readInviteSecret = (search: string | undefined): string | undefined => {
  if (typeof search !== 'string' || search.length === 0) {
    return undefined
  }

  const secret = new URLSearchParams(search).get('secret')
  const trimmedSecret = secret ? secret.trim() : ''
  return trimmedSecret.length > 0 ? trimmedSecret : undefined
}

const getMediaTitleFromUrl = (mediaUrl: URL): string => {
  const pathName = mediaUrl.pathname.replace(/\/+$/, '')
  const lastSegment = pathName
    .split('/')
    .filter(Boolean)
    .pop()
  return lastSegment || mediaUrl.hostname || mediaUrl.toString()
}

const getMediaKindFromUrl = (mediaUrl: URL): MediaSnapshot['kind'] =>
  classifyMediaUrl(mediaUrl.toString())

const getStageKindLabel = (media: MediaSnapshot | undefined): string => {
  if (!media) return 'Ready for websites'

  switch (media.kind) {
    case 'localFile':
      return 'Local file loaded'
    case 'url':
      return 'Direct media loaded'
    case 'website':
      return 'Website loaded'
  }
}

const getPlaybackStateLabel = (state: SessionSnapshot['playback']['state']): string => {
  switch (state) {
    case 'playing':
      return 'Playing together'
    case 'paused':
      return 'Paused together'
    case 'idle':
    default:
      return 'Waiting for play'
  }
}

const formatQueuedCountLabel = (count: number): string =>
  count === 1 ? '1 pick queued' : `${count} picks queued`

const createLaunchSteps = (
  currentMedia: MediaSnapshot | undefined,
  guestUsername: string | undefined,
  playbackState: SessionSnapshot['playback']['state']
): readonly LaunchStep[] => {
  const hasSource = Boolean(currentMedia)
  const hasGuest = Boolean(guestUsername)
  const isPlaying = playbackState === 'playing'

  return [
    {
      id: 'source',
      title: hasSource ? 'Source is ready' : 'Pick the first source',
      detail: currentMedia
        ? `${currentMedia.title} is on the shared stage.`
        : 'Paste the exact watch page, a direct media link, or choose a local file.',
      state: hasSource ? 'complete' : 'next'
    },
    {
      id: 'invite',
      title: hasGuest ? 'Invite worked' : 'Send one private invite',
      detail: hasGuest
        ? `${guestUsername} landed in the rabbit-side seat.`
        : 'Copy the invite link so the room stays tiny and private.',
      state: hasGuest ? 'complete' : hasSource ? 'next' : 'waiting'
    },
    {
      id: 'buddy',
      title: hasGuest ? 'Buddy is synced' : 'Wait for rabbit-side',
      detail: hasGuest
        ? 'Both seats are present, so playback commands can stay obvious.'
        : 'The guest sees the same queue once they hop in with the secret.',
      state: hasGuest ? 'complete' : 'waiting'
    },
    {
      id: 'play',
      title: isPlaying ? 'Watching together' : 'Press play when ready',
      detail: isPlaying
        ? 'Cat-side controls are keeping the room in lockstep.'
        : 'Start once the source and guest are ready; seek and speed stay host-led.',
      state: isPlaying ? 'complete' : hasSource && hasGuest ? 'next' : 'waiting'
    }
  ]
}

const getNextLaunchStep = (steps: readonly LaunchStep[]): LaunchStep =>
  steps.find(step => step.state === 'next') ||
  steps.find(step => step.state === 'waiting') ||
  steps[steps.length - 1] ||
  COMPLETE_LAUNCH_STEP

const hasLocalFileRegistry = (
  playback: SessionRuntimePlaybackEngine
): playback is SessionRuntimePlaybackEngine & LocalFilePlaybackRegistry =>
  typeof (playback as { readonly registerLocalFile?: unknown }).registerLocalFile === 'function'

const RuntimeSessionRouteSurface = ({
  boundary,
  lobbyId
}: {
  readonly boundary: RuntimeSessionShellRouteBoundary
  readonly lobbyId: string
}) => {
  const settings = useProjectionSelector({
    store: boundary.settingsStore,
    selector: snapshot => snapshot
  })

  const renderRuntimeSurface = (viewModel: SessionRuntimeShellViewModel): React.ReactNode => {
    const queueItems = mapSessionSnapshotToQueueItems(viewModel.snapshot.session)
    const currentMedia = viewModel.snapshot.session.current
    const guest = viewModel.snapshot.session.participants.guest
    const guestSeatLabel = guest ? guest.username : 'Waiting for rabbit-side'
    const queuedCountLabel = formatQueuedCountLabel(viewModel.snapshot.session.queue.length)
    const stageKindLabel = getStageKindLabel(currentMedia)
    const playbackStateLabel = getPlaybackStateLabel(viewModel.snapshot.session.playback.state)
    const launchSteps = createLaunchSteps(
      currentMedia,
      guest ? guest.username : undefined,
      viewModel.snapshot.session.playback.state
    )
    const readyStepCount = launchSteps.filter(step => step.state === 'complete').length
    const nextLaunchStep = getNextLaunchStep(launchSteps)
    const roleLabel =
      viewModel.snapshot.role === 'host'
        ? 'Cat-side host'
        : viewModel.snapshot.role === 'guest'
        ? 'Rabbit-side guest'
        : 'Room warming up'

    return (
      <div className={styles.roomGrid}>
        <section
          id="runtime_cozy_command_bar"
          className={`${styles.card} ${styles.commandBar}`}
          aria-label="Cozy command bar"
        >
          <div className={styles.commandBarRole}>
            <span>{roleLabel}</span>
            <strong>{currentMedia ? currentMedia.title : 'Pick a first stream'}</strong>
            <p>
              {guest
                ? `${guest.username} is in the rabbit-side seat.`
                : 'Copy the invite when the source is ready.'}
            </p>
          </div>
          <div className={styles.commandBarNext}>
            <span>Best next tap</span>
            <strong>{nextLaunchStep.title}</strong>
            <p>{nextLaunchStep.detail}</p>
          </div>
          <div className={styles.commandBarChips} aria-label="Fast room shortcuts">
            {COMMAND_BAR_LINKS.map(link => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </section>

        <section
          id="runtime_room_runway"
          className={`${styles.card} ${styles.roomRunway}`}
          aria-label="Tonight dashboard"
        >
          <div className={styles.cardHeader}>
            <p className={styles.kicker}>Tonight dashboard</p>
            <span>{stageKindLabel}</span>
          </div>
          <div className={styles.runwayGrid}>
            <article data-runway-card="source">
              <span>Now source</span>
              <strong>{currentMedia ? currentMedia.title : 'Choose a first stream'}</strong>
              <p>
                {currentMedia
                  ? 'Ready on the shared stage.'
                  : 'Paste a website, direct link, or local file to start the room.'}
              </p>
            </article>
            <article data-runway-card="guest">
              <span>Guest seat</span>
              <strong>{guestSeatLabel}</strong>
              <p>Cat-side hosts, rabbit-side lands from the private invite.</p>
            </article>
            <article data-runway-card="queue">
              <span>Queue</span>
              <strong>{queuedCountLabel}</strong>
              <p>Keep the next pick visible without making the room busy.</p>
            </article>
            <article data-runway-card="sync">
              <span>Sync</span>
              <strong>{playbackStateLabel}</strong>
              <p>Play, pause, seek, speed, and next all stay host-led.</p>
            </article>
          </div>
        </section>

        <section
          id="runtime_launchpad"
          className={`${styles.card} ${styles.launchpad}`}
          aria-label="Tonight launchpad"
        >
          <div className={styles.cardHeader}>
            <p className={styles.kicker}>Tonight launchpad</p>
            <span>{`${readyStepCount}/${launchSteps.length} ready`}</span>
          </div>
          <div className={styles.launchSteps}>
            {launchSteps.map((step, index) => (
              <article key={step.id} data-launch-step={step.id} data-launch-state={step.state}>
                <span>{`0${index + 1}`}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="runtime_concierge_strip"
          className={`${styles.card} ${styles.conciergeStrip}`}
          aria-label="Next best move"
        >
          <strong>Next best move</strong>
          <span data-next-launch-state={nextLaunchStep.state}>{nextLaunchStep.title}</span>
          <p>{nextLaunchStep.detail}</p>
        </section>

        <section
          id="runtime_watch_deck"
          className={`${styles.card} ${styles.watchDeck}`}
          aria-label="Cozy watch-room happy path"
        >
          {SOURCE_LANES.map(lane => (
            <article key={lane.id}>
              <span>{lane.title}</span>
              <p>{lane.detail}</p>
            </article>
          ))}
        </section>

        <article className={`${styles.card} ${styles.statusCard}`}>
          <div className={styles.cardHeader}>
            <p className={styles.kicker}>Room status</p>
            <span>{roleLabel}</span>
          </div>
          <SessionShell
            className={styles.sessionShell}
            errorTitle="Session issues"
            hostLabel="Cat-side"
            guestLabel="Rabbit-side"
            waitingForGuestLabel="Waiting for rabbit-side guest"
            stateLabels={{
              idle: 'Warming up',
              hosting: 'Hosting room',
              joining: 'Joining room',
              connected: 'Synced',
              ended: 'Ended'
            }}
            {...viewModel.sessionShellProps}
          />
          <div className={styles.petConnector} aria-hidden="true">
            <span className={`${styles.petOrb} ${styles.catOrb}`}>
              <span className={styles.petFace}>
                <i />
                <i />
                <b />
              </span>
            </span>
            <span className={styles.syncBeam} />
            <span className={`${styles.petOrb} ${styles.rabbitOrb}`}>
              <span className={styles.petFace}>
                <i />
                <i />
                <b />
              </span>
            </span>
          </div>
        </article>

        <InviteLinkPanel
          baseUrl={getInviteBaseUrl()}
          className={`${styles.card} ${styles.invitePanel}`}
          copyLabel="Copy"
          invite={boundary.invite}
          inviteLinkLabel="Invite link"
          onCopyInviteLink={boundary.copyText}
          onCopyRoomId={boundary.copyText}
          onCopySecret={boundary.copyText}
          roomIdLabel="Room code"
          secretLabel="Room secret"
          id="runtime_invite_panel"
          title="Invite your watch buddy"
        />

        <section className={`${styles.card} ${styles.stageCard}`}>
          <div className={styles.cardHeader}>
            <p className={styles.kicker}>Playback stage</p>
            <span>Website + file preview</span>
          </div>
          <div
            className={styles.videoStageFrame}
            data-stage-state={currentMedia ? 'ready' : 'empty'}
          >
            <video className={styles.videoStage} controls ref={boundary.mediaElementRef} />
            {!currentMedia ? (
              <div className={styles.stageEmptyState} aria-hidden="true">
                <span>Drop the first pick</span>
                <strong>Websites, direct links, or a local file all land here.</strong>
              </div>
            ) : null}
          </div>
          <div className={styles.stageNowBar} aria-label="Current playback source">
            <span>{getStageKindLabel(currentMedia)}</span>
            <strong>{currentMedia ? currentMedia.title : 'Pick a cozy first stream'}</strong>
          </div>
          <div className={styles.stageComfortRail} aria-label="Stage promises">
            <span>Host-led playback</span>
            <span>Guest follows clearly</span>
            <span>Zero video-byte sharing</span>
            <span>Low-latency control lane</span>
          </div>
          <p>
            Queue YouTube, AnimePahe, Cineby, Miruro, direct media, or a local file from the panel
            beside the stage. The room stays small while each browser loads the thing it can
            actually play.
          </p>
        </section>

        <RuntimeAddMediaPanel
          className={`${styles.card} ${styles.addMediaPanel}`}
          addFileLabel="Queue local file"
          addUrlLabel="Queue cozy link"
          description="Paste a supported website like YouTube, AnimePahe, Cineby, or Miruro; use a direct media URL; or choose a local file when both sides have it."
          invalidUrlLabel="Use a full http:// or https:// watch link."
          missingUrlLabel="Paste a website, direct media link, or pick one of the quick source chips."
          onAddUrl={boundary.addMediaUrl}
          onAddLocalFile={viewModel.snapshot.role === 'host' ? boundary.addLocalFile : undefined}
          placeholder="Paste YouTube, AnimePahe, Cineby, Miruro, or direct media..."
          sourceSuggestions={ADD_MEDIA_SUGGESTIONS}
          title="Pick the next cozy stream"
        />

        <QueueShell
          className={`${styles.card} ${styles.queuePanel}`}
          currentItemClassName={styles.queueCurrent}
          currentItemEmptyLabel="Nothing playing yet. Pick a cozy first stream."
          currentItemLabel="Now watching"
          nextButtonClassName={styles.queueNextButton}
          nextButtonLabel="Play next"
          queuedItemsClassName={styles.queuedItems}
          queuedItemsEmptyLabel="Queue is open. Drop in a link for the watch buddy."
          queuedItemsLabel="Up next"
          removeLabel="Remove"
          requestedByLabel="Added by"
          {...queueItems}
          {...boundary.queueIntents}
        />

        <PlaybackRuntimeControls
          id="runtime_playback_controls"
          className={`${styles.card} ${styles.playbackPanel}`}
          playback={viewModel.snapshot.session.playback}
          session={mapSessionSnapshotToPlaybackModel(viewModel.snapshot.session)}
          intents={boundary.playbackIntents}
          labels={{
            play: "Let's go",
            pause: 'Pause here',
            seekBackward: 'Back 10s',
            seekForward: 'Forward 10s',
            rateDown: 'Slower',
            rateUp: 'Faster',
            next: 'Next pick'
          }}
        />

        <SystemEventFeed
          className={`${styles.card} ${styles.eventPanel}`}
          emptyLabel="All quiet. The room is cozy."
          events={mapSystemErrorsToEvents(viewModel.snapshot.systemErrors)}
          title="Room notes"
        />
      </div>
    )
  }

  return (
    <LayoutMain className={styles.container} showBackButton={false}>
      <section className={styles.shell} data-runtime-session-shell="true">
        <header className={styles.heroCard}>
          <div>
            <p className={styles.kicker}>Cat + rabbit watch room</p>
            <h1>Cozy watch room</h1>
            <p>
              A soft two-person booth for YouTube, AnimePahe, Cineby, Miruro, direct media, and
              local files. Paste the source, send the invite, then let the low-latency control lane
              keep both sides together without sharing video bytes.
            </p>
            <div
              id="runtime_happy_path"
              className={styles.happyPath}
              aria-label="Cozy room happy path"
            >
              {HAPPY_PATH_STEPS.map(step => (
                <span key={step.id}>
                  <strong>{step.title}</strong>
                  {step.detail}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.roomSummary} aria-label="Room summary">
            <span>
              <strong>Room code</strong>
              <code>{lobbyId}</code>
            </span>
            <span>
              <strong>Seats</strong>
              Cat + rabbit only
            </span>
            <span>
              <strong>Sync</strong>
              Host-led controls
            </span>
          </div>
          <div id="runtime_room_mood" className={styles.roomMoodStrip} aria-label="Room mood">
            {ROOM_MOOD_CHIPS.map(chip => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        </header>

        <section
          id="runtime_room_signals"
          className={`${styles.card} ${styles.signalDock}`}
          aria-label="Room readiness signals"
        >
          <strong>Room feels ready when</strong>
          {ROOM_READY_SIGNALS.map(signal => (
            <article key={signal.id}>
              <span>{signal.label}</span>
              <p>{signal.detail}</p>
            </article>
          ))}
        </section>

        <SessionRuntimeShellContainer
          store={boundary.store}
          intents={boundary.sessionIntents}
          render={renderRuntimeSurface}
        />

        <SettingsRuntimePanel
          className={`${styles.card} ${styles.settingsPanel}`}
          settings={settings}
          onSettingsChange={boundary.updateSettings}
        />
      </section>
    </LayoutMain>
  )
}

export const createRuntimeSessionShellRouteBoundary = (
  lobbyId: string,
  dependencies: RuntimeSessionShellRouteBoundaryDependencies = {}
): RuntimeSessionShellRouteBoundary => {
  const roomId = lobbyId.trim()
  const now = dependencies.now || Date.now
  const hostUsername = dependencies.hostUsername || HOST_USERNAME
  const runtimeFactory = dependencies.createRuntime || createSessionRuntime
  const mediaElementRef = React.createRef<HTMLVideoElement>()
  const playbackEngineFactory =
    dependencies.createPlaybackEngine ||
    (() => createBrowserPlaybackRuntime(() => mediaElementRef.current))
  const includeLocalWarning = Boolean(dependencies.createTransportPair)
  const inviteSecretProvided = typeof dependencies.inviteSecret === 'string'
  const inviteSecret =
    dependencies.inviteSecret ||
    (includeLocalWarning ? `runtime-route-local:${roomId}` : createSecureInviteSecret())

  const fallbackSession = createFallbackSessionSnapshot(roomId, hostUsername)
  const invite: PrivateInviteCredentials = {
    roomId,
    secret: inviteSecret
  }
  const settingsStore = createProjectionStore(createDefaultMinimalSettings())
  let boundaryErrors: readonly SessionRuntimeSystemErrorSnapshot[] = []
  let runtimeHandle: RuntimeRouteRuntimeHandle | undefined
  let projectionConnection: Disposable | undefined
  let startEpoch = 0
  let mediaCounter = 0
  const store = createProjectionStore(
    mapProjectionToShellSnapshot(
      createFallbackRuntimeProjection(now),
      fallbackSession,
      includeLocalWarning
    )
  )

  let started = false
  let disposed = false

  const recordBoundaryError = (message: string): void => {
    boundaryErrors = [
      ...boundaryErrors,
      {
        id: `${STARTUP_ERROR_ID}-${boundaryErrors.length + 1}`,
        code: 'unknown',
        message
      }
    ].slice(-BOUNDARY_SYSTEM_ERROR_CAP)
    const projection = runtimeHandle
      ? runtimeHandle.runtime.getSnapshot()
      : createFallbackRuntimeProjection(now)
    store.setSnapshot(
      mapProjectionToShellSnapshot(projection, fallbackSession, includeLocalWarning, boundaryErrors)
    )
  }

  const requireRuntime = (): RuntimeSession => {
    if (!runtimeHandle) {
      throw new Error('Runtime session shell boundary has not started.')
    }

    return runtimeHandle.runtime
  }

  const requireRuntimeHandle = (): RuntimeRouteRuntimeHandle => {
    if (!runtimeHandle) {
      throw new Error('Runtime session shell boundary has not started.')
    }

    return runtimeHandle
  }

  const attachRuntimeProjection = (runtime: RuntimeSession): void => {
    projectionConnection = connectSessionEngineProjection(store, {
      subscribeToSnapshots(listener) {
        return runtime.subscribeToSnapshots(projection => {
          listener(
            mapProjectionToShellSnapshot(
              projection,
              fallbackSession,
              includeLocalWarning,
              boundaryErrors
            )
          )
        })
      }
    })
    store.setSnapshot(
      mapProjectionToShellSnapshot(
        runtime.getSnapshot(),
        fallbackSession,
        includeLocalWarning,
        boundaryErrors
      )
    )
  }

  const disposeStartedRuntime = (): void => {
    if (projectionConnection) {
      projectionConnection.dispose()
      projectionConnection = undefined
    }
    if (runtimeHandle) {
      runtimeHandle.dispose()
      runtimeHandle = undefined
    }
  }

  const dispatchCommand = (command: HostSessionCommand): void => {
    runBoundaryCommand(() => dispatchRuntimeCommand(requireRuntime(), command), recordBoundaryError)
  }

  const createMediaId = (): string => {
    mediaCounter += 1
    return `runtime-media-${now()}-${mediaCounter}`
  }

  const dispatchMedia = (media: MediaSnapshot): void => {
    dispatchCommand({ type: 'addMedia', media })
  }

  const copyText = (value: string): void => {
    const clipboard = getClipboardWriter()

    if (!clipboard) {
      recordBoundaryError('Clipboard copy is unavailable in this browser.')
      return
    }

    void clipboard.writeText(value).catch(error => {
      recordBoundaryError(toErrorMessage(error))
    })
  }

  const addMediaUrl = (url: string): void => {
    const trimmedUrl = url.trim()
    let mediaUrl: URL
    try {
      mediaUrl = new URL(trimmedUrl)
    } catch {
      recordBoundaryError(`Media URL "${trimmedUrl}" is not a valid absolute URL.`)
      return
    }

    dispatchMedia({
      mediaId: createMediaId(),
      kind: getMediaKindFromUrl(mediaUrl),
      source: mediaUrl.toString(),
      title: getMediaTitleFromUrl(mediaUrl)
    })
  }

  const addLocalFile = (file: File): void => {
    try {
      const playback = requireRuntimeHandle().playback
      if (!hasLocalFileRegistry(playback)) {
        recordBoundaryError('Local file playback is unavailable for this runtime.')
        return
      }

      const metadata = playback.registerLocalFile(file)
      dispatchMedia({
        mediaId: createMediaId(),
        kind: 'localFile',
        source: localFileToMediaUrl(metadata),
        title: metadata.name
      })
    } catch (error) {
      recordBoundaryError(toErrorMessage(error))
    }
  }

  const sessionIntents: SessionRuntimeIntentCallbacks = {
    onHostIntent(intent) {
      runBoundaryCommand(
        () =>
          requireRuntime().startHostSession({
            roomId: intent.roomId,
            hostUsername: intent.username,
            inviteSecret: invite.secret
          }),
        recordBoundaryError
      )
    },
    onJoinIntent(intent) {
      runBoundaryCommand(() => requireRuntime().dispatchGuestCommand(intent), recordBoundaryError)
    },
    onLeaveIntent(intent) {
      runBoundaryCommand(() => requireRuntime().dispatchGuestCommand(intent), recordBoundaryError)
    },
    onPlaybackIntent(intent) {
      dispatchCommand(intent)
    }
  }

  const playbackIntents: PlaybackRuntimeControlIntents = {
    onPlayPause(playing) {
      dispatchCommand({ type: 'playPause', playing })
    },
    onSeek(positionMs) {
      dispatchCommand({ type: 'seek', positionMs })
    },
    onSetRate(rate) {
      dispatchCommand({ type: 'setRate', rate })
    },
    onNext() {
      dispatchCommand({ type: 'next' })
    }
  }

  const queueIntents: QueueIntentCallbacks = {
    onNext() {
      dispatchCommand({ type: 'next' })
    },
    onRemove(mediaId) {
      dispatchCommand({ type: 'removeMedia', mediaId })
    }
  }

  return {
    store,
    settingsStore,
    invite,
    mediaElementRef,
    playbackIntents,
    queueIntents,
    sessionIntents,
    addLocalFile,
    addMediaUrl,
    copyText,
    updateSettings(nextSettings: MinimalSettings): void {
      settingsStore.setSnapshot(nextSettings)
    },
    async start(): Promise<void> {
      if (disposed) {
        throw new Error('Runtime session shell boundary cannot be started after disposal.')
      }

      if (started) {
        return
      }

      started = true
      const currentStartEpoch = startEpoch + 1
      startEpoch = currentStartEpoch
      let pendingRuntimeHandle: RuntimeRouteRuntimeHandle | undefined
      try {
        pendingRuntimeHandle = await createRuntimeHandle({
          createPlaybackEngine: playbackEngineFactory,
          createRuntime: runtimeFactory,
          createTransportPair: dependencies.createTransportPair,
          now,
          roomId
        })
        if (disposed || startEpoch !== currentStartEpoch) {
          pendingRuntimeHandle.dispose()
          return
        }

        runtimeHandle = pendingRuntimeHandle
        pendingRuntimeHandle = undefined
        attachRuntimeProjection(runtimeHandle.runtime)

        if (runtimeHandle.role === 'host') {
          await runtimeHandle.runtime.startHostSession({
            roomId,
            hostUsername,
            inviteSecret: invite.secret
          })
        } else {
          if (!inviteSecretProvided) {
            throw new Error('Invite secret is required to join a runtime session.')
          }

          await runtimeHandle.runtime.startGuestSession({
            roomId,
            username: settingsStore.getSnapshot().username,
            inviteSecret: invite.secret
          })
        }
        if (disposed || startEpoch !== currentStartEpoch) {
          disposeStartedRuntime()
        }
      } catch (error) {
        if (pendingRuntimeHandle) {
          pendingRuntimeHandle.dispose()
        }
        disposeStartedRuntime()
        started = false
        if (!disposed) {
          recordBoundaryError(toErrorMessage(error))
        }
      }
    },
    dispose(): void {
      if (disposed) {
        return
      }
      disposed = true
      startEpoch += 1
      disposeStartedRuntime()
    }
  }
}

export const RuntimeSessionShellPage = ({ location, match }: RouteComponentProps<IRouteParams>) => {
  const lobbyId = match.params.lobbyId
  const inviteSecret = useMemo(() => readInviteSecret(location.search), [location.search])
  const boundary = useMemo(
    () => createRuntimeSessionShellRouteBoundary(lobbyId, { inviteSecret }),
    [inviteSecret, lobbyId]
  )

  useEffect(() => {
    void boundary.start()

    return () => {
      boundary.dispose()
    }
  }, [boundary])

  return <RuntimeSessionRouteSurface boundary={boundary} lobbyId={lobbyId} />
}
