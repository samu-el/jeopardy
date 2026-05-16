import { describe, expect, it } from "vitest";
import { commandFromClient, type ClientGameCommand } from "@/lib/realtime";

describe("realtime command mapping", () => {
  it("maps every client command to a game command with the authenticated actor id", () => {
    const commands: ClientGameCommand[] = [
      { type: "start-game" },
      { type: "pick-clue", clueId: "j-200" },
      { type: "submit-wager", amount: 500 },
      { type: "buzz" },
      { type: "submit-answer", answer: "Mars" },
      { type: "reveal-answer" },
      { type: "judge-answer", targetPlayerId: "p2", correct: true },
      { type: "skip" },
      { type: "undo" },
      { type: "update-settings", settings: { aiBotsEnabled: true } },
      {
        type: "add-bot",
        bot: {
          id: "bot-1",
          displayName: "Bot",
        },
      },
      { type: "configure-host", hostId: "p1" },
    ];

    for (const command of commands) {
      expect(commandFromClient("p1", command)).toMatchObject({
        type: command.type,
        actorId: "p1",
      });
    }
  });

  it("ignores spoofed actor ids from loose runtime payloads", () => {
    const mapped = commandFromClient("real-player", {
      type: "buzz",
      actorId: "spoofed-player",
    } as never);

    expect(mapped).toEqual({
      type: "buzz",
      actorId: "real-player",
    });
  });
});
