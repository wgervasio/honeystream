# Agent workspace

This folder contains the operating contract for coding assistants working on the
Honeystream architecture migration.

Read these files before editing code:

- `architecture-contract.md` defines target modules, ownership, and allowed dependencies.
- `coding-standards.md` defines TypeScript, purity, lifecycle, DI, and file-size rules.
- `performance-memory-contract.md` defines state, render, protocol, and cleanup budgets.
- `refactor-workflow.md` defines the incremental migration approach.
- `reasoning-records.md` defines how to document engineering rationale without dumping private reasoning.
- `analyzer-policy.md` defines analyzer expectations and how to keep checks strict.

The migration plan lives in `docs/architecture-migration-plan.md`.

Assistants should optimize for a coherent 1:1 private watch-session system, not for
preserving legacy abstractions. Keep changes incremental, typed, and enforceable.
