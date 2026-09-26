import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baselineBotProfiles } from "@/lib/ai/profiles";
import type { GameClue, GameState } from "@/lib/game";
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

describe("AI judge switch", () => {
  async function answeredClue(answer = "Mars") {
    const room = makeRoom([]);
    room.room.dispatch("bea", { type: "join-game", displayName: "Bea" });
    room.room.dispatch("ada", { type: "start-game" });
    room.room.dispatch("ada", { type: "pick-clue", clueId: "j-200" });
    await vi.advanceTimersByTimeAsync(500);
    room.room.dispatch("bea", { type: "buzz" });
    room.room.dispatch("bea", { type: "submit-answer", answer });
    await vi.advanceTimersByTimeAsync(300);
    expect(room.getState().activeClue?.answerRevealed).toBe(true);
    return room;
  }

  it("rules on its own while the judge is on", async () => {
    const room = await answeredClue();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(room.getState().scores.bea).toBe(200);
  });

  it("does not rule again after the host undoes its ruling", async () => {
    const room = await answeredClue();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(room.getState().scores.bea).toBe(200);

    room.room.dispatch("ada", { type: "undo" });
    expect(room.getState().activeClue?.judges.bea).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(room.getState().activeClue?.judges.bea).toBeUndefined();

    room.room.dispatch("ada", {
      type: "judge-answer",
      targetPlayerId: "bea",
      correct: false,
    });
    expect(room.getState().scores.bea).toBe(-200);
  });

  it("leaves a too-close-to-call answer for the host present to rule", async () => {
    // "Mars bar" for "Mars" sits in the judge's ambiguous band.
    const room = await answeredClue("Mars bar");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(room.getState().activeClue?.judges.bea).toBeUndefined();
    expect(
      room.room.getChatHistory().some((line) => line.text.includes("the host rules")),
    ).toBe(true);
    // Held once, not re-asked on every change.
    const held = room.room
      .getChatHistory()
      .filter((line) => line.text.includes("the host rules"));
    expect(held).toHaveLength(1);

    // The host's own ruling still lands.
    room.room.dispatch("ada", {
      type: "judge-answer",
      targetPlayerId: "bea",
      correct: true,
    });
    expect(room.getState().scores.bea).toBe(200);
  });

  it("rules a close call itself when no host is present to ask", async () => {
    const room = await answeredClue("Mars bar");
    // The host's socket is gone before the ruling is due: nobody to ask.
    (room.room as unknown as { state: GameState }).state = {
      ...room.room.getState(),
      players: {
        ...room.room.getState().players,
        ada: { ...room.room.getState().players.ada, connected: false },
      },
    };
    room.director.evaluate();
    await vi.advanceTimersByTimeAsync(2_000);
    // Ruled (as wrong) rather than left hanging with nobody to decide.
    expect(room.getState().scores.bea).toBe(-200);
  });

  it("stops ruling the moment the host switches it off", async () => {
    const room = await answeredClue();
    // The ruling is already queued; switching off has to cancel it.
    room.room.dispatch("ada", {
      type: "update-settings",
      settings: { aiJudgeEnabled: false },
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(room.getState().scores.bea).toBe(0);
    expect(room.getState().activeClue?.judges.bea).toBeUndefined();
  });
});

describe("timer wiring", () => {
  it("calls the platform timers with their own receiver", () => {
    // A browser's setTimeout throws "Illegal invocation" when it is called as
    // a method of something else, which would silently kill every deferred
    // bot action. Stand in a host-checking timer to catch that here.
    const nativeTimeout = globalThis.setTimeout;
    const receivers: unknown[] = [];
    function guardedTimeout(this: unknown, handler: TimerHandler, timeout?: number) {
      receivers.push(this);
      if (this !== undefined && this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return nativeTimeout(handler, timeout);
    }
    globalThis.setTimeout = guardedTimeout as typeof globalThis.setTimeout;

    try {
      const room = makeRoom(["bot"]);
      expect(() => room.room.dispatch("ada", { type: "start-game" })).not.toThrow();
      expect(receivers.length).toBeGreaterThan(0);
    } finally {
      globalThis.setTimeout = nativeTimeout;
    }
  });
});
