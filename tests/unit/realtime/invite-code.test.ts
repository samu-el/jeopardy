import { describe, expect, it } from "vitest";
import {
  hasImpossibleCharacters,
  isCompleteRoomCode,
  parseInviteInput,
} from "@/lib/realtime/invite-code";
import { generateRoomCode } from "@/lib/realtime/room-code";

describe("invite input", () => {
  it("pulls the code out of a pasted invite link", () => {
    expect(parseInviteInput("http://localhost:3000/?room=u6p6")).toBe("U6P6");
    expect(parseInviteInput("https://example.com/?display=1&room=AB2C&x=1")).toBe("AB2C");
  });

  it("cleans a typed code", () => {
    expect(parseInviteInput(" ab c-12 ")).toBe("ABC1");
    expect(parseInviteInput("abcdef")).toBe("ABCD");
  });

  it("accepts only whole codes from the alphabet", () => {
    expect(isCompleteRoomCode("ABC")).toBe(false);
    expect(isCompleteRoomCode("AB2C")).toBe(true);
    expect(isCompleteRoomCode("ABC1")).toBe(false);
    expect(hasImpossibleCharacters("ABC1")).toBe(true);
    for (let index = 0; index < 50; index += 1) {
      expect(isCompleteRoomCode(generateRoomCode())).toBe(true);
    }
  });
});
