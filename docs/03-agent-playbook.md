# Agent Playbook

## Start Here

1. Run `proto install`.
2. Run `bun install`.
3. Read `AGENTS.md`.
4. Read the product and architecture docs for the feature area.
5. Run `bun run verify` before changing behavior so you know the baseline.

## Implementation Pattern

1. Define or update types first.
2. Write unit or contract tests for the behavior.
3. Implement pure logic.
4. Add Zustand state only for local UI/session needs or public room snapshots.
5. Add adapters for Next.js, Redis, realtime, or AI.
6. Add UI last, using Material UI and the repo theme.
7. Run the narrow tests, then `bun run verify`.

Before starting UI, read `docs/05-pre-ui-readiness.md` and either satisfy the blocking gate or explicitly document which item the current scoped task is allowed to bypass.

## Avoid

- Do not copy the upstream React components.
- Do not put game rules into page components.
- Do not put authoritative game rules into Zustand.
- Do not let the optional avatar AI host become game authority.
- Do not introduce a second package manager.
- Do not introduce protobuf unless the user asks for it explicitly.
- Do not make AI calls mandatory for local development or tests.

## Handoff Expectations

Every feature handoff should state:

- What changed.
- What commands passed.
- Any test gaps.
- Any follow-up decision needed.
