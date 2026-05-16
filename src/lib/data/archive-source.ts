import { gunzipSync } from "node:zlib";
import type { ArchivedEpisodeInput, ArchivedRawClue } from "./contracts";

// Same data source the upstream howardchung/jeopardy app uses.
// The j-archive-parser repository publishes a compiled gzipped JSON to its
// `release` branch with every Jeopardy! episode it has scraped.
const ARCHIVE_URL =
  "https://github.com/howardchung/j-archive-parser/raw/release/jeopardy.json.gz";

export interface RawEpisode {
  epNum: string;
  airDate?: string;
  info?: string;
  jeopardy?: ArchivedRawClue[];
  double?: ArchivedRawClue[];
  triple?: ArchivedRawClue[];
  final?: ArchivedRawClue[];
}

export type RawEpisodeMap = Record<string, RawEpisode>;

let cache: RawEpisodeMap | null = null;
let inflight: Promise<RawEpisodeMap> | null = null;
let lastLoadedAt = 0;
const TTL_MS = 24 * 60 * 60 * 1000;

export async function loadArchive(force = false): Promise<RawEpisodeMap> {
  const now = Date.now();
  if (!force && cache && now - lastLoadedAt < TTL_MS) {
    return cache;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const response = await fetch(ARCHIVE_URL, {
      // Allow Next.js / Bun to cache for the day
      next: { revalidate: 60 * 60 * 12 },
    } as RequestInit);
    if (!response.ok) {
      throw new Error(`Archive fetch failed: ${response.status}`);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    const json = JSON.parse(gunzipSync(buf).toString("utf8")) as RawEpisodeMap;
    cache = json;
    lastLoadedAt = Date.now();
    return json;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export interface EpisodeListing {
  id: string;
  number: string;
  airDate?: string;
  info?: string;
  theme: string;
  hasFinal: boolean;
  clueCount: number;
}

// J-Archive's `info` field is mostly short single-word tags ("kids",
// "college", "teen", "champions", "celebrity", "tournament", "super") so
// the matchers below accept either the short form or the longer phrasing.
const THEME_KEYWORDS: { theme: string; match: RegExp }[] = [
  {
    theme: "tournament-of-champions",
    match: /\b(tournament of champions|toc|champions)\b/i,
  },
  { theme: "kids-week", match: /\bkids?\b/i },
  { theme: "teen-tournament", match: /\bteen(?: tournament| reunion)?\b/i },
  {
    theme: "college-championship",
    match: /\bcollege(?: championship| tournament)?\b/i,
  },
  { theme: "celebrity", match: /\b(celebrity|power player|all[\s-]?star)\b/i },
  {
    theme: "masters",
    match: /\b(masters|battle of the decades|greatest of all time|goat)\b/i,
  },
  { theme: "tournament", match: /\btournament\b/i },
  { theme: "primetime", match: /\b(primetime|prime time|abc|super)\b/i },
];

export function classifyTheme(info: string | undefined): string {
  if (!info) return "standard";
  for (const entry of THEME_KEYWORDS) {
    if (entry.match.test(info)) return entry.theme;
  }
  return "standard";
}

export function listEpisodes(
  archive: RawEpisodeMap,
  options: { theme?: string; query?: string; limit?: number; offset?: number } = {},
): { total: number; episodes: EpisodeListing[] } {
  const term = options.query?.trim().toLowerCase();
  const themeFilter = options.theme && options.theme !== "all" ? options.theme : undefined;
  const all: EpisodeListing[] = [];
  for (const [key, episode] of Object.entries(archive)) {
    const theme = classifyTheme(episode.info);
    if (themeFilter && theme !== themeFilter) continue;
    if (term) {
      const haystack = `${episode.epNum} ${episode.info ?? ""} ${episode.airDate ?? ""}`.toLowerCase();
      if (!haystack.includes(term)) continue;
    }
    const clueCount =
      (episode.jeopardy?.length ?? 0) +
      (episode.double?.length ?? 0) +
      (episode.triple?.length ?? 0) +
      (episode.final?.length ?? 0);
    all.push({
      id: key,
      number: episode.epNum,
      airDate: episode.airDate,
      info: episode.info,
      theme,
      hasFinal: Boolean(episode.final?.length),
      clueCount,
    });
  }
  all.sort((a, b) => Number(b.number) - Number(a.number));
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  return {
    total: all.length,
    episodes: all.slice(offset, offset + limit),
  };
}

export function getEpisode(
  archive: RawEpisodeMap,
  id: string,
): ArchivedEpisodeInput | undefined {
  const raw = archive[id];
  if (!raw) return undefined;
  return {
    epNum: raw.epNum,
    airDate: raw.airDate,
    info: raw.info,
    title: raw.info ? `Episode ${raw.epNum} — ${raw.info}` : `Episode ${raw.epNum}`,
    jeopardy: raw.jeopardy,
    double: raw.double,
    triple: raw.triple,
    final: raw.final,
  };
}

export function themeCounts(archive: RawEpisodeMap): Record<string, number> {
  const counts: Record<string, number> = { all: 0 };
  for (const episode of Object.values(archive)) {
    const theme = classifyTheme(episode.info);
    counts[theme] = (counts[theme] ?? 0) + 1;
    counts.all += 1;
  }
  return counts;
}

export function getRandomEpisode(
  archive: RawEpisodeMap,
  options: { theme?: string } = {},
): { id: string; episode: ArchivedEpisodeInput } | undefined {
  const { episodes } = listEpisodes(archive, {
    theme: options.theme,
    limit: 100_000,
  });
  // Require a complete game (final + at least one round) to avoid duds.
  const playable = episodes.filter((entry) => entry.hasFinal && entry.clueCount > 20);
  if (playable.length === 0) return undefined;
  const choice = playable[Math.floor(Math.random() * playable.length)];
  const episode = getEpisode(archive, choice.id);
  if (!episode) return undefined;
  return { id: choice.id, episode };
}
