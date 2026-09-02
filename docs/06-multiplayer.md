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
| `src/lib/realtime/room-registry.ts` | Process-wide room table (on `globalThis`), room codes, idle sweeping |
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
- Rooms with nobody connected are swept after 30 minutes.

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

- `tests/unit/realtime/` covers the room, the registry and the director.
- `tests/unit/game/tick.test.ts` covers every time-driven transition.
- `tests/e2e/multiplayer.spec.ts` drives two real browser contexts against one
  server-side room: join by code, roster sync, chat, and a buzz crossing
  between clients.
