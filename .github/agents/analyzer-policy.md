# Analyzer policy

Run:

```sh
npm run analyze:architecture
```

The analyzer is intentionally strict for new architecture folders and warning-oriented for
legacy files during migration. As legacy code is removed, warnings should become failures.

## Enforced for new architecture folders

- Required agent and migration documents exist.
- Migration plan contains required sections for state performance, protocol, memory, and lifecycle.
- Root package exposes `analyze` and `analyze:architecture`.
- File-size limits by folder.
- No `any`, `Function`, `@ts-ignore`, `@ts-expect-error`, or double assertion escapes.
- No Redux imports in new architecture code.
- No mixins or static singleton service locators.
- Pure folders cannot import React, browser APIs, storage, timers, WebRTC, or extension APIs.
- Files using impure resources must include explicit cleanup through `dispose`, `destroy`, or `teardown`.
- Architecture agent docs for performance/memory and rationale records exist.

## Expected future analyzers

Add these as the migration creates enough code to check:

- Protocol compatibility tests for versioned message parsing.
- Import-boundary checks backed by the TypeScript compiler graph.
- Dead-code detection after Redux/chat/avatar removal.
- Bundle-size budgets for playback adapters and extension scripts.
- Leak tests that assert listener/timer/object-URL cleanup.
- Mutation tests for command authorization and playback-clock math.

Analyzer failures should block merges. If a rule is wrong, fix the rule or add a narrow,
documented exception. Do not bypass with type escapes.
