# Jeopardy

A rebuild of [howardchung/jeopardy](https://github.com/howardchung/jeopardy): the
board, the buzzer and shared rooms, on Bun, Next.js and TypeScript.

Play solo against AI opponents, or open a room, read out the four-character
code, and play the same board with everyone else in it. Rooms are
server-authoritative: the server owns the state and the clock, clients send
intent only.

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

Start the app:

```powershell
bun run dev
```

That serves the app and solo play. Shared rooms live in a Cloudflare Worker,
which runs alongside it:

```powershell
bun run rooms:dev
```

Point the app at it with `NEXT_PUBLIC_ROOMS_URL` (see `.env.example` and
`docs/06-multiplayer.md`). `GET /api/health` reports that the app is up.

## What's here

- **Shared rooms.** Open a room, share the code or link, and play together.
  The server holds the board, the buzzer and the clock; a refresh reclaims your
  seat and score, and hosting moves on if the host drops. Each room is a
  Durable Object on Cloudflare's free plan, so rooms survive a restart and
  cost nothing when idle (see `docs/06-multiplayer.md`).
- **The whole game.** Archived and custom boards, every round, Daily Doubles,
  Final Jeopardy wagers, buzz windows with the show's early-buzz lockout,
  judging (by a host or the fuzzy judge), chat, replays and stats.
- **AI opponents.** Four difficulty tiers that pick, ring in, answer and wager
  on their own, running on the server so everyone sees the same game.
- **The board.** Set palette and typography, tiles that fill in per round, a
  clue panel that grows out of the square you picked, round title cards,
  ring-in lights that go out with the clock, and podium displays that flash on
  a score change.
- **Sound.** A synthesized cue set (select, ring-in, correct, wrong, time's up,
  Daily Double, round start, applause) and a 30-second Final Jeopardy
  countdown. The show's own recordings are copyrighted, so none are shipped.
  These are original tones written to sit in the same register and pacing.
- **Voice readout.** The clue is read aloud by a selectable system voice, with
  the buzzer opening when the readout ends.

## Important Files

- `AGENTS.md` - mandatory implementation guidance for future agents.
- `docs/01-product-brief.md` - product scope, inherited features, and improvement backlog.
- `docs/02-architecture.md` - proposed architecture and ownership boundaries.
- `docs/03-agent-playbook.md` - development workflow for future implementation agents.
- `docs/05-pre-ui-readiness.md` - gate for what must exist before UI work begins.
- `docs/06-multiplayer.md` - how shared rooms, authority and the room clock work.
- `src/lib/data/` - archived episode and custom CSV normalization into engine clues.
- `src/lib/realtime/` - typed realtime command/session boundary and in-memory adapter.
- `.codex/skills/jeopardy-app/SKILL.md` - repo-local Codex skill for scoped feature work.
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
bun run audit:layout
bun run verify
```

Use `proto install` before running commands on a fresh machine. `.prototools` is the source of truth for tool versions.

### Layout audit

`bun run audit:layout` plays one game at seven screen sizes (1440x900, 1280x800, 1024x768, 768x1024, 390x844, 360x740 and a 1920x1080 television) with a host, a guest and a TV in the same room, and checks every screen on the way: the landing page and its join and error states, the builder, the game picker, settings, shortcuts, onboarding, each clue phase, the Daily Double, Double Jeopardy, Final, the results, the replay and a removed guest. It flags sideways page scroll, content past the viewport or cut off by its container, painted boxes poking out of their parent, spilling or clipped text, overlapping controls, control rows off a shared centre line and top-level blocks off the page's left edge, and exits 1 on any finding.

Run it against `bun run dev` (the dev build exposes the store the audit drives the room with) and the rooms Worker:

```powershell
bun run rooms:dev
$env:NEXT_PUBLIC_ROOMS_URL="http://127.0.0.1:8787"; bun run dev
$env:AUDIT_BASE_URL="http://127.0.0.1:3000"; bun run audit:layout --shots .audit/shots
```

`--viewports` and `--routes` (view name prefixes) narrow it, `--until <view>` ends the game early, `--json <file>` keeps the findings. Every board is archive episode `AUDIT_EPISODE` (default 9644), so two runs compare. The checks live in `scripts/layout-audit/detect.mjs` with their tests in `tests/unit/layout-audit/`. A container whose children run past it on purpose takes `data-audit-clip-ok`; `data-audit-ignore` skips a subtree.
