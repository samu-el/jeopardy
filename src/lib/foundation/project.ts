export const toolchain = {
  manager: "proto",
  runtime: "bun",
  framework: "nextjs-app-router",
  ui: "material-ui",
  state: "zustand",
} as const;

export const upstreamReference = {
  repository: "https://github.com/howardchung/jeopardy",
  reviewedOn: "2026-05-16",
  inheritedCapabilities: [
    "multiplayer rooms",
    "archived episode loading",
    "custom CSV games",
    "Jeopardy, Double Jeopardy, Triple Jeopardy, and Final Jeopardy rounds",
    "Daily Doubles",
    "timed buzzing",
    "text chat",
    "text-to-speech clue readout",
    "human judging",
    "experimental AI judging",
    "Redis room persistence",
    "game stats",
  ],
} as const;

export const foundationHarnesses = [
  "proto-pinned-toolchain",
  "next-health-route",
  "typescript-typecheck",
  "eslint",
  "vitest-unit-and-contract-tests",
  "playwright-health-smoke",
  "foundation-verifier",
] as const;

export const featureBacklog = [
  {
    id: "voice-selection",
    name: "Selectable clue readout voices",
    phase: "new-feature",
  },
  {
    id: "ai-bot-opponents",
    name: "AI bot opponents with difficulty and buzz response timing",
    phase: "new-feature",
  },
  {
    id: "avatar-ai-host",
    name: "Optional avatar AI host for pacing, clue readout, and light room guidance",
    phase: "new-feature",
  },
  {
    id: "responsive-game-room",
    name: "Fast responsive multiplayer game room",
    phase: "implementation",
  },
  {
    id: "host-control-center",
    name: "Host controls for pacing, correction, teams, and moderation",
    phase: "improvement",
  },
  {
    id: "solo-practice",
    name: "Solo practice mode with adaptive bots and review",
    phase: "improvement",
  },
  {
    id: "game-analytics",
    name: "Round analytics, buzz timing, accuracy, and wager history",
    phase: "improvement",
  },
] as const;

export function hasPlannedFeature(id: string) {
  return featureBacklog.some((feature) => feature.id === id);
}
