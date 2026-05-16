import {
  createSeededRng,
  decideBotAnswer,
  decideBotBuzz,
  decideBotWager,
  judgeAnswer as fuzzyJudge,
  type JudgeVerdict,
} from "@/lib/ai";
import {
  createGame,
  type GameClue,
  type GameEvent,
  type GamePlayer,
  type GameSettings,
  type GameState,
  type PublicGameState,
} from "@/lib/game";
import type { BotProfile } from "@/lib/foundation/game-contracts";
import {
  InMemoryRealtimeRoom,
  type ClientGameCommand,
  type ServerRealtimeMessage,
} from "@/lib/realtime";
import { createChatMessage, type ChatMessage } from "./chat";
import {
  beginReplayLog,
  persistReplayLog,
  recordCommand,
  recordEvents as recordReplayEvents,
} from "./replay-log";

export interface LocalRoomConfig {
  roomId: string;
  hostId: string;
  hostName: string;
  humanPlayers: { id: string; name: string; spectator?: boolean }[];
  bots: { id: string; name: string; profile: BotProfile }[];
  clues: GameClue[];
  settings?: Partial<GameSettings>;
  seed?: number;
}

export interface LocalRoomListeners {
  onPublicState: (state: PublicGameState) => void;
  onEvents: (events: GameEvent[]) => void;
  onChat: (message: ChatMessage) => void;
}

export class LocalRoomRuntime {
  private room: InMemoryRealtimeRoom;
  private connectionByClient = new Map<string, string>();
  private botProfiles = new Map<string, BotProfile>();
  private botCategoryPreference = new Map<string, Map<string, number>>();
  private pendingBotAction = new Map<string, NodeJS.Timeout>();
  private listeners: LocalRoomListeners;
  private chatHistory: ChatMessage[] = [];
  private rng: ReturnType<typeof createSeededRng>;
  private autoAdvanceTimeout: NodeJS.Timeout | undefined;
  private readonly hostId: string;
  private destroyed = false;

  constructor(config: LocalRoomConfig, listeners: LocalRoomListeners) {
    const players: GamePlayer[] = [
      ...config.humanPlayers.map<GamePlayer>((p) => ({
        id: p.id,
        displayName: p.name,
        kind: "human",
        connected: true,
        spectator: Boolean(p.spectator),
      })),
      ...config.bots.map<GamePlayer>((p) => ({
        id: p.id,
        displayName: p.name,
        kind: "ai-bot",
        connected: true,
        spectator: false,
      })),
    ];

    const initialState = createGame({
      roomId: config.roomId,
      players,
      clues: config.clues,
      now: Date.now(),
      settings: {
        hostId: config.hostId,
        buzzUnlockDelayMs: 1_200,
        answerTimeoutMs: 15_000,
        finalTimeoutMs: 30_000,
        ...config.settings,
      },
    });

    for (const bot of config.bots) {
      this.botProfiles.set(bot.id, bot.profile);
      this.botCategoryPreference.set(bot.id, new Map());
    }

    this.hostId = config.hostId;
    this.listeners = listeners;
    this.rng = createSeededRng(config.seed ?? Date.now());

    this.room = new InMemoryRealtimeRoom({
      initialState,
      clock: { now: () => Date.now() },
    });

    beginReplayLog(config.roomId);

    for (const player of players) {
      const session = this.room.issueSession(player.id);
      const connectionId = `conn-${player.id}`;
      this.connectionByClient.set(player.id, connectionId);
      this.room.connect({ ...session, connectionId }, (message) =>
        this.handleMessage(player.id, message),
      );
    }
  }

  destroy() {
    this.destroyed = true;
    for (const timer of this.pendingBotAction.values()) {
      clearTimeout(timer);
    }
    this.pendingBotAction.clear();
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
    }
  }

  getPublicState(): PublicGameState {
    return this.room.getPublicState();
  }

  getInternalState(): GameState {
    return this.room.getState();
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  sendCommand(actorId: string, command: ClientGameCommand) {
    const connectionId = this.connectionByClient.get(actorId);
    if (!connectionId) {
      return;
    }
    recordCommand({ ...command, actorId } as never);
    this.room.receive(connectionId, {
      type: "game-command",
      commandId: `cmd-${Math.random().toString(36).slice(2)}`,
      command,
    });
  }

  postChat(authorId: string, authorName: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.pushChat({
      kind: "player",
      authorId,
      authorName,
      text: trimmed,
    });
  }

  judgeWithAi(targetPlayerId: string): JudgeVerdict | undefined {
    const state = this.room.getState();
    const active = state.activeClue;
    if (!active || !active.answerRevealed) return undefined;
    const clue = state.cluesById[active.clueId];
    const answer = active.answers[targetPlayerId] ?? "";
    const verdict = fuzzyJudge({
      submittedAnswer: answer,
      expectedAnswer: clue.correctResponse,
    });
    this.sendCommand(this.hostId, {
      type: "judge-answer",
      targetPlayerId,
      correct: verdict.correct,
    });
    const player = state.players[targetPlayerId];
    this.pushChat({
      kind: "judge",
      text: `${verdict.correct ? "✓" : "✗"} ${player?.displayName ?? targetPlayerId} · "${answer}" · ${(verdict.confidence * 100).toFixed(0)}%`,
    });
    return verdict;
  }

  private handleMessage(clientId: string, message: ServerRealtimeMessage) {
    if (this.destroyed) return;
    if (message.type === "public-state") {
      if (clientId === this.hostId) {
        this.listeners.onPublicState(message.state);
      }
      this.maybeAutomate();
    } else if (message.type === "game-events") {
      if (clientId === this.hostId) {
        this.listeners.onEvents(message.events);
        this.recordEvents(message.events);
        recordReplayEvents(message.events);
        if (message.events.some((event) => event.type === "round-advanced" && event.round === "complete")) {
          persistReplayLog();
        }
      }
    }
  }

  private recordEvents(events: GameEvent[]) {
    const state = this.room.getState();
    for (const event of events) {
      switch (event.type) {
        case "clue-picked": {
          const clue = state.cluesById[event.clueId];
          const player = state.players[event.actorId];
          this.pushChat({
            kind: "system",
            text: `${player?.displayName ?? event.actorId} → ${clue?.category ?? "?"} $${clue?.value ?? 0}${event.dailyDouble ? " · DD" : ""}`,
          });
          break;
        }
        case "buzz-accepted":
          // Visualised on the scoreboard via animated light bar; no chat noise.
          break;
        case "answer-judged": {
          const player = state.players[event.targetPlayerId];
          this.pushChat({
            kind: "host",
            text: event.correct === true
              ? `${player?.displayName ?? event.targetPlayerId} +$${event.delta}`
              : event.correct === false
                ? `${player?.displayName ?? event.targetPlayerId} $${event.delta}`
                : `${player?.displayName ?? event.targetPlayerId} —`,
          });
          const targetClue = state.activeClue
            ? state.cluesById[state.activeClue.clueId]
            : undefined;
          const prefs = this.botCategoryPreference.get(event.targetPlayerId);
          if (prefs && targetClue && event.correct !== null) {
            const current = prefs.get(targetClue.category) ?? 0;
            prefs.set(targetClue.category, current + (event.correct ? 1 : -1));
          }
          break;
        }
        case "round-advanced":
          this.pushChat({
            kind: "system",
            text: event.round.replace("-jeopardy", "").replace(/^./, (c) => c.toUpperCase()),
          });
          break;
        case "game-started":
          break;
        case "command-rejected":
          // Rejections fire constantly during normal play (early buzzes, queue
          // ordering races). Surface only auth/setup errors to the chat.
          if (
            event.reason === "not-authorized" ||
            event.reason === "not-found" ||
            event.reason === "undo-unavailable"
          ) {
            this.pushChat({
              kind: "system",
              text: event.message,
            });
          }
          break;
        case "wager-requested":
          if (state.activeClue?.dailyDouble) {
            const player = state.players[event.playerIds[0]];
            this.pushChat({
              kind: "system",
              text: `DD · ${player?.displayName ?? event.playerIds[0]}`,
            });
          } else if (state.activeClue?.round === "final-jeopardy") {
            this.pushChat({ kind: "system", text: "Final" });
          }
          break;
        default:
          break;
      }
    }
  }

  private pushChat(message: Parameters<typeof createChatMessage>[0]) {
    const created = createChatMessage(message);
    this.chatHistory = [...this.chatHistory, created].slice(-200);
    this.listeners.onChat(created);
  }

  private maybeAutomate() {
    if (this.destroyed) return;
    const state = this.room.getState();

    if (!state.activeClue && state.pickerId && this.botProfiles.has(state.pickerId)) {
      const key = `${state.pickerId}:pick`;
      if (!this.pendingBotAction.has(key)) {
        const round = state.round;
        if (round !== "lobby" && round !== "complete" && round !== "final-jeopardy") {
          const availableClues = state.clueIdsByRound[round].filter(
            (clueId) => !state.revealedClueIds.includes(clueId),
          );
          if (availableClues.length > 0) {
            const profile = this.botProfiles.get(state.pickerId)!;
            const preference = this.botCategoryPreference.get(state.pickerId) ?? new Map();
            const preferHighValue = profile.targetAccuracy > 0.65;
            const ranked = availableClues
              .map((clueId) => state.cluesById[clueId])
              .map((clue) => ({
                clue,
                score:
                  (preference.get(clue.category) ?? 0) +
                  (preferHighValue ? clue.value / 200 : (2_000 - clue.value) / 200),
              }))
              .sort((a, b) => b.score - a.score);
            const pickIndex = Math.floor(this.rng.next() * Math.min(3, ranked.length));
            const choice = ranked[pickIndex].clue;
            const delay = 700 + Math.floor(this.rng.next() * 1_200);
            const pickerId = state.pickerId;
            const timer = setTimeout(() => {
              this.pendingBotAction.delete(key);
              this.sendCommand(pickerId, {
                type: "pick-clue",
                clueId: choice.id,
              });
            }, delay);
            this.pendingBotAction.set(key, timer);
          }
        }
      }
    }

    if (!state.activeClue) return;
    const active = state.activeClue;

    if (active.waitingForWager.length > 0) {
      for (const playerId of active.waitingForWager) {
        const profile = this.botProfiles.get(playerId);
        if (!profile) continue;
        if (this.pendingBotAction.has(`${playerId}:wager`)) continue;
        const clue = state.cluesById[active.clueId];
        const currentScore = state.scores[playerId] ?? 0;
        const leaderScore = Math.max(
          ...Object.values(state.scores),
          1,
        );
        const amount = decideBotWager({
          profile,
          clue,
          currentScore,
          leaderScore,
          round: clue.round,
          rng: this.rng,
        });
        const delay = 600 + Math.floor(this.rng.next() * 900);
        const timer = setTimeout(() => {
          this.pendingBotAction.delete(`${playerId}:wager`);
          this.sendCommand(playerId, { type: "submit-wager", amount });
        }, delay);
        this.pendingBotAction.set(`${playerId}:wager`, timer);
      }
      return;
    }

    if (active.clueRevealed && !active.answerRevealed) {
      const now = Date.now();
      for (const [botId, profile] of this.botProfiles.entries()) {
        if (active.buzzes[botId] !== undefined) continue;
        if (this.pendingBotAction.has(`${botId}:buzz`)) continue;
        if (active.round === "final-jeopardy") {
          continue;
        }
        const clue = state.cluesById[active.clueId];
        const decision = decideBotBuzz(profile, clue, this.rng);
        if (!decision.shouldBuzz) continue;
        const readoutRemaining = Math.max(0, (active.readoutEndsAt ?? now) - now);
        const buzzAt = readoutRemaining + Math.max(0, decision.buzzDelayMs);
        const timer = setTimeout(() => {
          this.pendingBotAction.delete(`${botId}:buzz`);
          this.sendCommand(botId, { type: "buzz" });
          this.queueBotAnswer(botId, profile);
        }, buzzAt);
        this.pendingBotAction.set(`${botId}:buzz`, timer);
      }

      if (active.round === "final-jeopardy") {
        for (const [botId, profile] of this.botProfiles.entries()) {
          if (active.submitted[botId]) continue;
          if (this.pendingBotAction.has(`${botId}:final-answer`)) continue;
          const clue = state.cluesById[active.clueId];
          const decision = decideBotAnswer(profile, clue, this.rng);
          const delay = 2_000 + Math.floor(this.rng.next() * 6_000);
          const timer = setTimeout(() => {
            this.pendingBotAction.delete(`${botId}:final-answer`);
            this.sendCommand(botId, {
              type: "submit-answer",
              answer: decision.answer,
            });
          }, delay);
          this.pendingBotAction.set(`${botId}:final-answer`, timer);
        }
      }
    }

    if (active.clueRevealed && !active.answerRevealed && active.answerWindowEndsAt) {
      const now = Date.now();
      const remaining = active.answerWindowEndsAt - now;
      if (remaining > 0 && !this.autoAdvanceTimeout && state.settings.aiJudgeEnabled) {
        this.autoAdvanceTimeout = setTimeout(() => {
          this.autoAdvanceTimeout = undefined;
          this.autoRevealAndJudge();
        }, remaining + 200);
      }
    }
  }

  private queueBotAnswer(botId: string, profile: BotProfile) {
    const state = this.room.getState();
    const active = state.activeClue;
    if (!active) return;
    const clue = state.cluesById[active.clueId];
    const decision = decideBotAnswer(profile, clue, this.rng);
    const delay = 800 + Math.floor(this.rng.next() * 2_400);
    const key = `${botId}:answer`;
    const timer = setTimeout(() => {
      this.pendingBotAction.delete(key);
      this.sendCommand(botId, {
        type: "submit-answer",
        answer: decision.answer,
      });
    }, delay);
    this.pendingBotAction.set(key, timer);
  }

  private autoRevealAndJudge() {
    const state = this.room.getState();
    const active = state.activeClue;
    if (!active || active.answerRevealed) return;
    if (!state.settings.aiJudgeEnabled) return;
    this.sendCommand(this.hostId, { type: "reveal-answer" });
    const refreshed = this.room.getState();
    const queue = refreshed.activeClue?.judgeQueue ?? [];
    for (const playerId of queue) {
      this.judgeWithAi(playerId);
    }
    setTimeout(() => {
      if (this.destroyed) return;
      const latest = this.room.getState();
      if (latest.activeClue?.canAdvance) {
        this.sendCommand(this.hostId, { type: "skip" });
      }
    }, 2_500);
  }
}
