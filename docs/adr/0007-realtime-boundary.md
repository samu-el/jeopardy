# ADR 0007: Typed Realtime Boundary

## Status

Accepted.

## Decision

Define a transport-neutral realtime boundary before binding to Socket.IO or UI code. Client messages carry intent, not authority; the server-side adapter stamps each game command with the authenticated session's client id.

## Context

Multiplayer Jeopardy needs low-latency command handling, reconnects, and fair buzz timing. UI work should not depend on ad hoc socket strings or client-supplied actor ids.

## Consequences

- `src/lib/realtime/contracts.ts` owns typed client and server messages.
- `src/lib/realtime/in-memory-room.ts` provides a tested adapter for local harnesses.
- A future Socket.IO adapter should wrap the same contracts.
- Buzz timing uses the server clock.
- Reconnect requires an issued session token and replaces stale connections.
