import type {
  GameClue,
  GameCommand,
  GameEvent,
  GamePlayer,
  GameSettings,
  PublicGameState,
} from "@/lib/game";
import type { ChatMessage } from "./chat";

export type RealtimeConnectionStatus =
  | "connected"
  | "replaced"
  | "disconnected";

export type RealtimeRejectReason =
  | "invalid-session"
  | "unknown-connection"
  | "unknown-message"
  | "invalid-command";

export interface RealtimeSession {
  clientId: string;
  sessionToken: string;
}

export interface RealtimeConnectionRequest extends RealtimeSession {
  connectionId: string;
}

export interface RealtimeConnectionRecord extends RealtimeConnectionRequest {
  connectedAt: number;
  status: RealtimeConnectionStatus;
}

export type ClientGameCommand =
  | {
      type: "start-game";
    }
  | {
      type: "pick-clue";
      clueId: string;
    }
  | {
      type: "submit-wager";
      amount: number;
    }
  | {
      type: "buzz";
    }
  | {
      type: "submit-answer";
      answer: string;
    }
  | {
      type: "reveal-answer";
    }
  | {
      type: "judge-answer";
      targetPlayerId: string;
      correct: boolean | null;
    }
  | {
      type: "skip";
    }
  | {
      type: "readout-complete";
      clueId: string;
    }
  | {
      type: "extend-readout";
      clueId: string;
      endsAt: number;
    }
  | {
      type: "undo";
    }
  | {
      type: "update-settings";
      settings: Partial<GameSettings>;
    }
  | {
      type: "add-bot";
      bot: Omit<GamePlayer, "kind" | "connected" | "spectator">;
      /** Difficulty profile the server resolves from its baseline table. */
      profileId?: string;
    }
  | {
      type: "configure-host";
      hostId?: string;
    }
  | {
      type: "join-game";
      displayName: string;
      spectator?: boolean;
      emoji?: string;
      color?: string;
    }
  | {
      type: "leave-game";
      targetPlayerId?: string;
    }
  | {
      type: "set-player-profile";
      targetPlayerId?: string;
      displayName?: string;
      emoji?: string;
      color?: string;
      spectator?: boolean;
    }
  | {
      type: "load-game";
      clues: GameClue[];
      keepScores?: boolean;
    };

export type ClientRealtimeMessage =
  | {
      type: "game-command";
      commandId: string;
      command: ClientGameCommand;
    }
  | {
      type: "chat";
      commandId?: string;
      text: string;
    }
  | {
      /** Ask the room to run the fuzzy judge on one queued answer. */
      type: "ai-judge";
      commandId?: string;
      targetPlayerId: string;
    };

export type ServerRealtimeMessage =
  | {
      type: "session-accepted";
      connectionId: string;
      clientId: string;
      sessionToken: string;
      state: PublicGameState;
      chat: ChatMessage[];
    }
  | {
      type: "session-rejected";
      connectionId: string;
      clientId: string;
      reason: RealtimeRejectReason;
      message: string;
    }
  | {
      type: "connection-status";
      clientId: string;
      connectionId: string;
      status: RealtimeConnectionStatus;
    }
  | {
      type: "game-events";
      commandId?: string;
      events: GameEvent[];
    }
  | {
      type: "public-state";
      state: PublicGameState;
    }
  | {
      type: "chat";
      message: ChatMessage;
    }
  | {
      type: "message-rejected";
      commandId?: string;
      connectionId?: string;
      reason: RealtimeRejectReason;
      message: string;
    };

export type RealtimeMessageSink = (message: ServerRealtimeMessage) => void;

export interface RealtimeClock {
  now: () => number;
}

export interface RealtimeTokenFactory {
  createToken: (clientId: string) => string;
}

export interface RealtimeConnectResult {
  ok: boolean;
  reason?: RealtimeRejectReason;
}

export function commandFromClient(
  clientId: string,
  command: ClientGameCommand,
): GameCommand {
  switch (command.type) {
    case "start-game":
      return { type: "start-game", actorId: clientId };
    case "pick-clue":
      return { type: "pick-clue", actorId: clientId, clueId: command.clueId };
    case "submit-wager":
      return { type: "submit-wager", actorId: clientId, amount: command.amount };
    case "buzz":
      return { type: "buzz", actorId: clientId };
    case "submit-answer":
      return { type: "submit-answer", actorId: clientId, answer: command.answer };
    case "reveal-answer":
      return { type: "reveal-answer", actorId: clientId };
    case "judge-answer":
      return {
        type: "judge-answer",
        actorId: clientId,
        targetPlayerId: command.targetPlayerId,
        correct: command.correct,
      };
    case "skip":
      return { type: "skip", actorId: clientId };
    case "readout-complete":
      return {
        type: "readout-complete",
        actorId: clientId,
        clueId: command.clueId,
      };
    case "extend-readout":
      return {
        type: "extend-readout",
        actorId: clientId,
        clueId: command.clueId,
        endsAt: command.endsAt,
      };
    case "undo":
      return { type: "undo", actorId: clientId };
    case "update-settings":
      return {
        type: "update-settings",
        actorId: clientId,
        settings: command.settings,
      };
    case "add-bot":
      return { type: "add-bot", actorId: clientId, bot: command.bot };
    case "configure-host":
      return {
        type: "configure-host",
        actorId: clientId,
        hostId: command.hostId,
      };
    case "join-game":
      return {
        type: "join-game",
        actorId: clientId,
        displayName: command.displayName,
        spectator: command.spectator,
        emoji: command.emoji,
        color: command.color,
      };
    case "leave-game":
      return {
        type: "leave-game",
        actorId: clientId,
        targetPlayerId: command.targetPlayerId,
      };
    case "set-player-profile":
      return {
        type: "set-player-profile",
        actorId: clientId,
        targetPlayerId: command.targetPlayerId,
        displayName: command.displayName,
        emoji: command.emoji,
        color: command.color,
        spectator: command.spectator,
      };
    case "load-game":
      return {
        type: "load-game",
        actorId: clientId,
        clues: command.clues,
        keepScores: command.keepScores,
      };
  }
}
