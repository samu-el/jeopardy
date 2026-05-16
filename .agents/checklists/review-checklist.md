# Review Checklist

- No unrelated rewrites.
- No copied upstream UI components.
- No game logic hidden inside React components.
- No authoritative game rules or private room state hidden inside Zustand.
- No mandatory network AI calls in tests.
- No answer keys exposed before reveal.
- Host-only commands are enforced outside the client.
- Buzz timing uses server authority.
- Realtime commands do not trust client-supplied actor ids.
- Voice selection has a fallback.
- AI bots use normal player commands.
- Avatar AI host cannot reveal hidden state or override game authority.
- `bun run verify` result is included in handoff.
