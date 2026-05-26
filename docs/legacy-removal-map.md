# Legacy removal map (role/avatar/color deletion prep)

## Scope

This map is a scoped prep pass for the reduced 1:1 product cutover. It identifies legacy surfaces that still carry:

- avatar state
- profile color state
- DJ/admin role controls
- public/private/offline session mode
- configurable max-user limits

This document is intentionally deletion-oriented and does **not** propose a broad refactor in this wave.

## Current legacy surfaces

| Concern | Legacy surfaces | Notes |
| --- | --- | --- |
| Avatar profile + registry | `src/services/avatar.ts`, `src/appContext.ts`, `src/reducers/settings.ts` (`avatar` / `getLocalAvatar`), `src/lobby/actions/user-init.ts`, `src/lobby/actions/users.ts`, `src/lobby/reducers/users.ts`, `src/components/settings/sections/Profile.tsx`, `src/components/lobby/UserAvatar.tsx`, `src/components/lobby/UserItem.tsx`, `src/components/lobby/UserList.tsx` | Avatar selection is still persisted, synced, validated, and rendered. |
| Chat color profile | `src/reducers/settings.ts` (`color` / `setColor` / `getLocalColor`), `src/lobby/actions/user-init.ts`, `src/lobby/actions/users.ts`, `src/lobby/reducers/users.ts`, `src/components/settings/sections/Profile.tsx`, `src/components/chat/Username.tsx`, `src/lobby/reducers/users.helpers.ts` | User color remains part of replicated profile and chat display formatting. |
| DJ/admin role model | `src/lobby/reducers/users.ts` (`UserRole`), `src/lobby/reducers/users.helpers.ts` (`hasRole`/`isDJ`/`isAdmin`), `src/lobby/actions/users.ts` (`setUserRole`, `server_toggleUserRole`, admin-gated moderation), `src/lobby/actions/user-init.ts` (`server_answerClient` admin gate), `src/components/lobby/UserList.tsx`, `src/components/lobby/UserItem.tsx`, `src/lobby/reducers/mediaPlayer.helpers.ts`, `src/lobby/reducers/chat.helpers.ts`, locale keys (`toggleDJ`, `requiresDJPermissions`, `dj`) | Product target is host/guest only; DJ is legacy multi-user moderation. |
| Public/private/offline session mode | `src/reducers/settings.ts` (`SessionMode`, `getLocalSessionMode`), `src/components/lobby/modals/SessionSettings.tsx` (mode selector UI), `src/containers/LobbyPage.tsx` (networking on/off via mode), `src/lobby/actions/user-init.ts` (private-mode join approval path), `src/components/lobby/UserList.tsx` (invite highlight tied to offline mode) | Mode switching is legacy room-topology behavior outside reduced private 1:1 target. |
| Configurable max users | `src/constants/settings.ts` (`USERS_MAX`, `MAX_USERS_INFINITE`, `DEFAULT_USERS_MAX`), `src/reducers/settings.ts` (`maxUsers`), `src/lobby/reducers/session.ts` (`maxUsers`, `getMaxUsers`), `src/lobby/actions/session.ts` (`initHostSession`), `src/lobby/actions/user-init.ts` (full-session rejection), `src/components/lobby/modals/SessionSettings.tsx` (dropdown), `src/components/lobby/UserList.tsx` (occupancy badge) | Reduced target is hard 1 host + 1 guest, not configurable capacity. |

## Ordered deletion plan (scoped waves)

1. **Freeze target invariants in domain/protocol first**
   - Keep host-authoritative 1:1 semantics as source of truth.
   - Preserve typed wire validation; no Redux-shaped sync reintroduction.

2. **Remove role-specific behavior (DJ/admin)**
   - Replace role checks with host/guest authorization decisions.
   - Remove role mutation RPC (`toggleUserRole`) and UI affordances.
   - Remove locale strings and role badges after UI path removal.

3. **Remove avatar/color from replicated user profile**
   - Stop sending avatar/color in client init and profile-update payloads.
   - Delete avatar registry plumbing and profile selectors once UI stops referencing them.
   - Keep username-only profile path.

4. **Remove session mode and max-user controls**
   - Eliminate public/private/offline selector UI and branching.
   - Replace max-user setting with fixed 1 guest policy.
   - Keep explicit typed disconnect reason for capacity violations if needed.

5. **Clean persistence/migrations and dead locale keys**
   - Remove avatar/color/maxUsers persisted fields when no longer read.
   - Remove obsolete migration branches tied only to removed fields.
   - Drop now-unused translation keys and assets.

## Analyzer-safe deletions in this prep wave

These are low-risk removals already completed in this branch:

- `src/components/lobby/modals/SessionSettings.tsx`
  - Removed unused connected props `hostId` and `hostName`.
  - Removed now-unused selectors/imports `getHostId` and `getHost`.
- `src/lobby/reducers/users.helpers.ts`
  - Stopped exporting helpers that had no external callers:
    - `getHostId`
    - `getHost`
    - `findUser`
    - `findUserByName`

Behavior is unchanged; this is export-surface cleanup only.

## Guardrails for follow-up waves

- No broad refactor in one PR; keep deletions incremental and verifiable.
- Do not add new Redux-shaped session/network behavior while deleting legacy surfaces.
- Keep `domain/**` and `protocol/**` pure.
- Every protocol shape change must stay typed + runtime-validated.
- Every impure owner must keep explicit cleanup lifecycles.

## Verification gates per removal PR

- `npm run analyze:architecture`
- App unit/build checks relevant to touched modules
- Regression checks for lobby join/leave, playback controls, and invite flow
