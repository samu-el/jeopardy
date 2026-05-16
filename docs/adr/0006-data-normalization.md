# ADR 0006: Data Normalization Boundary

## Status

Accepted.

## Decision

Normalize archived episode data and custom CSV uploads into the pure game engine's `GameClue` model before creating game state.

## Context

The predecessor supports J-Archive-derived episode data and custom CSV games. Future UI should not know about these different source formats, and the game engine should not parse CSV or remote data shapes.

## Consequences

- `src/lib/data` owns source-specific parsing and validation.
- `src/lib/game` consumes only normalized `GameClue[]`.
- Custom import UI can show actionable validation issues from the data layer.
- Remote fetching and caching can be added later without changing engine contracts.
