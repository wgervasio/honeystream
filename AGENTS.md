# Agent instructions

This repository is migrating toward a strict, typed, private 1:1 watch-session
architecture.

All coding assistants must read `.github/agents/` and
`docs/architecture-migration-plan.md` before changing session, protocol, transport,
playback, or extension architecture. Pay special attention to the performance/memory
contract and rationale-record requirements.

Run this before handoff:

```sh
npm run analyze:architecture
```

Do not add new Redux-shaped session behavior, type escapes, global singletons, mixins,
or impure domain code.
