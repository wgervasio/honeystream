# Coding standards

## TypeScript

- Use TypeScript for app, protocol, transport, and extension migration work.
- Do not add `any`, `Function`, `Object`, double assertions, `@ts-ignore`, or `@ts-expect-error`.
- Prefer discriminated unions for commands, events, states, and errors.
- Use runtime validators for every external or wire input.
- Treat `JSON.parse`, `postMessage`, WebRTC data, extension messages, URL params, and storage as untrusted.

## Pure and impure split

Pure code belongs in `domain/**` and `protocol/**`.

Pure code may:

- Accept values.
- Return values.
- Validate values.
- Calculate derived state.
- Produce typed events.

Pure code may not:

- Read clocks directly.
- Touch DOM/browser APIs.
- Allocate timers.
- Open sockets.
- Read or write storage.
- Import React or Redux.

Impure code belongs in `transport/**`, `playback/adapters/**`, `platform/**`, or thin UI
composition layers. Impure code must isolate side effects and expose cleanup.

## File and function size

New architecture limits:

| Area | Max lines |
| --- | ---: |
| `protocol/**` | 180 |
| `domain/**` | 220 |
| `transport/**` | 260 |
| `playback/engine/**` | 240 |
| `playback/adapters/**` | 320 |
| `ui/**` | 220 |
| Tests | 400 |

Prefer small functions under 40 lines. Split by responsibility, not by arbitrary layers.

## Dependency injection over mixins/singletons

Use explicit dependencies:

```ts
type SessionEngineDeps = {
  clock: Clock
  idGenerator: IdGenerator
}
```

Avoid:

- Mixins.
- Ambient global registries.
- `getInstance()` service locators.
- Static mutable instances.
- Cross-module hidden state.

Factories are acceptable when they return typed objects and make ownership explicit.

## Lifecycle management

Every impure object must define ownership and cleanup. Use `dispose()` consistently.

Examples of resources that require cleanup:

- `addEventListener` / `removeEventListener`
- `setTimeout` / `clearTimeout`
- `setInterval` / `clearInterval`
- WebRTC peers and DataChannels
- WebSockets
- `MutationObserver` / `ResizeObserver`
- `URL.createObjectURL` / `URL.revokeObjectURL`
- Popup windows and iframe sources
- Extension message listeners

Prefer `AbortController` for grouped listener cleanup when browser support allows it.

## Error handling

- Do not swallow errors with empty `catch` blocks.
- Convert expected failures into typed error events.
- Log unexpected failures at the boundary where they can be diagnosed.
- Do not return success-shaped defaults after failed validation.

## State management

- Do not use Redux as the domain model or wire protocol for new code.
- React may subscribe to a small external-store projection.
- Domain state changes must flow through typed commands and events.
- Keep event logs bounded.
- Keep caches bounded or disposable.
- Do not deep-diff app state for synchronization.
- Do not commit playback current time every frame; derive it from the playback clock model.
- Do not store impure handles in state.

## Performance and memory

- Name the owner of every allocation that can outlive the current call stack.
- Keep arrays and maps capped unless they are provably bounded by product rules.
- Reuse derived calculations where safe, but do not add unbounded memoization.
- Prefer compact protocol/domain values over class instances across boundaries.
- Clear references after disposing browser resources.
- Add a rationale record when increasing caps or adding a cache.

## Tests and analyzers

- Add unit tests for pure domain and protocol code.
- Add lifecycle cleanup tests for impure adapters.
- Run `npm run analyze:architecture` before handing off.
