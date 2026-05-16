import { describe, expect, it } from "vitest";
import { createGame, type GameClue, type GamePlayer } from "@/lib/game";
import {
  InMemoryRealtimeRoom,
  type ServerRealtimeMessage,
} from "@/lib/realtime";

const players: GamePlayer[] = [
  {
    id: "p1",
    displayName: "Ada",
    kind: "human",
    connected: true,
    spectator: false,
  },
  {
    id: "p2",
    displayName: "Grace",
    kind: "human",
    connected: true,
    spectator: false,
  },
];

const clues: GameClue[] = [
  {
    id: "j-200",
    round: "jeopardy",
    category: "Planets",
    value: 200,
    clue: "The red planet.",
    correctResponse: "Mars",
  },
];

function createRoom(nowRef = { value: 0 }) {
  const game = createGame({
    roomId: "room-1",
    players,
    clues,
    now: nowRef.value,
    settings: {
      hostId: "p1",
      buzzUnlockDelayMs: 100,
      answerTimeoutMs: 1_000,
    },
  });

  return new InMemoryRealtimeRoom({
    initialState: game,
    clock: {
      now: () => nowRef.value,
    },
    tokenFactory: {
      createToken: (clientId) => `token-for-${clientId}`,
    },
  });
}

function sink() {
  const messages: ServerRealtimeMessage[] = [];
  return {
    messages,
    push: (message: ServerRealtimeMessage) => messages.push(message),
  };
}

describe("in-memory realtime room", () => {
  it("broadcasts game events and public state after typed client commands", () => {
    const now = { value: 10 };
    const room = createRoom(now);
    const p1 = sink();
    const p2 = sink();
    const p1Session = room.issueSession("p1");
    const p2Session = room.issueSession("p2");

    expect(room.connect({ ...p1Session, connectionId: "c1" }, p1.push)).toEqual({
      ok: true,
    });
    expect(room.connect({ ...p2Session, connectionId: "c2" }, p2.push)).toEqual({
      ok: true,
    });

    now.value = 20;
    const result = room.receive("c1", {
      type: "game-command",
      commandId: "start-1",
      command: { type: "start-game" },
    });

    expect(result.ok).toBe(true);
    expect(p1.messages).toContainEqual(
      expect.objectContaining({
        type: "game-events",
        commandId: "start-1",
        events: expect.arrayContaining([
          expect.objectContaining({ type: "game-started" }),
        ]),
      }),
    );
    expect(p2.messages).toContainEqual(
      expect.objectContaining({
        type: "public-state",
        state: expect.objectContaining({
          round: "jeopardy",
          serverTime: 20,
        }),
      }),
    );
  });

  it("stamps commands with the authenticated session id instead of trusting payload actor ids", () => {
    const now = { value: 10 };
    const room = createRoom(now);
    const p2 = sink();
    const p2Session = room.issueSession("p2");
    room.connect({ ...p2Session, connectionId: "c2" }, p2.push);

    now.value = 20;
    room.receive("c2", {
      type: "game-command",
      commandId: "spoof-start",
      command: { type: "start-game", actorId: "p1" } as never,
    });

    expect(p2.messages).toContainEqual(
      expect.objectContaining({
        type: "game-events",
        commandId: "spoof-start",
        events: [
          expect.objectContaining({
            type: "command-rejected",
            actorId: "p2",
            reason: "not-authorized",
          }),
        ],
      }),
    );
  });

  it("requires issued session tokens and replaces old connections on reconnect", () => {
    const room = createRoom();
    const rejected = sink();
    const first = sink();
    const second = sink();
    const session = room.issueSession("p1");

    expect(
      room.connect(
        { clientId: "p1", sessionToken: "wrong", connectionId: "bad" },
        rejected.push,
      ),
    ).toEqual({ ok: false, reason: "invalid-session" });
    expect(rejected.messages[0]).toMatchObject({
      type: "session-rejected",
      reason: "invalid-session",
    });

    expect(room.connect({ ...session, connectionId: "old" }, first.push)).toEqual({
      ok: true,
    });
    expect(room.connect({ ...session, connectionId: "new" }, second.push)).toEqual({
      ok: true,
    });
    expect(first.messages).toContainEqual(
      expect.objectContaining({
        type: "connection-status",
        connectionId: "old",
        status: "replaced",
      }),
    );

    const oldResult = room.receive("old", {
      type: "game-command",
      commandId: "old-start",
      command: { type: "start-game" },
    });
    expect(oldResult).toMatchObject({
      ok: false,
      message: {
        type: "message-rejected",
        reason: "unknown-connection",
      },
    });
  });

  it("uses server clock timestamps for buzz windows", () => {
    const now = { value: 10 };
    const room = createRoom(now);
    const p1 = sink();
    const p2 = sink();
    room.connect({ ...room.issueSession("p1"), connectionId: "c1" }, p1.push);
    room.connect({ ...room.issueSession("p2"), connectionId: "c2" }, p2.push);

    now.value = 20;
    room.receive("c1", {
      type: "game-command",
      commandId: "start",
      command: { type: "start-game" },
    });
    room.receive("c1", {
      type: "game-command",
      commandId: "pick",
      command: { type: "pick-clue", clueId: "j-200" },
    });

    now.value = 50;
    room.receive("c2", {
      type: "game-command",
      commandId: "early-buzz",
      command: { type: "buzz" },
    });
    expect(p2.messages).toContainEqual(
      expect.objectContaining({
        type: "game-events",
        commandId: "early-buzz",
        events: [
          expect.objectContaining({
            type: "command-rejected",
            reason: "buzz-not-open",
          }),
        ],
      }),
    );

    now.value = 121;
    room.receive("c2", {
      type: "game-command",
      commandId: "buzz",
      command: { type: "buzz" },
    });

    expect(p2.messages).toContainEqual(
      expect.objectContaining({
        type: "game-events",
        commandId: "buzz",
        events: [
          expect.objectContaining({
            type: "buzz-accepted",
            buzzedAt: 121,
            reactionTimeMs: 1,
          }),
        ],
      }),
    );
  });
});
