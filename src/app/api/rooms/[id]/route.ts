import { deleteRoom, resolveRoom, roomSummary } from "@/lib/realtime/room-registry";
import { ensureRoomStore } from "@/lib/realtime/room-store-bootstrap";
import { socketPath } from "@/lib/realtime/socket-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await ensureRoomStore();
  // A room this process doesn't hold may still be in the store, so an invite
  // link keeps working across a restart.
  const room = await resolveRoom(id);
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
  await ensureRoomStore();
  return Response.json({ id, deleted: await deleteRoom(id) });
}
