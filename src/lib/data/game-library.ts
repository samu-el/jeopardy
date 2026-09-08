"use client";

import { checkPublishedGame, type PublishedGame } from "./published-game";
import type { NormalizedGame } from "./contracts";

/**
 * Publishing and fetching custom games.
 *
 * Games live in the same Cloudflare Worker as the rooms, because they need
 * the same thing rooms do: somewhere that keeps a value between visits. A
 * game saved in a browser can't be played with friends, which is the whole
 * point of building one.
 */

/** Where the edit tokens live: whoever published a game can replace it. */
const tokenStorageKey = "jeopardy.published-games.v1";

export interface PublishResult {
  ok: boolean;
  id?: string;
  shareUrl?: string;
  error?: string;
}

function libraryBase(): string | null {
  const configured = (process.env.NEXT_PUBLIC_ROOMS_URL ?? "").trim();
  if (!configured) return null;
  return configured
    .replace(/^ws:/, "http:")
    .replace(/^wss:/, "https:")
    .replace(/\/$/, "");
}

function readTokens(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(tokenStorageKey) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function rememberToken(id: string, token: string) {
  if (typeof window === "undefined") return;
  try {
    const all = { ...readTokens(), [id]: token };
    window.localStorage.setItem(tokenStorageKey, JSON.stringify(all));
  } catch {
    // A lost token costs the ability to update, not the game itself.
  }
}

/** The token for a game this browser published, if it still has one. */
export function editTokenFor(id: string): string | undefined {
  return readTokens()[id];
}

export function shareUrlFor(id: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/?game=${id}`;
}

/**
 * Publishes a game, or replaces one this browser published before. The id is
 * minted by the Worker on a first publish — a client choosing its own id
 * could land on, or overwrite, someone else's.
 */
export async function publishGame(
  game: { title: string; author?: string; clues: NormalizedGame["clues"] },
  existingId?: string,
): Promise<PublishResult> {
  const base = libraryBase();
  if (!base) {
    return {
      ok: false,
      error: "Publishing needs the rooms service, which isn't configured here.",
    };
  }

  // Check before sending so the builder can point at the offending clue
  // rather than relaying a bare 422 from the edge.
  const checked = checkPublishedGame({ ...game, id: existingId ?? "" });
  if (!checked.ok) {
    return { ok: false, error: checked.problems.slice(0, 3).join(" ") };
  }

  const token = existingId ? editTokenFor(existingId) : undefined;
  const url = existingId ? `${base}/games/${existingId}` : `${base}/games`;

  try {
    const response = await fetch(url, {
      method: existingId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: checked.game, editToken: token }),
    });
    if (response.status === 403) {
      return { ok: false, error: "This game was published from another browser." };
    }
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        problems?: string[];
      } | null;
      return {
        ok: false,
        error: detail?.problems?.slice(0, 3).join(" ") ?? "Could not publish that game.",
      };
    }
    const body = (await response.json()) as { game: PublishedGame; editToken: string };
    rememberToken(body.game.id, body.editToken);
    return { ok: true, id: body.game.id, shareUrl: shareUrlFor(body.game.id) };
  } catch (error) {
    return { ok: false, error: (error as Error).message || "Could not reach the library." };
  }
}

/** Loads a published game by id. Returns undefined when there is nothing there. */
export async function fetchPublishedGame(id: string): Promise<PublishedGame | undefined> {
  const base = libraryBase();
  if (!base) return undefined;
  try {
    const response = await fetch(`${base}/games/${encodeURIComponent(id)}`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as { game?: unknown };
    // The library is storage, not a source of truth about shape: whatever
    // comes back goes through the same validator as anything published.
    const checked = checkPublishedGame(body.game);
    return checked.ok ? checked.game : undefined;
  } catch {
    return undefined;
  }
}
