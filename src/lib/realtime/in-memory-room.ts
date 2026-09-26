import {
  dispatchGameCommand,
  getPublicGameState,
  maxPlayersPerRoom,
  reassignRoles,
  tickGame,
  type GameEvent,
  type GameState,
} from "@/lib/game";
import { judgeAnswer as fuzzyJudge } from "@/lib/ai/judge";
import {
  createChatMessage,
  sanitizeChatText,
  type ChatMessage,
  type ChatMessageInput,
} from "./chat";
import {
  commandFromClient,
  hostReclaimGraceMs,
  kickBanMs,
  type ClientGameCommand,
  type ClientRealtimeMessage,
  type RealtimeClock,
  type RealtimeConnectResult,
  type RealtimeConnectionRecord,
  type RealtimeConnectionRequest,
  type RealtimeMessageSink,
  type RealtimeRejectReason,
  type RealtimeSession,
  type RealtimeTokenFactory,
  type ServerRealtimeMessage,
} from "./contracts";

export interface InMemoryRealtimeRoomOptions {
  initialState: GameState;
  clock?: RealtimeClock;
  tokenFactory?: RealtimeTokenFactory;
  /** Chat lines kept in memory and replayed to a joining client. */
  chatHistoryLimit?: number;
  /** Chat carried over when a room is restored from storage. */
  initialChat?: ChatMessage[];
}

export type RoomChangeListener = (state: GameState, events: GameEvent[]) => void;
export type RoomChatListener = (message: ChatMessage) => void;

/**
 * The authoritative room. It owns the game state, stamps every command with
 * the connection's client id, and fans the resulting public state out to
 * every listener. The same class backs solo play in the browser and the
 * Socket.IO server, so both paths run identical rules.
 */
export class InMemoryRealtimeRoom {
  private state: GameState;
  private readonly clock: RealtimeClock;
  private readonly tokenFactory: RealtimeTokenFactory;
  private readonly chatHistoryLimit: number;
  private readonly sessions = new Map<string, RealtimeSession>();
  private readonly connections = new Map<
    string,
    RealtimeConnectionRecord & { sink: RealtimeMessageSink }
  >();
  private readonly activeConnectionByClient = new Map<string, string>();
  private readonly changeListeners = new Set<RoomChangeListener>();
  private readonly chatListeners = new Set<RoomChatListener>();
  private chat: ChatMessage[] = [];
  /** Players the host removed, and until when they are kept out. */
  private readonly bans = new Map<string, number>();
  /**
   * The host who dropped off, and until when the chair is theirs to reclaim.
   * The room keeps playing under whoever it passed to in the meantime.
   */
  private hostClaim:
    | { playerId: string; until: number; pickerHandedTo?: string }
    | undefined;

  constructor({
    initialState,
    clock = { now: () => Date.now() },
    tokenFactory = { createToken: defaultToken },
    chatHistoryLimit = 200,
    initialChat = [],
  }: InMemoryRealtimeRoomOptions) {
    this.state = structuredClone(initialState);
    this.clock = clock;
    this.tokenFactory = tokenFactory;
    this.chatHistoryLimit = chatHistoryLimit;
    this.chat = initialChat.slice(-chatHistoryLimit);
  }

  getState() {
    return structuredClone(this.state);
  }

  /** `viewerId` lets the host be shown what only the host may see. */
  getPublicState(viewerId?: string) {
    return getPublicGameState(this.state, this.clock.now(), { viewerId });
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chat];
  }

  /** Number of live connections, used to reap idle rooms. */
  get connectionCount(): number {
    return this.connections.size;
  }

  onChange(listener: RoomChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /** Chat doesn't move game state, so persistence listens for it separately. */
  onChat(listener: RoomChatListener): () => void {
    this.chatListeners.add(listener);
    return () => {
      this.chatListeners.delete(listener);
    };
  }

  issueSession(clientId: string): RealtimeSession {
    const existing = this.sessions.get(clientId);
    if (existing) {
      return existing;
    }

    const session = {
      clientId,
      sessionToken: this.tokenFactory.createToken(clientId),
    };
    this.sessions.set(clientId, session);
    return session;
  }

  /**
   * The session a joining client may use. A client id nobody holds yet gets a
   * fresh token; one already held is only handed back to whoever offers its
   * token, so knowing a player's id (it is public) is not enough to sit in
   * their seat.
   */
  claimSession(clientId: string, offeredToken?: string): RealtimeSession | undefined {
    const existing = this.sessions.get(clientId);
    if (!existing) return this.issueSession(clientId);
    return existing.sessionToken === offeredToken ? existing : undefined;
  }

  /** Whether the host removed this client recently enough that it stays out. */
  isBanned(clientId: string): boolean {
    return (this.bans.get(clientId) ?? 0) > this.clock.now();
  }

  /** Whether this client id has ever been issued a session in this room. */
  hasSession(clientId: string): boolean {
    return this.sessions.has(clientId);
  }

  /** Who holds a claim on the chair right now, if anyone. */
  get pendingHostClaim(): string | undefined {
    const claim = this.hostClaim;
    return claim && claim.until >= this.clock.now() ? claim.playerId : undefined;
  }

  connect(
    request: RealtimeConnectionRequest,
    sink: RealtimeMessageSink,
  ): RealtimeConnectResult {
    const reject = (
      reason: RealtimeRejectReason,
      message: string,
    ): RealtimeConnectResult => {
      sink({
        type: "session-rejected",
        connectionId: request.connectionId,
        clientId: request.clientId,
        reason,
        message,
      });
      return { ok: false, reason };
    };

    const session = this.sessions.get(request.clientId);
    if (!session || session.sessionToken !== request.sessionToken) {
      return reject(
        "invalid-session",
        "Session token does not match the requested client id.",
      );
    }

    const bannedUntil = this.bans.get(request.clientId);
    if (bannedUntil !== undefined) {
      if (bannedUntil > this.clock.now()) {
        return reject("kicked", "The host removed you from this room.");
      }
      this.bans.delete(request.clientId);
    }

    // Refused before the socket is accepted, not after: a joiner let in and
    // then denied a seat used to sit at a board with no lectern and no word
    // of why.
    if (
      !this.state.players[request.clientId] &&
      Object.keys(this.state.players).length >= maxPlayersPerRoom
    ) {
      return reject("room-full", `This room is full (${maxPlayersPerRoom} players).`);
    }

    const previousConnectionId = this.activeConnectionByClient.get(request.clientId);
    if (previousConnectionId && previousConnectionId !== request.connectionId) {
      const previous = this.connections.get(previousConnectionId);
      if (previous) {
        previous.status = "replaced";
        previous.sink({
          type: "connection-status",
          clientId: request.clientId,
          connectionId: previousConnectionId,
          status: "replaced",
        });
      }
      this.connections.delete(previousConnectionId);
    }

    this.connections.set(request.connectionId, {
      ...request,
      connectedAt: this.clock.now(),
      status: "connected",
      sink,
    });
    this.activeConnectionByClient.set(request.clientId, request.connectionId);
    this.setPlayerConnected(request.clientId, true);

    sink({
      type: "session-accepted",
      connectionId: request.connectionId,
      clientId: request.clientId,
      sessionToken: request.sessionToken,
      state: this.getPublicState(request.clientId),
      chat: this.getChatHistory(),
    });
    this.broadcast({
      type: "connection-status",
      clientId: request.clientId,
      connectionId: request.connectionId,
      status: "connected",
    });
    this.broadcastPublicState();
    return { ok: true };
  }

  disconnect(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.connections.delete(connectionId);
    if (this.activeConnectionByClient.get(connection.clientId) === connectionId) {
      this.activeConnectionByClient.delete(connection.clientId);
      const wasHost = this.state.settings.hostId === connection.clientId;
      const wasPicker = this.state.pickerId === connection.clientId;
      if (this.state.round === "lobby") {
        // Nothing to preserve before the game starts — free the seat so the
        // pre-game roster only lists people who are actually here.
        this.applyCommand(connection.clientId, { type: "leave-game" });
      } else {
        // Mid-game the seat and score stay put so a refresh can reclaim them.
        this.setPlayerConnected(connection.clientId, false);
        this.migrateRolesAwayFrom(connection.clientId);
      }
      if (wasHost) {
        // A refresh is not a resignation. Whoever takes the chair now holds
        // it for the host, who gets it back by returning in time.
        this.hostClaim = {
          playerId: connection.clientId,
          until: this.clock.now() + hostReclaimGraceMs,
          // If the board passed with the chair, it comes back with it too —
          // unless play has moved it on by then.
          pickerHandedTo: wasPicker ? this.state.pickerId : undefined,
        };
      }
    }

    connection.sink({
      type: "connection-status",
      clientId: connection.clientId,
      connectionId,
      status: "disconnected",
    });
    this.broadcast({
      type: "connection-status",
      clientId: connection.clientId,
      connectionId,
      status: "disconnected",
    });
    this.broadcastPublicState();
  }

  receive(connectionId: string, message: ClientRealtimeMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== "connected") {
      const rejection: ServerRealtimeMessage = {
        type: "message-rejected",
        commandId: message.commandId,
        connectionId,
        reason: "unknown-connection",
        message: "Connection is not active.",
      };
      return { ok: false, message: rejection };
    }

    switch (message.type) {
      case "game-command":
        return this.applyCommand(
          connection.clientId,
          message.command,
          message.commandId,
        );
      case "chat": {
        const player = this.state.players[connection.clientId];
        this.postChat({
          kind: "player",
          authorId: connection.clientId,
          authorName: player?.displayName ?? connection.clientId,
          text: message.text,
        });
        return { ok: true, events: [] };
      }
      case "ai-judge": {
        // A ruling moves scores, so it is the host's call (or the room's own
        // director's), never a contestant's on their own answer.
        if (this.state.settings.hostId !== connection.clientId) {
          const rejection: ServerRealtimeMessage = {
            type: "message-rejected",
            commandId: message.commandId,
            connectionId,
            reason: "not-authorized",
            message: "Only the host can ask for a ruling.",
          };
          connection.sink(rejection);
          return { ok: false, message: rejection };
        }
        this.runAiJudge(message.targetPlayerId);
        return { ok: true, events: [] };
      }
      default: {
        const rejection: ServerRealtimeMessage = {
          type: "message-rejected",
          connectionId,
          reason: "unknown-message",
          message: "Realtime message type is not supported.",
        };
        connection.sink(rejection);
        return { ok: false, message: rejection };
      }
    }
  }

  /**
   * Runs a command on behalf of a player without a connection — bots, the
   * automation director, and server-side housekeeping all come through here.
   */
  dispatch(actorId: string, command: ClientGameCommand, commandId?: string) {
    return this.applyCommand(actorId, command, commandId);
  }

  /** Advances every time-driven transition. Cheap when nothing is due. */
  tick(now = this.clock.now()) {
    const before = this.state;
    const result = tickGame(before, now);
    if (result.state === before && result.events.length === 0) {
      return { ok: true, events: [] as GameEvent[] };
    }
    this.state = result.state;
    this.publish(result.events);
    return { ok: true, events: result.events };
  }

  postChat(input: ChatMessageInput) {
    const text = sanitizeChatText(input.text);
    if (!text) return undefined;
    const message = createChatMessage({
      ...input,
      text,
      timestamp: input.timestamp ?? this.clock.now(),
    });
    this.chat = [...this.chat, message].slice(-this.chatHistoryLimit);
    this.broadcast({ type: "chat", message });
    for (const listener of this.chatListeners) {
      listener(message);
    }
    return message;
  }

  /**
   * Scores one queued answer with the fuzzy judge and reports the verdict to
   * the room. Runs where the state lives so every client sees the same call.
   */
  runAiJudge(targetPlayerId: string, options: { holdAmbiguous?: boolean } = {}) {
    const active = this.state.activeClue;
    if (!active?.answerRevealed) return undefined;
    if (active.judges[targetPlayerId] !== undefined) return undefined;
    if (active.currentJudgePlayerId !== targetPlayerId) return undefined;

    const clue = this.state.cluesById[active.clueId];
    const answer = active.answers[targetPlayerId] ?? "";
    const verdict = fuzzyJudge({
      submittedAnswer: answer,
      expectedAnswer: clue.correctResponse,
    });
    const hostId = this.state.settings.hostId ?? targetPlayerId;
    const host = this.state.players[hostId];
    // A near miss is the host's call when there is a connected host other
    // than the player being judged; the verdict is posted as advice instead.
    if (
      options.holdAmbiguous &&
      verdict.ambiguous &&
      hostId !== targetPlayerId &&
      host?.connected
    ) {
      const player = this.state.players[targetPlayerId];
      this.postChat({
        kind: "judge",
        text: `? ${player?.displayName ?? targetPlayerId} · "${
          answer.trim() || "—"
        }" · close call, waiting for the host`,
      });
      return { ...verdict, held: true as const };
    }
    this.applyCommand(hostId, {
      type: "judge-answer",
      targetPlayerId,
      correct: verdict.correct,
    });
    const player = this.state.players[targetPlayerId];
    this.postChat({
      kind: "judge",
      text: `${verdict.correct ? "✓" : "✗"} ${
        player?.displayName ?? targetPlayerId
      } · "${answer.trim() || "—"}" · ${(verdict.confidence * 100).toFixed(0)}%`,
    });
    return { ...verdict, held: false as const };
  }

  private applyCommand(
    actorId: string,
    command: ClientGameCommand,
    commandId?: string,
  ) {
    const gameCommand = commandFromClient(actorId, command);
    const result = dispatchGameCommand(this.state, gameCommand, {
      now: this.clock.now(),
    });
    this.state = result.state;
    this.afterCommand(actorId, command, result.events);
    this.publish(result.events, commandId);
    return { ok: true, events: result.events };
  }

  /**
   * The room's own bookkeeping around a command the engine accepted: a
   * removal that should stick, and a host coming back for their chair.
   */
  private afterCommand(
    actorId: string,
    command: ClientGameCommand,
    events: GameEvent[],
  ) {
    for (const event of events) {
      if (event.type === "host-configured") {
        // Handed over on purpose: there is no claim left to honour.
        this.hostClaim = undefined;
      }
      if (event.type === "player-left") {
        // No seat, nothing for a token to guard: whoever comes back under
        // this id starts a fresh session (once any ban has run out).
        this.sessions.delete(event.playerId);
        if (event.playerId !== actorId) this.removeConnection(event.playerId);
        if (this.hostClaim?.playerId === event.playerId && event.playerId !== actorId) {
          this.hostClaim = undefined;
        }
      }
      if (event.type === "player-joined" && command.type === "join-game") {
        this.returnChairTo(event.playerId);
      }
    }
  }

  /** Hands the chair back to a host who returned inside the grace window. */
  private returnChairTo(playerId: string) {
    const claim = this.hostClaim;
    if (!claim || claim.playerId !== playerId) return;
    this.hostClaim = undefined;
    if (claim.until < this.clock.now()) return;
    const player = this.state.players[playerId];
    if (!player || this.state.settings.hostId === playerId) return;
    const boardStillWaiting =
      claim.pickerHandedTo !== undefined &&
      this.state.pickerId === claim.pickerHandedTo &&
      !this.state.activeClue;
    this.state = {
      ...this.state,
      updatedAt: this.clock.now(),
      settings: { ...this.state.settings, hostId: playerId },
      pickerId: boardStillWaiting ? playerId : this.state.pickerId,
    };
    this.postChat({ kind: "system", text: `${player.displayName} is hosting again` });
  }

  /**
   * The host removed someone. Their socket is told why and dropped, and they
   * are kept out for a while: a removal a reload undoes isn't one.
   */
  private removeConnection(playerId: string) {
    this.bans.set(playerId, this.clock.now() + kickBanMs);
    const connectionId = this.activeConnectionByClient.get(playerId);
    if (!connectionId) return;
    const connection = this.connections.get(connectionId);
    this.activeConnectionByClient.delete(playerId);
    this.connections.delete(connectionId);
    connection?.sink({
      type: "session-rejected",
      connectionId,
      clientId: playerId,
      reason: "kicked",
      message: "The host removed you from this room.",
    });
  }

  private publish(events: GameEvent[], commandId?: string) {
    if (events.length > 0) {
      this.broadcast({ type: "game-events", commandId, events });
    }
    this.broadcastPublicState();
    for (const listener of this.changeListeners) {
      listener(this.state, events);
    }
  }

  private broadcast(message: ServerRealtimeMessage) {
    for (const connection of this.connections.values()) {
      if (connection.status === "connected") {
        connection.sink(message);
      }
    }
  }

  private broadcastPublicState() {
    for (const connection of this.connections.values()) {
      if (connection.status === "connected") {
        connection.sink({
          type: "public-state",
          state: this.getPublicState(connection.clientId),
        });
      }
    }
  }

  private setPlayerConnected(clientId: string, connected: boolean) {
    const player = this.state.players[clientId];
    if (!player || player.connected === connected) {
      return;
    }

    this.state = {
      ...this.state,
      updatedAt: this.clock.now(),
      players: {
        ...this.state.players,
        [clientId]: {
          ...player,
          connected,
        },
      },
    };
  }

  /** Keeps the room playable when the host or picker drops off. */
  private migrateRolesAwayFrom(clientId: string) {
    if (this.state.settings.hostId !== clientId && this.state.pickerId !== clientId) {
      return;
    }
    const next = reassignRoles(this.state, clientId);
    if (next === this.state) return;
    this.state = { ...next, updatedAt: this.clock.now() };
    const host = this.state.settings.hostId;
    if (host && host !== clientId) {
      this.postChat({
        kind: "system",
        text: `${this.state.players[host]?.displayName ?? host} is now hosting`,
      });
    }
  }
}

/** Unguessable: the token is what proves a returning client owns its seat. */
function defaultToken(clientId: string) {
  // Typed loosely: the worker build's lib set doesn't declare Web Crypto here.
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const random = cryptoRef?.randomUUID
    ? cryptoRef.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `session-${clientId}-${random}`;
}
