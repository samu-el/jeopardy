# ADR 0002: Pure Game Engine Boundary

## Status

Accepted.

## Decision

Build Jeopardy rules as a pure TypeScript game engine before attaching realtime, persistence, AI, or UI adapters.

## Context

The predecessor mixes room transport, persistence, timers, judging, and scoring in a single server room class. That worked for a compact app, but it is harder for multiple agents to extend safely.

## Consequences

- Game rules need state transition tests.
- React components should render public state and dispatch commands.
- AI bots must use the same command path as humans.
- Realtime and persistence adapters should be replaceable.
