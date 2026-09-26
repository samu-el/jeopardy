/**
 * What this browser remembers about the rooms it has sat in: which seat, and
 * the token that proves it. A refresh, a reopened invite link or a host
 * coming back to their own code reads this to walk straight back into the
 * room instead of being asked who they are again.
 *
 * Storage can be missing (private mode, a blocked origin) or full; every
 * read and write here fails quietly and the app simply asks again.
 */

const roomsKey = "jeopardy.rooms.v1";
const displayIdKey = "jeopardy.display-id.v1";

/** A seat older than this is not worth trying to reclaim. */
export const roomSeatTtlMs = 12 * 60 * 60_000;

export interface RoomSeatMemory {
  roomId: string;
  clientId: string;
  sessionToken?: string;
  /** This browser opened the room. */
  host?: boolean;
  savedAt: number;
}

type SeatTable = Record<string, RoomSeatMemory>;

/** The minimum of the Web Storage API these helpers need. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function local(): KeyValueStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function session(): KeyValueStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function seatKey(roomId: string, clientId: string) {
  return `${roomId}:${clientId}`;
}

function readTable(storage: KeyValueStorage | undefined): SeatTable {
  if (!storage) return {};
  try {
    const raw = storage.getItem(roomsKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as SeatTable) : {};
  } catch {
    return {};
  }
}

function writeTable(storage: KeyValueStorage | undefined, table: SeatTable) {
  if (!storage) return;
  try {
    storage.setItem(roomsKey, JSON.stringify(table));
  } catch {
    // Quota or a blocked origin: the next visit just asks again.
  }
}

/** Drops anything past its useful life so the table never grows unbounded. */
export function pruneSeats(table: SeatTable, now: number): SeatTable {
  return Object.fromEntries(
    Object.entries(table).filter(([, seat]) => now - (seat?.savedAt ?? 0) <= roomSeatTtlMs),
  );
}

export function recallRoomSeat(
  roomId: string,
  clientId: string,
  { now = Date.now(), storage = local() }: { now?: number; storage?: KeyValueStorage } = {},
): RoomSeatMemory | undefined {
  const seat = readTable(storage)[seatKey(roomId, clientId)];
  if (!seat || now - seat.savedAt > roomSeatTtlMs) return undefined;
  return seat;
}

export function rememberRoomSeat(
  seat: Omit<RoomSeatMemory, "savedAt">,
  { now = Date.now(), storage = local() }: { now?: number; storage?: KeyValueStorage } = {},
) {
  const table = pruneSeats(readTable(storage), now);
  const key = seatKey(seat.roomId, seat.clientId);
  const previous = table[key];
  table[key] = {
    ...previous,
    ...seat,
    // A token only ever moves forward; a write without one keeps the last.
    sessionToken: seat.sessionToken ?? previous?.sessionToken,
    host: seat.host ?? previous?.host,
    savedAt: now,
  };
  writeTable(storage, table);
}

export function forgetRoomSeat(
  roomId: string,
  clientId: string,
  { storage = local() }: { storage?: KeyValueStorage } = {},
) {
  const table = readTable(storage);
  delete table[seatKey(roomId, clientId)];
  writeTable(storage, table);
}

/**
 * A television gets its own id, kept for the life of the tab. Sharing the
 * browser's player id used to make a display opened next to the host take
 * the host's own seat.
 */
export function displayClientId(storage: KeyValueStorage | undefined = session()): string {
  try {
    const existing = storage?.getItem(displayIdKey);
    if (existing) return existing;
  } catch {
    // Fall through to a fresh id.
  }
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const id = `display-${random}`;
  try {
    storage?.setItem(displayIdKey, id);
  } catch {
    // An id for this page load only is still a separate seat.
  }
  return id;
}

/**
 * Puts the room code in the address bar (or takes it out), without a
 * navigation. A refresh or a copied URL then lands back in the same room.
 */
export function writeRoomToUrl(roomId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (roomId) {
      if (url.searchParams.get("room") === roomId) return;
      url.searchParams.set("room", roomId);
    } else {
      if (!url.searchParams.has("room") && !url.searchParams.has("display")) return;
      url.searchParams.delete("room");
      url.searchParams.delete("display");
    }
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // An address bar we can't write to costs the refresh shortcut, nothing more.
  }
}
