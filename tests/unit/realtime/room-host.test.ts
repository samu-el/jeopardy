import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameClue } from "@/lib/game";
import { RoomHost, type ServerRealtimeMessage } from "@/lib/realtime";

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

interface FakeClient {
  id: string;
  messages: ServerRealtimeMessage[];
  latestState: () => ServerRealtimeMessage & { type: "public-state" };
}

const hosts: RoomHost[] = [];

function makeHost(overrides: Partial<ConstructorParameters<typeof RoomHost>[0]> = {}) {
  const host = new RoomHost({
    roomId: "TEST",
    clues,
    // The tick loop is driven by hand in these tests.
    tickIntervalMs: 0,
    ...overrides,
  });
  hosts.push(host);
  return host;
}

function connect(host: RoomHost, clientId: string, displayName: string): FakeClient {
  const messages: ServerRealtimeMessage[] = [];
  const session = host.room.issueSession(clientId);
  host.room.connect({ ...session, connectionId: `conn-${clientId}` }, (message) => {
    messages.push(message);
  });
  host.room.dispatch(clientId, { type: "join-game", displayName });
  return {
    id: clientId,
    messages,
    latestState: () => {
      const state = [...messages]
        .reverse()
        .find((message) => message.type === "public-state");
      if (!state) throw new Error(`${clientId} never received a public state`);
      return state as ServerRealtimeMessage & { type: "public-state" };
    },
  };
}

afterEach(() => {
  for (const host of hosts.splice(0)) {
    host.destroy();
  }
  vi.useRealTimers();
});

describe("RoomHost", () => {
  it("seats joiners and fans the roster out to everyone", () => {
    const host = makeHost();
    const ada = connect(host, "ada", "Ada");
    const grace = connect(host, "grace", "Grace");

    const seenByAda = ada.latestState().state.players.map((player) => player.displayName);
    const seenByGrace = grace.latestState().state.players.map((player) => player.displayName);

    expect(seenByAda.sort()).toEqual(["Ada", "Grace"]);
    expect(seenByGrace.sort()).toEqual(["Ada", "Grace"]);
    expect(ada.latestState().state.settings.hostId).toBe("ada");
  });

  it("stamps the actor from the connection, so a client cannot act as someone else", () => {
    const host = makeHost();
    connect(host, "ada", "Ada");
    connect(host, "grace", "Grace");
    host.room.dispatch("ada", { type: "start-game" });
    host.room.dispatch("ada", { type: "pick-clue", clueId: "j-200" });

    // Grace's connection sends a buzz; it can only ever be Grace's buzz.
    host.room.receive("conn-grace", {
      type: "game-command",
      commandId: "c1",
      command: { type: "buzz" },
    });

    const buzzes = host.getState().activeClue?.buzzes ?? {};
    expect(Object.keys(buzzes)).not.toContain("ada");
  });

  it("frees a seat when someone drops out before the game starts", () => {
    const host = makeHost();
    connect(host, "ada", "Ada");
    connect(host, "grace", "Grace");

    host.room.disconnect("conn-grace");

    expect(Object.keys(host.getState().players)).toEqual(["ada"]);
  });

  it("holds a seat and its score when someone drops mid-game", () => {
    const host = makeHost();
    connect(host, "ada", "Ada");
    connect(host, "grace", "Grace");
    host.room.dispatch("ada", { type: "start-game" });

    host.room.disconnect("conn-grace");

    const grace = host.getState().players.grace;
    expect(grace).toBeDefined();
    expect(grace.connected).toBe(false);
  });

  it("hands hosting to someone still in the room when the host drops mid-game", () => {
    const host = makeHost();
    connect(host, "ada", "Ada");
    connect(host, "grace", "Grace");
    host.room.dispatch("ada", { type: "start-game" });

    host.room.disconnect("conn-ada");

    expect(host.getState().settings.hostId).toBe("grace");
  });

  it("replays chat history to a client that joins late", () => {
    const host = makeHost();
    const ada = connect(host, "ada", "Ada");
    host.room.receive("conn-ada", { type: "chat", text: "  anyone home?  " });

    const grace = connect(host, "grace", "Grace");
    const accepted = grace.messages.find((message) => message.type === "session-accepted");

    expect(accepted).toBeDefined();
    expect(
      accepted?.type === "session-accepted" &&
        accepted.chat.some((line) => line.text === "anyone home?"),
    ).toBe(true);
    expect(ada.messages.some((message) => message.type === "chat")).toBe(true);
  });

  it("advances time-driven transitions when ticked", () => {
    const host = makeHost({ settings: { roundIntroMs: 0, autoAdvanceMs: 1_000 } });
    connect(host, "ada", "Ada");
    host.room.dispatch("ada", { type: "start-game" });
    host.room.dispatch("ada", { type: "pick-clue", clueId: "j-200" });

    const closesAt = host.getState().activeClue!.buzzWindowEndsAt!;
    host.room.tick(closesAt);
    expect(host.getState().activeClue?.answerRevealed).toBe(true);

    host.room.tick(closesAt + 1_000);
    expect(host.getState().activeClue).toBeUndefined();
    expect(host.getState().revealedClueIds).toContain("j-200");
  });

  it("scores a revealed answer with the room's judge", () => {
    const host = makeHost({ settings: { roundIntroMs: 0 } });
    connect(host, "ada", "Ada");
    host.room.dispatch("ada", { type: "start-game" });
    host.room.dispatch("ada", { type: "pick-clue", clueId: "j-200" });
    const openAt = host.getState().activeClue!.readoutEndsAt!;
    vi.setSystemTime(openAt + 10);
    host.room.dispatch("ada", { type: "buzz" });
    host.room.dispatch("ada", { type: "submit-answer", answer: "what is mars" });
    host.room.dispatch("ada", { type: "reveal-answer" });

    const verdict = host.room.runAiJudge("ada");

    expect(verdict?.correct).toBe(true);
    expect(host.getState().scores.ada).toBe(200);
  });
});
