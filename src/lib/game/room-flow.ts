/**
 * Who is in the room and what game they are playing: seats, roles, settings,
 * the deck of clues, and starting the thing.
 */
import type {
  GameClue,
  GameCommand,
  GameEngineResult,
  GamePlayer,
  GameState,
  PlayableRound,
} from "./contracts";
import {
  createEmptyStats,
  emptyClueIndex,
  getActivePlayers,
  getFirstPlayableRound,
  introDeadline,
  isHostOrOpenRoom,
  maxPlayersPerRoom,
  patch,
  refuse,
  sanitizeName,
  selectPicker,
  touch,
  withoutPlayer,
} from "./rules";

type Command<T extends GameCommand["type"]> = Extract<GameCommand, { type: T }>;

export function startGame(
  state: GameState,
  command: Command<"start-game">,
  now: number,
): GameEngineResult {
  const denied = refuse(state, command, [
    [state.round === "lobby", "game-already-started", "Game already started."],
    [isHostOrOpenRoom(state, command.actorId), "not-authorized", "Only the host can start."],
  ]);
  if (denied) return denied;

  const round = getFirstPlayableRound(state) ?? "complete";
  const next =
    round === "complete"
      ? patch(state, now, { round })
      : patch(state, now, {
          round,
          pickerId: selectPicker(state),
          roundIntroEndsAt: introDeadline(state, now),
        });
  return {
    state: next,
    events: [
      { type: "game-started", round },
      { type: "round-advanced", round },
    ],
  };
}

/** Puts the board back the way it was before the last reveal. */
export function undo(
  state: GameState,
  command: Command<"undo">,
  now: number,
): GameEngineResult {
  const denied = refuse(state, command, [
    [isHostOrOpenRoom(state, command.actorId), "not-authorized", "Only the host can undo."],
    [state.undoSnapshot, "undo-unavailable", "No undo snapshot exists."],
  ]);
  if (denied) return denied;
  return {
    state: touch({ ...structuredClone(state.undoSnapshot!), undoSnapshot: undefined }, now),
    events: [{ type: "undo-applied" }],
  };
}

export function updateSettings(
  state: GameState,
  command: Command<"update-settings">,
  now: number,
): GameEngineResult {
  const denied = refuse(state, command, [
    [
      isHostOrOpenRoom(state, command.actorId),
      "not-authorized",
      "Only the host can update settings.",
    ],
  ]);
  if (denied) return denied;
  return {
    state: patch(state, now, { settings: { ...state.settings, ...command.settings } }),
    events: [{ type: "settings-updated" }],
  };
}

export function addBot(
  state: GameState,
  command: Command<"add-bot">,
  now: number,
): GameEngineResult {
  const denied = refuse(state, command, [
    [isHostOrOpenRoom(state, command.actorId), "not-authorized", "Only the host can add bots."],
    [!state.players[command.bot.id], "invalid-command", "Player id is already used."],
  ]);
  if (denied) return denied;

  const bot: GamePlayer = { ...command.bot, kind: "ai-bot", connected: true, spectator: false };
  return {
    state: patch(state, now, {
      players: { ...state.players, [bot.id]: bot },
      scores: { ...state.scores, [bot.id]: 0 },
    }),
    events: [{ type: "bot-added", botId: bot.id }],
  };
}

export function configureHost(
  state: GameState,
  command: Command<"configure-host">,
  now: number,
): GameEngineResult {
  const denied = refuse(state, command, [
    [
      !state.settings.hostId || state.settings.hostId === command.actorId,
      "not-authorized",
      "Only the host can reassign host.",
    ],
    [!command.hostId || state.players[command.hostId], "not-found", "Host player was not found."],
  ]);
  if (denied) return denied;
  return {
    state: patch(state, now, {
      settings: { ...state.settings, hostId: command.hostId },
      pickerId: command.hostId ?? state.pickerId,
    }),
    events: [{ type: "host-configured", hostId: command.hostId }],
  };
}

export function joinGame(
  state: GameState,
  command: Command<"join-game">,
  now: number,
): GameEngineResult {
  const displayName = sanitizeName(command.displayName);
  const existing = state.players[command.actorId];

  if (existing) {
    const player: GamePlayer = {
      ...existing,
      displayName: displayName || existing.displayName,
      connected: true,
      emoji: command.emoji ?? existing.emoji,
      color: command.color ?? existing.color,
      spectator: command.spectator ?? existing.spectator,
    };
    return {
      // Reclaiming a seat in a room that came back from storage counts too:
      // the recorded host may never return.
      state: ensureHost(
        patch(state, now, { players: { ...state.players, [player.id]: player } }),
      ),
      events: [
        {
          type: "player-joined",
          playerId: player.id,
          displayName: player.displayName,
          rejoined: true,
        },
      ],
    };
  }

  const denied = refuse(state, command, [
    [Object.keys(state.players).length < maxPlayersPerRoom, "room-full", "This room is full."],
  ]);
  if (denied) return denied;

  const inPlay = state.round !== "lobby" && state.round !== "complete";
  const player: GamePlayer = {
    id: command.actorId,
    displayName: displayName || "Player",
    kind: "human",
    connected: true,
    spectator: Boolean(command.spectator),
    emoji: command.emoji,
    color: command.color,
    joinedAt: now,
  };
  return {
    // First human through the door owns the room — and so does the next one,
    // if the chair is standing empty when they arrive.
    state: ensureHost(
      patch(state, now, {
        players: { ...state.players, [player.id]: player },
        scores: { ...state.scores, [player.id]: state.scores[player.id] ?? 0 },
        pickerId: state.pickerId ?? (inPlay ? player.id : undefined),
      }),
    ),
    events: [
      {
        type: "player-joined",
        playerId: player.id,
        displayName: player.displayName,
        rejoined: false,
      },
    ],
  };
}

export function leaveGame(
  state: GameState,
  command: Command<"leave-game">,
  now: number,
): GameEngineResult {
  const targetId = command.targetPlayerId ?? command.actorId;
  const player = state.players[targetId];
  const denied = refuse(state, command, [
    [
      targetId === command.actorId || isHostOrOpenRoom(state, command.actorId),
      "not-authorized",
      "Only the host can remove players.",
    ],
    [player, "not-found", "Player was not found."],
  ]);
  if (denied) return denied;

  const players = { ...state.players };
  const scores = { ...state.scores };
  delete players[targetId];
  delete scores[targetId];

  return {
    state: touch(
      reassignRoles(
        {
          ...state,
          players,
          scores,
          activeClue: state.activeClue
            ? withoutPlayer(state.activeClue, targetId)
            : undefined,
        },
        targetId,
      ),
      now,
    ),
    events: [
      { type: "player-left", playerId: targetId, displayName: player!.displayName },
    ],
  };
}

export function setPlayerProfile(
  state: GameState,
  command: Command<"set-player-profile">,
  now: number,
): GameEngineResult {
  const targetId = command.targetPlayerId ?? command.actorId;
  const player = state.players[targetId];
  const denied = refuse(state, command, [
    [
      targetId === command.actorId || isHostOrOpenRoom(state, command.actorId),
      "not-authorized",
      "Only the host can edit other players.",
    ],
    [player, "not-found", "Player was not found."],
  ]);
  if (denied) return denied;

  const renamed =
    command.displayName === undefined ? "" : sanitizeName(command.displayName);
  return {
    state: patch(state, now, {
      players: {
        ...state.players,
        [targetId]: {
          ...player!,
          displayName: renamed || player!.displayName,
          emoji: command.emoji ?? player!.emoji,
          color: command.color ?? player!.color,
          spectator: command.spectator ?? player!.spectator,
        },
      },
    }),
    events: [{ type: "player-updated", playerId: targetId }],
  };
}

/** Swaps in a whole new deck of clues and clears the board behind it. */
export function loadGame(
  state: GameState,
  command: Command<"load-game">,
  now: number,
): GameEngineResult {
  const denied = refuse(state, command, [
    [isHostOrOpenRoom(state, command.actorId), "not-authorized", "Only the host can load a game."],
    [command.clues.length > 0, "invalid-command", "A game needs at least one clue."],
  ]);
  if (denied) return denied;

  const cluesById: Record<string, GameClue> = {};
  const clueIdsByRound = emptyClueIndex();
  for (const clue of command.clues) {
    if (cluesById[clue.id]) {
      return refuse(state, command, [
        [false, "invalid-command", `Duplicate clue id: ${clue.id}`],
      ])!;
    }
    cluesById[clue.id] = { ...clue };
    clueIdsByRound[clue.round as PlayableRound].push(clue.id);
  }

  return {
    state: patch(state, now, {
      round: "lobby",
      roundIntroEndsAt: undefined,
      activeClue: undefined,
      revealedClueIds: [],
      cluesById,
      clueIdsByRound,
      scores: command.keepScores
        ? { ...state.scores }
        : Object.fromEntries(Object.keys(state.players).map((id) => [id, 0])),
      stats: createEmptyStats(),
      undoSnapshot: undefined,
    }),
    events: [{ type: "game-loaded", clueCount: command.clues.length }],
  };
}

/**
 * Hands the host badge and the picker seat to someone still in the room.
 * Called when a player leaves or drops off the connection.
 */
export function reassignRoles(state: GameState, departedId: string): GameState {
  const withHost = ensureHost(state, departedId);
  if (withHost.pickerId !== departedId) return withHost;
  const pickerId =
    withHost.settings.hostId ??
    getActivePlayers(withHost).find((player) => player.id !== departedId)?.id;
  return pickerId === withHost.pickerId ? withHost : { ...withHost, pickerId };
}

/**
 * The chair belongs to someone who is actually here.
 *
 * A host who is present keeps it, spectator or not — hosting without playing
 * is a thing people choose. But a chair held by someone absent is a room
 * nobody can run: the board won't open, the answer won't reveal. A room
 * restored from storage comes back with its old host recorded and nobody
 * connected, so the next person through the door would otherwise find a board
 * they cannot touch — and if they are the only one there, no one is coming to
 * hand it over.
 *
 * Call it after anyone joins, leaves or drops.
 */
export function ensureHost(state: GameState, departedId?: string): GameState {
  const current = state.settings.hostId ? state.players[state.settings.hostId] : undefined;
  if (current && current.id !== departedId && isHostCandidate(current)) return state;

  const nextHost = candidates(state, departedId)[0]?.id;
  if (nextHost === state.settings.hostId) return state;
  return { ...state, settings: { ...state.settings, hostId: nextHost } };
}

function isHostCandidate(player: GamePlayer): boolean {
  return player.kind === "human" && player.connected;
}

/** Everyone who could take the chair, best first. */
function candidates(state: GameState, departedId?: string): GamePlayer[] {
  return Object.values(state.players)
    .filter((player) => player.id !== departedId && isHostCandidate(player))
    .sort(
      (a, b) =>
        // A contestant before a spectator: a television that joined to watch
        // should not end up holding the board.
        Number(Boolean(a.spectator)) - Number(Boolean(b.spectator)) ||
        (a.joinedAt ?? 0) - (b.joinedAt ?? 0) ||
        a.id.localeCompare(b.id),
    );
}
