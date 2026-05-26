# Copilot coding instructions

This repository is migrating away from Redux-shaped networking toward a small, typed,
host-authoritative 1:1 watch-session architecture.

Before changing architecture or session code, read:

- `.github/agents/README.md`
- `.github/agents/architecture-contract.md`
- `.github/agents/coding-standards.md`
- `.github/agents/performance-memory-contract.md`
- `.github/agents/refactor-workflow.md`
- `.github/agents/reasoning-records.md`
- `.github/agents/analyzer-policy.md`
- `docs/architecture-migration-plan.md`

Hard rules:

- Do not add new Redux-backed distributed session behavior.
- Do not put browser, DOM, extension, WebRTC, timer, storage, or network APIs in `domain/**`.
- Do not add `any`, global singletons, mixins, broad silent catches, or unbounded resource ownership.
- Every impure runtime object must have explicit lifecycle cleanup.
- Every wire message must have a TypeScript type and runtime validation.
- Run `npm run analyze:architecture` before handing off architecture work.
