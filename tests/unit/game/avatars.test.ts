import { describe, expect, it } from "vitest";
import { monogramFor, normalizeAvatar, normalizeAvatarColor } from "@/lib/game";
import { decodeClientFrame } from "@/lib/realtime/ws-protocol";

describe("avatars", () => {
  it("keeps icon keys and the initial, and nothing else", () => {
    expect(normalizeAvatar("rocket")).toBe("rocket");
    expect(normalizeAvatar("initial")).toBe("initial");
    expect(normalizeAvatar("\u{1F98A}")).toBeUndefined();
    expect(normalizeAvatar("Rocket")).toBeUndefined();
    expect(normalizeAvatar(42)).toBeUndefined();
  });

  it("keeps hex colours only", () => {
    expect(normalizeAvatarColor("#33d684")).toBe("#33d684");
    expect(normalizeAvatarColor("#FFF")).toBe("#FFF");
    expect(normalizeAvatarColor("red")).toBeUndefined();
    expect(normalizeAvatarColor("#12345")).toBeUndefined();
  });

  it("takes the first letter or digit of a name as its monogram", () => {
    expect(monogramFor("ada")).toBe("A");
    expect(monogramFor("  \u{1F98A} zoe")).toBe("Z");
    expect(monogramFor("élodie")).toBe("É");
    expect(monogramFor("7up")).toBe("7");
    expect(monogramFor("\u{1F98A}!")).toBeUndefined();
  });

  it("drops the emoji an older client puts on its join frame", () => {
    const frame = decodeClientFrame(
      JSON.stringify({ t: "join", roomId: "R", clientId: "c", emoji: "\u{1F98A}" }),
    );
    expect(frame).toMatchObject({ t: "join", avatar: undefined });
    expect(frame).not.toHaveProperty("emoji");
  });
});
