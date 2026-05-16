# Jeopardy Modern

Modern rebuild foundation for [howardchung/jeopardy](https://github.com/howardchung/jeopardy).

This phase is intentionally infrastructure-first: it prepares the repo for future agentic development with Bun, Next.js, Material UI, Zustand, proto tool pinning, docs, local skills, and verification harnesses. It does not implement the game UI.

## Quick Start

Install proto once:

```powershell
irm https://moonrepo.dev/install/proto.ps1 | iex
```

Install the pinned toolchain and dependencies:

```powershell
proto install
bun install
```

Run the foundation checks:

```powershell
bun run verify
```

Start the app shell:

```powershell
bun run dev
```

The scaffold exposes `GET /api/health` so harnesses can verify Next.js is running before UI work begins.

## Current Scope

- Preserve the upstream feature intent: rooms, archived/custom games, all Jeopardy rounds, Daily Doubles, Final Jeopardy, buzzing, chat, judging, TTS, persistence, and stats.
- Modernize the implementation target: Bun, Next.js App Router, TypeScript, Material UI, Redis-ready services, AI-ready service boundaries, and responsive web foundations.
- Add new product direction: selectable readout voices, AI bot opponents with difficulty and buzz timing, better host controls, accessibility, analytics, solo practice, and richer custom games.
- Include an optional avatar AI host as a planned adapter for readout, pacing, rule reminders, and future animation cues.
- Provide docs and harnesses that another agent can follow without rediscovering the upstream app from scratch.

## Important Files

- `AGENTS.md` - mandatory implementation guidance for future agents.
- `docs/01-product-brief.md` - product scope, inherited features, and improvement backlog.
- `docs/02-architecture.md` - proposed modern architecture and ownership boundaries.
- `docs/03-agent-playbook.md` - development workflow for future implementation agents.
- `docs/05-pre-ui-readiness.md` - gate for what must exist before UI work begins.
- `src/lib/data/` - archived episode and custom CSV normalization into engine clues.
- `src/lib/realtime/` - typed realtime command/session boundary and in-memory adapter.
- `.codex/skills/jeopardy-modern-app/SKILL.md` - repo-local Codex skill for scoped feature work.
- `scripts/verify-foundation.ts` - checks that the foundation stays coherent.

## Commands

```powershell
bun run dev
bun run build
bun run typecheck
bun run lint
bun run test
bun run test:e2e
bun run foundation:verify
bun run verify
```

Use `proto install` before running commands on a fresh machine. `.prototools` is the source of truth for tool versions.
