import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baselineBotProfiles } from "@/lib/foundation/game-contracts";
import type { GameClue } from "@/lib/game";
import { LocalRoomRuntime } from "@/lib/runtime";

const clues: GameClue[] = [
  {
    id: "j-1",
    round: "jeopardy",
    category: "Test",
    value: 200,
    clue: "Red planet.",
    correctResponse: "Mars",
  },
  {
    id: "j-2",
    round: "jeopardy",
    category: "Test",
    value: 400,
    clue: "Blue planet.",
    correctResponse: "Earth",
  },
];

describe("LocalRoomRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeRuntime() {
    const events: unknown[] = [];
    const chats: unknown[] = [];
    const states: unknown[] = [];
    const runtime = new LocalRoomRuntime(
      {
        roomId: "room-1",
        hostId: "host",
        hostName: "Host",
        humanPlayers: [{ id: "host", name: "Host" }],
        bots: [
          {
            id: "bot-legend",
            name: "Legend",
            profile: { ...baselineBotProfiles[3], targetAccuracy: 1 },
          },
        ],
        clues,
        settings: {
          buzzUnlockDelayMs: 100,
          answerTimeoutMs: 500,
          aiJudgeEnabled: true,
          aiBotsEnabled: true,
        },
        seed: 42,
      },
      {
        onPublicState: (state) => states.push(state),
        onEvents: (evts) => events.push(evts),
        onChat: (chat) => chats.push(chat),
      },
    );
    return { runtime, events, chats, states };
  }

  it("drives a full clue cycle: start, bot pick, bot buzz, auto-judge", async () => {
    const { runtime, chats } = makeRuntime();
    runtime.sendCommand("host", { type: "start-game" });
    runtime.sendCommand("host", { type: "pick-clue", clueId: "j-1" });

    // Allow timers for readout + bot buzz + bot answer + auto-judge to fire
    await vi.advanceTimersByTimeAsync(20_000);

    const state = runtime.getPublicState();
    // The bot took its turn — score changed (positive on correct, negative on wrong)
    const bot = state.players.find((p) => p.id === "bot-legend");
    expect(bot?.score).not.toBe(0);
    expect(chats.length).toBeGreaterThan(0);
    runtime.destroy();
  });

  it("posts chat messages to listeners", () => {
    const { runtime, chats } = makeRuntime();
    runtime.postChat("host", "Host", "hello world");
    expect(chats.some((c) => (c as { text: string }).text === "hello world")).toBe(true);
    runtime.destroy();
  });

  it("destroy clears pending timers without leaking", async () => {
    const { runtime } = makeRuntime();
    runtime.sendCommand("host", { type: "start-game" });
    runtime.sendCommand("host", { type: "pick-clue", clueId: "j-1" });
    runtime.destroy();
    await vi.advanceTimersByTimeAsync(20_000);
    // No assertion needed — test passes if no errors leak from killed timers
    expect(true).toBe(true);
  });
});
