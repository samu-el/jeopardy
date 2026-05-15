import { createStore } from "zustand/vanilla";
import type { RoundName } from "@/lib/foundation/game-contracts";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface PublicRoomSnapshot {
  roomId: string;
  round: RoundName;
  serverTime: number;
  playerCount: number;
  activeClueId?: string;
  hostId?: string;
  voiceProfileId?: string;
}

export interface ClientPreferences {
  captionsEnabled: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  voiceProfileId: string;
}

export interface AppStoreState {
  connectionStatus: ConnectionStatus;
  currentRoom: PublicRoomSnapshot | null;
  lastError: string | null;
  preferences: ClientPreferences;
}

export interface AppStoreActions {
  clearError: () => void;
  clearRoomSnapshot: () => void;
  reset: (initial?: AppStoreInitialState) => void;
  setClientPreference: <Key extends keyof ClientPreferences>(
    key: Key,
    value: ClientPreferences[Key],
  ) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setError: (message: string) => void;
  setRoomSnapshot: (snapshot: PublicRoomSnapshot) => void;
}

export type AppStore = AppStoreState & AppStoreActions;

export type AppStoreInitialState = Partial<
  Omit<AppStoreState, "preferences">
> & {
  preferences?: Partial<ClientPreferences>;
};

export const defaultClientPreferences: ClientPreferences = {
  captionsEnabled: true,
  reducedMotion: false,
  soundEnabled: true,
  voiceProfileId: "browser-default",
};

export function getInitialAppState(
  initial: AppStoreInitialState = {},
): AppStoreState {
  return {
    connectionStatus: initial.connectionStatus ?? "idle",
    currentRoom: initial.currentRoom ?? null,
    lastError: initial.lastError ?? null,
    preferences: {
      ...defaultClientPreferences,
      ...initial.preferences,
    },
  };
}

export function createAppStore(initial: AppStoreInitialState = {}) {
  return createStore<AppStore>()((set) => ({
    ...getInitialAppState(initial),
    clearError: () => set({ lastError: null }),
    clearRoomSnapshot: () => set({ currentRoom: null }),
    reset: (nextInitial = {}) => set(getInitialAppState(nextInitial)),
    setClientPreference: (key, value) =>
      set((state) => ({
        preferences: {
          ...state.preferences,
          [key]: value,
        },
      })),
    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setError: (message) => set({ lastError: message }),
    setRoomSnapshot: (snapshot) => set({ currentRoom: snapshot }),
  }));
}

export const appStore = createAppStore();
