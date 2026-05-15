# ADR 0004: Zustand Client State

## Status

Accepted.

## Decision

Use Zustand for client-side state management.

## Context

The app will need responsive local UI state, preferences, connection status, and cached public room snapshots. These concerns should be ergonomic in React without turning React components into game-rule owners.

## Consequences

- Zustand stores may hold local UI/session state and public server-approved snapshots.
- Zustand stores must not hold authoritative game rules, private answer keys, private wagers, or host authorization.
- Pure game modules remain the rule source and should be tested independently.
- Store selectors should be narrow so high-frequency realtime updates do not rerender the entire app.
