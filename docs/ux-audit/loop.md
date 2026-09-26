# UX audit — solo core game loop

Method: I played live rooms against Casual + Champion bots at 1440x900 and 390x844, using Playwright scripts in `scratchpad/ux/loop/` (logs `desk.log`, `phone.log`, `phone2.log`; screenshots `*.png`). I checked the engine directly with `scratchpad/ux/loop/engine.test.ts`. The desktop run was stopped at clue ~25 of the Jeopardy round, so Double Jeopardy, Final and Results were checked from code only.

## P0

**[P0] Correct response is shown to everyone before the rebound buzz**

- Where: `src/lib/game/clue-flow.ts:318-326` (submitAnswer calls revealAnswer), `:450-460` (judgeAnswer reopens the buzzer).
- What: When the one player who rang in submits, the engine reveals the answer at once, and `correctResponse` is sent to every client. If the answer is then judged wrong, the clue sets `answerRevealed=false` and reopens buzzing. Everyone left has already seen the answer.
- Repro: In the live run (desk.log, first run, 56.2s), Champion answered "Noh" and the stage showed "NOH DRAMA". It was ruled wrong, buzzing reopened, and I rang in and typed the answer I had just seen. Engine script output: "after B submits: correctResponse visible to all = ANS1 … A buzzed (already saw answer): true".
- Fix: Split "answers in" from "response revealed". When the owed answers arrive, go to a judging phase where the host sees the expected answer and the table does not. Project `correctResponse` only once the clue is final: correct, no one left, or time out.

**[P0] Phone: the BUZZ button starts below the fold, and can land there again during play**

- Where: `src/components/GameSurface.tsx:220-255` (podium row wraps), `src/lib/game/projection.ts:31-33` (players sorted by score, then name), ClueStage height on xs.
- What: At 390x844 the clue panel takes about 560px, and three 130px podiums wrap to two rows. Your podium, which holds the BUZZ key, goes wherever the score sort puts it. At 0-0-0, "Player XXX" sorts after "Casual"/"Champion", so the buzzer sits at y=989 on an 844px viewport. It is fully off-screen on the first clue.
- Repro: phone2.log shows "buzzer y 989 … viewport 844 rank 2". Screenshot: `phone-last-place-buzzer.png`.
- Fix: Pin the self podium or buzzer: put it first, or add a sticky bottom buzz bar on xs. Also shrink the clue panel on phones to fit its content.

## P1

**[P1] A misjudge cannot be overridden or undone**

- Where: `src/lib/realtime/room-director.ts:273-288` (AI judge fires after 900 ms, even with a human host seated). `clue-flow.ts:380-391` rejects a second ruling with "already-judged". The engine has an `undo` command (`room-flow.ts:61`), but no component sends it (grep finds no `type: "undo"` under src/components). JudgeBench (`ClueControls.tsx:241`) stays mounted with live Correct/Incorrect keys after the ruling.
- What: AI judge is on by default (`game-store.ts:197`). It rules before the host can read the bench. The fuzzy matcher then rejects accepted short forms: "Noh" vs "Noh drama" scores 0.767, under the 0.78 cutoff, and cost the bot $200. Pressing Correct afterwards does nothing and gives no message; the rejection is not surfaced (`room-host.ts:254`).
- Repro: desk.log (first run) 56.2 → 57.0s ruled incorrect. My MANUAL JUDGE clicks at 42.5s and 43.1s after the ruling had no effect.
- Fix: Add a host "Undo / Reverse ruling" action, plus per-player score adjust, wired to `undo`. Take the snapshot before each judge-answer, not only at reveal. When a human host is seated, have the AI suggest a ruling with a countdown instead of applying it. Disable or hide the bench keys once `judges[target]` is set.

**[P1] Other players get an answer box on someone else's Daily Double**

- Where: `src/components/ClueControls.tsx:118-123`: `answerOpen = … (buzzedByMe || clue.dailyDouble)`.
- What: When a bot finds a DD, every player's clock housing shows an autofocused "What is…" field. Submitting is silently refused (the server requires `buzzes[me]`), and the field just clears.
- Repro: Screenshots `desk-dd-clue-jeopardy.png` and `desk-foreign-dd-after-submit.png`. The log shows "submitted on foreign DD; field still visible? true".
- Fix: Use `clue.dailyDoublePlayerId === currentClientId` instead of `clue.dailyDouble`.

**[P1] A wrong Daily Double answer reopens a "Ring in" window nobody can use**

- Where: `clue-flow.ts:450-460`. `reopens` does not exclude `dailyDoublePlayerId`.
- What: After a wrong DD ruling inside the answer window, the engine hides the response again and starts a 6 s buzz window. `canBuzz` is false for DDs, so the table sits through 6 s of "RING IN" with no buzzer. The tick then re-reveals the answer and posts "No takers."
- Repro: Engine script output: "DD after wrong: correctResponse undefined canAdvance false buzzWindowEndsAt-now 6000 canBuzz false".
- Fix: Add `!clue.dailyDoublePlayerId` to `reopens`.

**[P1] Whether others get a rebound depends on how fast the host judges**

- Where: `clue-flow.ts:450-455` (`now <= clue.answerWindowEndsAt`).
- What: Rebound buzzing only reopens if the ruling lands inside the original answer window, which is 10 s from the buzz. A host who takes a few seconds to rule, or a player who times out, means nobody else gets a chance at the clue.
- Repro: Engine script output: "slow judge wrong: reopened? false canAdvance true".
- Fix: Base the reopen decision on the remaining players, not on wall-clock time since the buzz.

**[P1] Podiums reorder on every score change, mid-clue**

- Where: `projection.ts:31-33` sorts by score, and GameSurface renders in that order.
- What: Lecterns jump sideways the moment a ruling lands, which is while you're still reading it. Compare `desk-judge-bench.png` with `desk-can-advance.png`: Champion moves from the middle to the left. On a phone this also moves your own BUZZ key between rows (see the P0 above).
- Fix: Keep seat order stable (join order) on the podium row, and sort only in the results/scoreboard views.

**[P1] Results "Again" and "Lobby" do the same thing**

- Where: `src/components/Room.tsx:67` passes `exitToLobby` to both `onPlayAgain` and `onExit`. `ResultsView.tsx:81-96`.
- What: In a shared room both reload the same episode (load-game), so "Lobby" doesn't reach the lobby and "Again" replays the same clues. Verified from code only: the run did not reach the results screen.
- Fix: "Again" should deal a new random episode. "Lobby" or "Home" should call `setScreen("landing")` or `leaveOnlineRoom`.

## P2

**[P2] The clock says "X rang in" in Final Jeopardy and on Daily Doubles**

- Where: `use-clue-turn.ts:171-178`. `revealActiveClue` fills `buzzes` for everyone owed, so `someoneBuzzed` is true.
- What: In Final, the label shows the first player's name + "rang in" while everyone is writing. On a DD it shows "<picker> rang in". Verified from code; I saw the DD case in the log as "BZ" with the answer field showing.
- Fix: Use "Final answer" / "Daily Double · <name>" labels when `isFinal || dailyDouble`.

**[P2] Red "wrong" light never shows on the podium in normal rounds**

- Where: `Podium.tsx:53-72, 224`. The light draws only while `isBuzzed`, but judgeAnswer deletes `buzzes[target]` on a wrong ruling (`clue-flow.ts:432-437`).
- What: The incorrect colour branch is unreachable outside Final. The only feedback for a wrong answer is a brief score flash.
- Fix: Drive the light from `judges[player.id] !== undefined || isBuzzed`.

**[P2] Countdown lamps are fully lit while the buzzer is still locked ("Reading…")**

- Where: `use-clue-turn.ts:152-158`: `inReadout ? 1`.
- What: Five gold lamps say "go" during the lock, and ringing in then costs an early-buzz lockout. The DD and phone screenshots show "READING…" with all lamps lit. On a rebound, the fraction is computed against `readoutEndsAt` from the first window, so the lamps start partly out.
- Fix: Keep the lamps dark during readout and light them when buzzing opens. After a reopen, use the reopen time as the start of the window.

**[P2] JudgeBench confidence % reads backwards**

- Where: `clue/JudgeBench.tsx:57-66`.
- What: "77%" in red means "77% similar, ruled wrong". "— 100%" in red for an empty answer means 100% sure it's wrong. The number and colour contradict each other (`phone-judge-bench.png`).
- Fix: Show a verdict word ("Looks right" / "Looks wrong") with confidence, or show the similarity without the verdict colour.

**[P2] The host can pick when a bot has the board, and nothing shows that this is an override**

- Where: `GameSurface.tsx:121-128` (`canPick` is true for the host) and `rules.ts:191`.
- What: In solo play the board stays clickable during a bot's turn, and "PICKS" on the bot's lectern contradicts that. The first click wins the race against the bot's 0.7–1.9 s pick delay.
- Fix: Only the picker gets pickable tiles. If host override is wanted, gate it behind a modifier and label it.

**[P2] Every round opens with the host player, not the lowest score**

- Where: `rules.ts:209-218` (`selectPicker`).
- What: A seated host always opens Double Jeopardy. On the show the trailing player picks first. Verified from code.
- Fix: Use the lowest-score rule when `round !== first round`, or always.

**[P2] "True Daily Double" quick-pick is wrong when your score is under the round maximum**

- Where: `ClueControls.tsx:227-235`. It sets `wagerLimits.max = max(score, 1000/2000)`.
- What: With $200 it offers $1000, which is the house maximum and not "everything you have".
- Fix: Label it "Max" when score < floor, or set it to the score.

**[P2] A Daily Double wager is hidden from the table until the reveal**

- Where: `projection.ts:81` (wagers are projected only after `answerRevealed`) and `ClueStage.tsx:40`.
- What: The headline reads "DAILY DOUBLE" with no amount while the clue is played (`desk-foreign-dd-after-submit.png`). The show announces the wager.
- Fix: Project the DD wager once it is submitted. Keep Final wagers hidden.

**[P2] The buzzer steals focus whenever buzzing opens**

- Where: `clue/PodiumClueButtons.tsx:29-33`.
- What: `focus()` runs every time `canBuzz` flips, even if the user is typing in chat or a settings field. The foreign-DD answer field also autofocuses. Verified from code.
- Fix: Only focus when `document.activeElement` is `body` or already inside the game surface.

**[P2] No "time's up" or auto-advance cue**

- Where: ClueStage/ClueControls. No component reads `timedOut` or `closesAt`.
- What: When nobody rings in, the lamps vanish and the answer appears with nothing saying time ran out. The 3.5 s auto-advance has no indicator.
- Fix: Show "Time's up" when `timedOut` is set, and a small countdown on "Next clue".
