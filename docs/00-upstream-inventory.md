# Upstream Inventory

Reference repository: `https://github.com/howardchung/jeopardy`

Reviewed on 2026-05-16 from a fresh clone.

## Inherited Product Behavior

- Online rooms for private and simultaneous games.
- Archived Jeopardy episode loading from J-Archive-derived data.
- Episode number lookup and event filtering.
- Custom game upload through CSV.
- Jeopardy, Double Jeopardy, Triple Jeopardy, and Final Jeopardy rounds.
- Daily Doubles, wagers, score changes, and final wagers.
- Timed clue reading before buzz unlock.
- Buzz ordering and answer submission.
- Human self/host judging.
- Experimental AI judging through OpenAI.
- Text chat and system messages.
- Redis-backed room persistence and lightweight stats.
- Optional AI voice pregeneration through an external RVC-style service.

## Upstream Technical Shape

- Vite React frontend.
- Hono Node server.
- Socket.IO realtime transport.
- Redis persistence.
- Local gzipped clue data loaded from `jeopardy.json.gz`.
- Browser text-to-speech plus optional generated audio.

## Modernization Direction

The rebuild should preserve the behavior, not the implementation style. Future agents should use the upstream code as a requirements reference and reimplement with the architecture in `docs/02-architecture.md`.
