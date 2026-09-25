# Shared rooms UX audit (multi)

Scripts and screenshots are in `scratchpad/ux/multi/` (s1–s8). Every item below was reproduced in a real multi-context Playwright run against localhost:3000 and :8787, or read directly from the code.

---

**[P0] Host refresh loses the room, and the host chair never comes back**

- Where: `src/lib/state/game-store.ts` `startGame`/`connectToRoom` (the URL is never updated); `in-memory-room.ts` `disconnect` → `migrateRolesAwayFrom`; `room-flow.ts` `ensureHost`/`joinGame`.
- What's wrong: The host's address bar stays `/` after New Game, and nothing writes `?room=CODE`. On a refresh the host lands on the landing page. The room moves HOST/PICKS to a guest. If the host then types the code back in, they return as an ordinary player. There is no UI to hand the chair back (`configure-host` has no caller in components).
- Repro (s3): host New Game → guest joins → host reloads. The URL is `http://localhost:3000/` and New Game is shown. The guest sees `ALICE HOST PICKS`, `PLAYER 211 OFFLINE`. The host rejoins by code and is still not host.
- Suggested fix: `history.replaceState` to `?room=CODE` once the room connects, and auto-rejoin on load when the identity already holds a seat (skip the join card). Give the chair back to the original host when they reclaim their seat within a grace window, and add a "Make host" action in PlayersPanel.

**[P0] The 6s "offline fallback" silently abandons a live room (on a blip, or when a second tab opens)**

- Where: `src/lib/state/room-session.ts` `watchForRoomFallback`.
- What's wrong: The timer checks `status !== "connected"` once, 6s after start. It fires if a working room is momentarily `reconnecting`, or if the tab is `rejected` because another tab replaced it. The host tab then throws the room away and starts a local game labelled "Solo · not shareable — the rooms service could not be reached", which is false. Guests are left with an OFFLINE host forever.
- Repro (s7): host starts, a guest joins, and the host's socket drops about 5s in (WS proxied and closed). The host now sees only itself, with no banner. Alice sees `PLAYER D4C OFFLINE` and never recovers. s8: opening the display link in the same browser within 6s produces the same "Solo · not shareable" screen on the host.
- Suggested fix: Fall back only if the socket never reached `connected` (track a `everConnected` flag), and never after `rejected`. Show an explicit "Couldn't reach rooms — play offline?" choice instead of switching silently.

**[P0] A same-browser TV display takes over the host's seat and permanently renames the browser to "Display"**

- Where: `game-store.ts` `joinAsDisplay` (writes `lobby.hostName="Display"` and `hostSpectator=true` into the persisted lobby); identity is per-browser (`identity.ts`).
- What's wrong: `?room=CODE&display=1` in a second tab of the same browser joins with the host's player id. `join-game` on an existing seat flips it to a spectator named Display, the host tab gets replaced, and the host drops off the podium row for everyone. The change is also saved to localStorage, so every later game from that browser starts as spectator "Display".
- Repro (s8): host plus Alice, then the host opens a new tab at `/?room=CODE&display=1`. Alice sees only `ALICE $0`. localStorage `jeopardy.lobby.v2` has `"hostName":"Display"`.
- Suggested fix: Give a display its own ephemeral client id (e.g. `display-<uuid>` in sessionStorage), and don't write display name or spectator into the persisted lobby.

**[P1] A full room or a kicked player becomes a silent ghost with no message**

- Where: `room-session.ts` `join` (the socket is accepted before `join-game` is dispatched); `room-flow.ts` `joinGame` room-full refusal; PlayersPanel remove → `leave-game`; `room-host.ts` posts rejections to chat only.
- What's wrong: When the room is full (12, bots and spectators included), the joiner gets `session-accepted`. `join-game` is then refused, and the "This room is full." notice goes only to chat, which is off by default. The joiner sees the board with no seat, no buzzer and no banner. A kicked player likewise stays connected, loses their podium and buzzer, and gets no notice. On reload they can rejoin at once, so the kick doesn't stick.
- Repro (s4): host adds 11 bots and a guest joins. The guest sees 12 podiums, none of them theirs, and no "full" text anywhere. s2: host removes Alice. Alice sees only the host's podium, and the clue opens with no buzzer and no message.
- Suggested fix: Check capacity before accepting the socket and send `session-rejected` with "Room is full (12)". Send the target a targeted `removed` frame that closes the socket and shows "The host removed you", and optionally block rejoin for the session.

**[P1] "Rooms service unreachable" is reported as "That room is not open"**

- Where: `Landing.tsx` `joinRoom` (overwrites any failure with the not-open text); `game-store.ts` `joinOnlineRoom` (no timeout on the lookup fetch).
- What's wrong: A network or worker failure on the `/room/CODE` lookup shows "That room is not open. Ask the host for a fresh code…", which sends people to chase a new code during an outage. There is also no timeout, so a hung worker leaves the Join spinner running forever.
- Repro (s4): route `**/room/**` aborted → the join card says "That room is not open…".
- Suggested fix: Tell apart `{exists:false}` and a fetch error or timeout ("Can't reach the game server — try again"), add an AbortController timeout, and add a Retry button.

**[P1] TV display for a dead or unknown code shows "Connecting…" forever, with a QR code for it**

- Where: `DisplayView.tsx` (no ConnectionBanner and no error state); `AppShell` → `joinAsDisplay`.
- What's wrong: `joinOnlineRoom` returns false (`status: rejected`), but the display renders an empty board with "CONNECTING…" and a "PLAY ALONG QQQQ" QR code for a room that doesn't exist.
- Repro (s8-tv-badroom): `/?room=QQQQ&display=1`.
- Suggested fix: Render the rejected state in DisplayView ("Room QQQQ isn't open"), hide the join panel, and offer a code-entry field.

**[P1] Guest refresh (or invite-link revisit) forces the join card again instead of rejoining**

- Where: `AppShell.tsx` (`?room=` always goes to `setPendingRoomId`).
- What's wrong: The seat is held (OFFLINE) and the identity is stable, but a refreshing guest must click Join again. Until they do, the room shows them OFFLINE.
- Repro (s3): guest reloads → "Joining room" dialog, and the host sees `ALICE OFFLINE` until Join is clicked.
- Suggested fix: If this identity has already joined this code (remember it in sessionStorage), rejoin straight away.

**[P1] Guests see host-only lobby controls that silently do nothing, and the local list desyncs from the room**

- Where: `PlayersPanel.tsx` (bot add buttons, AI judge, Auto-advance, Solo practice shown to everyone); `room-session.ts` `add-bot` silently drops non-host requests; `game-store.ts` `addBot` adds to the local lobby first.
- What's wrong: A guest clicking "+ Rookie" sees "Rookie #1" appear in their Players panel. The room never gets it (not on the podiums on either side). The switches only change the guest's local lobby, and persisted bots from a guest's old solo games also appear in the list as if seated.
- Repro (s2): guest → More → Players → Rookie. The panel lists Rookie #1, and the host and guest podiums are unchanged.
- Suggested fix: In a network room, render the roster from `publicState` only. Gate bot and setting controls on `isRoomHost`, and show read-only values to guests.

**[P1] Clearing your name renames you "You" in the room, and the field can't be emptied**

- Where: `game-store.ts` `setHostName` (`name.trim() || "You"`, sends `set-player-profile` on every keystroke).
- What's wrong: Select-all plus Backspace in "Your name" turns the field into "You" and broadcasts it, so other players see a lectern labelled YOU. Every keystroke is a separate server broadcast.
- Repro (s2): guest clears the name → field value `You`, and the host podiums show `YOU $0`.
- Suggested fix: Keep the raw draft locally and commit on blur or Enter (debounced), falling back to `defaultPlayerName` rather than "You".

**[P1] "Home" (the wordmark) leaves the socket open, so you stay a connected ghost**

- Where: `RoomToolbar.tsx` wordmark `onClick={() => setScreen("landing")}`, compared with the Leave button, which calls `leaveOnlineRoom`.
- What's wrong: Clicking the logo goes to the landing page while the room still shows you connected and holding your seat (and the host chair, if you have it). There is no way back to the room from the landing page other than re-entering the code. Verified by code; not run in the browser.
- Suggested fix: Either treat Home as Leave (with a confirm), or show a "Return to room CODE" affordance on the landing page while `online` is set.

**[P1] Phone buzzer is a 22px-tall target pinned to the bottom edge**

- Where: `clue/PodiumClueButtons.tsx` (buzzer inside the podium); layout at 390×844.
- What's wrong: On a phone the BUZZ button measured 112×22 at y=810 of 844. It sits under the fold edge, next to the dev badge, and well below the 44px minimum touch target. On a phone the buzzer is the whole game.
- Repro (s5b): phone guest, host opens a clue → buzzer bounding box `{x:68,y:810,w:112,h:22}`.
- Suggested fix: At xs, render a large fixed-bottom buzzer (at least 64px, full width, safe-area aware), and/or make the clue card tappable to buzz.

**[P1] Intents queued while offline are replayed against newer state**

- Where: `socket-client.ts` `write()`, which queues up to 32 frames and replays them on reconnect.
- What's wrong: The board stays clickable while reconnecting (the host tile was `enabled` while offline, in s7). Picks or buzzes made during the outage fire late, against whatever state the room has moved to.
- Suggested fix: Don't queue game commands (only join, ping and chat), or drop queued commands older than about 1s. Disable board and buzzer while status is not `connected`.

**[P2] Replaced-tab banner offers "Play solo", which leads to an empty, unplayable default board**

- Where: `ConnectionBanner.tsx` (the rejected state's only action is `leaveOnlineRoom`).
- What's wrong: After "This room was opened in another tab.", the only button is "Play solo". It leaves you on a greyed 6×5 placeholder board with a disabled Begin (s8-alice-playsolo). The same button appears for every rejection.
- Suggested fix: Per-reason actions: "Use this tab here" (re-join), "Back to home", and "Try again" for not-open.

**[P2] Presence (joined/left/host changed/room full) lives only in chat, which is off by default**

- Where: `room-host.ts` narrates to chat; `preferences.chatEnabled=false`.
- What's wrong: With default settings nobody is told that someone joined, left, took over as host, or was refused. The only presence signals are OFFLINE opacity and the "N in room" count, which is hidden below md.
- Suggested fix: A small toast or snackbar for roster and host changes, independent of chat.

**[P2] No clear "you" marker on the podium row**

- Where: `Podium.tsx` (`isYou` only changes the edge colour, and only when no avatar colour is set).
- What's wrong: With three lecterns (s1-phone) there is no way to tell which one is yours.
- Suggested fix: A "YOU" tag in the badge row, or a distinct outline.

**[P2] The host is never asked for a name and appears as "Player 473"**

- Where: Landing New Game → `resolvePlayerName`.
- What's wrong: Guests are prompted for a name on the join card, but the host goes straight to a board as "PLAYER 473". Renaming means knowing to open More → Players.
- Suggested fix: An inline name field on the landing page or in the onboarding card, or an editable name plate on your own podium.

**[P2] A late buzz gets no feedback**

- Where: `use-clue-turn.ts` and `PodiumClueButtons` (no rejected-buzz state).
- What's wrong: In a simultaneous buzz (s5), the loser's button reverts to "BUZZ" with only the stage caption "PHOEBE RANG IN". There are no buzz timings or order. `latencyMs` and the RTT are measured but never used or shown.
- Suggested fix: Show "Phoebe was first (+42ms)" to the loser and a buzz-order list. Consider latency compensation, or at least display ping.

**[P2] The room code can collide with an existing room**

- Where: `game-store.ts` `startGame` → `generateRoomCode()` with `create: true`; `room-object.ts` `ensureRoom` returns the existing room when `create` is true.
- What's wrong: With 32^4 codes and rooms whose `created` flag never expires, a new game can land in a stranger's persisted room. Verified by code, not reproduced.
- Suggested fix: For a create request, reject if `created` is already set, and have the client retry with a new code.

**[P2] Results screen "Again"/"Lobby" buttons are no-ops for guests, and both do the same thing**

- Where: `Room.tsx` passes `exitToLobby` for both; for a guest, `resolveClues(lobby)` is empty or refused. Verified by code.
- Suggested fix: Hide them for non-hosts and show "Waiting for the host…"; make "Lobby" actually leave.

**[P2] Code input accepts 6 characters and spaces; Join is enabled at 3**

- Where: `Landing.tsx` (maxLength 6, `openJoinCard` at length 3 or more).
- What's wrong: Codes are 4 characters of an unambiguous alphabet, but the field takes "AD ZR", 0/O/1/I, and 3-character codes, so a round trip is needed to learn a code is wrong.
- Suggested fix: Normalise as the user types (strip spaces, map O→0? or reject), set maxLength 4, and enable Join at exactly 4.
