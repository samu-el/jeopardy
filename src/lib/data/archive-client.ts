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
  const response = await fetch(url.toString());
  if (response.ok) return (await response.json()) as T;
  if (fallback !== undefined) return fallback;
  throw new Error(`Failed to load episodes (${response.status})`);
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
  const response = await fetch(`/api/episodes/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`Failed to load episode ${id} (${response.status})`);
  return (await response.json()) as ArchiveEpisodeResponse;
}

export function fetchArchiveStats(): Promise<{ total: number }> {
  return ask<{ total: number }>({ mode: "stats" }, { total: 0 });
}

/** The two count endpoints answer in the same envelope. */
async function counts(mode: "themes" | "decades"): Promise<Record<string, number>> {
  const data = await ask<{ counts?: Record<string, number> }>({ mode }, {});
  return data.counts ?? {};
}

export const fetchThemeCounts = () => counts("themes");
export const fetchDecadeCounts = () => counts("decades");

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
