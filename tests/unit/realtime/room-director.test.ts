import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baselineBotProfiles } from "@/lib/foundation/game-contracts";
import type { GameClue } from "@/lib/game";
import { RoomHost } from "@/lib/realtime";

const clues: GameClue[] = [
  {
    id: "j-200",
    round: "jeopardy",
    category: "Planets",
    value: 200,
    clue: "The red planet.",
    correctResponse: "Mars",
  },
  {
    id: "j-400",
    round: "jeopardy",
    category: "Planets",
    value: 400,
    clue: "The ringed planet.",
    correctResponse: "Saturn",
  },
];

const sharpshooter = { ...baselineBotProfiles[3], targetAccuracy: 1 };

let host: RoomHost | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  host?.destroy();
  host = undefined;
  vi.useRealTimers();
});

function makeRoom(botIds: string[]) {
  host = new RoomHost({
    roomId: "DIR1",
    clues,
    settings: {
      hostId: "ada",
      roundIntroMs: 0,
      buzzUnlockDelayMs: 100,
      readoutPerCharMs: 0,
      answerTimeoutMs: 2_000,
      autoAdvanceMs: 500,
      aiJudgeEnabled: true,
      aiBotsEnabled: true,
    },
    botProfiles: Object.fromEntries(botIds.map((id) => [id, sharpshooter])),
    seed: 7,
  });
  host.room.dispatch("ada", { type: "join-game", displayName: "Ada", spectator: true });
  for (const id of botIds) {
    host.room.dispatch("ada", {
      type: "add-bot",
      bot: { id, displayName: id.toUpperCase() },
    });
  }
  host.start();
  return host;
}

describe("RoomDirector", () => {
  it("plays a clue on its own: picks, rings in, answers and gets judged", async () => {
    const room = makeRoom(["bot"]);
    room.room.dispatch("ada", { type: "start-game" });

    await vi.advanceTimersByTimeAsync(20_000);

    expect(room.getState().scores.bot).toBeGreaterThan(0);
  });

  it("drops queued bot work when the room moves to another clue", async () => {
    const room = makeRoom(["bot"]);
    room.room.dispatch("ada", { type: "start-game" });
    room.room.dispatch("ada", { type: "pick-clue", clueId: "j-200" });

    // Move on before the bot's buzz timer fires.
    room.room.dispatch("ada", { type: "reveal-answer" });
    room.room.dispatch("ada", { type: "skip" });
    const revealedAfterSkip = [...room.getState().revealedClueIds];

    await vi.advanceTimersByTimeAsync(3_000);

    // The stale buzz never lands on the next clue.
    const active = room.getState().activeClue;
    expect(revealedAfterSkip).toContain("j-200");
    if (active) {
      expect(active.clueId).not.toBe("j-200");
    }
  });

  it("stops scheduling once the room is torn down", async () => {
    const room = makeRoom(["bot"]);
    room.room.dispatch("ada", { type: "start-game" });
    room.destroy();
    const before = room.getState();

    await vi.advanceTimersByTimeAsync(20_000);

    expect(room.getState().revealedClueIds).toEqual(before.revealedClueIds);
    expect(room.getState().activeClue?.clueId).toBe(before.activeClue?.clueId);
  });
});
