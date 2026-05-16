import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function fail(message: string): never {
  console.error(`Foundation verification failed: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    fail(message);
  }
}

function readJson(path: string) {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as Record<
    string,
    unknown
  >;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    return stats.isDirectory() ? walk(path) : [path];
  });
}

const requiredFiles = [
  ".prototools",
  "AGENTS.md",
  "README.md",
  "package.json",
  "docs/01-product-brief.md",
  "docs/02-architecture.md",
  "docs/03-agent-playbook.md",
  "docs/05-pre-ui-readiness.md",
  ".codex/skills/jeopardy-modern-app/SKILL.md",
  "src/app/api/health/route.ts",
  "src/lib/data/contracts.ts",
  "src/lib/data/normalize.ts",
  "src/lib/data/index.ts",
  "src/lib/game/contracts.ts",
  "src/lib/game/engine.ts",
  "src/lib/game/index.ts",
  "src/lib/realtime/contracts.ts",
  "src/lib/realtime/in-memory-room.ts",
  "src/lib/realtime/index.ts",
  "src/lib/state/app-store.ts",
  "src/lib/state/use-app-store.ts",
  "src/lib/state/game-store.ts",
  "src/lib/state/persistence.ts",
  "src/lib/state/use-persisted-lobby.ts",
  "src/lib/foundation/pre-ui-readiness.ts",
  "src/lib/ai/index.ts",
  "src/lib/ai/judge.ts",
  "src/lib/ai/bots.ts",
  "src/lib/ai/voice.ts",
  "src/lib/ai/avatar-host.ts",
  "src/lib/runtime/index.ts",
  "src/lib/runtime/chat.ts",
  "src/lib/runtime/local-room.ts",
  "src/lib/runtime/avatar-narrator.ts",
  "src/lib/runtime/socket-client.ts",
  "src/lib/realtime/socket-bridge.ts",
  "src/lib/data/builder.ts",
  "src/lib/data/archive-source.ts",
  "src/lib/data/archive-client.ts",
  "src/lib/data/fixture-episode.ts",
  "src/app/api/episodes/route.ts",
  "src/app/api/episodes/[id]/route.ts",
  "src/components/AppShell.tsx",
  "src/components/Room.tsx",
  "src/components/RoomToolbar.tsx",
  "src/components/PlayersPanel.tsx",
  "src/components/Board.tsx",
  "src/components/ClueStage.tsx",
  "src/components/Scoreboard.tsx",
  "src/components/Chat.tsx",
  "src/components/SettingsPanel.tsx",
  "src/components/ResultsView.tsx",
  "src/components/AvatarHostController.tsx",
  "src/components/CustomGameBuilder.tsx",
  "src/components/EpisodeBrowser.tsx",
  "src/components/GamePicker.tsx",
  "src/components/Landing.tsx",
  "src/components/Podium.tsx",
  "src/components/Wordmark.tsx",
  "src/components/MicAnswerField.tsx",
  "src/components/AvatarPicker.tsx",
  "src/components/DailyDoubleSplash.tsx",
  "src/components/ShortcutsOverlay.tsx",
  "src/components/Onboarding.tsx",
  "src/components/TranscriptPane.tsx",
  "src/components/ReplayView.tsx",
  "src/components/AnalyticsGate.tsx",
  "src/lib/runtime/replay-log.ts",
  "src/app/api/rooms/route.ts",
  "src/app/api/rooms/[id]/route.ts",
  ".storybook/main.ts",
  ".storybook/preview.tsx",
  "src/components/Podium.stories.tsx",
  "src/components/Board.stories.tsx",
  "src/components/ClueStage.stories.tsx",
  "src/components/RoomToolbar.stories.tsx",
  "src/lib/ai/sfx.ts",
  "src/lib/ai/speech-recognition.ts",
  "public/manifest.webmanifest",
  "public/icon.svg",
  "tests/unit/foundation.test.ts",
  "tests/unit/app-store.test.ts",
  "tests/unit/data/normalize.test.ts",
  "tests/unit/data/builder.test.ts",
  "tests/unit/game/engine.test.ts",
  "tests/unit/game/final-jeopardy.test.ts",
  "tests/unit/game/buzzer-reopen.test.ts",
  "tests/unit/data/fixture-episode.test.ts",
  "tests/unit/data/decade.test.ts",
  "tests/unit/runtime/replay-log.test.ts",
  "tests/e2e/fixture-round.spec.ts",
  "tests/e2e/share-link.spec.ts",
  "tests/e2e/onboarding.spec.ts",
  "tests/unit/realtime/in-memory-room.test.ts",
  "tests/unit/runtime/local-room.test.ts",
  "tests/unit/ai/judge.test.ts",
  "tests/unit/ai/bots.test.ts",
  "tests/unit/ai/avatar-host.test.ts",
  "tests/unit/ai/avatar-narrator.test.ts",
  "tests/contracts/data-normalization.test.ts",
  "tests/contracts/game-contracts.test.ts",
  "tests/contracts/game/public-state-privacy.test.ts",
  "tests/contracts/pre-ui-readiness.test.ts",
  "tests/contracts/realtime/command-mapping.test.ts",
  "tests/contracts/ai/privacy.test.ts",
  "tests/e2e/health.spec.ts",
  "tests/e2e/round.spec.ts",
  ".github/workflows/ci.yml",
];

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `missing required file ${file}`);
}

const protoTools = readFileSync(join(root, ".prototools"), "utf8");
assert(protoTools.includes('bun = "1.3.6"'), ".prototools must pin Bun");
assert(protoTools.includes('node = "22.22.0"'), ".prototools must pin Node");
assert(!existsSync(join(root, "proto")), "protobuf-style proto/ directory is out of scope");

const protoFiles = walk(root).filter((file) => file.endsWith(".proto"));
assert(protoFiles.length === 0, "protobuf .proto files are out of scope");

const packageJson = readJson("package.json");
const scripts = packageJson.scripts as Record<string, string> | undefined;
const dependencies = packageJson.dependencies as Record<string, string> | undefined;
assert(scripts?.verify?.includes("foundation:verify"), "verify script must run foundation verifier");
assert(scripts?.typecheck === "tsc --noEmit", "typecheck script should use tsc");
assert(packageJson.packageManager === "bun@1.3.6", "packageManager must pin Bun");
assert(dependencies?.zustand, "Zustand must be installed as the client state layer");

const productBrief = readFileSync(join(root, "docs/01-product-brief.md"), "utf8");
assert(productBrief.includes("voice selection"), "product brief must mention voice selection");
assert(productBrief.includes("AI bot"), "product brief must mention AI bot opponents");
assert(productBrief.includes("avatar AI host"), "product brief must mention avatar AI host");

const preUiReadiness = readFileSync(join(root, "docs/05-pre-ui-readiness.md"), "utf8");
assert(
  preUiReadiness.includes("Avatar AI Host"),
  "pre-UI readiness doc must include avatar AI host",
);
assert(
  preUiReadiness.includes("Zustand"),
  "pre-UI readiness doc must include Zustand client state",
);

const gameEngine = readFileSync(join(root, "src/lib/game/engine.ts"), "utf8");
for (const forbidden of ["react", "zustand", "ioredis", "socket.io", "openai"]) {
  const imports = gameEngine
    .split("\n")
    .filter((line) => line.trim().startsWith("import "))
    .join("\n");
  assert(!imports.includes(forbidden), `game engine must not import ${forbidden}`);
}

const dataNormalizer = readFileSync(join(root, "src/lib/data/normalize.ts"), "utf8");
const dataImports = dataNormalizer
  .split("\n")
  .filter((line) => line.trim().startsWith("import "))
  .join("\n");
for (const forbidden of ["react", "zustand", "ioredis", "socket.io", "openai"]) {
  assert(!dataImports.includes(forbidden), `data normalizer must not import ${forbidden}`);
}

const realtimeRoom = readFileSync(
  join(root, "src/lib/realtime/in-memory-room.ts"),
  "utf8",
);
const realtimeImports = realtimeRoom
  .split("\n")
  .filter((line) => line.trim().startsWith("import "))
  .join("\n");
for (const forbidden of ["react", "zustand", "ioredis", "socket.io", "openai"]) {
  assert(!realtimeImports.includes(forbidden), `realtime room must not import ${forbidden}`);
}

console.log("Foundation verification passed.");
