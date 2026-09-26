# UX Audit — 2026-09-25

Eight parallel auditors drove the running app (Playwright, desktop 1440x900 / 1920x1080, phones 375–390 wide, tablet, landscape) and read the code. Findings are verified by a run or a code reference unless marked "code only". No code was changed.

| Area                          | File                     | P0  | P1  | P2  |
| ----------------------------- | ------------------------ | --- | --- | --- |
| Core solo loop                | [loop.md](loop.md)       | 2   | 6   | 10  |
| Multiplayer rooms             | [multi.md](multi.md)     | 3   | 9   | 8   |
| TV display / Final / Results  | [display.md](display.md) | 2   | 9   | 11  |
| Mobile / PWA                  | [mobile.md](mobile.md)   | 2   | 8   | 8   |
| Accessibility                 | [a11y.md](a11y.md)       | 1   | 9   | 10  |
| Builder / Settings            | [builder.md](builder.md) | 1   | 12  | 11  |
| AI judge / bots / voice / sfx | [ai.md](ai.md)           | 0   | 12  | 11  |
| Landing / onboarding / picker | [landing.md](landing.md) | 0   | 9   | 11  |

## P0 — fix first

1. **Correct response leaks before rebound buzz** — answer revealed to all on first submit; buzzing reopens for people who saw it (`src/lib/game/clue-flow.ts` ~318, ~450). _loop_
2. **Host refresh loses the room** — host URL never gets `?room=`, chair moves to a guest, not returned, no transfer UI. _multi, landing_
3. **6 s offline fallback fires on transient disconnect** — host silently becomes local "Solo · not shareable"; guests see host OFFLINE forever. _multi_
4. **TV display link in host's browser steals the host seat** and persists "Display"/spectator to localStorage. _multi_
5. **Spectators/displays counted as contestants** — "DISPLAY $0" can win. _display_
6. **TV shows empty ghost board at game end** — `DisplayView` has no results layout. _display_
7. **Buzzer unusable on phones** — starts below the fold (clue panel `min(66vh,560px)`, podiums wrap/sort so own lectern can be row 2) and is 22 px tall. _mobile, loop, a11y, multi_
8. **Malformed JSON import crashes the app** — `parseBuilderGame` only checks field presence. _builder_
9. **No screen-reader announcements for gameplay** — clue, buzzer, rulings, scores; only live region is `aria-live="off"`. _a11y_

## Cross-cutting themes (fix once, closes many findings)

- **Host/guest authority is muddled in UI.** Guests see and use controls that silently do nothing or diverge locally: Change game/Shuffle, bots, buzz window, settings, Again/Lobby. Any player can trigger `ai-judge` on their own answer (`in-memory-room.ts`) — this is a rules/authority bug, not just UX. Gate controls on role and enforce server-side.
- **Session lifecycle.** Home button leaves socket open (ghost seats, re-deal into old room); guest refresh shows join card; kicked/full-room players get no message; offline commands replay onto newer state; bad `?game=` / dead `?room=` links fail silently or spin forever.
- **Judging.** Fuzzy matcher is the only judge (no LLM path): accepts "2" for "12", "Henry VIII" for "Henry VII"; rejects "4"/"four", "U.S.A.", "who was…". Auto-rules in 900 ms even with a human host; no override/undo UI though engine has `undo`. Bot "wrong" answers judged correct 83%. % shown is similarity, not confidence.
- **Results screen is broken.** "Again" and "Lobby" both call `exitToLobby`; nothing for guests; no new-episode path; More-menu dialogs not mounted; winner rank/score chips invisible (1.11:1 contrast); ties unhandled; `$-400` vs `-$400`.
- **Final Jeopardy.** TV says "Daily Double — waiting for the wager"; answers/wagers never revealed; ≤$0 players get a $0–$0 wager box and stall 30 s; wagers silently clamped; bot leader always bets everything.
- **Audio.** Every sfx plays twice (effect replays events); mute/Home don't stop readout; "Incorrect." spoken once per game (dedup by text); Final music ignores mute; default "Host: Voice" is silent because Sound defaults off; "Avatar" mode == "Voice".
- **Keyboard/focus.** Space always buzzes during a clue, hijacking focused buttons; focus drops to `<body>` on clue open/close/results; Onboarding modal no focus trap/Esc/name; buzzer auto-focus depends on `clue.canBuzz` which never turns true client-side.
- **Mobile shell.** `vh` not `dvh`; no `viewportFit: cover`/safe-area; buzz on click not pointerdown, no `touch-action: manipulation`; categories render at 7 px; no apple-touch-icon/PNG icons, OG tags, service worker, wake lock; Inter referenced but never loaded; fonts via render-blocking Google CSS.
- **Builder.** Not reachable from Landing; no CSV import in UI (`normalizeCustomCsvGame` unused); drafts only saved when valid; duplicate category names merge; errors rendered ~2800 px down with no field highlighting; $ field re-sorts while typing.
- **Picker.** Search doesn't search categories; capped at 60 of 9,421 episodes; raw "Failed to load episodes (404)"; loading shows "Nothing matched."

## Coverage gaps

Core-loop agent stopped mid Jeopardy round — Double Jeopardy/Final/Results items there are code-only (display agent covered those live). Multiplayer did not test host controls beyond kick, tab backgrounding, or 3+ simultaneous buzzers. iOS-specific items (keyboard focus, safe area, audio unlock) are code-inferred; confirm on a real iPhone.
