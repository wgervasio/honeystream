# Architecture contract

## Product shape

Honeystream should be treated as a private 1:1 synchronized playback system:

- One host and one guest.
- Username-only identity.
- Host-authoritative queue and playback state.
- Typed commands from guest to host.
- Typed events and snapshots from host to guest.
- Playback through local-file, embed-extension, or popup adapters.

## Runtime modules

| Module | Owns | Must not own |
| --- | --- | --- |
| `domain/**` | Session rules, queue rules, playback clock math, permissions | DOM, React, Redux, WebRTC, extension APIs, timers, storage |
| `protocol/**` | Message types, versions, parsers, validation | Business decisions, UI state, browser APIs |
| `transport/**` | WebRTC/signaling connections and ordered delivery | Queue/playback/user rules |
| `playback/engine/**` | Adapter selection and playback state application | React rendering, transport protocol |
| `playback/adapters/**` | Browser media side effects and cleanup | Session authorization or queue mutation |
| `ui/**` | Rendering snapshots and emitting user intents | Direct socket/WebRTC/extension manipulation |
| `platform/**` | Browser capability adapters | Domain policy |

## Import boundaries

Allowed dependency direction:

```text
ui -> domain/protocol/playback engine
playback engine -> domain/protocol/playback adapters
transport -> protocol
domain -> protocol types only when needed
protocol -> no app modules
```

Forbidden:

- `domain/**` importing `react`, `redux`, `react-redux`, `window`, `document`, `navigator`, `chrome`, `WebSocket`, or `simple-peer`.
- `protocol/**` importing app services or browser APIs.
- `ui/**` importing concrete WebRTC, signaling, or extension background modules.
- New architecture code importing legacy Redux action creators or reducers.

## Authoritative model

The host owns session truth. The guest may only send commands. The host validates commands,
updates domain state, and emits events/snapshots.

```text
Guest UI -> ClientCommand -> PeerTransport -> Host SessionEngine
Host SessionEngine -> HostEvent/Snapshot -> PeerTransport -> Guest projection
```

Do not reintroduce peer-to-peer mutable shared state. Do not broadcast object diffs as the
protocol. Send explicit messages.

## Lifecycle contract

Any class or factory that touches side-effectful resources must return or implement:

```ts
interface Disposable {
  dispose(): void
}
```

This applies to WebRTC peers, WebSockets, event listeners, timers, object URLs, iframes,
popups, media elements, observers, and caches. Ownership must be local and obvious.
