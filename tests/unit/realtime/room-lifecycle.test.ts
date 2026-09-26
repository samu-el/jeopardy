import { afterEach, describe, expect, it } from "vitest";
import type { GameClue } from "@/lib/game";
import {
  RoomHost,
  RoomSession,
  hostReclaimGraceMs,
  kickBanMs,
  type ServerFrame,
  type ServerRealtimeMessage,
} from "@/lib/realtime";

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

const hosts: RoomHost[] = [];

afterEach(() => {
  for (const host of hosts.splice(0)) host.destroy();
});

function makeHost(now: { value: number }) {
  const host = new RoomHost({
    roomId: "LIFE",
    clues,
    tickIntervalMs: 0,
    now: () => now.value,
    settings: { roundIntroMs: 0 },
  });
  hosts.push(host);
  return host;
}

/** A client on the wire: a RoomSession plus every frame it was sent. */
function client(host: RoomHost, connectionId: string, fresh = false) {
  const frames: ServerFrame[] = [];
  const session = new RoomSession({
    connectionId,
    resolveRoom: async () => ({ host, fresh }),
    send: (frame) => frames.push(frame),
  });
  const messages = () =>
    frames.flatMap((frame) => (frame.t === "message" ? [frame.message] : []));
  const accepted = () =>
    messages().filter(
      (message): message is Extract<ServerRealtimeMessage, { type: "session-accepted" }> =>
        message.type === "session-accepted",
    );
  const rejections = () =>
    messages().filter(
      (message): message is Extract<ServerRealtimeMessage, { type: "session-rejected" }> =>
        message.type === "session-rejected",
    );
  return {
    session,
    frames,
    messages,
    accepted,
    rejections,
    token: () => accepted().at(-1)?.sessionToken,
    join: (clientId: string, extra: Record<string, unknown> = {}) =>
      session.handle({ t: "join", roomId: "LIFE", clientId, displayName: clientId, ...extra }),
  };
}

async function startedRoom() {
  const now = { value: 1_000 };
  const host = makeHost(now);
  const ada = client(host, "c-ada", true);
  await ada.join("ada", { create: true });
  const bea = client(host, "c-bea");
  await bea.join("bea");
  host.room.dispatch("ada", { type: "start-game" });
  return { now, host, ada, bea };
}

describe("room lifecycle", () => {
  it("hands the chair back to a host who refreshes within the grace window", async () => {
    const { host, ada } = await startedRoom();
    expect(host.getState().settings.hostId).toBe("ada");
    const token = ada.token();

    ada.session.close();
    // The room stays playable meanwhile.
    expect(host.getState().settings.hostId).toBe("bea");
    expect(host.room.pendingHostClaim).toBe("ada");

    const back = client(host, "c-ada-2");
    await back.join("ada", { sessionToken: token });
    expect(host.getState().settings.hostId).toBe("ada");
    // The board went with the chair, so it comes back with it.
    expect(host.getState().pickerId).toBe("ada");
    expect(host.room.pendingHostClaim).toBeUndefined();
  });

  it("keeps a removed player out even when their browser forgot its token", async () => {
    const { host, ada, bea } = await startedRoom();
    await ada.session.handle({
      t: "command",
      command: { type: "leave-game", targetPlayerId: "bea" },
    });
    expect(bea.rejections().at(-1)?.reason).toBe("kicked");
    const retry = client(host, "c-bea-2");
    await retry.join("bea");
    expect(retry.rejections().at(-1)?.reason).toBe("kicked");
  });

  it("does not hand the chair back once the grace window has passed", async () => {
    const { now, host, ada } = await startedRoom();
    const token = ada.token();
    ada.session.close();
    now.value += hostReclaimGraceMs + 1;

    const back = client(host, "c-ada-2");
    await back.join("ada", { sessionToken: token });
    expect(host.getState().settings.hostId).toBe("bea");
  });

  it("a host who hands the chair over on purpose has no claim to it", async () => {
    const { host, ada } = await startedRoom();
    await ada.session.handle({
      t: "command",
      command: { type: "configure-host", hostId: "bea" },
    });
    expect(host.getState().settings.hostId).toBe("bea");
    const token = ada.token();
    ada.session.close();

    const back = client(host, "c-ada-2");
    await back.join("ada", { sessionToken: token });
    expect(host.getState().settings.hostId).toBe("bea");
  });

  it("only gives a held seat back to the token that holds it", async () => {
    const { host, bea } = await startedRoom();
    bea.session.close();

    const impostor = client(host, "c-imp");
    await impostor.join("bea");
    expect(impostor.rejections()[0]?.reason).toBe("invalid-session");
    expect(host.getState().players.bea.connected).toBe(false);

    const back = client(host, "c-bea-2");
    await back.join("bea", { sessionToken: bea.token() });
    expect(back.accepted()).toHaveLength(1);
    expect(host.getState().players.bea.connected).toBe(true);
  });

  it("tells a removed player why, and keeps them out for a while", async () => {
    const { now, host, ada, bea } = await startedRoom();
    await ada.session.handle({
      t: "command",
      command: { type: "leave-game", targetPlayerId: "bea" },
    });

    expect(bea.rejections().at(-1)?.reason).toBe("kicked");
    expect(host.getState().players.bea).toBeUndefined();

    const retry = client(host, "c-bea-2");
    await retry.join("bea", { sessionToken: bea.token() });
    expect(retry.rejections().at(-1)?.reason).toBe("kicked");
    expect(host.getState().players.bea).toBeUndefined();

    now.value += kickBanMs + 1;
    const later = client(host, "c-bea-3");
    await later.join("bea", { sessionToken: bea.token() });
    expect(later.accepted()).toHaveLength(1);
    expect(host.getState().players.bea).toBeDefined();
  });

  it("refuses a joiner at the door when every seat is taken", async () => {
    const { host, ada } = await startedRoom();
    for (let index = 0; index < 10; index += 1) {
      await ada.session.handle({ t: "add-bot", id: `bot-${index}` });
    }
    expect(Object.keys(host.getState().players)).toHaveLength(12);

    const late = client(host, "c-late");
    await late.join("late");
    expect(late.accepted()).toHaveLength(0);
    expect(late.rejections()[0]?.reason).toBe("room-full");
    expect(late.rejections()[0]?.message).toMatch(/full/);

    // And a thirteenth bot is refused too, out loud.
    await ada.session.handle({ t: "add-bot", id: "bot-extra" });
    expect(host.getState().players["bot-extra"]).toBeUndefined();
    expect(
      ada.messages().some((m) => m.type === "message-rejected" && m.reason === "room-full"),
    ).toBe(true);
  });

  it("tells a guest who tries to add a bot that only the host can", async () => {
    const { host, bea } = await startedRoom();
    await bea.session.handle({ t: "add-bot", id: "bot-guest" });
    expect(host.getState().players["bot-guest"]).toBeUndefined();
    expect(
      bea.messages().some((m) => m.type === "message-rejected" && m.reason === "not-authorized"),
    ).toBe(true);
  });

  it("says a code names no room rather than opening one", async () => {
    const frames: ServerFrame[] = [];
    const session = new RoomSession({
      connectionId: "c-x",
      resolveRoom: async () => undefined,
      send: (frame) => frames.push(frame),
    });
    await session.handle({ t: "join", roomId: "QQQQ", clientId: "x" });
    const message = frames[0]?.t === "message" ? frames[0].message : undefined;
    expect(message).toMatchObject({ type: "session-rejected", reason: "room-not-found" });
  });

  it("won't let a new room land on a code somebody else is using", async () => {
    const { host } = await startedRoom();
    const stranger = client(host, "c-new");
    await stranger.join("stranger", { create: true });
    expect(stranger.rejections()[0]?.reason).toBe("room-code-taken");
    expect(host.getState().players.stranger).toBeUndefined();
  });

  it("lets the room's own host re-send create on a reconnect", async () => {
    const { host, ada } = await startedRoom();
    const token = ada.token();
    ada.session.close();
    const back = client(host, "c-ada-2");
    await back.join("ada", { create: true, sessionToken: token });
    expect(back.rejections()).toHaveLength(0);
    expect(back.accepted()).toHaveLength(1);
  });

  it("only the host may ask the room for a ruling", async () => {
    const { now, host, ada, bea } = await startedRoom();
    await ada.session.handle({ t: "command", command: { type: "pick-clue", clueId: "j-200" } });
    // Let the readout finish, ring in, answer.
    now.value = (host.getState().activeClue?.readoutEndsAt ?? 0) + 1;
    host.room.tick(now.value);
    await bea.session.handle({ t: "command", command: { type: "buzz" } });
    await bea.session.handle({ t: "command", command: { type: "submit-answer", answer: "Mars" } });
    host.room.tick(now.value);
    const active = host.getState().activeClue;
    expect(active?.answerRevealed).toBe(true);
    expect(active?.currentJudgePlayerId).toBe("bea");

    await bea.session.handle({ t: "ai-judge", targetPlayerId: "bea" });
    expect(host.getState().activeClue?.judges.bea).toBeUndefined();
    expect(
      bea.messages().some((m) => m.type === "message-rejected" && m.reason === "not-authorized"),
    ).toBe(true);

    await ada.session.handle({ t: "ai-judge", targetPlayerId: "bea" });
    expect(host.getState().scores.bea).toBe(200);
  });
});
