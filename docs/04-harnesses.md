# Harnesses

## Local

- `bun run typecheck` checks TypeScript.
- `bun run lint` checks project lint rules.
- `bun run test` runs Vitest unit and contract tests.
- `bun run test:e2e` starts Next.js and checks the health route with Playwright.
- `bun run foundation:verify` checks required foundation files, toolchain pins, and scope boundaries.
- `bun run verify` runs the default pre-handoff suite, including a production build.

The unit suite includes a Zustand store test to keep client state behavior explicit as the app grows.

## CI

The GitHub workflow in `.github/workflows/foundation.yml` installs proto, installs the pinned tools, installs Bun dependencies, and runs the verification suite.

## Adding Harnesses Later

Add focused harnesses when the behavior justifies them:

- Game-engine state transition tests.
- Realtime multi-client integration tests.
- Redis persistence tests with a containerized Redis service.
- AI bot simulations with deterministic fake models.
- Accessibility checks for game room UI.
- Visual regression tests for board, clue, and host surfaces.
