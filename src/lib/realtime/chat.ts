export type ChatMessageKind = "player" | "system" | "host" | "judge";

export interface ChatMessage {
  id: string;
  timestamp: number;
  kind: ChatMessageKind;
  authorId?: string;
  authorName?: string;
  text: string;
}

export type ChatMessageInput = Omit<ChatMessage, "id" | "timestamp"> & {
  timestamp?: number;
  id?: string;
};

export function createChatMessage(input: ChatMessageInput): ChatMessage {
  return {
    id: input.id ?? `msg-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: input.timestamp ?? Date.now(),
    kind: input.kind,
    authorId: input.authorId,
    authorName: input.authorName,
    text: input.text,
  };
}

/** Room chat is public and shared, so cap what a client can push through it. */
export const maxChatLength = 280;

export function sanitizeChatText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, maxChatLength);
}
