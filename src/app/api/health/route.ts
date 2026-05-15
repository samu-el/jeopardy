export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    service: "jeopardy-modern",
    phase: "foundation",
    uiImplemented: false,
    timestamp: new Date().toISOString(),
  });
}
