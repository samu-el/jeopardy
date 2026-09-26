import { describe, expect, it } from "vitest";
import {
  decodeClientFrame,
  isTerminalRejectReason,
  type RealtimeRejectReason,
} from "@/lib/realtime";
import { problemFromRejection } from "@/lib/runtime/room-runtime";

describe("realtime rejection contract", () => {
  it("maps every reason a room can give onto something the client can show", () => {
    const reasons: RealtimeRejectReason[] = [
      "invalid-session",
      "unknown-connection",
      "unknown-message",
      "invalid-command",
      "room-not-found",
      "room-full",
      "room-code-taken",
      "kicked",
      "not-authorized",
    ];
    expect(reasons.map(problemFromRejection)).toEqual([
      "invalid-session",
      "invalid-session",
      "invalid-session",
      "invalid-session",
      "not-found",
      "full",
      "code-taken",
      "kicked",
      "invalid-session",
    ]);
  });

  it("stops the client retrying only on answers a retry can't change", () => {
    expect(isTerminalRejectReason("kicked")).toBe(true);
    expect(isTerminalRejectReason("room-full")).toBe(true);
    expect(isTerminalRejectReason("room-not-found")).toBe(true);
    expect(isTerminalRejectReason("room-code-taken")).toBe(true);
    expect(isTerminalRejectReason("not-authorized")).toBe(false);
    expect(isTerminalRejectReason("unknown-connection")).toBe(false);
  });

  it("carries a seat token on the join frame, and only as a string", () => {
    expect(
      decodeClientFrame(JSON.stringify({ t: "join", roomId: "R", clientId: "c", sessionToken: "t" })),
    ).toMatchObject({ sessionToken: "t" });
    expect(
      decodeClientFrame(JSON.stringify({ t: "join", roomId: "R", clientId: "c", sessionToken: 4 })),
    ).toMatchObject({ sessionToken: undefined });
  });
});
