# Architecture migration plan

## Executive goal

Reduce Honeystream into a deliberately small, private, 1:1 synchronized watch-session
system. The rewrite must optimize for correctness, low memory pressure, explicit state
ownership, predictable cleanup, and protocol clarity over framework convenience.

The target product is:

- Private invite-link sessions only.
- Two participants maximum: host and guest.
- Username-only identity.
- Shared queue and synchronized playback for local files, direct media URLs, and supported websites.
- System events only for joins, leaves, and errors.
- Minimal settings that directly change playback or session behavior.
- No Redux-shaped domain model, no Redux-shaped network protocol, and no unbounded state.

## Non-goals

- Public rooms, room discovery, chat, avatars, colors, roles, DJ/admin flows, and arbitrary max users.
- Server-authoritative media playback. The host browser remains authoritative for the 1:1 session.
- Moving browser/media orchestration into WASM. The hard boundary is DOM/extension/media APIs, not CPU.
- Deep framework adoption for its own sake. TanStack/Redux/etc. are not core requirements.

## Core behaviors to preserve

| Area | Reduced behavior |
| --- | --- |
| Session | Host creates private room, guest joins by invite link, either side can leave, errors are explicit |
| Identity | User enters a username; generated peer identity stays internal |
| Authorization | Invite secret authorizes the one guest; host validates all guest commands |
| Queue | Add URL/local file, play first item, queue later items, remove item, next item |
| Playback | Play, pause, seek, rate, duration update, end detection, host-clock based sync |
| Local files | Each peer chooses their own file copy; only metadata and playback state are shared |
| Websites | Each peer loads the same URL locally through the playback adapter |
| Events | Bounded join/leave/error event feed; no general chat log |
| Settings | Username, volume/mute, safe-browse behavior, preferred playback adapter options |

## Runtime architecture

```text
React UI
  -> typed user intents
ExternalStoreProjection
  -> selected read-only snapshots
SessionRuntime
  -> owns impure orchestration and disposal
SessionEngine
  -> pure command validation and state transitions
Protocol
  -> versioned runtime-validated wire messages
PeerTransport
  -> WebRTC DataChannel after signaling
PlaybackEngine
  -> adapter lifecycle and playback application
PlaybackAdapter
  -> local-file, iframe/extension, or popup side effects
```

The host owns truth. The guest never mutates shared state directly. Guest actions become
`ClientCommand` messages. The host validates them, applies a pure transition, then emits
`HostEvent` messages and occasional `SessionSnapshot` messages.

## State ownership model

| State | Owner | Lifetime | Notes |
| --- | --- | --- | --- |
| `SessionState` | `SessionEngine` | Room lifetime | Plain data, minimal, serializable |
| UI projection | `ExternalStoreProjection` | Component tree lifetime | Derived from engine snapshots; no protocol ownership |
| Peer connection | `PeerTransport` | Connection lifetime | Ordered messages only; no domain decisions |
| Signaling socket | `SignalingClient` | Setup/reconnect lifetime | Closed after 1:1 WebRTC path is established when possible |
| Playback target | `PlaybackEngine` | Current media item lifetime | Owns adapter selection and cleanup |
| Object URLs | `LocalFileAdapter` | Selected local file lifetime | Never stored in shared state; always revoked |
| Iframes/popups | `EmbedAdapter` / `PopupAdapter` | Current website media lifetime | Closed, cleared, and listener-cleaned on media change |
| Event feed | `EventLog` | Room lifetime | Bounded ring buffer, errors/joins/leaves only |
| Metadata cache | `MediaResolver` | App lifetime or resolver lifetime | Small LRU with TTL and explicit `clear()` |

## Minimal domain state shape

The shared state should be close to this size and shape:

```ts
type SessionState = {
  readonly roomId: RoomId
  readonly status: 'idle' | 'hosting' | 'joining' | 'connected' | 'ended'
  readonly participants: {
    readonly host: Participant
    readonly guest?: Participant
  }
  readonly queue: readonly MediaItem[]
  readonly current?: MediaItem
  readonly playback: PlaybackModel
  readonly events: readonly SystemEvent[]
}
```

Rules:

- No DOM nodes, object URLs, `File`, `Blob`, peer objects, callbacks, timers, or extension handles in shared state.
- No duplicated media blobs or large descriptions in state. Store compact display metadata only.
- Queue length must be capped. Start with 50 items unless product needs prove otherwise.
- Event feed must be capped. Start with 64 events.
- Media metadata cache must be capped. Start with 32 entries and TTL-based eviction.

## State management performance strategy

Do not deep-diff application state. Do not broadcast reducer diffs. Do not use framework state as
the wire protocol.

Use this model instead:

1. UI sends a typed intent to `SessionRuntime`.
2. Runtime converts it into a local command or wire command.
3. Host `SessionEngine` runs a pure transition:

   ```ts
   type Transition = {
     readonly state: SessionState
     readonly events: readonly HostEvent[]
     readonly errors: readonly DomainError[]
   }
   ```

4. Runtime commits the new state by incrementing a small version counter.
5. UI subscribers are notified once per committed transition.
6. Transport sends only the resulting protocol events, not a deep object diff.
7. Snapshots are sent on join, resync, reconnect, or protocol mismatch.

Performance constraints:

- Playback position is derived, not updated every frame.
- React should not receive high-frequency time ticks from the session engine.
- UI time displays may use a local animation frame or interval that reads derived playback time.
- Engine commits should be O(1) except queue operations, which are O(n) over a capped queue.
- Transport messages should be small JSON objects until profiling proves a binary format is needed.
- Avoid cloning full state for every selector. Expose immutable snapshots and selected subscriptions.
- Avoid retaining historical snapshots. Keep current state plus bounded event log only.

## Playback clock model

Playback sync is a clock problem, not a Redux state problem.

The host emits:

```ts
type PlaybackModel = {
  readonly state: 'idle' | 'playing' | 'paused'
  readonly positionMs: number
  readonly updatedAtHostMs: number
  readonly rate: number
  readonly durationMs?: number
}
```

Clients calculate current position:

```text
if paused: positionMs
if playing: positionMs + (clientNowAdjustedToHost - updatedAtHostMs) * rate
```

Rules:

- Estimate host clock skew during join and periodically on low-frequency heartbeat.
- Clamp seeks to valid duration when duration is known.
- Treat livestreams or unknown durations as non-auto-advance unless adapter proves end.
- Do not store constantly changing current time in shared state.
- Playback adapter receives desired state and decides whether an actual seek is needed using a threshold.

## Protocol design

All messages must be discriminated unions with a protocol version, sequence number, and runtime
validation.

```ts
type WireEnvelope =
  | {
      readonly version: 1
      readonly direction: 'client-to-host'
      readonly seq: number
      readonly sentAtMs: number
      readonly command: ClientCommand
    }
  | {
      readonly version: 1
      readonly direction: 'host-to-client'
      readonly seq: number
      readonly sentAtMs: number
      readonly event: HostEvent
    }
```

Command families:

- `join`
- `leave`
- `addMedia`
- `removeMedia`
- `playPause`
- `seek`
- `setRate`
- `next`
- `requestSnapshot`

Host event families:

- `snapshot`
- `participantJoined`
- `participantLeft`
- `mediaQueued`
- `mediaRemoved`
- `currentMediaChanged`
- `playbackChanged`
- `systemError`
- `protocolRejected`

Protocol rules:

- Unknown versions fail closed and request reload/upgrade.
- Unknown message types are rejected with typed protocol errors.
- Never parse wire input directly inside domain code.
- Never use ambient string registries for commands.
- Every parser returns `Result<T, ProtocolError>`.

## Pure and impure boundaries

Pure folders:

- `domain/**`
- `protocol/**`

Pure code may validate, calculate, and return new values. It may not read clocks directly,
touch browser APIs, allocate timers, open sockets, read storage, import React, or import Redux.

Impure folders:

- `transport/**`
- `playback/adapters/**`
- `platform/**`
- UI composition boundaries

Impure code must isolate effects and expose ownership through `dispose()`.

## Dependency and lifecycle architecture

Prefer constructor/factory dependency injection:

```ts
type SessionRuntimeDeps = {
  readonly clock: Clock
  readonly transport: PeerTransport
  readonly playback: PlaybackEngine
  readonly store: SessionProjectionStore
  readonly logger: Logger
}
```

Forbidden:

- Mixins.
- `getInstance()` service locators.
- Static mutable singletons.
- Ambient global registries.
- Hidden cross-module resource ownership.

Use factories for browser-specific construction and pass dependencies into pure/portable runtime
objects.

## Memory and byte management contract

Every allocated resource must have one owner and one cleanup path.

| Resource | Owner | Cleanup requirement |
| --- | --- | --- |
| DataChannel | `PeerTransport` | Close and remove listeners in `dispose()` |
| SimplePeer/RTCPeerConnection | `PeerTransport` | Destroy/close and clear references |
| WebSocket | `SignalingClient` | Close and remove listeners |
| Timeout/interval | Owning runtime object | Clear in `dispose()` and before replacing |
| Animation frame | UI/playback adapter | Cancel on unmount/dispose |
| Object URL | `LocalFileAdapter` | Revoke before replacement and on dispose |
| Iframe | `EmbedAdapter` | Remove listeners, set `src` to `about:blank`, release ref |
| Popup | `PopupAdapter` | Close when owned; detach listeners |
| DOM listener | Owner that registered it | Remove with exact target/type/listener/options |
| Observer | Owner that created it | Disconnect |
| Cache entry | Cache owner | TTL/LRU eviction and explicit clear |

Memory rules:

- Do not store `File`, `Blob`, DOM node, peer, socket, event listener, or timer handles in domain state.
- Do not keep arrays/maps that can grow without a named cap.
- Do not keep full protocol history. Keep sequence counters and bounded diagnostics only.
- Null or replace references after disposal when they hold external resources.
- Prefer small value objects over class instances for protocol/domain state.
- Use typed IDs instead of object references across module boundaries.

## Rationale records

Use decision records for architecture choices. Do not commit private reasoning transcripts.

Every major module or migration step should leave a concise rationale record in code comments,
PR text, or docs using this shape:

```text
Context:
Invariant:
Options considered:
Decision:
Performance impact:
Memory/lifecycle ownership:
Failure mode:
Validation:
```

The goal is to preserve engineering reasoning, constraints, and tradeoffs without turning
implementation code into a diary.

## Analyzer and enforcement roadmap

Current command:

```sh
npm run analyze:architecture
```

The custom analyzer currently enforces required docs, root scripts, new-folder file sizes,
type-escape bans, Redux import bans, singleton/mixin bans, pure-folder side-effect bans, and
resource-cleanup presence.

Add or tighten these as the migration proceeds:

- Import graph boundaries for `domain`, `protocol`, `transport`, `playback`, and `ui`.
- Type coverage budget with no uncovered exported protocol/domain types.
- Protocol parser compatibility tests for every version.
- Memory leak tests for object URLs, listeners, timers, peers, iframes, and popups.
- Bundle budgets for playback adapters and extension scripts.
- Dead-code detection after Redux/chat/avatar removal.
- Complexity limits for transition functions and adapter classes.
- Mutation tests for permission checks and playback-clock math.

## Migration phases

### Phase 0: Guardrails and inventory

- Keep the agent docs and analyzer mandatory.
- Inventory current Redux actions/reducers used for session, users, queue, playback, and chat.
- Mark legacy hotspot files as strangler targets.
- Define the exact reduced behavior set before moving implementation.

Exit criteria:

- Analyzer passes.
- Legacy behavior map exists in the migration PR or docs.
- New code owners agree on folder boundaries.

### Phase 1: Protocol foundation

- Create `protocol/messages` discriminated unions.
- Create handwritten or schema-backed runtime parsers.
- Add sequence numbers, protocol version, and typed errors.
- Add tests for accepted, rejected, unknown-version, and malformed messages.

Exit criteria:

- No wire input can enter runtime without validation.
- Protocol tests prove malformed data fails closed.

### Phase 2: Pure domain engine

- Implement username validation, invite authorization, queue transitions, playback clock math, and event-log bounding.
- Use pure transition functions that accept current state, command, and injected time.
- Return typed state/events/errors.
- Add property-style tests around queue caps, event caps, seek clamps, and role restrictions.

Exit criteria:

- Domain tests run without DOM, React, Redux, WebRTC, or browser globals.
- Analyzer proves pure folder boundaries.

### Phase 3: Runtime and projection store

- Add `SessionRuntime` as the impure owner that wires engine, transport, playback, and UI projection.
- Add a tiny external-store projection with versioned snapshots and selected subscriptions.
- Replace high-frequency Redux-derived playback time with derived local reads.

Exit criteria:

- UI can render a host-only local session from the new runtime.
- Runtime disposal clears every owned resource.

### Phase 4: Transport strangler

- Wrap existing signaling/WebRTC behavior behind `PeerTransport`.
- Ensure transport serializes validated protocol envelopes only.
- Add connection lifecycle tests with fake transport.
- Add heartbeat/clock-skew messages at low frequency.

Exit criteria:

- Host and guest can exchange protocol messages without Redux RPC.
- Disconnects surface typed errors.

### Phase 5: Playback adapter extraction

- Define `PlaybackAdapter`.
- Move local-file playback behind `LocalFileAdapter`.
- Move iframe/extension bridge behind `EmbedExtensionAdapter`.
- Move popup fallback behind `PopupAdapter`.
- Add lifecycle tests for every adapter resource.

Exit criteria:

- Media change disposes prior adapter before creating the next one.
- Local object URLs are revoked.
- Iframe/popup listeners are removed.

### Phase 6: UI cutover

- Replace Redux-connected lobby/session/playback components with runtime-backed UI.
- Keep UI components presentation-focused.
- Remove chat UI and replace with bounded system event feed.
- Remove avatar/color/role/session-mode/max-users surfaces.

Exit criteria:

- Private 1:1 flow works end to end.
- UI no longer dispatches session Redux actions for migrated behavior.

### Phase 7: Legacy deletion

- Delete Redux RPC and diff-sync middleware after feature parity.
- Delete unused reducers/actions/selectors for removed features.
- Delete obsolete extension bridge paths after adapter migration.
- Convert legacy hotspot analyzer warnings into failures for equivalent new paths.

Exit criteria:

- No Redux-shaped network protocol remains.
- Analyzer, tests, and builds pass.

## Definition of done

- Two different computers can connect through a private invite link.
- Host and guest stay synced for local files and supported website playback.
- All shared state flows through typed protocol messages and host-authoritative transitions.
- No new architecture code uses Redux as domain state or network protocol.
- Every impure resource has deterministic cleanup and tests where practical.
- Analyzer passes.
- Existing package builds/tests pass.
