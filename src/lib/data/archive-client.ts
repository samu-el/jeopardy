"use client";

import type { ArchivedEpisodeInput, EpisodeListing } from "./contracts";

export type ArchiveListing = EpisodeListing;

export interface ArchiveListResponse {
  total: number;
  episodes: ArchiveListing[];
}

export interface ArchiveEpisodeResponse {
  id: string;
  episode: ArchivedEpisodeInput;
}

export type ArchiveErrorKind = "not-found" | "unavailable" | "offline";

/**
 * A failure worth showing a person: what went wrong in words, and whether
 * trying again could help. A bare "Failed (404)" is neither.
 */
export class ArchiveError extends Error {
  constructor(
    readonly kind: ArchiveErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ArchiveError";
  }
  get retryable(): boolean {
    return this.kind !== "not-found";
  }
}

export const archiveUnavailableMessage =
  "The episode archive isn't answering right now. Try again in a moment.";
export const archiveOfflineMessage =
  "Could not reach the episode archive. Check your connection and try again.";

function labelOf(options: { id: string; label: string }[], id: string | undefined) {
  return options.find((entry) => entry.id === id)?.label;
}

/** "No Kids episodes from the 80s" — what a filter combination found nothing for. */
export function describeEmptyFilter(theme?: string, decade?: string): string {
  const themeLabel = theme && theme !== "all" ? labelOf(themeOptions, theme) : undefined;
  const decadeLabel = decade && decade !== "all" ? labelOf(decadeOptions, decade) : undefined;
  if (themeLabel && decadeLabel) {
    return `No ${themeLabel} episodes from the ${decadeLabel}. Try another era or theme.`;
  }
  if (themeLabel) return `No ${themeLabel} episodes in the archive. Try another theme.`;
  if (decadeLabel) return `No episodes from the ${decadeLabel}. Try another era.`;
  return "No playable episodes matched.";
}

async function send(url: string, notFound: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ArchiveError("offline", archiveOfflineMessage);
  }
  if (response.ok) return response;
  if (response.status === 404) throw new ArchiveError("not-found", notFound);
  throw new ArchiveError("unavailable", archiveUnavailableMessage);
}

/**
 * Everything the archive answers sits on one route with a mode, so asking it
 * anything is one function. Blank values and "all" are simply left off the
 * query, which is what the route means by absent.
 */
async function ask<T>(
  params: Record<string, string | number | undefined>,
  fallback?: T,
): Promise<T> {
  const url = new URL("/api/episodes", window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all") continue;
    url.searchParams.set(key, String(value));
  }
  try {
    const response = await send(
      url.toString(),
      describeEmptyFilter(params.theme as string | undefined, params.decade as string | undefined),
    );
    return (await response.json()) as T;
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

export function fetchEpisodeList(params: {
  theme?: string;
  decade?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<ArchiveListResponse> {
  const { query, ...rest } = params;
  return ask<ArchiveListResponse>({ ...rest, q: query });
}

export function fetchRandomEpisode(
  theme?: string,
  decade?: string,
): Promise<ArchiveEpisodeResponse> {
  return ask<ArchiveEpisodeResponse>({ mode: "random", theme, decade });
}

export async function fetchEpisodeById(id: string): Promise<ArchiveEpisodeResponse> {
  const response = await send(
    `/api/episodes/${encodeURIComponent(id)}`,
    `There's no episode #${id} in the archive. Check the number, or browse instead.`,
  );
  return (await response.json()) as ArchiveEpisodeResponse;
}

export function fetchArchiveStats(): Promise<{ total: number }> {
  return ask<{ total: number }>({ mode: "stats" }, { total: 0 });
}

/** The two count endpoints answer in the same envelope. */
async function counts(
  mode: "themes" | "decades",
  theme?: string,
): Promise<Record<string, number>> {
  const data = await ask<{ counts?: Record<string, number> }>({ mode, theme }, {});
  return data.counts ?? {};
}

export const fetchThemeCounts = () => counts("themes");
/** Decades with episodes, within a theme when one is chosen. */
export const fetchDecadeCounts = (theme?: string) => counts("decades", theme);

export const decadeOptions: { id: string; label: string }[] = [
  { id: "all", label: "All eras" },
  { id: "1980s", label: "80s" },
  { id: "1990s", label: "90s" },
  { id: "2000s", label: "2000s" },
  { id: "2010s", label: "2010s" },
  { id: "2020s", label: "2020s" },
];

export const themeOptions: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "standard", label: "Standard" },
  { id: "tournament-of-champions", label: "Champions" },
  { id: "tournament", label: "Tournaments" },
  { id: "kids-week", label: "Kids" },
  { id: "teen-tournament", label: "Teen" },
  { id: "college-championship", label: "College" },
  { id: "celebrity", label: "Celebrity" },
  { id: "masters", label: "Masters / GOAT" },
  { id: "primetime", label: "Primetime" },
];
