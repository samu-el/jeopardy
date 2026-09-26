# UX audit: TV/display, Final Jeopardy, Results, Podium, theme

Method: I played real games against the running app (fixture board, 4 clues plus Final) with Playwright. Runs covered a solo host, a host plus a phone guest at 390x844, and TV displays at 1920x1080 and 1280x720. Scripts and screenshots are in `ux/display/` (play.mjs, play2.mjs, play3.mjs, \*.png).

## P0

**[P0] A TV display takes the win on the results screen, and every display is listed as a contestant**

- Where: `src/components/ResultsView.tsx` (`sorted = [...state.players]`), rendered from `Room.tsx`.
- What's wrong: ResultsView never filters out `player.spectator`. Each `?display=1` tab joins as a spectator called "Display" with $0. It then shows up in the standings and the stat cards. When every real player finishes below $0, **"DISPLAY" is crowned the winner** with $0.
- Repro: host plus guest plus one TV (`/?room=CODE&display=1`). Both players end negative. The results header reads "DISPLAY $0" (screenshot `g-results.png`). With two displays, both appear in rows 2 and 3 (`host-results.png`).
- Suggested fix: filter `!p.spectator` before sorting, the same way GameSurface already does. Decide the winner only from contestants. Add an e2e assertion.

**[P0] The TV shows an empty ghost board when the game ends: no winner, no scores**

- Where: `DisplayView.tsx` always renders `<GameSurface tv />`. `Room.tsx` is the only place that switches to `ResultsView` when `round === "complete"`.
- What's wrong: when the game completes, the television falls back to a blank 6x5 placeholder board with dimmed $200–$1000 values. The whole room is watching that screen at the climax and it shows nothing. The same happens when the host opens TV mode from the results screen.
- Repro: play to the end with a display attached. See `tv-results-1080.png` and `r3-tv-results.png`.
- Suggested fix: add a TV results layout to DisplayView for `round === "complete"`: winner, final standings and the Final Jeopardy wagers, sized for a room. Use the same filtered contestant list.

## P1

**[P1] Final Jeopardy on the TV says "Daily Double — waiting for the wager" and "$0"**

- Where: `TvClue.tsx`. `waiting` always renders the Daily Double copy, and the header is always `${category} · $${value}`.
- What's wrong: while Final wagers are being placed, the TV shows "DAILY DOUBLE — WAITING FOR THE WAGER" under "PROGRAMMING · $0". It never says "Final Jeopardy".
- Repro: reach Final with a display attached. See `tv-final-wager-1080.png`.
- Suggested fix: branch on `clue.round === "final-jeopardy"`. Headline "FINAL JEOPARDY!", the category in large type, "Contestants are wagering…" (or who is still wagering), and no value.

**[P1] Final Jeopardy reveal never shows anyone's answer or wager**

- Where: `ClueStage.tsx`, `TvClue.tsx` and `Podium.tsx`. The only reader of `clue.answers` and `clue.wagers` is the host-only `JudgeBench`.
- What's wrong: the projection makes answers and wagers public after the reveal (`projection.ts:80-81`), but no component shows them to players or the TV. The AI judge rules at once and the scores just jump. The upstream-style drama of revealing each podium's answer, then its wager, then the new score is missing. A guest's wrong answer ("Python") is never shown.
- Repro: two players submit Final answers and the reveal shows only "GO" (`h2-final-reveal.png`, `g-final-reveal.png`, `tv2-final-reveal.png`).
- Suggested fix: a pure reveal sequence (ordered lowest to highest score) driven by public state. Show answer, verdict and wager on each Podium or on a TV reveal card, stepped by the host or auto-advanced.

**[P1] The Final Jeopardy clue panel is a narrow portrait card and its headline wraps**

- Where: `Board.tsx` and `board/BoardFrame.tsx`. `boardRatio(columns, rows)` for the Final round is 1 column by 1 row, giving a ratio of about 0.89. The clue overlay inherits that frame.
- What's wrong: at 1280x720 the Final clue sits in a 340px-wide card. "FINAL JEOPARDY!" wraps onto two lines and collides with the category (`host-final-wager.png`). On a 1920 TV it is a 938px portrait slab with black bars (`tv-final-clue-1080.png`). This happens with every game, not only the fixture.
- Suggested fix: use the standard board ratio (6 by 5) for the frame whenever a clue is open or the round is Final, or give Final its own full-width frame.

**[P1] "Again" and "Lobby" do the same thing, and neither works for a non-host**

- Where: `Room.tsx` passes `onPlayAgain={exitToLobby} onExit={exitToLobby}`. `game-store.ts exitToLobby` sends `load-game` as `lobby.hostId`.
- What's wrong: for the host, both buttons reload the same board into the lobby. For a guest, clicking "Again" does nothing: the state stays `complete` (verified). The guest's local `lobby.hostId` is not the room host, so the command is refused or does nothing, and there is no feedback. Neither button gives a real "new game" (new board) or "back to landing".
- Repro: `play2.mjs`, where the guest clicks Again and the state is still `complete`.
- Suggested fix: separate actions. Play again with the same players and a fresh board for the host. For guests, show "Waiting for host…" or a disabled button with an explanation. Leave to landing. Hide host-only actions from non-hosts.

**[P1] Replay, Transcript, Shortcuts and Builder do nothing on the results screen**

- Where: in `Room.tsx`, the results branch renders the `toolbar` (whose More menu offers "Replay last game", "Transcript", "Shortcuts" and the builder) but mounts only `<GamePicker>`. `ReplayView`, `TranscriptPane`, `ShortcutsOverlay` and `CustomGameBuilder` are not in that branch, and the `?` shortcut toggles state nothing renders.
- What's wrong: "Replay last game" is most useful right after a game, and it silently does nothing there. Verified: 0 dialogs open after clicking it.
- Suggested fix: mount the same dialogs in both branches, for example by hoisting them out of the conditional.

**[P1] The winner's rank badge is invisible and the stat-card score chips can't be read**

- Where: `ResultsView.tsx`, where the rank circle uses `background: "secondary.main"`. The sx `background` key does not resolve palette paths, so the circle ends up with no fill and dark `#1A1200` text on a dark surface. The stat chips use `<Chip color="secondary">`, but the theme's `MuiChip.root.backgroundColor: ui.surfaceRaised` overrides the gold fill, again leaving dark text on navy.
- What's wrong: the "1" beside the winner can't be seen, and "$800" or "$0" in the chips is unreadable (`host-results.png`). Negative chips are readable only because the error palette's text is white.
- Suggested fix: use `bgcolor: "secondary.main"`. Remove `backgroundColor` from the Chip root override, or scope it to `colorDefault`.

**[P1] The TV join panel covers the board's bottom-left tile**

- Where: `DisplayView.tsx JoinPanel`, `position: fixed; bottom: 16; left: 16`.
- What's wrong: at 1920x1080 with a 6-column board, the panel sits on top of the $1000 tile in the first category (`tv-results-1080.png`). At 1280x720 it covers half of the $400 tile (`tv-board-720.png`). The code comment assumes the margin is at the bottom, but `--board-fill-height: calc(100dvh - 24px)` means there is none.
- Suggested fix: reserve a strip for the panel (reduce `--board-fill-height` while it is shown), or dock it in the side letterbox. Alternatively, auto-hide it once the first clue is picked.

**[P1] The TV plays no Final Jeopardy think music and no Daily Double sting, and shows no Final countdown**

- Where: `useFinalTheme` and `useDailyDoubleSplash` live only in `ClueStage.tsx`. In TV mode `GameSurface` renders `TvClue` instead, so neither hook runs.
- What's wrong: the DisplayView comment says "The screen with the speakers should be the one doing the talking". In practice the TV is silent at the two signature moments and shows no 30s clock or Daily Double splash.
- Suggested fix: move both hooks into GameSurface or a shared hook used by TvClue. Render `DailyDoubleSplash` and a minimal Final countdown on TvClue.

**[P1] TV category and header text is too small to read from across a room**

- Where: `BoardFrame.categoryFontSize` is capped at 18px. The TvClue header is `clamp(11px,1.4cqw,22px)`. The dimmed question after the reveal is `clamp(12px,1.8cqw,30px)` at 55% opacity.
- What's wrong: on a 1920x1080 TV, category names render at about 18px ("MATH", "COLORS" in `tv-board-1080.png`), and "MATH · $200" above a clue is about 20px in 55% white. Neither is legible from a sofa. Values meanwhile reach 46px or more.
- Suggested fix: raise the caps in fill/TV mode (categories around 3–4vh, header 28–36px) and lift opacity to at least 0.75.

## P2

**[P2] Negative scores are formatted "$-400" in Results but "-$400" everywhere else**

- Where: the ResultsView row score and stat-card chip (`${player.score}`). Podium and the results header use `-$`.
- Suggested fix: add one shared `formatMoney()` in `foundation` and use it everywhere, including wager limits.

**[P2] Results stat labels are cryptic glyphs, and a lone stat card stretches the full width**

- Where: `ResultsView.tsx` StatLine labels "✓", "✗", "1st", "DD", "ms". The grid uses `repeat(min(n,4))`.
- What's wrong: screen readers read "check mark" or "ballot x", and "ms" is meaningless without units or context. With one player the card spans 1600px, with labels about 1300px away from their values (`r3-results-1080.png`).
- Suggested fix: use labels such as "Correct", "Incorrect", "First to buzz", "Daily Doubles", "Avg reaction (ms)". Cap card width (`minmax(0, 360px)`) and centre the cards.

**[P2] No tie handling on the results screen**

- Where: ResultsView `winner = sorted[0]`.
- What's wrong: with tied players, only whoever sorts first gets the trophy and the gold row.
- Suggested fix: compute all top scorers and render "Tie: A & B". Give tied rows the same rank.

**[P2] Players at $0 or below still get a Final wager bench**

- Where: `ClueControls` wager bench and `rules.ts` Final `waitingForWager = getActivePlayers`.
- What's wrong: a negative-score player sees "FINAL WAGER · $0–$0" and an "EVERYTHING" button, and the room waits up to 30s on them (`g-final-wager.png`).
- Suggested fix: skip wager collection for players at $0 or below, or auto-submit 0. Show "Not eligible for a wager".

**[P2] Over-limit wagers are clamped silently**

- Where: `ClueControls.handleSubmitWager` sends the raw number, and the server `clampWager` clamps it.
- What's wrong: typing 500 with a $400 limit is accepted as $400 with no message. The player only learns when their score moves.
- Suggested fix: validate against `turn.wagerLimits` on the client and show an inline error, or echo the placed wager ("Wager locked: $400").

**[P2] On a phone the correct response is smaller than the clue**

- Where: `ClueStage.tsx`, correct-response `clamp(16px, 2.4vw, 34px)`.
- What's wrong: at 390px, "GO" renders at 16px under an 18px clue (`g-final-reveal.png`). The TV does the opposite, making the answer dominant.
- Suggested fix: size it from `cqw`, like the clue, and make it at least as large as the clue.

**[P2] Lecterns are pushed below the fold on a phone during Final and open clues**

- Where: the GameSurface stack on xs (tall clue panel, timer, wager bench, then podiums).
- What's wrong: at 390x844 the player's own score and lectern are cut off at the bottom during the wager (`g-final-wager.png`, `g-final-reveal.png`).
- Suggested fix: shorten the xs clue panel while a bench is open, or pin a compact score strip.

**[P2] "N IN ROOM" counts displays as people**

- Where: the RoomToolbar room count.
- What's wrong: a solo host with two TVs reads "3 IN ROOM".
- Suggested fix: count contestants and label spectators separately, or exclude displays.

**[P2] Score flash animations ignore reduced motion**

- Where: `Podium.tsx`, the `score-up` scale and `score-down` shake keyframes.
- What's wrong: they run regardless of `preferences.reducedMotion` or `prefers-reduced-motion`. RoundIntro and ClueStage do respect the setting.
- Suggested fix: pass `reducedMotion` into Podium, or wrap the keyframes in a `@media (prefers-reduced-motion: no-preference)` guard.

**[P2] Font loading is fragile**

- Where: `layout.tsx`.
- What's wrong: the Inter body font is never requested; Google Fonts loads only Oswald and Bitter. Body text therefore falls back to each platform's system-ui, which differs between devices. Oswald and Bitter come from a runtime Google CSS request. When it is blocked, as in this sandbox, the board falls back to DejaVu or Liberation wide faces, which look nothing like the set.
- Suggested fix: self-host all three with `next/font` so they are preloaded, work offline and avoid layout shift.

**[P2] Two "gold" tokens with swapped names, and a theme-color mismatch**

- Where: `jeopardy-style.ts`. `jeopardyPalette.gold` is `#D69F4C` but `ui.gold` is `#F2C14E` (the value of `jeopardyPalette.goldBright`).
- What's wrong: the ClueStage headline and board values use the darker gold, while results and the join panel use the brighter one. Separately, the viewport `themeColor` is `#070a16` but the stage is `#000`.
- Suggested fix: keep one gold scale with unambiguous names, and set `themeColor` to `ui.stage`.
