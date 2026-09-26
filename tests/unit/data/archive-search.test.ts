import { describe, expect, it } from "vitest";
import { decadeCounts, listEpisodes, type RawEpisodeMap } from "@/lib/data/archive-source";
import { ArchiveError, describeEmptyFilter } from "@/lib/data/archive-client";

const archive: RawEpisodeMap = {
  "1": {
    epNum: "1",
    airDate: "1984-09-10",
    info: "kids",
    jeopardy: [{ cat: "POTENT POTABLES", q: "q", a: "a" }],
  },
  "2": {
    epNum: "2",
    airDate: "2021-01-01",
    jeopardy: [{ cat: "SCIENCE", q: "q", a: "a" }],
    final: [{ cat: "WORLD CAPITALS", q: "q", a: "a" }],
  },
};

describe("archive search", () => {
  it("finds episodes by category name", () => {
    expect(listEpisodes(archive, { query: "potent potables" }).episodes.map((e) => e.id)).toEqual([
      "1",
    ]);
    expect(listEpisodes(archive, { query: "capitals" }).episodes.map((e) => e.id)).toEqual(["2"]);
    expect(listEpisodes(archive, { query: "1984" }).total).toBe(1);
  });

  it("pages with offset", () => {
    const first = listEpisodes(archive, { limit: 1 });
    const second = listEpisodes(archive, { limit: 1, offset: 1 });
    expect(first.total).toBe(2);
    expect(first.episodes[0].id).not.toBe(second.episodes[0].id);
  });

  it("counts decades within a theme", () => {
    expect(decadeCounts(archive, "kids-week")).toEqual({ all: 1, "1980s": 1 });
    expect(decadeCounts(archive)).toEqual({ all: 2, "1980s": 1, "2020s": 1 });
  });
});

describe("archive errors", () => {
  it("says which filter combination came up empty", () => {
    expect(describeEmptyFilter("kids-week", "1980s")).toBe(
      "No Kids episodes from the 80s. Try another era or theme.",
    );
    expect(describeEmptyFilter("all", "all")).toBe("No playable episodes matched.");
  });

  it("marks only outages as worth retrying", () => {
    expect(new ArchiveError("not-found", "x").retryable).toBe(false);
    expect(new ArchiveError("unavailable", "x").retryable).toBe(true);
  });
});
