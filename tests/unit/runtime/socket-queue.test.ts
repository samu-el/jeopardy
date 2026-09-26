import { describe, expect, it } from "vitest";
import { framesToReplay, staleIntentMs } from "@/lib/runtime/socket-client";
import type { ClientFrame } from "@/lib/realtime";

const pick: ClientFrame = { t: "command", command: { type: "pick-clue", clueId: "j-200" } };
const buzz: ClientFrame = { t: "command", command: { type: "buzz" } };
const chat: ClientFrame = { t: "chat", text: "hi" };
const ping: ClientFrame = { t: "ping", sentAt: 1 };

describe("offline queue replay", () => {
  it("sends everything queued before the first connection, in order", () => {
    // The host deals the board before the socket is up.
    const queue = [
      { frame: pick, at: 0 },
      { frame: chat, at: 0 },
    ];
    expect(framesToReplay(queue, { everConnected: false, now: 60_000 })).toEqual([pick, chat]);
  });

  it("drops game intent that went stale during an outage", () => {
    const now = 10_000;
    const queue = [
      { frame: pick, at: now - staleIntentMs - 1 },
      { frame: chat, at: now - 5_000 },
      { frame: buzz, at: now - 10 },
    ];
    expect(framesToReplay(queue, { everConnected: true, now })).toEqual([chat, buzz]);
  });

  it("never replays pings", () => {
    expect(framesToReplay([{ frame: ping, at: 0 }], { everConnected: false, now: 0 })).toEqual(
      [],
    );
  });
});
