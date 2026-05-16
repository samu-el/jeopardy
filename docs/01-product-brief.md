# Product Brief

## Goal

Build a fast, responsive, modern web app for playing Jeopardy with friends or AI opponents. The app should feel reliable in live multiplayer rooms, pleasant on desktop and mobile, and easier to host than the predecessor.

## Baseline Features To Preserve

- Create and join multiplayer rooms.
- Load archived episodes and custom games.
- Support Jeopardy, Double Jeopardy, Triple Jeopardy, and Final Jeopardy.
- Support Daily Doubles, clue selection, wagers, and scorekeeping.
- Lock buzzing until the clue readout is complete.
- Preserve buzz order and answer windows.
- Support spectators.
- Include text chat and system game log entries.
- Allow human judging and optional AI judging.
- Persist active rooms when Redis is configured.
- Track stats such as questions answered, correctness, first buzzes, and reaction times.

## New Feature Commitments

- Add voice selection for clue readout. Players or hosts should be able to choose from browser voices, hosted voices, and future custom voice adapters.
- Add AI bot opponents. Bots need configurable difficulty, response accuracy, wager behavior, and buzz delay ranges so they feel meaningfully different.
- Add an optional avatar AI host for clue readout, pacing, rule reminders, and light commentary. The app must remain fully playable when this is disabled.
- Add better host controls for pacing, undo, answer correction, room moderation, and settings.
- Add responsive play surfaces for phones, tablets, and desktop without treating mobile as an afterthought.
- Add accessibility-first game flow: captions, keyboard shortcuts, visible timers, reduced motion support, and screen-reader-friendly state.

## Improvement Backlog

- Solo practice mode with adaptive bot difficulty.
- Team mode with shared score and rotating captain controls.
- Tournament mode across multiple boards.
- Better custom game builder with validation before launch.
- Import/export game packages as JSON and CSV.
- Searchable episode browser with filters for season, date, event, and category.
- Latency calibration for buzz fairness.
- Room lobby with ready checks and seat management.
- Replay timeline for clue, buzz, answer, judge, and score events.
- Analytics dashboard for buzz timing, accuracy, wagering, and category strengths.
- AI clue readout cache with progress and fallbacks.
- Avatar AI host with voice-only and avatar-and-voice modes.
- AI judge explanation mode for hosts, with confidence and manual override.
- Bot personalities that change category preference, wagering, and risk tolerance.
- Moderation tools for chat, names, spectators, and disruptive players.
- Shareable room links with optional room codes.
- PWA install support for quick phone buzzing.
- Observability for room health, realtime latency, and AI service failures.

## Out Of Scope For This Phase

- No Jeopardy board UI.
- No room UI.
- No realtime gameplay implementation.
- No AI service calls beyond typed boundaries and docs.
- No data ingestion implementation beyond architecture notes.
