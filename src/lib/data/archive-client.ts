"use client";

import type { ArchivedEpisodeInput } from "./contracts";

export interface ArchiveListing {
  id: string;
  number: string;
  airDate?: string;
  info?: string;
  theme: string;
  hasFinal: boolean;
  clueCount: number;
}

export interface ArchiveListResponse {
  total: number;
  episodes: ArchiveListing[];
}

export interface ArchiveEpisodeResponse {
  id: string;
  episode: ArchivedEpisodeInput;
}

export async function fetchEpisodeList(params: {
  theme?: string;
  decade?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<ArchiveListResponse> {
  const url = new URL("/api/episodes", window.location.origin);
  if (params.theme && params.theme !== "all") url.searchParams.set("theme", params.theme);
  if (params.decade && params.decade !== "all")
    url.searchParams.set("decade", params.decade);
  if (params.query) url.searchParams.set("q", params.query);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Failed to load episodes (${response.status})`);
  return (await response.json()) as ArchiveListResponse;
}

export async function fetchRandomEpisode(
  theme?: string,
  decade?: string,
): Promise<ArchiveEpisodeResponse> {
  const url = new URL("/api/episodes", window.location.origin);
  url.searchParams.set("mode", "random");
  if (theme && theme !== "all") url.searchParams.set("theme", theme);
  if (decade && decade !== "all") url.searchParams.set("decade", decade);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Failed to load random episode (${response.status})`);
  return (await response.json()) as ArchiveEpisodeResponse;
}

export async function fetchEpisodeById(id: string): Promise<ArchiveEpisodeResponse> {
  const response = await fetch(`/api/episodes/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`Failed to load episode ${id} (${response.status})`);
  return (await response.json()) as ArchiveEpisodeResponse;
}

export async function fetchArchiveStats(): Promise<{ total: number }> {
  const response = await fetch("/api/episodes?mode=stats");
  if (!response.ok) return { total: 0 };
  return (await response.json()) as { total: number };
}

export async function fetchThemeCounts(): Promise<Record<string, number>> {
  const response = await fetch("/api/episodes?mode=themes");
  if (!response.ok) return {};
  const data = (await response.json()) as { counts?: Record<string, number> };
  return data.counts ?? {};
}

export async function fetchDecadeCounts(): Promise<Record<string, number>> {
  const response = await fetch("/api/episodes?mode=decades");
  if (!response.ok) return {};
  const data = (await response.json()) as { counts?: Record<string, number> };
  return data.counts ?? {};
}

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
