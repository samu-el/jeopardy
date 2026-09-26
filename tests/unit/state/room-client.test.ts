import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baselineBotProfiles } from "@/lib/ai/profiles";
import type { GameEvent, PublicGameState } from "@/lib/game";
import { useGameStore, type GameStoreState, type OnlineRoomState } from "@/lib/state/game-store";
import { appendNotice, hostChangeNotice, maxNotices, noticesFromEvents } from "@/lib/state/notices";
import {
  displayClientId,
  forgetRoomSeat,
  recallRoomSeat,
  rememberRoomSeat,
  roomSeatTtlMs,
  type KeyValueStorage,
} from "@/lib/state/room-memory";
import { committableName, lookupRoom } from "@/lib/state/room-session";
import {
  selectCanHost,
  selectIsReconnecting,
  selectRole,
  selectRoomInteractive,
  selectRoomStatus,
} from "@/lib/state/selectors";

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function snapshot(hostId: string | undefined, round: PublicGameState["round"] = "jeopardy") {
  return {
    round,
    settings: { hostId },
    players: [
      { id: "me", displayName: "Me", spectator: false },
      { id: "ada", displayName: "Ada", spectator: false },
    ],
  } as unknown as PublicGameState;
}

function online(patch: Partial<OnlineRoomState> = {}): OnlineRoomState {
  return {
    roomId: "ROOM",
    status: "connected",
    isHost: false,
    role: "player",
    everConnected: true,
    ...patch,
  };
}

describe("room seat memory", () => {
  it("remembers a seat and its token per room and client", () => {
    const storage = memoryStorage();
    rememberRoomSeat({ roomId: "ABCD", clientId: "p-1", sessionToken: "t1" }, { storage, now: 0 });
    expect(recallRoomSeat("ABCD", "p-1", { storage, now: 10 })?.sessionToken).toBe("t1");
    expect(recallRoomSeat("ABCD", "p-2", { storage, now: 10 })).toBeUndefined();
    expect(recallRoomSeat("WXYZ", "p-1", { storage, now: 10 })).toBeUndefined();
  });

  it("keeps the last token when a write carries none, and forgets on request", () => {
    const storage = memoryStorage();
    rememberRoomSeat({ roomId: "ABCD", clientId: "p-1", sessionToken: "t1" }, { storage, now: 0 });
    rememberRoomSeat({ roomId: "ABCD", clientId: "p-1" }, { storage, now: 5 });
    expect(recallRoomSeat("ABCD", "p-1", { storage, now: 6 })?.sessionToken).toBe("t1");
    forgetRoomSeat("ABCD", "p-1", { storage });
    expect(recallRoomSeat("ABCD", "p-1", { storage, now: 6 })).toBeUndefined();
  });

  it("lets an old seat lapse", () => {
    const storage = memoryStorage();
    rememberRoomSeat({ roomId: "ABCD", clientId: "p-1" }, { storage, now: 0 });
    expect(recallRoomSeat("ABCD", "p-1", { storage, now: roomSeatTtlMs + 1 })).toBeUndefined();
  });

  it("gives a display its own id, stable for the tab", () => {
    const storage = memoryStorage();
    const first = displayClientId(storage);
    expect(first).toMatch(/^display-/);
    expect(displayClientId(storage)).toBe(first);
    expect(displayClientId(memoryStorage())).not.toBe(first);
  });
});

describe("room lookup", () => {
  const respond = (status: number, body?: unknown) =>
    (async () =>
      new Response(body === undefined ? "nope" : JSON.stringify(body), {
        status,
      })) as unknown as typeof fetch;

  it("tells an open room, a missing one and an outage apart", async () => {
    expect(await lookupRoom("ABCD", { fetchFn: respond(200, { exists: true }) })).toBe("open");
    expect(await lookupRoom("ABCD", { fetchFn: respond(200, { exists: false }) })).toBe(
      "not-found",
    );
    expect(await lookupRoom("ABCD", { fetchFn: respond(404) })).toBe("not-found");
    expect(await lookupRoom("ABCD", { fetchFn: respond(502) })).toBe("unreachable");
    const failing = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await lookupRoom("ABCD", { fetchFn: failing })).toBe("unreachable");
  });

  it("gives up on a lookup that never answers", async () => {
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    expect(await lookupRoom("ABCD", { fetchFn: hanging, timeoutMs: 20 })).toBe("unreachable");
  });
});

describe("names", () => {
  it("never commits an empty name or 'You'", () => {
    expect(committableName("")).toBeUndefined();
    expect(committableName("   ")).toBeUndefined();
    expect(committableName("You")).toBeUndefined();
    expect(committableName("  Zelda   Z ")).toBe("Zelda Z");
  });
});

describe("notices", () => {
  it("announces arrivals and departures of other people, not yourself or a TV", () => {
    const events: GameEvent[] = [
      { type: "player-joined", playerId: "ada", displayName: "Ada", rejoined: false },
      { type: "player-joined", playerId: "me", displayName: "Me", rejoined: false },
      { type: "player-joined", playerId: "bea", displayName: "Bea", rejoined: true },
      { type: "player-joined", playerId: "display-1", displayName: "Display", rejoined: false },
      { type: "player-left", playerId: "ada", displayName: "Ada" },
    ];
    expect(noticesFromEvents(events, "me").map((notice) => notice.text)).toEqual([
      "Ada joined",
      "Ada left",
    ]);
  });

  it("notices the chair changing hands", () => {
    expect(hostChangeNotice(null, snapshot("ada"), "me")).toBeUndefined();
    expect(hostChangeNotice(snapshot("ada"), snapshot("ada"), "me")).toBeUndefined();
    expect(hostChangeNotice(snapshot("me"), snapshot("ada"), "me")?.text).toBe(
      "Ada is now hosting",
    );
    expect(hostChangeNotice(snapshot("ada"), snapshot("me"), "me")?.text).toBe(
      "You're the host now",
    );
  });

  it("keeps only the latest few", () => {
    let notices = appendNotice([], { kind: "info", text: "0" }, 0);
    for (let index = 1; index < 10; index += 1) {
      notices = appendNotice(notices, { kind: "info", text: String(index) }, index);
    }
    expect(notices).toHaveLength(maxNotices);
    expect(notices.at(-1)?.text).toBe("9");
  });
});

describe("selectors", () => {
  const base = () => useGameStore.getState();
  const view = (patch: Partial<GameStoreState>): GameStoreState => ({
    ...base(),
    selfId: () => "me",
    ...patch,
  });

  it("solo play is always yours to run", () => {
    expect(selectCanHost(view({ online: null }))).toBe(true);
  });

  it("in a shared room the room's state decides who hosts", () => {
    expect(selectCanHost(view({ online: online(), publicState: snapshot("me") }))).toBe(true);
    expect(selectCanHost(view({ online: online(), publicState: snapshot("ada") }))).toBe(false);
    expect(selectRole(view({ online: online(), publicState: snapshot("ada") }))).toBe("player");
    expect(selectRole(view({ online: online({ role: "display" }), publicState: snapshot("ada") })))
      .toBe("display");
    // Before the first snapshot, only the browser that opened the room.
    expect(selectCanHost(view({ online: online({ isHost: true }), publicState: null }))).toBe(true);
    expect(selectCanHost(view({ online: online(), publicState: null }))).toBe(false);
  });

  it("names where the client stands with its room", () => {
    expect(selectRoomStatus(view({ online: null, runtime: null }))).toBe("idle");
    expect(selectRoomStatus(view({ online: online() }))).toBe("connected");
    const dropped = view({ online: online({ status: "reconnecting" }) });
    expect(selectRoomStatus(dropped)).toBe("reconnecting");
    expect(selectIsReconnecting(dropped)).toBe(true);
    expect(selectRoomInteractive(dropped)).toBe(false);
    expect(
      selectRoomStatus(
        view({ online: online({ status: "connecting", everConnected: false }) }),
      ),
    ).toBe("connecting");
    expect(
      selectRoomStatus(
        view({ online: online({ status: "rejected", problem: "not-found", everConnected: false }) }),
      ),
    ).toBe("not-found");
    expect(
      selectRoomStatus(
        view({
          online: online({ status: "reconnecting", problem: "unreachable", everConnected: false }),
        }),
      ),
    ).toBe("unreachable");
  });
});

describe("store gating in a shared room", () => {
  const sendCommand = vi.fn();
  const destroy = vi.fn();
  const addBot = vi.fn();
  let initial: GameStoreState;

  beforeEach(() => {
    vi.useFakeTimers();
    initial = useGameStore.getState();
    sendCommand.mockReset();
    destroy.mockReset();
    addBot.mockReset();
    useGameStore.setState({
      lobby: { ...initial.lobby, hostId: "me", hostName: "Me", bots: [] },
      runtime: {
        mode: "network",
        roomId: "ROOM",
        selfId: "me",
        getPublicState: () => null,
        getChatHistory: () => [],
        sendCommand,
        postChat: vi.fn(),
        requestAiJudge: vi.fn(),
        addBot,
        destroy,
      } as never,
      online: online(),
      publicState: snapshot("ada"),
      notices: [],
      leaveConfirmOpen: false,
      screen: "play",
    });
  });

  afterEach(() => {
    useGameStore.setState(initial, true);
    vi.useRealTimers();
  });

  it("a guest can't add bots, restart, or switch the judge — and hears why", () => {
    const store = useGameStore.getState();
    store.addBot(baselineBotProfiles[0]);
    store.exitToLobby();
    store.setAiJudge(false);
    store.transferHost("me");
    expect(useGameStore.getState().lobby.bots).toHaveLength(0);
    expect(addBot).not.toHaveBeenCalled();
    expect(sendCommand).not.toHaveBeenCalled();
    expect(useGameStore.getState().notices.map((notice) => notice.text)).toContain(
      "Only the host can add bots.",
    );
  });

  it("the host's judge switch reaches the room", () => {
    useGameStore.setState({ publicState: snapshot("me") });
    useGameStore.getState().setAiJudge(false);
    expect(sendCommand).toHaveBeenCalledWith("me", {
      type: "update-settings",
      settings: { aiJudgeEnabled: false },
    });
  });

  it("the host can hand the chair over", () => {
    useGameStore.setState({ publicState: snapshot("me") });
    useGameStore.getState().transferHost("ada");
    expect(sendCommand).toHaveBeenCalledWith("me", { type: "configure-host", hostId: "ada" });
  });

  it("sends a name once typing pauses, and never an empty one", () => {
    const store = useGameStore.getState();
    store.setHostName("");
    expect(useGameStore.getState().lobby.hostName).toBe("");
    vi.advanceTimersByTime(1_000);
    expect(sendCommand).not.toHaveBeenCalled();

    store.setHostName("Z");
    store.setHostName("Ze");
    store.setHostName("Zed");
    vi.advanceTimersByTime(1_000);
    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendCommand).toHaveBeenCalledWith("me", {
      type: "set-player-profile",
      displayName: "Zed",
    });
  });

  it("Home asks first in a live game, then really leaves", () => {
    useGameStore.getState().setScreen("landing");
    expect(useGameStore.getState().leaveConfirmOpen).toBe(true);
    expect(useGameStore.getState().screen).toBe("play");
    expect(destroy).not.toHaveBeenCalled();

    useGameStore.getState().confirmGoHome();
    const after = useGameStore.getState();
    expect(sendCommand).toHaveBeenCalledWith("me", { type: "leave-game" });
    expect(destroy).toHaveBeenCalled();
    expect(after.online).toBeNull();
    expect(after.runtime).toBeNull();
    expect(after.screen).toBe("landing");
  });

  it("Home from a finished game leaves without asking", () => {
    useGameStore.setState({ publicState: snapshot("ada", "complete") });
    useGameStore.getState().setScreen("landing");
    expect(useGameStore.getState().leaveConfirmOpen).toBe(false);
    expect(useGameStore.getState().screen).toBe("landing");
    expect(useGameStore.getState().online).toBeNull();
  });
});
