import { describe, expect, it } from "vitest";
import { roomSnapshotVersion, type RoomSnapshot } from "@/lib/realtime";
// Imported by path, not through the barrel: the Redis adapter is server-only
// and must never be pulled into a client bundle.
import {
  defaultRoomTtlSeconds,
  RedisRoomStore,
  type RedisLike,
} from "@/lib/realtime/redis-room-store";
import { createGame } from "@/lib/game";

/** Enough of ioredis to exercise the store without a server. */
class FakeRedis implements RedisLike {
  readonly entries = new Map<string, { value: string; ttl: number }>();
  readonly calls: string[] = [];
  failOn: string | null = null;
  quitCalled = false;

  async get(key: string) {
    this.record("get", key);
    return this.entries.get(key)?.value ?? null;
  }

  async set(key: string, value: string, mode: "EX", seconds: number) {
    this.record("set", key);
    expect(mode).toBe("EX");
    this.entries.set(key, { value, ttl: seconds });
    return "OK";
  }

  async del(key: string) {
    this.record("del", key);
    return this.entries.delete(key) ? 1 : 0;
  }

  async keys(pattern: string) {
    this.record("keys", pattern);
    const prefix = pattern.replace(/\*$/, "");
    return [...this.entries.keys()].filter((key) => key.startsWith(prefix));
  }

  async quit() {
    this.quitCalled = true;
    return "OK";
  }

  private record(operation: string, key: string) {
    this.calls.push(`${operation} ${key}`);
    if (this.failOn === operation) {
      throw new Error(`redis ${operation} exploded`);
    }
  }
}

function snapshot(roomId = "ABCD"): RoomSnapshot {
  return {
    version: roomSnapshotVersion,
    roomId,
    state: createGame({ roomId, players: [], clues: [], now: 0 }),
    chat: [],
    bots: {},
    savedAt: 1_000,
  };
}

function makeStore(overrides: Partial<ConstructorParameters<typeof RedisRoomStore>[0]> = {}) {
  const client = new FakeRedis();
  const errors: string[] = [];
  const store = new RedisRoomStore({
    client,
    onError: (operation) => errors.push(operation),
    ...overrides,
  });
  return { client, store, errors };
}

describe("RedisRoomStore", () => {
  it("round-trips a snapshot under a namespaced key with a TTL", async () => {
    const { client, store } = makeStore();

    await store.save(snapshot("ABCD"));
    const loaded = await store.load("ABCD");

    expect(client.entries.has("jeopardy:room:ABCD")).toBe(true);
    expect(client.entries.get("jeopardy:room:ABCD")?.ttl).toBe(defaultRoomTtlSeconds);
    expect(loaded?.roomId).toBe("ABCD");
    expect(loaded?.state.roomId).toBe("ABCD");
  });

  it("honours a custom prefix and TTL", async () => {
    const { client, store } = makeStore({ prefix: "staging:", ttlSeconds: 60 });

    await store.save(snapshot("WXYZ"));

    expect(client.entries.get("staging:WXYZ")?.ttl).toBe(60);
    expect(await store.list()).toEqual(["WXYZ"]);
  });

  it("reports a missing room rather than inventing one", async () => {
    const { store } = makeStore();
    expect(await store.load("GONE")).toBeUndefined();
  });

  it("discards a snapshot written by an older shape", async () => {
    const { client, store } = makeStore();
    client.entries.set("jeopardy:room:OLD1", {
      value: JSON.stringify({ ...snapshot("OLD1"), version: 0 }),
      ttl: 10,
    });

    expect(await store.load("OLD1")).toBeUndefined();
    // And it cleans up, so it isn't re-read on every join.
    expect(client.entries.has("jeopardy:room:OLD1")).toBe(false);
  });

  it("discards unparseable content", async () => {
    const { client, store } = makeStore();
    client.entries.set("jeopardy:room:JUNK", { value: "not json", ttl: 10 });

    expect(await store.load("JUNK")).toBeUndefined();
  });

  it("treats a Redis failure as 'not stored' instead of throwing", async () => {
    const { client, store, errors } = makeStore();
    client.failOn = "get";
    await expect(store.load("ABCD")).resolves.toBeUndefined();

    client.failOn = "set";
    await expect(store.save(snapshot())).resolves.toBeUndefined();

    client.failOn = "del";
    await expect(store.delete("ABCD")).resolves.toBeUndefined();

    client.failOn = "keys";
    await expect(store.list()).resolves.toEqual([]);

    expect(errors).toEqual(["load", "save", "delete", "list"]);
  });

  it("closes the client", async () => {
    const { client, store } = makeStore();
    await store.close();
    expect(client.quitCalled).toBe(true);
  });
});
