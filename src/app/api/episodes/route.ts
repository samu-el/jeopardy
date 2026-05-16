import {
  decadeCounts,
  getRandomEpisode,
  listEpisodes,
  loadArchive,
  themeCounts,
} from "@/lib/data/archive-source";
import { fixtureEpisode } from "@/lib/data/fixture-episode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shouldUseFixture(url: URL): boolean {
  if (url.searchParams.get("fixture") === "1") return true;
  if (process.env.NODE_ENV === "test") return true;
  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "list";
  if (shouldUseFixture(url)) {
    if (mode === "stats") return Response.json({ total: 1 });
    if (mode === "themes") return Response.json({ counts: { all: 1, standard: 1 } });
    if (mode === "decades") return Response.json({ counts: { all: 1, "2020s": 1 } });
    if (mode === "random" || mode === "list") {
      const episodes = [
        {
          id: fixtureEpisode.epNum ?? "0",
          number: fixtureEpisode.epNum ?? "0",
          airDate: fixtureEpisode.airDate,
          info: fixtureEpisode.info,
          theme: "standard",
          hasFinal: Boolean(fixtureEpisode.final?.length),
          clueCount:
            (fixtureEpisode.jeopardy?.length ?? 0) +
            (fixtureEpisode.final?.length ?? 0),
        },
      ];
      if (mode === "random") {
        return Response.json({
          id: fixtureEpisode.epNum ?? "0",
          episode: fixtureEpisode,
        });
      }
      return Response.json({ total: 1, episodes });
    }
  }
  try {
    const archive = await loadArchive();
    if (mode === "random") {
      const theme = url.searchParams.get("theme") ?? undefined;
      const decade = url.searchParams.get("decade") ?? undefined;
      const random = getRandomEpisode(archive, { theme, decade });
      if (!random) {
        return Response.json({ error: "no-episode" }, { status: 404 });
      }
      return Response.json({ id: random.id, episode: random.episode });
    }
    if (mode === "stats") {
      const total = Object.keys(archive).length;
      return Response.json({ total });
    }
    if (mode === "themes") {
      return Response.json({ counts: themeCounts(archive) });
    }
    if (mode === "decades") {
      return Response.json({ counts: decadeCounts(archive) });
    }
    const theme = url.searchParams.get("theme") ?? undefined;
    const decade = url.searchParams.get("decade") ?? undefined;
    const query = url.searchParams.get("q") ?? undefined;
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
    const result = listEpisodes(archive, { theme, decade, query, limit, offset });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: "archive-unavailable", message: String((error as Error)?.message ?? error) },
      { status: 502 },
    );
  }
}
