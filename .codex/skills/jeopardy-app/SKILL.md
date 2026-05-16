---
name: jeopardy-app
description: Use when implementing, reviewing, or planning features in this repo for the Jeopardy web app. Covers Bun, Next.js App Router, Material UI, Zustand client state, proto toolchain usage, game-engine boundaries, AI bots, voice readout selection, optional avatar AI host, multiplayer rooms, and agent handoff expectations.
---

# Jeopardy App

## Quick Start

Read these files before editing:

1. `AGENTS.md`
2. `docs/01-product-brief.md`
3. `docs/02-architecture.md`
4. `docs/03-agent-playbook.md`
5. `docs/05-pre-ui-readiness.md` before UI work

Use `proto install` and Bun commands. In this repo, proto means the moonrepo version manager. Do not add protobuf files or a `proto/` directory unless explicitly requested by the user.

## Implementation Workflow

1. Define or update domain types and contracts.
2. Add focused tests for the behavior.
3. Implement pure game or service logic.
4. Add Next.js, realtime, Redis, or AI adapters only after the core logic is tested.
5. Build UI last with Material UI and the repo theme.
6. Run `bun run verify` before handoff.

## Architecture Rules

- Keep Jeopardy rules in pure TypeScript modules, not React components.
- Use Zustand only for local UI/session state, preferences, and public room snapshots.
- Keep private state separate from public room state.
- Keep optional avatar AI host output to structured cues and allowed narration; it is never game authority.
- Never expose unrevealed correct responses or private wagers.
- Treat AI judging, AI bots, and generated voices as optional adapters with fakes for tests.
- Make AI bots act through normal player commands and buzz timing.
- Keep voice readout selectable with browser speech as the fallback.
- Preserve server authority for buzzing, judging permissions, and host-only commands.

## Feature Priorities

Preserve inherited behavior from the upstream app:

- Multiplayer rooms.
- Archived and custom games.
- Jeopardy, Double Jeopardy, Triple Jeopardy, and Final Jeopardy.
- Daily Doubles, wagers, buzzing, judging, scores, chat, persistence, and stats.

Add the new product direction:

- Selectable readout voices.
- AI bot opponents with difficulty, accuracy, wager style, and buzz delay ranges.
- Better host controls.
- Responsive mobile and desktop play.
- Accessibility, analytics, replay, solo practice, and improved custom game creation.

## Handoff

Report what changed, what verification ran, and any residual risk. If `bun run verify` cannot pass, explain the exact failure and why it remains.
