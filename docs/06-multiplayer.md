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
| `src/lib/realtime/room-session.ts` | One connected client: join, commands, chat — no transport in it |
| `src/lib/realtime/ws-protocol.ts` | The JSON frames on the wire, and how to parse them safely |
| `src/lib/realtime/room-code.ts` | Room codes, shared by the browser and the Worker |
| `src/lib/realtime/room-store.ts` | The snapshot shape a room is rebuilt from |
| `workers/rooms/index.ts` | The Worker: turns a room code into its Durable Object |
| `workers/rooms/room-object.ts` | `RoomDurableObject` — the room itself, plus its storage |
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

- **Every board is a shared room.** Starting a game mints a code and opens the
  object before the first clue, so there is no "make this shareable" step to
  find and nobody has to decide up front whether friends are joining. Solo
  play is simply a room with one person in it.
- The code is four unambiguous characters (`generateRoomCode`), shared as a
  code or an invite link (`?room=CODE`). The room strip shows it masked and
  reveals on request: a code on screen is a code anyone watching can join
  with, and boards get screen-shared.
- If the rooms service can't be reached within `roomConnectGraceMs`, the same
  board reopens locally and the strip says "Solo — not shareable". An outage
  costs sharing, not the game.
- Taking a seat is the `join-game` command, so the roster lives in the engine
  and reaches everyone through the normal state broadcast.
- Each browser keeps a stable player id (`src/lib/state/identity.ts`). Re-joining
  with it reclaims the same seat and score.
- Dropping **before** the game starts frees the seat; dropping **mid-game**
  keeps it (marked offline) so a refresh can reclaim it.
- A room nobody is connected to is evicted from memory by Cloudflare. That is
  eviction, not deletion: the snapshot stays, and the room comes back on the
  next join.

## Display mode

`?room=CODE&display=1` opens the room on a television. The display connects
on its own — a TV should show the board, not a form — and joins as a
**spectator**: no seat, no buzzer, no commands. The people playing keep their
phones, and the board is the thing everyone looks at.

It shows the code plainly, next to a QR that joins the room in one scan.
That is the opposite of the player view, which masks the code: a display
exists to be read by the room it is standing in.

Spectators are filtered out of the podium row. A lectern for someone with no
score and no buzzer is an empty seat on the set — which is what a display
would otherwise look like.

## Readout pacing

The buzzer opens when the clue has actually been read, not when a formula
says it should be. The room still carries a per-character estimate, but it is
only a fallback for a silent table: the client doing the reading holds the
window open while it speaks.

- Cues queue. "Math, for 200" is still being spoken when the estimate would
  have opened the buzzer, so both that cue and the clue itself push the
  deadline out through `extend-readout` — from the moment they are handed to
  the voice, not from when it reaches them. A queued cue is held for a short
  grace only, because a browser with no installed voices accepts `speak()`
  and then says nothing at all; the full estimate goes on once it starts.
- Picking a clue drops whatever the host was still saying. The category
  rundown is long, and a pick made during it would otherwise leave the clue
  queued behind it. The interrupt fires only when the pick cue really is
  about to speak: the UI replays the same event batch on every published
  state, and cancelling on a replay would cut the clue off mid-sentence.
- `readout-complete` brings it forward the moment the clue's own utterance
  ends — the buzzer opens on the voice stopping, not on a guess.
- `extend-readout` only ever moves the deadline later and is capped at
  `maxReadoutHoldMs` (60s), so a broken or hostile client cannot freeze the
  buzzer.
- Only the room host paces it: every client speaks at its own rate, and the
  window has to open once, at the same moment, for everyone.
- The director's scheduled bot work is scoped to the readout deadline, so a
  held buzzer reschedules their ring-ins instead of firing them early.

## Where a room runs

A room is a **Cloudflare Durable Object**, one per room code.

That is not a deployment detail — it is the reason shared rooms work at all.
A room needs a process that stays alive between requests: it holds the board,
it owns the clock, and it keeps a socket open per player. A serverless
function has none of those, so the app's own host (Vercel) can serve the UI
and the episode archive but cannot hold a room.

```
Vercel (Next.js)              Cloudflare Worker (free plan)
────────────────              ─────────────────────────────
UI, /api/episodes    ──ws──►  jeopardy-rooms
/api/health                     └─ RoomDurableObject per code
                                     ├─ InMemoryRealtimeRoom + RoomHost
                                     └─ ctx.storage  (the snapshot)
```

Cloudflare routes every client that names the same code to the same object,
which is why `idFromName(code)` replaced the process-wide room registry, the
Redis store and the idle-eviction sweep all at once:

- **Finding a room** is `idFromName(CODE)`. There is no table to look in.
- **Persistence** is `ctx.storage`. The room writes its snapshot on create,
  on every change (debounced 400ms), and once more when the last player
  leaves.
- **Eviction** is Cloudflare's. An object nobody is connected to is dropped
  from memory and costs nothing; the next join restores it from the snapshot.
- **Existence** is a stored flag, so joining a code nobody has opened is
  "that room does not exist" rather than a blank board.

A room that has never been opened has no object, no storage and no cost.

## Running it

```powershell
bun run dev         # the app, on :3000
bun run rooms:dev   # the rooms Worker, on :8787
```

Point the app at the Worker with `NEXT_PUBLIC_ROOMS_URL` (`.env.example` has
both the local and deployed shapes). Solo play needs neither — it runs the
same `RoomHost` inside the browser tab.

Deploying the rooms:

```powershell
bun run rooms:deploy
```

The first deploy asks you to log in and creates `jeopardy-rooms` on the
Workers free plan. Then set `NEXT_PUBLIC_ROOMS_URL` on Vercel to the
`wss://jeopardy-rooms.<subdomain>.workers.dev` address and redeploy.

Or connect the repo in the Cloudflare dashboard (Workers & Pages → Import a
repository) with the root directory set to `workers/rooms`, which redeploys
on every push to `main`.

Set `ALLOWED_ORIGINS` on the Worker to the app's origin so only it can open
rooms. It lives in the dashboard rather than in this file because it differs
per deployment; `keep_vars` is what stops the next deploy wiping it. Losing
it is worse than an outage — the check falls open and nothing looks wrong.

Durable Objects are on the Workers free plan (SQLite-backed ones, which is
what this uses), so none of this needs a paid plan or a card on file.

## Testing

- `tests/unit/realtime/` covers the room, the director, room codes and the
  snapshot round-trip.
- `tests/unit/game/tick.test.ts` covers every time-driven transition.
- `tests/e2e/multiplayer.spec.ts` drives two real browser contexts against a
  **real Durable Object** — Playwright starts `wrangler dev` alongside Next,
  so join-by-code, roster sync, chat and a cross-client buzz are exercised
  against the same runtime that serves production.
