# Performance and memory contract

## Performance target

The reduced product is a 1:1 watch session. State volume should stay tiny. Most performance
problems will come from browser media resources, leaked listeners, unnecessary renders, and
unbounded caches, not from CPU-heavy calculations.

Optimize for:

- O(1) playback position derivation.
- O(1) command validation except capped queue operations.
- One UI notification per committed domain transition.
- No high-frequency network updates for current playback time.
- No deep diffing of full app state.
- Bounded memory for queues, event logs, and caches.

## State budgets

Initial caps:

| Structure | Cap |
| --- | ---: |
| Queue | 50 media items |
| System event log | 64 events |
| Media metadata cache | 32 entries |
| Protocol diagnostics | 64 recent rejected/failed messages |
| Pending command promises | 8 in flight |

Raising a cap requires a product reason and a rationale record.

## Render strategy

- React renders snapshots, not live mutable engine internals.
- Use selected subscriptions or shallow comparison to avoid rerendering the whole session UI.
- Playback progress displays may update locally, but they must read derived time and avoid committing state every frame.
- Adapter events should be throttled before they become domain commands.

## Wire strategy

- Use explicit host events and snapshots, not object-tree diffs.
- Send playback model changes only when play, pause, seek, rate, media, or duration changes.
- Use heartbeat/clock-skew checks at low frequency only.
- Prefer JSON until profiling proves serialization is a bottleneck.

## Allocation strategy

- Avoid retaining historical snapshots.
- Avoid copying large arrays on high-frequency paths.
- Store compact metadata only. Never store `File`, `Blob`, DOM nodes, sockets, peers, iframe windows, or object URLs in domain state.
- Use typed IDs across boundaries instead of object references.
- Caches must have LRU/TTL behavior and explicit `clear()`.

## Cleanup strategy

Every side-effectful owner must expose `dispose()`. Disposal must be idempotent.

Required cleanup pairs:

| Allocate/register | Cleanup |
| --- | --- |
| `URL.createObjectURL` | `URL.revokeObjectURL` |
| `addEventListener` | `removeEventListener` or abort signal |
| `setTimeout` | `clearTimeout` |
| `setInterval` | `clearInterval` |
| `requestAnimationFrame` | `cancelAnimationFrame` |
| `MutationObserver` / `ResizeObserver` | `disconnect` |
| WebSocket | remove listeners, close |
| WebRTC peer/DataChannel | remove listeners, close/destroy |
| iframe media page | detach listeners, set `src` to `about:blank`, release refs |
| popup | detach listeners, close if owned |

After disposal, clear references that hold browser resources.
