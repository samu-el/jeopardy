import { describe, expect, it } from "vitest";
import { formatCountdown } from "@/lib/foundation/clock";

describe("formatCountdown", () => {
  it("reads under a minute as 0:ss", () => {
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(30)).toBe("0:30");
  });

  it("carries whole minutes rather than running the seconds past 59", () => {
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(122)).toBe("2:02");
  });

  it("never shows a negative clock", () => {
    expect(formatCountdown(-3)).toBe("0:00");
  });
});
