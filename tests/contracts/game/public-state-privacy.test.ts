import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGame,
  dispatchGameCommand,
  getPublicGameState,
  type GameClue,
  type GamePlayer,
} from "@/lib/game";

const players: GamePlayer[] = [
  {
    id: "host",
    displayName: "Host",
    kind: "human",
    connected: true,
    spectator: false,
  },
  {
    id: "player",
    displayName: "Player",
    kind: "human",
    connected: true,
    spectator: false,
  },
];

const clues: GameClue[] = [
  {
    id: "secret",
    round: "jeopardy",
    category: "Secrets",
    value: 200,
    clue: "This answer should stay hidden.",
    correctResponse: "classified response",
    dailyDouble: true,
  },
];

describe("public game state privacy", () => {
  it("does not expose correct responses, answers, or wagers before answer reveal", () => {
    let state = createGame({
      roomId: "privacy",
      players,
      clues,
      now: 0,
      settings: {
        hostId: "host",
        buzzUnlockDelayMs: 100,
      },
    });

    state = dispatchGameCommand(
      state,
      { type: "start-game", actorId: "host" },
      { now: 10 },
    ).state;
    state = dispatchGameCommand(
      state,
      { type: "pick-clue", actorId: "host", clueId: "secret" },
      { now: 20 },
    ).state;
    state = dispatchGameCommand(
      state,
      { type: "submit-wager", actorId: "host", amount: 777 },
      { now: 30 },
    ).state;
    const publicBeforeReveal = JSON.stringify(getPublicGameState(state, 40));
    expect(publicBeforeReveal).toContain("This answer should stay hidden.");
    expect(publicBeforeReveal).not.toContain("777");

    // The picker is the only player who owes an answer on a Daily Double, so
    // sending it is the reveal: the answer and the wager come out together,
    // and not a moment before.
    state = dispatchGameCommand(
      state,
      { type: "submit-answer", actorId: "host", answer: "classified response" },
      { now: 140 },
    ).state;

    const publicAfterReveal = JSON.stringify(getPublicGameState(state, 150));
    expect(publicAfterReveal).toContain("classified response");
    expect(publicAfterReveal).toContain("777");
  });

  it("keeps the pure game engine free of UI, state-store, persistence, realtime, and AI imports", () => {
    const gameDir = join(process.cwd(), "src", "lib", "game");
    const files = walk(gameDir).filter((file) => file.endsWith(".ts"));
    const forbiddenPatterns = [
      "react",
      "zustand",
      'from "ws"',
      "openai",
      "@/lib/state",
      "@/lib/ai",
      "@/lib/realtime",
      "@/lib/persistence",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const imports = source
        .split("\n")
        .filter((line) => line.trim().startsWith("import "))
        .join("\n");
      for (const pattern of forbiddenPatterns) {
        expect(imports, `${file} imports ${pattern}`).not.toContain(pattern);
      }
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
