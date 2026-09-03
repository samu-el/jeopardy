import { afterEach, describe, expect, it } from "vitest";
import { baselineBotProfiles } from "@/lib/foundation/game-contracts";
import type { GameClue } from "@/lib/game";
import {
  configureRoomStore,
  createRoom,
  deleteRoom,
  getRoom,
  InMemoryRoomStore,
  persistRoom,
  resetRoomRegistry,
  resolveRoom,
  roomSnapshotVersion,
  sweepIdleRooms,
  type RoomHost,
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

afterEach(() => {
  resetRoomRegistry();
});

function seatAndPlay(room: RoomHost) {
  room.room.dispatch("ada", { type: "join-game", displayName: "Ada" });
  room.room.dispatch("gra", { type: "join-game", displayName: "Grace" });
  room.room.dispatch("ada", { type: "start-game" });
  room.room.dispatch("ada", { type: "pick-clue", clueId: "j-200" });
  room.room.dispatch("ada", { type: "reveal-answer" });
  room.room.dispatch("ada", {
    type: "judge-answer",
    targetPlayerId: "ada",
    correct: true,
  });
  room.room.dispatch("ada", { type: "skip" });
  room.room.postChat({ kind: "player", authorId: "gra", authorName: "Grace", text: "nice" });
}

function liveRooms(): Map<string, RoomHost> {
  const registry = globalThis as unknown as Record<
    symbol,
    { rooms: Map<string, RoomHost> } | undefined
  >;
  return registry[Symbol.for("jeopardy.room-registry")]?.rooms ?? new Map();
}

/** Drops every live room while leaving the store alone — a process restart. */
function restartProcess() {
  const rooms = liveRooms();
  for (const room of rooms.values()) {
    room.destroy();
  }
  rooms.clear();
}

describe("room persistence", () => {
  it("brings a room back after a restart with scores, board and chat intact", async () => {
    const store = new InMemoryRoomStore();
    configureRoomStore(store);

    // No round-title card, so the test can pick a clue right away.
    const room = createRoom({ hostId: "ada", clues, settings: { roundIntroMs: 0 } });
    const code = room.roomId;
    seatAndPlay(room);
    await persistRoom(room);

    restartProcess();
    expect(getRoom(code)).toBeUndefined();

    const restored = await resolveRoom(code);
    expect(restored).toBeDefined();
    const state = restored!.getState();

    expect(state.scores.ada).toBe(200);
    expect(state.revealedClueIds).toContain("j-200");
    expect(state.round).toBe("jeopardy");
    expect(state.settings.hostId).toBe("ada");
    expect(Object.keys(state.cluesById)).toEqual(["j-200", "j-400"]);
    expect(restored!.room.getChatHistory().some((line) => line.text === "nice")).toBe(true);
  });

  it("marks restored humans as disconnected until they come back", async () => {
    const store = new InMemoryRoomStore();
    configureRoomStore(store);
    const room = createRoom({ hostId: "ada", clues });
    const code = room.roomId;
    room.room.dispatch("ada", { type: "join-game", displayName: "Ada" });
    room.addBot({ id: "bot-1", displayName: "Legend", profileId: "legend" });
    room.room.dispatch("ada", { type: "start-game" });
    await persistRoom(room);

    restartProcess();
    const restored = await resolveRoom(code);
    const players = restored!.getState().players;

    expect(players.ada.connected).toBe(false);
    // A bot has no connection to lose — it resumes with the room.
    expect(players["bot-1"].connected).toBe(true);
  });

  it("keeps bots playing after a restart", async () => {
    const store = new InMemoryRoomStore();
    configureRoomStore(store);
    const room = createRoom({ hostId: "ada", clues });
    const code = room.roomId;
    room.addBot({ id: "bot-1", displayName: "Legend", profileId: "legend" });
    await persistRoom(room);

    const snapshot = await store.load(code);
    expect(snapshot?.bots["bot-1"]).toMatchObject({
      id: baselineBotProfiles[3].id,
    });

    restartProcess();
    const restored = await resolveRoom(code);
    expect(restored!.director.hasBots()).toBe(true);
  });

  it("writes changes through without being asked", async () => {
    const store = new InMemoryRoomStore();
    configureRoomStore(store);
    const room = createRoom({ hostId: "ada", clues });

    // Creating a room reserves its code immediately.
    await Promise.resolve();
    expect(await store.load(room.roomId)).toBeDefined();

    room.room.dispatch("ada", { type: "join-game", displayName: "Ada" });
    room.flush();
    await Promise.resolve();

    const snapshot = await store.load(room.roomId);
    expect(snapshot?.version).toBe(roomSnapshotVersion);
    expect(snapshot?.state.players.ada.displayName).toBe("Ada");
  });

  it("evicts an idle room from memory but can still bring it back", async () => {
    const store = new InMemoryRoomStore();
    configureRoomStore(store);
    const room = createRoom({ hostId: "ada", clues });
    const code = room.roomId;
    room.room.dispatch("ada", { type: "join-game", displayName: "Ada" });
    room.flush();
    await Promise.resolve();

    const evicted = sweepIdleRooms(Date.now() + 60 * 60_000, 30 * 60_000);

    expect(evicted).toContain(code);
    expect(getRoom(code)).toBeUndefined();
    expect(await store.load(code)).toBeDefined();
    expect((await resolveRoom(code))?.getState().players.ada.displayName).toBe("Ada");
  });

  it("forgets a deleted room everywhere", async () => {
    const store = new InMemoryRoomStore();
    configureRoomStore(store);
    const room = createRoom({ hostId: "ada", clues });
    await persistRoom(room);

    await deleteRoom(room.roomId);

    expect(await store.load(room.roomId)).toBeUndefined();
    expect(await resolveRoom(room.roomId)).toBeUndefined();
  });

  it("restores a room once when two clients arrive together", async () => {
    const store = new InMemoryRoomStore();
    configureRoomStore(store);
    const room = createRoom({ hostId: "ada", clues });
    const code = room.roomId;
    await persistRoom(room);
    restartProcess();

    const [first, second] = await Promise.all([resolveRoom(code), resolveRoom(code)]);

    expect(first).toBeDefined();
    expect(second).toBe(first);
    expect([...liveRooms().keys()].filter((id) => id === code)).toHaveLength(1);
  });

  it("keeps the game playable when the store is down", async () => {
    const store = new InMemoryRoomStore();
    configureRoomStore(store);
    const room = createRoom({ hostId: "ada", clues });
    store.failing = true;

    room.room.dispatch("ada", { type: "join-game", displayName: "Ada" });
    room.room.dispatch("ada", { type: "start-game" });
    room.flush();
    await Promise.resolve();

    // The round still started; only durability was lost.
    expect(room.getState().round).toBe("jeopardy");
    await expect(resolveRoom("SOMEWHERE")).resolves.toBeUndefined();
  });
});
