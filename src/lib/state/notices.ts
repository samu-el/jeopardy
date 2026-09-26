import type { GameEvent, PublicGameState } from "@/lib/game";

/**
 * Transient room news: someone arrived, someone left, the chair changed
 * hands, a request was refused. Chat carries the same lines, but chat is off
 * by default, and nobody should need it on to learn that they are hosting.
 */
export type RoomNoticeKind =
  | "joined"
  | "left"
  | "host-changed"
  | "room-full"
  | "kicked"
  | "refused"
  | "info";

export interface RoomNotice {
  id: string;
  kind: RoomNoticeKind;
  text: string;
  at: number;
}

export type RoomNoticeDraft = Omit<RoomNotice, "id" | "at">;

/** Displays join and leave rooms constantly; nobody needs telling. */
function isDisplayId(playerId: string) {
  return playerId.startsWith("display-");
}

/** The notices a batch of room events is worth, from this client's seat. */
export function noticesFromEvents(events: readonly GameEvent[], selfId: string): RoomNoticeDraft[] {
  const drafts: RoomNoticeDraft[] = [];
  for (const event of events) {
    if (event.type === "player-joined") {
      if (event.rejoined || event.playerId === selfId || isDisplayId(event.playerId)) continue;
      drafts.push({ kind: "joined", text: `${event.displayName} joined` });
    } else if (event.type === "player-left") {
      if (event.playerId === selfId || isDisplayId(event.playerId)) continue;
      drafts.push({ kind: "left", text: `${event.displayName} left` });
    }
  }
  return drafts;
}

/**
 * A change of host, read off two successive snapshots. The engine moves the
 * chair on its own when a host drops, with no event of its own, so the
 * snapshot is the one place every kind of hand-over shows up.
 */
export function hostChangeNotice(
  previous: PublicGameState | null,
  next: PublicGameState,
  selfId: string,
): RoomNoticeDraft | undefined {
  if (!previous) return undefined;
  const before = previous.settings.hostId;
  const after = next.settings.hostId;
  if (!after || before === after) return undefined;
  if (after === selfId) return { kind: "host-changed", text: "You're the host now" };
  const name = next.players.find((player) => player.id === after)?.displayName ?? "Someone";
  return { kind: "host-changed", text: `${name} is now hosting` };
}

/** At most this many notices are kept; older ones fall off the front. */
export const maxNotices = 4;

export function appendNotice(
  existing: readonly RoomNotice[],
  draft: RoomNoticeDraft,
  now: number,
): RoomNotice[] {
  const notice: RoomNotice = {
    ...draft,
    id: `notice-${now}-${Math.random().toString(36).slice(2, 7)}`,
    at: now,
  };
  return [...existing, notice].slice(-maxNotices);
}
