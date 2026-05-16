import { hasBridgeRoom } from "@/lib/realtime/socket-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const exists = hasBridgeRoom(id);
  return Response.json({ id, exists });
}
