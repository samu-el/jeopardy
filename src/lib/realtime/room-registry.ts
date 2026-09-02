import type { GameClue, GameSettings } from "@/lib/game";
import { RoomHost } from "./room-host";

export interface CreateRoomInput {
  roomId?: string;
  hostId?: string;
  clues?: GameClue[];
  settings?: Partial<GameSettings>;
}

interface RegistryShape {
  rooms: Map<string, RoomHost>;
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
    existing = { rooms: new Map() };
    globalRef[registryKey] = existing;
  }
  return existing;
}

/** Rooms with nobody connected are reaped after this long. */
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
  }).start();
  rooms.set(roomId, host);
  ensureSweeper();
  return host;
}

export function getRoom(roomId: string): RoomHost | undefined {
  return registry().rooms.get(normalizeRoomCode(roomId));
}

export function getOrCreateRoom(roomId: string, input: CreateRoomInput = {}): RoomHost {
  const normalized = normalizeRoomCode(roomId);
  return getRoom(normalized) ?? createRoom({ ...input, roomId: normalized });
}

export function deleteRoom(roomId: string): boolean {
  const rooms = registry().rooms;
  const normalized = normalizeRoomCode(roomId);
  const room = rooms.get(normalized);
  room?.destroy();
  return rooms.delete(normalized);
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

/** Drops rooms nobody has touched, so a long-lived server doesn't leak. */
export function sweepIdleRooms(now = Date.now(), idleMs = roomIdleTimeoutMs): string[] {
  const rooms = registry().rooms;
  const removed: string[] = [];
  for (const [roomId, room] of rooms) {
    const idle = now - room.lastActivityAt > idleMs;
    if (idle && room.room.connectionCount === 0) {
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
  if (state.sweeper) {
    clearInterval(state.sweeper);
    state.sweeper = undefined;
  }
}
