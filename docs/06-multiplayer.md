# Multiplayer

Rooms are server-authoritative. A client sends intent; the server owns the
state, the clock and the roster, and every client renders whatever the room
publishes. Solo play runs the same room inside the browser tab, so the rules,
the timing and the bots behave identically whether one person is playing or
five.

## The pieces

| Module | Role |
| --- | --- |
| `src/lib/game` | Pure rules, including `tickGame()` for every time-driven transition |
| `src/lib/realtime/in-memory-room.ts` | The authoritative room: stamps the actor, applies commands, fans out public state and chat |
| `src/lib/realtime/room-director.ts` | Bots and the AI judge — reacts to published state, never to a transport |
| `src/lib/realtime/room-host.ts` | Room + director + the tick loop, plus show-paced timings |
| `src/lib/realtime/room-registry.ts` | Process-wide room table (on `globalThis`), room codes, idle eviction |
| `src/lib/realtime/room-store.ts` | Snapshot shape and the `RoomStore` interface (memory-only by default) |
| `src/lib/realtime/redis-room-store.ts` | Redis-backed persistence, server-only |
| `src/lib/realtime/socket-bridge.ts` | Socket.IO endpoint at `/api/socket` |
| `src/lib/runtime/local-room.ts` | Solo/pass-and-play: a `RoomHost` in the tab |
| `src/lib/runtime/network-room.ts` | Shared room: the same surface over a socket |

`RoomRuntime` (`src/lib/runtime/room-runtime.ts`) is the only thing components
know about, so no UI branches on transport.

## Authority

- Client commands carry **no actor id**. `commandFromClient()` stamps it from
  the socket session, so a client can only ever act as itself.
- The server holds private state: unrevealed clue text, unrevealed answers and
  wagers are stripped from every public snapshot (`tests/contracts/game/public-state-privacy.test.ts`).
- Only the host can start, load a board, judge, or remove a player. Hosting
  migrates to the longest-seated connected human if the host drops.

## The clock

Nothing in a room waits on a client. `RoomHost` ticks `tickGame()` four times
a second, which:

- opens and closes the ring-in window,
- ends an answer window that ran out,
- stakes a default wager on a lapsed Daily Double or Final Jeopardy,
- closes a finished clue after `autoAdvanceMs` and returns the board,
- rolls the round over and clears the round title card.

`tickGame()` returns the *same state object* when nothing is due, so an idle
room costs one comparison per tick and broadcasts nothing.

## Joining, leaving, reconnecting

- A room code is four unambiguous characters (`generateRoomCode`), shared as a
  code or an invite link (`?room=CODE`).
- Taking a seat is the `join-game` command, so the roster lives in the engine
  and reaches everyone through the normal state broadcast.
- Each browser keeps a stable player id (`src/lib/state/identity.ts`). Re-joining
  with it reclaims the same seat and score.
- Dropping **before** the game starts frees the seat; dropping **mid-game**
  keeps it (marked offline) so a refresh can reclaim it.
- Rooms with nobody connected are swept out of memory after 30 minutes. With
  Redis configured that is eviction, not deletion — the room comes back on the
  next join.

## Readout pacing

The buzzer opens when the clue has actually been read, not when a formula
says it should be. The room still carries a per-character estimate, but it is
only a fallback for a silent table: the client doing the reading holds the
window open while it speaks.

- Cues queue. "Math, for 200" is still being spoken when the estimate would
  have opened the buzzer, so both that cue and the clue itself push the
  deadline out through `extend-readout`.
- `readout-complete` brings it forward the moment the clue's own utterance
  ends — the buzzer opens on the voice stopping, not on a guess.
- `extend-readout` only ever moves the deadline later and is capped at
  `maxReadoutHoldMs` (60s), so a broken or hostile client cannot freeze the
  buzzer.
- Only the room host paces it: every client speaks at its own rate, and the
  window has to open once, at the same moment, for everyone.
- The director's scheduled bot work is scoped to the readout deadline, so a
  held buzzer reschedules their ring-ins instead of firing them early.

## Persistence

Set `REDIS_URL` and rooms survive a restart. Without it nothing changes:
rooms live in memory for the life of the process, which is fine for local
development and solo play.

A room writes itself through on every change, debounced to 400ms, plus an
immediate write when it is created (so a restart can't hand the same code out
twice) and a flush before it is evicted. The snapshot holds the authoritative
state, the chat, and which seats are bots, under `jeopardy:room:<CODE>` with a
24-hour TTL refreshed on every save.

Coming back:

- `getRoom()` is the synchronous in-memory lookup. `resolveRoom()` is the one
  to use: it falls back to the store, rebuilds the room, and de-duplicates
  concurrent restores so two clients arriving together get one room.
- Every human is marked disconnected on restore and flips back as their client
  reconnects; bots resume with the room.
- Deadlines that expired while the process was down are settled by the first
  tick, so a restored room continues rather than hanging on a dead clock.
- A snapshot from an older shape is discarded rather than hydrated.

Redis being unreachable costs durability, never the game: every store call
swallows its error and reports "not stored", and the startup line says which
mode you actually got (`rooms: redis` or `rooms: memory-only`).

**This is durability for one instance, not horizontal scale.** A room is
owned by whichever process holds it, and the socket layer has no cross-instance
fan-out, so running several app instances behind a load balancer would need a
Socket.IO Redis adapter and room ownership on top of what is here.

## Running it

Shared rooms need the custom server, which serves Next.js and the Socket.IO
bridge from one HTTP listener:

```powershell
bun run dev      # development, with the bridge attached
bun run start    # production, same server
```

`next dev` on its own (`bun run dev:next`) serves the app but **not** the
socket endpoint, so only solo play works there. The same applies to
serverless hosting: room state lives in the server process, so a platform that
runs each request in its own lambda can host solo play only.

## Testing

- `tests/unit/realtime/` covers the room, the registry, the director, and
  persistence — snapshot round-trips, restart recovery, eviction, concurrent
  restore, and store outages, plus the Redis adapter against a fake client.
- `tests/unit/realtime/redis-integration.test.ts` runs the same recovery
  against a real server when `REDIS_URL` is set, and skips itself when it
  isn't. CI provides one.
- `tests/unit/game/tick.test.ts` covers every time-driven transition.
- `tests/e2e/multiplayer.spec.ts` drives two real browser contexts against one
  server-side room: join by code, roster sync, chat, and a buzz crossing
  between clients.
