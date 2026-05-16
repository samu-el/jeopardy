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
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<ArchiveListResponse> {
  const url = new URL("/api/episodes", window.location.origin);
  if (params.theme && params.theme !== "all") url.searchParams.set("theme", params.theme);
  if (params.query) url.searchParams.set("q", params.query);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Failed to load episodes (${response.status})`);
  return (await response.json()) as ArchiveListResponse;
}

export async function fetchRandomEpisode(
  theme?: string,
): Promise<ArchiveEpisodeResponse> {
  const url = new URL("/api/episodes", window.location.origin);
  url.searchParams.set("mode", "random");
  if (theme && theme !== "all") url.searchParams.set("theme", theme);
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

export const themeOptions: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "standard", label: "Standard" },
  { id: "tournament-of-champions", label: "Tournament of Champions" },
  { id: "kids-week", label: "Kids Week" },
  { id: "teen-tournament", label: "Teen Tournament" },
  { id: "college-championship", label: "College Championship" },
  { id: "celebrity", label: "Celebrity" },
  { id: "masters", label: "Masters / GOAT" },
  { id: "primetime", label: "Primetime" },
];
