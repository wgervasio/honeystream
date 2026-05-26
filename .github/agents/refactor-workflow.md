# Refactor workflow

## Default approach

Use a strangler migration:

1. Add typed protocol and pure domain code beside legacy Redux.
2. Adapt legacy UI to the new engine through thin bridges.
3. Replace one behavior at a time.
4. Delete legacy Redux/network code after equivalent behavior is proven.

Do not rewrite everything in one pass unless the task explicitly authorizes a full replacement.

## Required handoff shape

Every architecture change should state:

- Which behavior moved.
- Which module now owns it.
- Which legacy dependency was removed or isolated.
- Which cleanup path owns resources.
- Which analyzer/test proves the boundary.

## Behavior ownership checklist

Before adding code, classify it:

| Behavior | Owner |
| --- | --- |
| Invite secret validation | `domain/session` |
| Username validation | `domain/users` |
| Queue mutation | `domain/queue` |
| Playback time math | `domain/playback` |
| Wire message parsing | `protocol` |
| WebRTC connection | `transport/webrtc` |
| Signaling-room bootstrap | `transport/signaling` |
| Local file object URLs | `playback/adapters/local-file` |
| Iframe/extension messages | `playback/adapters/embed-extension` |
| Rendering controls | `ui/playback` |
| Persisted preferences | `platform/browser` or a tiny settings store |

If code appears to belong to multiple owners, split pure decision logic from impure execution.

## Deletion targets

The migration should remove or avoid expanding:

- Avatar/color state.
- DJ/admin/general role state.
- Public session modes.
- Max-user settings beyond hard-coded 1:1.
- Chat messages as product surface.
- Redux diff synchronization.
- Global RPC action registry.
- Provider hacks outside playback adapters.

## PWA policy

PWA/service-worker behavior is not core to the reduced product. Keep it only if it is needed
for install/update behavior and has an owner. Otherwise isolate it until it can be removed.
