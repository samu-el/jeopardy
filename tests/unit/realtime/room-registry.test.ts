import { afterEach, describe, expect, it } from "vitest";
import {
  createRoom,
  deleteRoom,
  generateRoomCode,
  getOrCreateRoom,
  getRoom,
  listRoomIds,
  normalizeRoomCode,
  resetRoomRegistry,
  roomSummary,
  sweepIdleRooms,
} from "@/lib/realtime";

afterEach(() => {
  resetRoomRegistry();
});

describe("room registry", () => {
  it("mints readable codes without ambiguous characters", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("finds a room however the code was typed", () => {
    const room = createRoom({ hostId: "ada" });

    expect(getRoom(room.roomId.toLowerCase())).toBe(room);
    expect(getRoom(` ${room.roomId} `)).toBe(room);
    expect(normalizeRoomCode(" ab-3d! ")).toBe("AB-3D");
  });

  it("only creates a room when asked to", () => {
    expect(getRoom("NOPE")).toBeUndefined();
    const created = getOrCreateRoom("NOPE");
    expect(created.roomId).toBe("NOPE");
    expect(getOrCreateRoom("NOPE")).toBe(created);
  });

  it("reports who is in a room", () => {
    const room = createRoom({ hostId: "ada" });
    room.room.dispatch("ada", { type: "join-game", displayName: "Ada", emoji: "🦊" });

    expect(roomSummary(room)).toMatchObject({
      id: room.roomId,
      round: "lobby",
      hostId: "ada",
      hasGame: false,
      players: [{ id: "ada", displayName: "Ada", emoji: "🦊", connected: true }],
    });
  });

  it("deletes a room and tears its host down", () => {
    const room = createRoom({ hostId: "ada" });

    expect(deleteRoom(room.roomId)).toBe(true);
    expect(room.isDestroyed).toBe(true);
    expect(listRoomIds()).not.toContain(room.roomId);
  });

  it("sweeps rooms nobody has touched, and keeps ones with a live connection", () => {
    const idle = createRoom({ hostId: "ada" });
    const busy = createRoom({ hostId: "grace" });
    const session = busy.room.issueSession("grace");
    busy.room.connect({ ...session, connectionId: "conn-grace" }, () => {});

    const removed = sweepIdleRooms(Date.now() + 60 * 60_000, 30 * 60_000);

    expect(removed).toContain(idle.roomId);
    expect(removed).not.toContain(busy.roomId);
    expect(getRoom(busy.roomId)).toBe(busy);
  });
});
