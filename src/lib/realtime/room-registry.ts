import type { GameClue, GameSettings } from "@/lib/game";
import { RoomHost } from "./room-host";
import { NullRoomStore, type RoomStore } from "./room-store";

export interface CreateRoomInput {
  roomId?: string;
  hostId?: string;
  clues?: GameClue[];
  settings?: Partial<GameSettings>;
}

interface RegistryShape {
  rooms: Map<string, RoomHost>;
  /** In-flight restores, so two joins never hydrate the same room twice. */
  loading: Map<string, Promise<RoomHost | undefined>>;
  store: RoomStore;
  sweeper?: ReturnType<typeof setInterval>;
}

/**
 * Rooms live on `globalThis` on purpose. The Next.js route handlers and the
 * Socket.IO bridge are bundled separately but run in the same process, so a
 * module-level Map would give each of them its own copy of the room list.
 */
const registryKey = Symbol.for("jeopardy.room-registry");

function registry(): RegistryShape {
  const globalRef = globalThis as unknown as Record<symbol, RegistryShape | undefined>;
  let existing = globalRef[registryKey];
  if (!existing) {
    existing = { rooms: new Map(), loading: new Map(), store: new NullRoomStore() };
    globalRef[registryKey] = existing;
  }
  return existing;
}

/** Rooms with nobody connected are evicted from memory after this long. */
export const roomIdleTimeoutMs = 30 * 60_000;

const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short, unambiguous, easy to read out loud over a call. */
export function generateRoomCode(length = 4): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += roomCodeAlphabet[Math.floor(Math.random() * roomCodeAlphabet.length)];
  }
  return code;
}

export function normalizeRoomCode(roomId: string): string {
  return roomId.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

/** Swaps in the backing store. Pass nothing to go back to memory-only. */
export function configureRoomStore(store: RoomStore = new NullRoomStore()) {
  registry().store = store;
  return store;
}

export function getRoomStore(): RoomStore {
  return registry().store;
}

/**
 * Writes a room through to the store. A store outage costs durability, not
 * the game in progress, so failures are logged and swallowed here rather
 * than surfacing as an unhandled rejection in the middle of a round.
 */
export async function persistRoom(room: RoomHost): Promise<boolean> {
  try {
    await registry().store.save(room.snapshot());
    return true;
  } catch (error) {
    console.warn(`[rooms] could not persist ${room.roomId}:`, error);
    return false;
  }
}

function trackRoom(room: RoomHost): RoomHost {
  registry().rooms.set(room.roomId, room);
  ensureSweeper();
  return room;
}

/** Write-behind: the host reports itself dirty, we push the snapshot out. */
function persistOnChange(room: RoomHost) {
  void persistRoom(room);
}

export function createRoom(input: CreateRoomInput = {}): RoomHost {
  const rooms = registry().rooms;
  let roomId = input.roomId ? normalizeRoomCode(input.roomId) : generateRoomCode();
  while (rooms.has(roomId)) {
    roomId = generateRoomCode();
  }
  const host = new RoomHost({
    roomId,
    clues: input.clues ?? [],
    settings: { hostId: input.hostId, ...input.settings },
    onDirty: persistOnChange,
  }).start();
  trackRoom(host);
  // Reserve the code straight away so a restart can't hand it out twice.
  void persistRoom(host);
  return host;
}

/** Synchronous lookup: only finds rooms already live in this process. */
export function getRoom(roomId: string): RoomHost | undefined {
  return registry().rooms.get(normalizeRoomCode(roomId));
}

/**
 * Finds a room, bringing it back from the store when this process doesn't
 * have it — after a restart, or after it was evicted for being idle.
 * Concurrent callers share one restore.
 */
export async function resolveRoom(roomId: string): Promise<RoomHost | undefined> {
  const normalized = normalizeRoomCode(roomId);
  const live = getRoom(normalized);
  if (live) return live;

  const state = registry();
  const inFlight = state.loading.get(normalized);
  if (inFlight) return inFlight;

  const load = (async () => {
    try {
      const snapshot = await state.store.load(normalized).catch((error) => {
        console.warn(`[rooms] could not load ${normalized}:`, error);
        return undefined;
      });
      if (!snapshot) return undefined;
      // Another caller may have created the room while we were waiting.
      const raced = getRoom(normalized);
      if (raced) return raced;
      const host = new RoomHost({
        roomId: normalized,
        restoreFrom: snapshot,
        onDirty: persistOnChange,
      }).start();
      return trackRoom(host);
    } finally {
      state.loading.delete(normalized);
    }
  })();

  state.loading.set(normalized, load);
  return load;
}

export async function getOrCreateRoom(
  roomId: string,
  input: CreateRoomInput = {},
): Promise<RoomHost> {
  const normalized = normalizeRoomCode(roomId);
  return (await resolveRoom(normalized)) ?? createRoom({ ...input, roomId: normalized });
}

/** Ends a room for good: out of memory and out of the store. */
export async function deleteRoom(roomId: string): Promise<boolean> {
  const rooms = registry().rooms;
  const normalized = normalizeRoomCode(roomId);
  const room = rooms.get(normalized);
  room?.destroy();
  const removed = rooms.delete(normalized);
  try {
    await registry().store.delete(normalized);
  } catch (error) {
    console.warn(`[rooms] could not delete ${normalized}:`, error);
  }
  return removed;
}

export function listRoomIds(): string[] {
  return [...registry().rooms.keys()];
}

export function roomSummary(room: RoomHost) {
  const state = room.getState();
  return {
    id: room.roomId,
    round: state.round,
    hostId: state.settings.hostId,
    hasGame: Object.keys(state.cluesById).length > 0,
    players: Object.values(state.players).map((player) => ({
      id: player.id,
      displayName: player.displayName,
      kind: player.kind,
      connected: player.connected,
      spectator: player.spectator,
      emoji: player.emoji,
      color: player.color,
    })),
  };
}

/**
 * Drops idle rooms out of memory. With a store configured this is eviction,
 * not deletion: the snapshot stays put and the room comes back on the next
 * join. Without one it is the end of the room.
 */
export function sweepIdleRooms(now = Date.now(), idleMs = roomIdleTimeoutMs): string[] {
  const rooms = registry().rooms;
  const removed: string[] = [];
  for (const [roomId, room] of rooms) {
    const idle = now - room.lastActivityAt > idleMs;
    if (idle && room.room.connectionCount === 0) {
      room.flush();
      room.destroy();
      rooms.delete(roomId);
      removed.push(roomId);
    }
  }
  return removed;
}

function ensureSweeper() {
  const state = registry();
  if (state.sweeper) return;
  state.sweeper = setInterval(() => sweepIdleRooms(), 5 * 60_000);
  (state.sweeper as unknown as { unref?: () => void }).unref?.();
}

/** Test helper: tears every room down and clears the registry. */
export function resetRoomRegistry() {
  const state = registry();
  for (const room of state.rooms.values()) {
    room.destroy();
  }
  state.rooms.clear();
  state.loading.clear();
  state.store = new NullRoomStore();
  if (state.sweeper) {
    clearInterval(state.sweeper);
    state.sweeper = undefined;
  }
}
