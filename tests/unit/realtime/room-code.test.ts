import { describe, expect, it } from "vitest";
import { generateRoomCode, normalizeRoomCode } from "@/lib/realtime";

describe("room codes", () => {
  it("mints readable codes without ambiguous characters", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const code = generateRoomCode();
      expect(code).toHaveLength(4);
      // No I/O/0/1: a code gets read aloud and typed in from across a room.
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });

  it("normalises however the code was typed", () => {
    expect(normalizeRoomCode(" ab2d ")).toBe("AB2D");
    expect(normalizeRoomCode("a-b2d")).toBe("A-B2D");
    expect(normalizeRoomCode("ab.2d!")).toBe("AB2D");
    expect(normalizeRoomCode("")).toBe("");
  });

  it("keeps a normalised code stable", () => {
    const code = generateRoomCode();
    expect(normalizeRoomCode(code)).toBe(code);
  });
});
