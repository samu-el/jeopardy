"use client";

import { create } from "zustand";

/**
 * What happened to a `?game=` link, for the landing page to say.
 *
 * The fetch used to be fired and forgotten: a dead link showed the plain
 * landing page, the param stayed in the address bar, and nobody could tell
 * the link was broken.
 */
export interface SharedGameLinkState {
  status: "idle" | "loading" | "error";
  error?: string;
  dismiss: () => void;
}

export const useSharedGameLink = create<SharedGameLinkState>((set) => ({
  status: "idle",
  dismiss: () => set({ status: "idle", error: undefined }),
}));

export const sharedGameUnreachable =
  "Couldn't load that shared game. Check your connection, or ask for the link again.";

function dropGameParam() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("game")) return;
    url.searchParams.delete("game");
    window.history.replaceState({}, "", url.toString());
  } catch {
    // An address bar that can't be rewritten costs a tidy URL, nothing more.
  }
}

/** Loads a shared game, reporting progress and failure instead of swallowing them. */
export async function openSharedGame(
  id: string,
  load: (id: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<void> {
  useSharedGameLink.setState({ status: "loading", error: undefined });
  let result: { ok: boolean; error?: string };
  try {
    result = await load(id);
  } catch {
    result = { ok: false, error: sharedGameUnreachable };
  }
  dropGameParam();
  useSharedGameLink.setState(
    result.ok
      ? { status: "idle", error: undefined }
      : { status: "error", error: result.error ?? sharedGameUnreachable },
  );
}
