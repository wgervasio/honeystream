# 2026-05-29: Watch-session connection lab proof

## Context

Honeystream needs the migration UI and tests to show that supported streaming sites are exercised through deterministic host/guest transport mocks before runtime handoff. The user-facing happy path should make the low-latency, zero-loss target visible without adding new Redux-backed sync behavior.

## Decision

Keep the existing typed simulated transport lab as the source of performance proof, add explicit coverage assertions for the YouTube, AnimePahe, Cineby, Miruro, and generic streaming fixture matrix, and surface the home-page connection lab highlights for latency budget, selected-lane byte loss, burst-control pressure, realistic short/long/live durations, and site coverage.

## Consequences

The branch now ties the cozy home UX to the deterministic mock-connection gate while preserving the host-authoritative 1:1 architecture. Future runtime adapters should keep media bytes local, preserve zero-loss selected lanes under bursty controls, and update the visible lab proof if fixture count, duration coverage, or latency budgets change.
