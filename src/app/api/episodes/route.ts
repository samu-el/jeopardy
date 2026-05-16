import {
  getRandomEpisode,
  listEpisodes,
  loadArchive,
} from "@/lib/data/archive-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "list";
  try {
    const archive = await loadArchive();
    if (mode === "random") {
      const theme = url.searchParams.get("theme") ?? undefined;
      const random = getRandomEpisode(archive, { theme });
      if (!random) {
        return Response.json({ error: "no-episode" }, { status: 404 });
      }
      return Response.json({ id: random.id, episode: random.episode });
    }
    if (mode === "stats") {
      const total = Object.keys(archive).length;
      return Response.json({ total });
    }
    const theme = url.searchParams.get("theme") ?? undefined;
    const query = url.searchParams.get("q") ?? undefined;
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
    const result = listEpisodes(archive, { theme, query, limit, offset });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: "archive-unavailable", message: String((error as Error)?.message ?? error) },
      { status: 502 },
    );
  }
}
