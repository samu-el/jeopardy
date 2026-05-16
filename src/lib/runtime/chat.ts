export type ChatMessageKind = "player" | "system" | "host" | "judge";

export interface ChatMessage {
  id: string;
  timestamp: number;
  kind: ChatMessageKind;
  authorId?: string;
  authorName?: string;
  text: string;
}

export function createChatMessage(input: Omit<ChatMessage, "id" | "timestamp"> & {
  timestamp?: number;
  id?: string;
}): ChatMessage {
  return {
    id: input.id ?? `msg-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: input.timestamp ?? Date.now(),
    kind: input.kind,
    authorId: input.authorId,
    authorName: input.authorName,
    text: input.text,
  };
}
