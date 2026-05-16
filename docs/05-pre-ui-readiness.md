# Pre-UI Readiness Gate

UI work should not begin until the blocking items below have implementation plans, typed contracts, and tests. Optional AI services can be developed in parallel, but their boundaries still need to be documented before UI surfaces depend on them.

Current foundation status: the first pure game engine, command/event contracts, public/private state boundary, game-engine tests, data normalization layer, and transport-neutral realtime adapter exist. They are ready for persistence and AI adapter work, but should keep expanding as new rules and import paths are implemented.

## Blocking Before UI

### Pure Game Engine

- Owner: `src/lib/game`
- Needed: room state, round lifecycle, board construction, clue picking, Daily Doubles, wagers, buzz windows, answer submission, judging, scoring, undo, and stats.
- Acceptance:
  - Game rules are pure TypeScript or deterministic services.
  - No React, Zustand, Redis, realtime, or AI imports.
  - Timer behavior can be tested with an injected clock.

### Game Engine Tests

- Owner: `tests/unit` and `tests/contracts`
- Needed: state transition tests for every command and rejection path.
- Acceptance:
  - Commands have success and failure tests.
  - Private answers and hidden wagers cannot leak before reveal.
  - Daily Double and Final Jeopardy wager rules are covered.

### Public And Private State

- Owner: `src/lib/game` and `src/lib/realtime`
- Needed: private room state and public render-safe state.
- Acceptance:
  - Correct responses, private wagers, room secrets, and undo snapshots stay private.
  - Public snapshots are safe for players and spectators.
  - Tests prove answer keys are not present before reveal.

### Command And Event Contracts

- Owner: `src/lib/game/contracts.ts`
- Needed: typed command/event unions before realtime or UI binds to behavior.
- Acceptance:
  - Commands include start game, pick clue, buzz, submit answer, submit wager, judge answer, undo, skip, update settings, add bot, and configure host.
  - Events include room created, clue revealed, buzz accepted, answer submitted, wager submitted, answer judged, score changed, round advanced, and command rejected.
  - Contracts are shared by engine, realtime adapters, and tests.

### Realtime Adapter

- Owner: `src/lib/realtime`
- Needed: Socket.IO or websocket adapter that maps client messages to typed commands.
- Acceptance:
  - Server timestamps decide buzz windows.
  - Reconnect behavior preserves client identity without trusting spoofed input.
  - Room broadcasts only public state.
- Foundation status:
  - Client command messages do not include trusted `actorId`.
  - The in-memory adapter stamps commands with authenticated session ids.
  - Tests cover broadcast, reconnect replacement, invalid tokens, spoofed actor ids, and server-clock buzz windows.

### Redis Persistence

- Owner: `src/lib/persistence`
- Needed: active room serialization, hydration, expiration, and optional local fallback.
- Acceptance:
  - Redis is optional for local development.
  - Hydration does not double-fire timers.
  - Tests use fakes or a containerized Redis service.

### Episode And Custom Game Data

- Owner: `src/lib/data`
- Needed: archived episode loader and custom CSV parser that normalize to one clue model.
- Acceptance:
  - Invalid custom games return actionable errors.
  - Remote data failure does not break local startup.
  - Imported clues support standard rounds, Daily Doubles, and Final Jeopardy.
- Foundation status:
  - `normalizeArchivedEpisode` maps J-Archive-style episode objects to engine clues.
  - `normalizeCustomCsvGame` maps upstream-style `round,cat,q,a,dd` CSV data to engine clues.
  - Unit and contract tests prove validation behavior and engine compatibility.

### AI Bot Opponents

- Owner: `src/lib/ai/bots`
- Needed: bot players that use the same room commands as humans.
- Acceptance:
  - Difficulty controls buzz delay, answer accuracy, category confidence, and wagering.
  - Bots never bypass buzz windows or judging.
  - Tests can run with deterministic fake bot decisions.

### Voice Readout

- Owner: `src/lib/ai/voice`
- Needed: selectable voice adapter for browser, hosted, and external readout providers.
- Acceptance:
  - Browser speech is the fallback.
  - Cache keys include clue text, voice id, provider, and locale.
  - Voice failures degrade to captions or default speech.

### Zustand Client State

- Owner: `src/lib/state`
- Needed: local preferences, connection status, UI state, and public room snapshots.
- Acceptance:
  - Zustand does not own authoritative rules.
  - Zustand does not store private answers or private wagers.
  - Selectors are narrow enough for high-frequency realtime updates.

### Accessibility Requirements

- Owner: docs and future UI tests
- Needed: accessibility spec before visual layout.
- Acceptance:
  - Keyboard-only pick, buzz, answer, wager, and judge flows are specified.
  - Captions, visible timers, reduced motion, and screen-reader status are specified.
  - Accessibility test strategy is documented.

### Responsive Requirements

- Owner: docs and future UI tests
- Needed: desktop, tablet, and phone flow definitions.
- Acceptance:
  - Phone buzzer flow is primary, not an afterthought.
  - Lobby, board, clue, wager, answer, and judge states have viewport expectations.
  - Playwright viewport coverage is listed before visual implementation.

### Pre-UI Harnesses

- Owner: `tests` and `scripts`
- Needed: one-command confidence before UI begins.
- Acceptance:
  - `bun run verify` stays green.
  - Foundation verifier protects toolchain and scope.
  - Engine, realtime, AI fake, data validation, and accessibility harnesses are planned before UI implementation.

## Optional But Planned Before UI Dependency

### Avatar AI Host

- Owner: `src/lib/ai/avatar-host`
- Needed: optional host adapter for clue readout, pacing, rule reminders, and light commentary.
- Acceptance:
  - The feature can be disabled, voice-only, or avatar-and-voice.
  - Host narration never reveals correct responses, private wagers, or hidden Daily Double content early.
  - The adapter emits structured host cues for future animation without requiring a UI now.
  - Tests use deterministic scripts or fake model output.

This feature does not block all UI work because the app must remain fully playable without it. It does block any UI surface that claims to support avatar-host mode.

## Machine-Readable Checklist

The source of truth for this gate is `src/lib/foundation/pre-ui-readiness.ts`, with coverage in `tests/contracts/pre-ui-readiness.test.ts`.
