import { describe, expect, it } from "vitest";
import { classifyDecade } from "@/lib/data/archive-source";

describe("classifyDecade", () => {
  it("buckets canonical years into decade ids", () => {
    expect(classifyDecade("1984-09-10")).toBe("1980s");
    expect(classifyDecade("1990-01-01")).toBe("1990s");
    expect(classifyDecade("1999-12-31")).toBe("1990s");
    expect(classifyDecade("2000-06-15")).toBe("2000s");
    expect(classifyDecade("2010-01-01")).toBe("2010s");
    expect(classifyDecade("2020-04-04")).toBe("2020s");
  });

  it("returns undefined for missing or unparseable inputs", () => {
    expect(classifyDecade(undefined)).toBeUndefined();
    expect(classifyDecade("")).toBeUndefined();
    expect(classifyDecade("not a date")).toBeUndefined();
  });

  it("rejects years outside the known range", () => {
    expect(classifyDecade("1983-01-01")).toBeUndefined();
    expect(classifyDecade("2099-01-01")).toBe("2020s");
    expect(classifyDecade("2200-01-01")).toBeUndefined();
  });
});
