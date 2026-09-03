import { configureRoomStore, getRoomStore } from "./room-registry";
import { createRedisClient, RedisRoomStore } from "./redis-room-store";
import type { RoomStore } from "./room-store";

let bootstrap: Promise<RoomStore> | undefined;

/**
 * Attaches Redis to the room registry the first time anything touches rooms.
 * With no `REDIS_URL` the registry keeps its memory-only store, so local
 * development and tests need no server. Runs once per process.
 */
export function ensureRoomStore(): Promise<RoomStore> {
  bootstrap ??= (async () => {
    const existing = getRoomStore();
    if (existing.kind !== "memory-only") return existing;
    try {
      const client = await createRedisClient();
      if (!client) return existing;
      // Confirm the server is actually there before promising durability, so
      // the startup line reflects what rooms will really get.
      await withTimeout(client.ping(), 5_000);
      const store = configureRoomStore(new RedisRoomStore({ client }));
      console.log("[rooms] persistence: redis");
      return store;
    } catch (error) {
      // Redis being unreachable costs durability, not the ability to play.
      console.warn("[rooms] redis unavailable, rooms stay in memory:", error);
      return existing;
    }
  })();
  return bootstrap;
}

/** Test helper: forget the one-shot bootstrap so a new store can be attached. */
export function resetRoomStoreBootstrap() {
  bootstrap = undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref?.(),
    ),
  ]);
}
