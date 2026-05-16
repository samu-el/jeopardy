import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginReplayLog,
  clearReplayLog,
  loadLastReplay,
  persistReplayLog,
  recordCommand,
  recordEvents,
} from "@/lib/runtime/replay-log";

describe("replay log", () => {
  afterEach(() => {
    clearReplayLog();
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.clear();
    }
  });

  it("captures commands and events in order", () => {
    setupLocalStorage();
    beginReplayLog("room-1");
    recordCommand({ type: "start-game", actorId: "host" });
    recordEvents([{ type: "game-started", round: "jeopardy" }]);
    recordCommand({ type: "pick-clue", actorId: "host", clueId: "j-1" });
    persistReplayLog();

    const loaded = loadLastReplay();
    expect(loaded?.roomId).toBe("room-1");
    expect(loaded?.entries.length).toBe(3);
    expect(loaded?.entries[0].cmd?.type).toBe("start-game");
    expect(loaded?.entries[1].events?.[0].type).toBe("game-started");
    expect(loaded?.entries[2].cmd?.type).toBe("pick-clue");
  });

  it("returns null when no log has been persisted", () => {
    setupLocalStorage();
    expect(loadLastReplay()).toBeNull();
  });

  it("ignores commands when no log is active", () => {
    setupLocalStorage();
    clearReplayLog();
    recordCommand({ type: "buzz", actorId: "p1" });
    expect(loadLastReplay()).toBeNull();
  });
});

function setupLocalStorage() {
  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.clear();
    return;
  }
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
  });
}
