# ADR 0003: AI Boundaries

## Status

Accepted.

## Decision

AI judging, AI bots, and generated voices must be optional service adapters behind typed interfaces.

## Context

The product needs AI-powered judging, voice selection, and bot opponents. Local development and tests must still work without API keys or network AI calls.

## Consequences

- Provide deterministic fake AI adapters for tests.
- Never block core gameplay permanently on an AI call.
- Host decisions override AI decisions.
- Bot players use normal game mechanics.
- Voice readout falls back to browser speech synthesis.
