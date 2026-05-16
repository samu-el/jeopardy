# Architecture

## Stack

- Toolchain manager: proto.
- Runtime and package manager: Bun.
- App framework: Next.js App Router.
- UI system: Material UI with a repo-owned theme.
- Client state: Zustand for UI/session state, preferences, and cached public room snapshots.
- Language: strict TypeScript.
- Realtime target: Socket.IO or a typed websocket adapter behind a service boundary.
- Persistence target: Redis for active rooms, durable storage later if needed.
- AI target: OpenAI-compatible service boundary for judging, bot reasoning, hosted voices, and optional avatar host cues.

## Proposed Module Boundaries

### `src/lib/game`

Pure game engine. Owns rounds, board construction, clue reveal, wagers, buzzing, scoring, judging state, undo snapshots, and stats. This layer should have no React, network, Redis, or AI imports.

### `src/lib/realtime`

Typed room events and transport adapters. This layer translates websocket messages into game-engine commands and broadcasts public state.

Current foundation: `src/lib/realtime` defines client command messages without `actorId`, stamps commands with the authenticated session id, and includes an in-memory adapter for tests. A Socket.IO binding can wrap these contracts later.

### `src/lib/data`

Episode and custom game loading. It should normalize J-Archive-derived data and user uploads into the same clue model.

Current foundation: `src/lib/data` provides pure normalizers for archived episode objects and upstream-style custom CSV files. Both sources emit `GameClue[]` for the pure engine and actionable validation issues for future import UI.

### `src/lib/ai`

AI judge, AI bots, voice selection, readout generation, and optional avatar host cues. All calls must be optional, timeout-aware, and observable. AI decisions should be overridable by a host.

### `src/lib/state`

Zustand client state. Owns local preferences, connection status, ephemeral UI state, and the latest server-approved public room snapshot. It must not own game rules, private answers, private wagers, or host authorization.

### `src/app`

Next.js routes, layouts, API endpoints, and eventual UI surfaces. Keep components focused on rendering and user interaction; do not hide game rules in components.

### `src/lib/foundation`

Temporary foundation metadata, contracts, and theme. As real modules arrive, migrate stable contracts into the domain modules above.

## State Model Guidance

Use a command/event shape:

- Commands represent intent: start game, pick clue, buzz, submit answer, judge answer, submit wager, skip, undo.
- Events represent facts: room created, clue revealed, buzz accepted, answer submitted, answer judged, score changed.
- Public state is derived from private room state and should never expose unrevealed correct responses or private wagers early.
- Zustand stores local client state and received public snapshots; it does not decide whether commands are valid.

## AI Bot Guidance

Bots should not bypass normal room mechanics. They should join as players, wait for buzz unlock, apply configured buzz delay, submit answers through the same command path, and receive judging like humans.

Difficulty should combine:

- Knowledge accuracy.
- Buzz delay range.
- Category confidence.
- Wager aggression.
- Final Jeopardy risk profile.

## Voice Readout Guidance

Voice selection should support:

- Browser speech synthesis as the offline/default fallback.
- Hosted TTS providers for consistent voices.
- External/custom adapters for future voice experiments.
- Per-room host default with possible local player override for accessibility.
- Caching by clue text, voice id, provider, and locale.

## Avatar AI Host Guidance

The avatar AI host is optional and must never be required to play a game. Treat it as a cue generator, not as the game authority.

Avatar host modes:

- Off: no avatar host behavior.
- Voice-only: host voice handles readout and allowed pacing cues.
- Avatar-and-voice: host voice plus structured animation cues for future UI.

The host may:

- Read categories and clues.
- Announce allowed pacing cues, such as "make a selection" or "time is up".
- Explain rules when enabled.
- Add light commentary only after public events.

The host must not:

- Reveal correct responses early.
- Reveal private wagers.
- Give hints during live clues.
- Override host or game-engine decisions.

## Security And Fairness

- Validate all client IDs and room commands.
- Enforce host-only actions server-side.
- Keep answer keys private until reveal.
- Use server timestamps for buzz windows.
- Ignore client-supplied actor IDs; realtime sessions stamp command authority server-side.
- Consider latency compensation only after measuring round-trip time.
- Rate-limit chat, room creation, AI calls, and custom uploads.
