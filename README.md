# Honeystream

Private watch sessions for two people watching the same local file, website video, or direct video URL.

Honeystream is a personal fork of the no-longer-maintained Metastream project, kept for 1:1 media watching with my girlfriend.

## Core flows

### Local files

1. Start a session.
2. Send the session link to the other person.
3. Add a downloaded video from your computer.
4. The other person chooses their local copy when prompted.
5. Play, pause, seek, and playback speed stay synced.

### Websites and direct links

1. Start a session.
2. Send the session link to the other person.
3. Paste a website video page or direct media URL.
4. Everyone uses their own browser access for that site.
5. Playback controls stay synced when the site can be controlled by the app.

Website playback uses the browser companion extension. Local-file playback does not.

## Development

Requires Yarn 1 and Node 12.22.x.

```sh
yarn
yarn --cwd packages/honeystream-signal-server build
yarn --cwd packages/honeystream-app start
```

## Architecture guardrails

The architecture migration plan is in `docs/architecture-migration-plan.md`. Coding
assistants should read `.github/agents/` before changing session, transport, protocol,
or playback architecture.

```sh
npm run analyze:architecture
```
