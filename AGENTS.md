# Agent Instructions

This repo is a modern Jeopardy web app rebuild. The upstream reference is `https://github.com/howardchung/jeopardy`, but do not copy UI code directly. Preserve the product behavior while reimplementing with the modern stack and local architecture.

## Non-Negotiables

- Use `proto` as the toolchain manager. Run `proto install` on fresh environments.
- Use Bun for package management and scripts.
- Use Next.js App Router, TypeScript, and Material UI.
- Use Zustand for client-side UI/session state and public room snapshots.
- Do not introduce protobuf files or a `proto/` contract directory unless a future user explicitly asks for protobuf.
- Keep game logic out of React components. Prefer pure state-machine modules with tests.
- Do not put authoritative game rules or private room state in Zustand.
- Treat multiplayer events, AI judging, readout voices, and bots as typed service boundaries.
- Preserve accessibility and responsiveness as first-class requirements.
- Do not implement broad UI surfaces without a scoped feature request.

## First Read

Before implementation work, read:

1. `docs/01-product-brief.md`
2. `docs/02-architecture.md`
3. `docs/03-agent-playbook.md`
4. The relevant checklist in `.agents/checklists/`

## Expected Workflow

1. Identify the smallest feature slice.
2. Add or update types/contracts first.
3. Implement game/service logic with unit tests.
4. Add Zustand selectors/actions only for client state after public state contracts are clear.
5. Add API or realtime adapters after the pure logic passes.
6. Build UI only after behavior and contracts are clear.
7. Run `bun run verify` before handoff.

## Tooling

```powershell
proto install
bun install
bun run verify
```

Use `bun run test:e2e` for browser-level smoke coverage once a change affects routes or UI.

## Source Control Care

The repo may contain work from another agent or user. Do not revert changes you did not make. If a file has unrelated edits, work with them or stop and ask only when the task cannot be completed safely.
