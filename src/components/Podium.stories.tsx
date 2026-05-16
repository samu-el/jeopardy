import type { Meta, StoryObj } from "@storybook/react";
import type { PublicGameState, PublicPlayerState } from "@/lib/game";
import { Podium } from "./Podium";

const player: PublicPlayerState = {
  id: "p1",
  displayName: "Ada",
  kind: "human",
  connected: true,
  spectator: false,
  score: 800,
};

const baseState: PublicGameState = {
  roomId: "room-story",
  round: "jeopardy",
  serverTime: 0,
  players: [player],
  board: [],
  pickerId: "p1",
  settings: {
    allowMultipleCorrect: false,
    hostId: "p1",
    aiJudgeEnabled: false,
    aiBotsEnabled: false,
    aiAvatarHostEnabled: false,
  },
  stats: {
    questionsStarted: 0,
    answeredByPlayer: {},
    correctByPlayer: {},
    incorrectByPlayer: {},
    firstBuzzByPlayer: {},
    reactionTimesByPlayer: {},
    dailyDoublesByPlayer: {},
  },
};

const meta: Meta<typeof Podium> = {
  title: "Game/Podium",
  component: Podium,
};

export default meta;

type Story = StoryObj<typeof Podium>;

export const Idle: Story = {
  args: { player, state: baseState, isYou: true, emoji: "🦊", color: "#5b8cff" },
};

export const Picker: Story = {
  args: { player, state: baseState, isYou: true, emoji: "🎯" },
};

export const Buzzed: Story = {
  args: {
    player,
    state: {
      ...baseState,
      currentClue: {
        clueId: "c1",
        round: "jeopardy",
        category: "Science",
        value: 200,
        clue: "Red planet.",
        dailyDouble: false,
        waitingForWager: [],
        canBuzz: false,
        buzzes: { p1: 1 },
        answers: {},
        wagers: {},
        judges: {},
        canAdvance: false,
      },
    },
    isYou: true,
  },
};

export const JudgedCorrect: Story = {
  args: {
    player: { ...player, score: 1000 },
    state: {
      ...baseState,
      currentClue: {
        clueId: "c1",
        round: "jeopardy",
        category: "Science",
        value: 200,
        clue: "Red planet.",
        correctResponse: "Mars",
        dailyDouble: false,
        waitingForWager: [],
        canBuzz: false,
        buzzes: { p1: 1 },
        answers: { p1: "Mars" },
        wagers: {},
        judges: { p1: true },
        canAdvance: true,
      },
    },
    isYou: true,
    emoji: "🌟",
    color: "#33d684",
  },
};
