# Pre-UI Readiness Checklist

Use `docs/05-pre-ui-readiness.md` as the detailed source of truth.

- Pure game engine exists outside React, Zustand, Redis, realtime, and AI.
- Game-engine state transitions have tests.
- Public/private room state is enforced and tested.
- Typed command/event contracts exist.
- Realtime adapter maps messages to commands, stamps actor authority server-side, and broadcasts public state.
- Redis persistence has an optional local fallback and hydration tests.
- Archived and custom game data normalize to one clue model.
- AI judge adapter is optional and fakeable.
- AI bot adapter uses normal player commands.
- Voice readout adapter supports browser fallback and selectable hosted voices.
- Optional avatar AI host adapter is documented, fakeable, and never authoritative.
- Zustand is limited to local UI/session state and public snapshots.
- Accessibility requirements are specified before visual layout.
- Responsive viewport requirements are specified before visual layout.
- `bun run verify` passes.
