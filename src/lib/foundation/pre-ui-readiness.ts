export type PreUiReadinessStatus =
  | "foundation-defined"
  | "implementation-required"
  | "implemented"
  | "blocked";

export type PreUiReadinessArea =
  | "game-engine"
  | "state-contracts"
  | "realtime"
  | "persistence"
  | "data"
  | "ai"
  | "voice"
  | "avatar-host"
  | "client-state"
  | "accessibility"
  | "responsive"
  | "testing";

export interface PreUiReadinessItem {
  id: string;
  area: PreUiReadinessArea;
  title: string;
  ownerModule: string;
  status: PreUiReadinessStatus;
  blocksUi: boolean;
  acceptanceCriteria: string[];
}

export const preUiReadinessChecklist: PreUiReadinessItem[] = [
  {
    id: "pure-game-engine",
    area: "game-engine",
    title: "Pure game engine state machine",
    ownerModule: "src/lib/game",
    status: "foundation-defined",
    blocksUi: true,
    acceptanceCriteria: [
      "Rounds advance through lobby, Jeopardy, Double Jeopardy, Triple Jeopardy, Final Jeopardy, and complete.",
      "Clue picking, Daily Doubles, wagers, buzzing, answer windows, judging, scoring, undo, and stats are pure functions or deterministic services.",
      "No React, Zustand, Redis, realtime, or AI imports exist in the game engine.",
    ],
  },
  {
    id: "game-engine-tests",
    area: "testing",
    title: "Game engine transition tests",
    ownerModule: "tests/unit or tests/contracts",
    status: "foundation-defined",
    blocksUi: true,
    acceptanceCriteria: [
      "Each command has success and rejection tests.",
      "Private answers and wagers stay private until reveal.",
      "Timer-dependent behavior uses injected clocks or deterministic test helpers.",
    ],
  },
  {
    id: "public-private-state",
    area: "state-contracts",
    title: "Public/private room state boundary",
    ownerModule: "src/lib/game and src/lib/realtime",
    status: "foundation-defined",
    blocksUi: true,
    acceptanceCriteria: [
      "Private state contains answer keys, hidden wagers, room secrets, and undo snapshots.",
      "Public state contains only render-safe data for players and spectators.",
      "A test proves correct responses cannot appear in public state before reveal.",
    ],
  },
  {
    id: "command-event-contracts",
    area: "state-contracts",
    title: "Command and event contracts",
    ownerModule: "src/lib/game/contracts.ts",
    status: "foundation-defined",
    blocksUi: true,
    acceptanceCriteria: [
      "Commands cover start game, pick clue, buzz, submit answer, submit wager, judge answer, undo, skip, update settings, add bot, and configure host.",
      "Events cover room created, clue revealed, buzz accepted, answer submitted, wager submitted, answer judged, score changed, round advanced, and error rejected.",
      "Contracts are shared by realtime adapters and tests.",
    ],
  },
  {
    id: "realtime-adapter",
    area: "realtime",
    title: "Realtime room adapter",
    ownerModule: "src/lib/realtime",
    status: "foundation-defined",
    blocksUi: true,
    acceptanceCriteria: [
      "Socket events map to typed commands and public-state broadcasts.",
      "Reconnect behavior preserves client identity without trusting spoofed input.",
      "Buzz timing uses server timestamps.",
    ],
  },
  {
    id: "redis-persistence",
    area: "persistence",
    title: "Redis persistence contract",
    ownerModule: "src/lib/realtime",
    status: "implemented",
    blocksUi: false,
    acceptanceCriteria: [
      "Active rooms serialize and hydrate without timers firing twice.",
      "Redis is optional in local development.",
      "Persistence tests use a fake adapter or containerized Redis.",
    ],
  },
  {
    id: "episode-custom-data",
    area: "data",
    title: "Episode and custom-game normalization",
    ownerModule: "src/lib/data",
    status: "foundation-defined",
    blocksUi: true,
    acceptanceCriteria: [
      "Archived episode data and custom CSV imports normalize to the same clue model.",
      "Invalid custom games return actionable validation errors.",
      "Data loading does not block app startup when remote data is unavailable.",
    ],
  },
  {
    id: "ai-judge-adapter",
    area: "ai",
    title: "Optional AI judge adapter",
    ownerModule: "src/lib/ai/judge",
    status: "implementation-required",
    blocksUi: false,
    acceptanceCriteria: [
      "AI judging has a deterministic fake for tests.",
      "Host judgment can override AI judgment.",
      "Timeouts and refusals never block the room permanently.",
    ],
  },
  {
    id: "ai-bot-adapter",
    area: "ai",
    title: "AI bot opponent adapter",
    ownerModule: "src/lib/ai/bots",
    status: "implementation-required",
    blocksUi: true,
    acceptanceCriteria: [
      "Bots join as normal players and use normal commands.",
      "Difficulty controls buzz delay, answer accuracy, category confidence, and wagering.",
      "Tests can simulate bots without network AI calls.",
    ],
  },
  {
    id: "voice-readout-adapter",
    area: "voice",
    title: "Selectable voice readout adapter",
    ownerModule: "src/lib/ai/voice",
    status: "implementation-required",
    blocksUi: true,
    acceptanceCriteria: [
      "Browser speech is the fallback.",
      "Hosted and external voice providers share a typed interface.",
      "Audio cache keys include clue text, voice id, locale, and provider.",
    ],
  },
  {
    id: "avatar-ai-host",
    area: "avatar-host",
    title: "Optional avatar AI host adapter",
    ownerModule: "src/lib/ai/avatar-host",
    status: "implementation-required",
    blocksUi: false,
    acceptanceCriteria: [
      "Avatar host can be disabled, voice-only, or avatar-and-voice.",
      "Host narration never reveals answers, private wagers, or hidden Daily Double content early.",
      "The adapter exposes structured cues for future UI animation without requiring a UI implementation now.",
      "Tests use deterministic scripts or fake model output.",
    ],
  },
  {
    id: "zustand-client-state",
    area: "client-state",
    title: "Zustand client state boundary",
    ownerModule: "src/lib/state",
    status: "foundation-defined",
    blocksUi: true,
    acceptanceCriteria: [
      "Zustand owns connection status, preferences, local UI state, and public snapshots.",
      "Zustand does not own authoritative game rules or private room state.",
      "Selectors are narrow enough for high-frequency realtime updates.",
    ],
  },
  {
    id: "accessibility-requirements",
    area: "accessibility",
    title: "Accessibility requirements",
    ownerModule: "docs and future UI tests",
    status: "implementation-required",
    blocksUi: true,
    acceptanceCriteria: [
      "Keyboard-only gameplay is specified for pick, buzz, answer, wager, and judge flows.",
      "Captions, visible timers, reduced motion, and screen-reader status updates are specified.",
      "Accessibility test strategy is documented before UI components are built.",
    ],
  },
  {
    id: "responsive-requirements",
    area: "responsive",
    title: "Responsive play requirements",
    ownerModule: "docs and future UI tests",
    status: "implementation-required",
    blocksUi: true,
    acceptanceCriteria: [
      "Desktop, tablet, and phone layouts are specified for lobby, board, clue, buzzer, wager, answer, and judge states.",
      "Phone buzzer flow is treated as a primary workflow.",
      "Future Playwright viewports are listed before visual work starts.",
    ],
  },
  {
    id: "pre-ui-harnesses",
    area: "testing",
    title: "Pre-UI harness coverage",
    ownerModule: "tests and scripts",
    status: "foundation-defined",
    blocksUi: true,
    acceptanceCriteria: [
      "Foundation verifier enforces toolchain, docs, and no-protobuf scope.",
      "Unit and contract tests cover foundation metadata and client state.",
      "Future engine, realtime, AI fake, data validation, and accessibility harnesses are listed before UI work.",
    ],
  },
];

export function getBlockingPreUiItems() {
  return preUiReadinessChecklist.filter((item) => item.blocksUi);
}

export function getPreUiItemsByArea(area: PreUiReadinessArea) {
  return preUiReadinessChecklist.filter((item) => item.area === area);
}
