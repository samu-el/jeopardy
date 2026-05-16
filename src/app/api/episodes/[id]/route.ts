import { getEpisode, loadArchive } from "@/lib/data/archive-source";
import { fixtureEpisode } from "@/lib/data/fixture-episode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  if (url.searchParams.get("fixture") === "1" || process.env.NODE_ENV === "test") {
    return Response.json({ id, episode: fixtureEpisode });
  }
  try {
    const archive = await loadArchive();
    const episode = getEpisode(archive, id);
    if (!episode) {
      return Response.json({ error: "not-found" }, { status: 404 });
    }
    return Response.json({ id, episode });
  } catch (error) {
    return Response.json(
      { error: "archive-unavailable", message: String((error as Error)?.message ?? error) },
      { status: 502 },
    );
  }
}
