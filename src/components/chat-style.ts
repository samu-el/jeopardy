import { ui } from "@/lib/foundation/jeopardy-style";

/**
 * Who said it, in one colour.
 *
 * The chat panel and the transcript both label the same four kinds of line,
 * and used to disagree: the transcript painted a judge's ruling gold while
 * the chat painted it orange.
 */
const speakerInk: Record<string, string> = {
  system: ui.inkMuted,
  host: ui.gold,
  judge: ui.gold,
};

export function speakerColor(kind: string): string {
  return speakerInk[kind] ?? ui.blue;
}

/** The connection lamp, and what it means when someone hovers it. */
const connectionStates: Record<string, { color: string; label: string }> = {
  connected: { color: ui.green, label: "Connected — share the code to let people in" },
  connecting: { color: ui.gold, label: "Connecting…" },
  reconnecting: { color: ui.gold, label: "Reconnecting…" },
  rejected: { color: ui.red, label: "Room unavailable" },
};

export function connectionState(status: string): { color: string; label: string } {
  return connectionStates[status] ?? { color: ui.red, label: "Disconnected" };
}

const speakerNames: Record<string, string> = {
  system: "Game",
  host: "Host",
  judge: "Judge",
  player: "Player",
};

/** Who said it, in words — for the screen reader the coloured dot can't reach. */
export function speakerLabel(kind: string): string {
  return speakerNames[kind] ?? kind;
}
