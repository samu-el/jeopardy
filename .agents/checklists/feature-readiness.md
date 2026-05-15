# Feature Readiness Checklist

- The feature has a narrow, named scope.
- Public and private state boundaries are clear.
- Server-authoritative behavior is identified.
- Game rules have unit tests before UI work.
- Zustand usage is limited to local UI/session state or public snapshots.
- AI, Redis, and realtime dependencies have local fakes or graceful fallbacks.
- Accessibility requirements are listed for any UI surface.
- `bun run verify` passes or the failure is documented.
