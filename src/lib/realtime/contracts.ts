import type {
  GameCommand,
  GameEvent,
  GamePlayer,
  GameSettings,
  PublicGameState,
} from "@/lib/game";

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
      type: "undo";
    }
  | {
      type: "update-settings";
      settings: Partial<GameSettings>;
    }
  | {
      type: "add-bot";
      bot: Omit<GamePlayer, "kind" | "connected" | "spectator">;
    }
  | {
      type: "configure-host";
      hostId?: string;
    };

export type ClientRealtimeMessage = {
  type: "game-command";
  commandId: string;
  command: ClientGameCommand;
};

export type ServerRealtimeMessage =
  | {
      type: "session-accepted";
      connectionId: string;
      clientId: string;
      sessionToken: string;
      state: PublicGameState;
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
  }
}
