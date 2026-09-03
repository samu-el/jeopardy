import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Redis } from "ioredis";
import type { GameClue } from "@/lib/game";
import {
  configureRoomStore,
  createRoom,
  deleteRoom,
  resetRoomRegistry,
  resolveRoom,
  type RoomHost,
} from "@/lib/realtime";
import {
  createRedisClient,
  RedisRoomStore,
} from "@/lib/realtime/redis-room-store";

const redisUrl = process.env.REDIS_URL;

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

/**
 * Runs against a real server when REDIS_URL is set, and is skipped otherwise
 * so the suite stays runnable with no infrastructure. CI provides one.
 */
describe.skipIf(!redisUrl)("Redis persistence (live server)", () => {
  let client: Redis | undefined;
  const createdRooms: string[] = [];

  beforeAll(async () => {
    client = await createRedisClient(redisUrl);
    // Make sure the connection is up before the first save.
    await client?.ping();
  });

  afterEach(async () => {
    for (const roomId of createdRooms.splice(0)) {
      await deleteRoom(roomId);
    }
    resetRoomRegistry();
  });

  afterAll(async () => {
    await client?.quit();
  });

  function attachStore() {
    return configureRoomStore(
      new RedisRoomStore({ client: client!, prefix: "jeopardy-test:room:", ttlSeconds: 60 }),
    );
  }

  /** Drops live rooms while leaving Redis alone — a process restart. */
  function restartProcess() {
    const registry = globalThis as unknown as Record<
      symbol,
      { rooms: Map<string, RoomHost> } | undefined
    >;
    const rooms = registry[Symbol.for("jeopardy.room-registry")]?.rooms;
    for (const room of rooms?.values() ?? []) {
      room.destroy();
    }
    rooms?.clear();
  }

  it("survives a restart with the game exactly where it was", async () => {
    const store = attachStore();
    const room = createRoom({ hostId: "ada", clues, settings: { roundIntroMs: 0 } });
    createdRooms.push(room.roomId);

    room.room.dispatch("ada", { type: "join-game", displayName: "Ada" });
    room.room.dispatch("ada", { type: "start-game" });
    room.room.dispatch("ada", { type: "pick-clue", clueId: "j-200" });
    room.room.dispatch("ada", { type: "reveal-answer" });
    room.room.dispatch("ada", {
      type: "judge-answer",
      targetPlayerId: "ada",
      correct: true,
    });
    room.room.postChat({ kind: "player", authorId: "ada", authorName: "Ada", text: "still here" });
    room.flush();
    // Let the write-behind save land in Redis.
    await new Promise((resolve) => setTimeout(resolve, 150));

    restartProcess();
    // Same store, brand new process state.
    configureRoomStore(store);

    const restored = await resolveRoom(room.roomId);
    expect(restored).toBeDefined();
    expect(restored).not.toBe(room);
    expect(restored!.getState().scores.ada).toBe(200);
    expect(restored!.getState().activeClue?.clueId).toBe("j-200");
    expect(restored!.getState().players.ada.connected).toBe(false);
    expect(
      restored!.room.getChatHistory().some((line) => line.text === "still here"),
    ).toBe(true);
  });

  it("stops resolving a room once it is deleted", async () => {
    attachStore();
    const room = createRoom({ hostId: "ada", clues });
    room.flush();
    await new Promise((resolve) => setTimeout(resolve, 150));

    await deleteRoom(room.roomId);
    restartProcess();

    expect(await resolveRoom(room.roomId)).toBeUndefined();
  });
});
