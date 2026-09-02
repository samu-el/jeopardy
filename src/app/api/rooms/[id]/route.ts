import { deleteRoom, getRoom, roomSummary } from "@/lib/realtime/room-registry";
import { socketPath } from "@/lib/realtime/socket-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const room = getRoom(id);
  if (!room) {
    return Response.json({ id, exists: false }, { status: 404 });
  }
  return Response.json({
    id: room.roomId,
    exists: true,
    socketPath,
    room: roomSummary(room),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return Response.json({ id, deleted: deleteRoom(id) });
}
