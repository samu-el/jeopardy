# Architecture

> The picture: [`docs/diagrams/jeopardy-architecture.excalidraw`](diagrams/jeopardy-architecture.excalidraw)
> — open it at [excalidraw.com](https://excalidraw.com) (File → Open) to pan, zoom and edit.
> A rendered copy sits next to it as [`jeopardy-architecture.svg`](diagrams/jeopardy-architecture.svg).

---

## 1. The one rule

**The room decides.** A browser can ask for anything; the engine that answers
is the one on the server. Every buzz, wager, answer and ruling is a command
sent to a room, applied by a pure function, and broadcast back as state. No
client scores itself, and no client can open a clue that isn't open.

Everything below follows from that.

## 2. The layers

| Layer | Path | Knows about |
|---|---|---|
| Rules | `src/lib/game` | Nothing. No React, no socket, no clock, no audio. |
| Data | `src/lib/data` | The archive, CSV, published games → one clue shape. |
| Room | `src/lib/realtime` | Sessions, connections, chat, bots, persistence. |
| Transport | `src/lib/runtime` | One `RoomRuntime` interface over local or socket. |
| Client state | `src/lib/state` | Zustand: lobby, preferences, the live room. |
| UI | `src/components` | MUI, drawn from one token set. |
| Edge | `workers/rooms` | A Durable Object per room. |
| Web | `src/app` | App Router pages and the episode API. |

`bun run verify` enforces the top row: `scripts/verify-foundation.ts` fails the
build if a pure module ever imports React, Zustand, a socket, Redis, OpenAI or
Next.

## 3. The engine

`src/lib/game` is a state machine with one entry point:

```ts
dispatchGameCommand(state, command, { now }) -> { state, events }
```

Same state, same command, same clock → same answer, every time. That is what
makes the whole of it testable without a browser, and what lets the same code
run a solo game in a tab and a shared game in a Durable Object.

| Module | Answers |
|---|---|
| `engine.ts` | `createGame`, the command table, `dispatchGameCommand` |
| `rules.ts` | May they? Who picks? What is this wager worth? Is the round over? |
| `clue-flow.ts` | A clue from pick to ruling, plus the clock (`tickGame`) |
| `room-flow.ts` | Seats, roles, settings, the deck of clues |
| `projection.ts` | What a client is allowed to see |
| `board-layout.ts` | Which cell each clue belongs in |
| `contracts.ts` | The types, the round order, the round names |

### Dispatch is a table, not a switch

```ts
const handlers = {
  "pick-clue": pickClue,
  buzz,
  "submit-answer": submitAnswer,
  // …
};
```

Keyed by command type and checked against it, so adding a command is one line
and nothing can fall through to the wrong branch.

### Every handler has the same two moves

```ts
export function buzz(state, command, now) {
  const denied = refuse(state, command, [
    [active?.clueRevealed && !active.answerRevealed, "buzz-not-open", "Buzzing is not open."],
    [isActivePlayer(state, command.actorId), "not-active-player", "Actor is not an active player."],
    [now >= (active?.lockouts[command.actorId] ?? 0), "buzz-locked-out", "Buzzer is locked out."],
  ]);
  if (denied) return denied;

  return editClue(state, now, (clue, draft) => {
    clue.buzzes[command.actorId] = now;
    // …
    return [{ type: "buzz-accepted", /* … */ }];
  });
}
```

`refuse` reads the rules in order and returns the first one broken, as a
`command-rejected` event. `edit`/`editClue` copy the position, let the handler
rearrange the copy in place, and stamp it. The guard ladders and the
`clone`/`touch`/`activeClue!` boilerplate that used to open and close every
handler are gone.

### The clock

`tickGame` is the half of the engine nobody presses. Rooms call it on a timer:

- nobody wagered in time → stake the house minimum and read the clue
- nobody rang in → close the window, show the answer, mark it timed out
- the answer window ran out → time out whoever owes an answer, reveal
- everyone who owes an answer has sent one → reveal at once, no dead air
- a clue has been ruled on and sat idle → clear it, and roll the round over

It returns the identical state object when nothing is due, so a room can skip
the broadcast with a reference check.

### A clue's life

```
Board open ──pick-clue──▶ Reading ──readout ends──▶ Buzzer open ──buzz──▶ Answering
     │                                                                        │
     └──pick-clue (Daily Double)──▶ Wager open ──submit-wager──▶ Reading       │
                                                                              ▼
Clue closed ◀──skip── Judging ◀──judge-answer── Answer up ◀──submit-answer / clock
                         │
                         └── wrong, and time left → the buzzer reopens for everyone else
```

## 4. The room

`RoomHost` (`src/lib/realtime/room-host.ts`) owns a `GameState`, a tick timer,
a debounced persist, and a `RoomDirector` that decides when bots ring in and
when the fuzzy judge scores an answer. `InMemoryRealtimeRoom` underneath it
holds sessions, connections and chat, and is where a command from the wire
turns into an engine call.

Two things run that host:

- **`LocalRoomRuntime`** — solo and pass-and-play, in your own tab.
- **`NetworkRoomRuntime`** — a WebSocket to a Durable Object.

Both satisfy `RoomRuntime`, so no component branches on transport.

### Seats

- A dropped socket keeps your seat and score until you come back.
- Leaving on purpose hands the seat back (`leave-game`).
- The host chair always belongs to somebody actually in the room — see
  `ensureHost` in `room-flow.ts`. A room restored from storage comes back with
  its old host recorded and nobody connected; the next person through the door
  takes the chair rather than finding a board they cannot touch.
- A contestant is preferred over a spectator: a television that joined to watch
  never ends up running the board.

### Commands on the wire

`ClientGameCommand` is derived from `GameCommand`, not restated:

```ts
type WithoutActor<T> = T extends unknown ? Omit<T, "actorId"> : never;
export type ClientGameCommand = WithoutActor<Exclude<GameCommand, { type: "tick" }>>;
```

and `commandFromClient` is `{ ...command, actorId: clientId }` — `actorId`
written last, so whatever a client claims to be, the room decides who it is
speaking as.

## 5. The data

```
j-archive JSON.gz ──▶ archive-source ──▶ normalize ──▶ GameClue[] ──▶ load-game
CSV / builder     ──────────────────────▶ normalize ──┘
published game    ──────────────────────▶ normalize ──┘
```

Everything the app can play becomes `GameClue[]`, so the engine has exactly one
shape to think about. Archived rounds are often short — a 1989 game that ran out
of time is missing the bottom of a category — so `board-layout.ts` places a clue
in the row its *value* names and draws an empty blue cell where the archive has
none. 2,408 of the archive's 18,824 rounds used to render with a hole in them.

## 6. The client

`src/lib/state/game-store.ts` is the Zustand store: lobby, preferences, screen,
and the live room. `room-session.ts` beside it owns the network plumbing —
opening a room, the local fallback when the rooms service can't be reached,
and `dealBoard`, the one place that loads a board, applies the room's settings,
seats the bots and starts.

UI is `src/components`. Of note:

- **`Board`** — a grid of one `Cell`. A category strip, a value you can press,
  a square the archive never had, and the ghost board before a game is dealt
  are the same blue rectangle with different text.
- **`ClueStage`** / **`TvClue`** — the clue on a laptop panel and on a
  television, both sized by `clueScale` so a long clue steps down the way the
  show sets one.
- **`ClueControls`** — the clock housing, the answer field, the wager bench;
  `clue/PodiumClueButtons` puts BUZZ and REVEAL on your own lectern, and
  `clue/JudgeBench` is the host's ruling row.
- **`DisplayView`** — TV mode: the same room, board only, no lecterns.

## 7. The look

`src/lib/foundation/jeopardy-style.ts` holds three things:

- **the set** — `jeopardyPalette`, `jeopardyFonts`: the board's own blue, gold
  and faces, which nothing else may touch;
- **the studio** — `ui.*`: stage, surface, line, ink, blue, gold;
- **the controls** — `controls.*`: housing, readout, key, keyPrimary, buzzer,
  keyOff — the physical language every button and field outside the board uses.

plus the recipes every screen shares: `displayType()`, `clueType()`,
`clueScale()`. `theme.ts` is a thin MUI wrapper over the same tokens, so a MUI
component and a hand-drawn one land on the same colour without either knowing
about the other.

## 8. Tests

| Kind | Where | What it pins |
|---|---|---|
| Unit | `tests/unit` | The engine, the rooms, the bots, the data |
| Contract | `tests/contracts` | Privacy of the public state, the layering |
| E2E | `tests/e2e` | Two browsers in one room, against a real Durable Object |

`bun run verify` runs typecheck (app and worker), lint, unit tests, the build
and the layering check. `bun run test:e2e` drives the full suite through
Playwright with both servers up.
