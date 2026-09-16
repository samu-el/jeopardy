/**
 * The engine: one function in, one new position out.
 *
 * Nothing here knows about React, a socket, a database or a speech engine —
 * give it the same state, command and clock and it gives the same answer
 * every time, which is why the whole of it can be exercised in a unit test.
 *
 * The work itself lives next door: `rules.ts` answers questions about a
 * position, `clue-flow.ts` runs a clue from pick to ruling, `room-flow.ts`
 * handles seats and settings, `projection.ts` decides what a client may see.
 */
import type {
  CreateGameInput,
  GameClue,
  GameCommand,
  GameCommandContext,
  GameEngineResult,
  GameState,
  PlayableRound,
} from "./contracts";
import {
  buzz,
  extendReadout,
  judgeAnswer,
  pickClue,
  readoutComplete,
  revealAnswer,
  skip,
  submitAnswer,
  submitWager,
  tickGame,
} from "./clue-flow";
import {
  addBot,
  configureHost,
  joinGame,
  leaveGame,
  loadGame,
  setPlayerProfile,
  startGame,
  undo,
  updateSettings,
} from "./room-flow";
import { createEmptyStats, defaultGameSettings, emptyClueIndex } from "./rules";

export { createEmptyStats, defaultGameSettings, maxPlayersPerRoom, maxReadoutHoldMs } from "./rules";
export { ensureHost, reassignRoles } from "./room-flow";
export { tickGame } from "./clue-flow";
export { getPublicGameState } from "./projection";

export function createGame(input: CreateGameInput): GameState {
  const cluesById: Record<string, GameClue> = {};
  const clueIdsByRound = emptyClueIndex();
  for (const clue of input.clues) {
    if (cluesById[clue.id]) throw new Error(`Duplicate clue id: ${clue.id}`);
    cluesById[clue.id] = { ...clue };
    clueIdsByRound[clue.round as PlayableRound].push(clue.id);
  }

  return {
    roomId: input.roomId,
    round: "lobby",
    createdAt: input.now,
    updatedAt: input.now,
    players: Object.fromEntries(input.players.map((player) => [player.id, { ...player }])),
    scores: Object.fromEntries(input.players.map((player) => [player.id, 0])),
    cluesById,
    clueIdsByRound,
    revealedClueIds: [],
    settings: { ...defaultGameSettings, ...input.settings },
    stats: createEmptyStats(),
  };
}

/**
 * Every command the engine understands, and the handler that runs it. A table
 * rather than a switch: adding a command is one line, and nothing can quietly
 * fall through to the wrong branch.
 */
const handlers: {
  [T in GameCommand["type"]]: (
    state: GameState,
    command: Extract<GameCommand, { type: T }>,
    now: number,
  ) => GameEngineResult;
} = {
  "start-game": startGame,
  "pick-clue": pickClue,
  "submit-wager": submitWager,
  buzz,
  "submit-answer": submitAnswer,
  "reveal-answer": revealAnswer,
  "judge-answer": judgeAnswer,
  skip,
  "readout-complete": readoutComplete,
  "extend-readout": extendReadout,
  undo,
  "update-settings": updateSettings,
  "add-bot": addBot,
  "configure-host": configureHost,
  "join-game": joinGame,
  "leave-game": leaveGame,
  "set-player-profile": setPlayerProfile,
  "load-game": loadGame,
  tick: (state, _command, now) => tickGame(state, now),
};

export function dispatchGameCommand(
  state: GameState,
  command: GameCommand,
  context: GameCommandContext,
): GameEngineResult {
  const handler = handlers[command.type] as (
    state: GameState,
    command: GameCommand,
    now: number,
  ) => GameEngineResult;
  return handler(state, command, context.now);
}
