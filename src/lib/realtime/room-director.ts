import {
  createSeededRng,
  decideBotAnswer,
  decideBotBuzz,
  decideBotWager,
  type BotRng,
} from "@/lib/ai/bots";
import type { BotProfile } from "@/lib/foundation/game-contracts";
import type { GameState } from "@/lib/game";
import type { InMemoryRealtimeRoom } from "./in-memory-room";

export interface RoomDirectorOptions {
  seed?: number;
  /** Bot profiles keyed by player id. Bots can be added while the room runs. */
  botProfiles?: Record<string, BotProfile>;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  now?: () => number;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Drives everything the room can't do on its own clock: bot picks, buzzes,
 * answers and wagers, plus AI judging when the room has no human host at the
 * podium. It only reacts to state the room already published, so it works
 * the same in the browser (solo play) and on the server (shared rooms).
 */
export class RoomDirector {
  private readonly room: InMemoryRealtimeRoom;
  private readonly profiles = new Map<string, BotProfile>();
  private readonly categoryPreference = new Map<string, Map<string, number>>();
  private readonly pending = new Map<string, { timer: Timer; scope: string }>();
  private readonly rng: BotRng;
  private readonly schedule: typeof setTimeout;
  private readonly unschedule: typeof clearTimeout;
  private unsubscribe: (() => void) | undefined;
  private stopped = false;

  constructor(room: InMemoryRealtimeRoom, options: RoomDirectorOptions = {}) {
    this.room = room;
    this.rng = createSeededRng(options.seed ?? Date.now());
    this.schedule = options.setTimeoutFn ?? setTimeout;
    this.unschedule = options.clearTimeoutFn ?? clearTimeout;
    for (const [id, profile] of Object.entries(options.botProfiles ?? {})) {
      this.addBot(id, profile);
    }
  }

  start() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.room.onChange(() => this.evaluate());
    this.evaluate();
  }

  stop() {
    this.stopped = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const entry of this.pending.values()) {
      this.unschedule(entry.timer);
    }
    this.pending.clear();
  }

  addBot(playerId: string, profile: BotProfile) {
    this.profiles.set(playerId, profile);
    if (!this.categoryPreference.has(playerId)) {
      this.categoryPreference.set(playerId, new Map());
    }
  }

  removeBot(playerId: string) {
    this.profiles.delete(playerId);
    this.categoryPreference.delete(playerId);
    for (const [key, entry] of [...this.pending.entries()]) {
      if (key.startsWith(`${playerId}:`)) {
        this.unschedule(entry.timer);
        this.pending.delete(key);
      }
    }
  }

  hasBots(): boolean {
    return this.profiles.size > 0;
  }

  /** Feeds a judged result back into the bot's category preferences. */
  noteJudgement(playerId: string, category: string, correct: boolean) {
    const preference = this.categoryPreference.get(playerId);
    if (!preference) return;
    preference.set(category, (preference.get(category) ?? 0) + (correct ? 1 : -1));
  }

  /** Re-reads the room and schedules whatever the bots should do next. */
  evaluate() {
    if (this.stopped) return;
    const state = this.room.getState();
    this.cancelStaleWork(state);
    this.maybePick(state);
    this.maybeWager(state);
    this.maybeBuzzAndAnswer(state);
    this.maybeAutoJudge(state);
  }

  /**
   * The scope a piece of scheduled work belongs to. Anything queued for a
   * clue (or a round) is dropped the moment the room moves on, so a bot
   * never buzzes into the next clue.
   */
  private static scopeOf(state: GameState): string {
    return state.activeClue ? `clue:${state.activeClue.clueId}` : `round:${state.round}`;
  }

  private cancelStaleWork(state: GameState) {
    const scope = RoomDirector.scopeOf(state);
    for (const [key, entry] of [...this.pending.entries()]) {
      if (entry.scope !== scope) {
        this.unschedule(entry.timer);
        this.pending.delete(key);
      }
    }
  }

  private defer(key: string, scope: string, delayMs: number, action: () => void) {
    if (this.pending.has(key)) return;
    const timer = this.schedule(() => {
      this.pending.delete(key);
      if (this.stopped) return;
      action();
    }, Math.max(0, delayMs));
    this.pending.set(key, { timer, scope });
  }

  private maybePick(state: GameState) {
    const pickerId = state.pickerId;
    if (!pickerId || state.activeClue) return;
    const profile = this.profiles.get(pickerId);
    if (!profile) return;
    const round = state.round;
    if (round === "lobby" || round === "complete" || round === "final-jeopardy") return;

    const available = state.clueIdsByRound[round].filter(
      (clueId) => !state.revealedClueIds.includes(clueId),
    );
    if (available.length === 0) return;

    const preference = this.categoryPreference.get(pickerId) ?? new Map<string, number>();
    const preferHighValue = profile.targetAccuracy > 0.65;
    const ranked = available
      .map((clueId) => state.cluesById[clueId])
      .map((clue) => ({
        clue,
        score:
          (preference.get(clue.category) ?? 0) +
          (preferHighValue ? clue.value / 200 : (2_000 - clue.value) / 200),
      }))
      .sort((a, b) => b.score - a.score);
    const choice = ranked[Math.floor(this.rng.next() * Math.min(3, ranked.length))].clue;
    const introDelay = Math.max(0, (state.roundIntroEndsAt ?? 0) - Date.now());

    this.defer(
      `${pickerId}:pick`,
      RoomDirector.scopeOf(state),
      introDelay + 700 + Math.floor(this.rng.next() * 1_200),
      () => {
        this.room.dispatch(pickerId, { type: "pick-clue", clueId: choice.id });
      },
    );
  }

  private maybeWager(state: GameState) {
    const active = state.activeClue;
    if (!active || active.waitingForWager.length === 0) return;

    for (const playerId of active.waitingForWager) {
      const profile = this.profiles.get(playerId);
      if (!profile) continue;
      const clue = state.cluesById[active.clueId];
      const amount = decideBotWager({
        profile,
        clue,
        currentScore: state.scores[playerId] ?? 0,
        leaderScore: Math.max(...Object.values(state.scores), 1),
        round: clue.round,
        rng: this.rng,
      });
      this.defer(
        `${playerId}:wager`,
        `clue:${active.clueId}`,
        600 + Math.floor(this.rng.next() * 900),
        () => {
          this.room.dispatch(playerId, { type: "submit-wager", amount });
        },
      );
    }
  }

  private maybeBuzzAndAnswer(state: GameState) {
    const active = state.activeClue;
    if (!active?.clueRevealed || active.answerRevealed) return;
    if (active.waitingForWager.length > 0) return;
    const clue = state.cluesById[active.clueId];
    const now = Date.now();

    if (active.round === "final-jeopardy") {
      for (const [botId, profile] of this.profiles.entries()) {
        if (active.submitted[botId]) continue;
        const decision = decideBotAnswer(profile, clue, this.rng);
        this.defer(
          `${botId}:final`,
          `clue:${active.clueId}`,
          2_000 + Math.floor(this.rng.next() * 6_000),
          () => {
            this.room.dispatch(botId, { type: "submit-answer", answer: decision.answer });
          },
        );
      }
      return;
    }

    const buzzedIds = Object.keys(active.buzzes);
    for (const [botId, profile] of this.profiles.entries()) {
      if (active.buzzes[botId] !== undefined) {
        // Already at the podium — make sure an answer is on its way.
        if (!active.submitted[botId]) {
          const decision = decideBotAnswer(profile, clue, this.rng);
          this.defer(
            `${botId}:answer`,
            `clue:${active.clueId}`,
            800 + Math.floor(this.rng.next() * 2_400),
            () => {
              this.room.dispatch(botId, {
                type: "submit-answer",
                answer: decision.answer,
              });
            },
          );
        }
        continue;
      }
      if (buzzedIds.length > 0) continue;
      if (active.judges[botId] !== undefined) continue;
      if (state.players[botId]?.spectator) continue;

      const decision = decideBotBuzz(profile, clue, this.rng);
      if (!decision.shouldBuzz) continue;
      const readoutRemaining = Math.max(0, (active.readoutEndsAt ?? now) - now);
      this.defer(
        `${botId}:buzz`,
        `clue:${active.clueId}`,
        readoutRemaining + Math.max(0, decision.buzzDelayMs),
        () => {
          this.room.dispatch(botId, { type: "buzz" });
        },
      );
    }
  }

  private maybeAutoJudge(state: GameState) {
    if (!state.settings.aiJudgeEnabled) return;
    const active = state.activeClue;
    if (!active?.answerRevealed) return;
    const target = active.currentJudgePlayerId;
    if (!target || active.judges[target] !== undefined) return;

    this.defer(`judge:${target}`, `clue:${active.clueId}`, 900, () => {
      const clue = this.room.getState().cluesById[active.clueId];
      const verdict = this.room.runAiJudge(target);
      if (verdict && clue) {
        this.noteJudgement(target, clue.category, verdict.correct);
      }
    });
  }
}
