# ADR 0001: Toolchain

## Status

Accepted.

## Decision

Use proto to pin tools, Bun for package management and scripts, Next.js App Router for the app, strict TypeScript for implementation, Material UI for the component system, and Zustand for client state.

## Context

The rebuild should be easier for future agents to run consistently. The user specifically requested proto, Bun, Next.js, and Material UI. The upstream app uses Vite, React, Node, Hono, and Socket.IO.

## Consequences

- `.prototools` is the source of truth for Node and Bun versions.
- `bun.lock` should be committed after dependency installation.
- UI work should use Material UI primitives and the repo theme.
- Client state should use Zustand stores with typed selectors/actions.
- Future agents should avoid adding another task runner unless the repo becomes a true multi-package workspace.
