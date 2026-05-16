# ADR 0005: Optional Avatar AI Host

## Status

Accepted.

## Decision

Support an optional avatar AI host as an AI adapter that emits voice and structured host cues. The feature can be off, voice-only, or avatar-and-voice.

## Context

The user wants an optional avatar AI host. This can improve pacing, accessibility, solo practice, and room polish, but it should not become a dependency for core gameplay.

## Consequences

- The app must remain fully playable with the avatar host disabled.
- The avatar host is not game authority.
- The adapter must never reveal hidden answers, private wagers, hidden Daily Double content, or hints during active clues.
- Future UI can animate the host from structured cues, but this phase does not implement that UI.
- Tests should use deterministic fake host output.
