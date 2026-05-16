import { describe, expect, it } from "vitest";
import {
  createAppStore,
  defaultClientPreferences,
  getInitialAppState,
} from "@/lib/state/app-store";

describe("app store", () => {
  it("defaults to local-first accessibility preferences", () => {
    expect(getInitialAppState().preferences).toEqual({
      reducedMotion: false,
      soundEnabled: true,
      voiceProfileId: "browser-default",
    });
  });

  it("updates connection and public room snapshot state", () => {
    const store = createAppStore();

    store.getState().setConnectionStatus("connected");
    store.getState().setRoomSnapshot({
      roomId: "daily-double",
      round: "jeopardy",
      serverTime: 1000,
      playerCount: 3,
      voiceProfileId: "studio-neutral",
    });

    expect(store.getState().connectionStatus).toBe("connected");
    expect(store.getState().currentRoom).toMatchObject({
      roomId: "daily-double",
      round: "jeopardy",
      playerCount: 3,
    });
  });

  it("keeps preference updates isolated from defaults", () => {
    const store = createAppStore();

    store.getState().setClientPreference("soundEnabled", false);
    store.getState().setClientPreference("voiceProfileId", "classic-host");

    expect(defaultClientPreferences.soundEnabled).toBe(true);
    expect(store.getState().preferences).toMatchObject({
      soundEnabled: false,
      voiceProfileId: "classic-host",
    });
  });

  it("resets state without removing actions", () => {
    const store = createAppStore({
      connectionStatus: "connected",
      preferences: {
        voiceProfileId: "studio-neutral",
      },
    });

    store.getState().reset();

    expect(store.getState().connectionStatus).toBe("idle");
    expect(store.getState().preferences.voiceProfileId).toBe("browser-default");

    store.getState().setError("lost connection");
    expect(store.getState().lastError).toBe("lost connection");
  });
});
