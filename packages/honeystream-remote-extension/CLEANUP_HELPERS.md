# Cleanup helpers

`helpers/cleanup-registry.js` introduces a small cleanup registry for extension migration work:

- Register listener cleanup with `addEventListener(...)`.
- Register timer cleanup with `addTimeout(...)` and `addInterval(...)`.
- Register custom cleanup handlers with `add(...)`.
- Dispose everything deterministically with `dispose()`.

The helper is intentionally **not wired into `src/background.js` or `src/player.js` yet**.
Those files are legacy hotspots, and this lane keeps runtime behavior stable while adding
tested building blocks for incremental cleanup refactors.

Minimal usage pattern:

```js
const { createCleanupRegistry } = require('./helpers/cleanup-registry')

const cleanup = createCleanupRegistry()
cleanup.addEventListener(window, 'message', onMessage)
cleanup.addTimeout(() => poll(), 5000)

// later
cleanup.dispose()
```
