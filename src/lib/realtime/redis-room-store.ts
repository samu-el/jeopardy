import type { Redis } from "ioredis";
import {
  isUsableSnapshot,
  type RoomSnapshot,
  type RoomStore,
} from "./room-store";

/** The slice of ioredis this store uses — kept small so it can be faked. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  quit?(): Promise<unknown>;
}

export interface RedisRoomStoreOptions {
  client: RedisLike;
  /** Namespace, so one Redis can host several deployments. */
  prefix?: string;
  /** How long an untouched room survives. Refreshed on every save. */
  ttlSeconds?: number;
  /** Called when Redis misbehaves; defaults to a single warn line. */
  onError?: (operation: string, error: unknown) => void;
}

/** A day is long enough to resume an interrupted game, short enough to clean up. */
export const defaultRoomTtlSeconds = 24 * 60 * 60;

/**
 * Redis-backed room persistence. Every operation swallows transport errors
 * and reports "not stored" instead: a Redis outage costs durability, never
 * the game in progress.
 */
export class RedisRoomStore implements RoomStore {
  readonly kind = "redis";
  private readonly client: RedisLike;
  private readonly prefix: string;
  private readonly ttlSeconds: number;
  private readonly onError: (operation: string, error: unknown) => void;

  constructor({
    client,
    prefix = "jeopardy:room:",
    ttlSeconds = defaultRoomTtlSeconds,
    onError,
  }: RedisRoomStoreOptions) {
    this.client = client;
    this.prefix = prefix;
    this.ttlSeconds = ttlSeconds;
    this.onError =
      onError ??
      ((operation, error) => {
        console.warn(`[rooms] redis ${operation} failed:`, error);
      });
  }

  private key(roomId: string): string {
    return `${this.prefix}${roomId}`;
  }

  async load(roomId: string): Promise<RoomSnapshot | undefined> {
    try {
      const raw = await this.client.get(this.key(roomId));
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      if (!isUsableSnapshot(parsed)) {
        // A snapshot from an older shape is worse than none: drop it rather
        // than hydrate a room the engine no longer understands.
        await this.delete(roomId);
        return undefined;
      }
      return parsed;
    } catch (error) {
      this.onError("load", error);
      return undefined;
    }
  }

  async save(snapshot: RoomSnapshot): Promise<void> {
    try {
      await this.client.set(
        this.key(snapshot.roomId),
        JSON.stringify(snapshot),
        "EX",
        this.ttlSeconds,
      );
    } catch (error) {
      this.onError("save", error);
    }
  }

  async delete(roomId: string): Promise<void> {
    try {
      await this.client.del(this.key(roomId));
    } catch (error) {
      this.onError("delete", error);
    }
  }

  async list(): Promise<string[]> {
    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      return keys.map((key) => key.slice(this.prefix.length));
    } catch (error) {
      this.onError("list", error);
      return [];
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit?.();
    } catch (error) {
      this.onError("close", error);
    }
  }
}

/**
 * Builds a Redis client from `REDIS_URL`. Returns undefined when the variable
 * is unset — Redis is optional, and without it rooms simply live in memory.
 * ioredis is imported lazily so a client bundle never pulls it in.
 */
export async function createRedisClient(
  url = process.env.REDIS_URL,
): Promise<Redis | undefined> {
  if (!url) return undefined;
  const { default: IORedis } = await import("ioredis");
  const client = new IORedis(url, {
    // Fail fast rather than hanging a room save forever on a dead server...
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
    // ...but do queue while the initial connection is still coming up, or
    // the first room created at boot would silently fail to persist.
    enableOfflineQueue: true,
    lazyConnect: false,
  });
  client.on("error", (error: unknown) => {
    console.warn("[rooms] redis connection error:", error);
  });
  return client;
}
