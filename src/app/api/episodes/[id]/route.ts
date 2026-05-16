import { getEpisode, loadArchive } from "@/lib/data/archive-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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
