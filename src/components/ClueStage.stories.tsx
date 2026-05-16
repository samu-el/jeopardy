import type { Meta, StoryObj } from "@storybook/react";
import type { PublicGameState } from "@/lib/game";
import { ClueStage } from "./ClueStage";

function makeState(
  overrides: Partial<PublicGameState["currentClue"]> | null,
): PublicGameState {
  return {
    roomId: "story-clue",
    round: overrides?.round ?? "jeopardy",
    serverTime: Date.now(),
    pickerId: "p1",
    players: [
      {
        id: "p1",
        displayName: "You",
        kind: "human",
        connected: true,
        spectator: false,
        score: 600,
      },
    ],
    board: [],
    currentClue: overrides
      ? {
          clueId: "c1",
          round: "jeopardy",
          category: "Science",
          value: 200,
          dailyDouble: false,
          waitingForWager: [],
          canBuzz: false,
          buzzes: {},
          submitted: {},
          answers: {},
          wagers: {},
          judges: {},
          canAdvance: false,
          ...overrides,
        }
      : undefined,
    settings: {
      allowMultipleCorrect: false,
      hostId: "p1",
      aiJudgeEnabled: true,
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
}

const meta: Meta<typeof ClueStage> = {
  title: "Game/ClueStage",
  component: ClueStage,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof ClueStage>;

export const Reading: Story = {
  args: {
    currentClientId: "p1",
    state: makeState({
      clue: "Red planet with the largest volcano in the solar system.",
      readoutEndsAt: Date.now() + 2_000,
      buzzWindowEndsAt: Date.now() + 8_000,
    }),
  },
};

export const Buzzing: Story = {
  args: {
    currentClientId: "p1",
    state: makeState({
      clue: "Red planet with the largest volcano in the solar system.",
      readoutEndsAt: Date.now() - 1_000,
      buzzWindowEndsAt: Date.now() + 4_000,
    }),
  },
};

export const Answering: Story = {
  args: {
    currentClientId: "p1",
    state: makeState({
      clue: "Red planet with the largest volcano in the solar system.",
      readoutEndsAt: Date.now() - 5_000,
      buzzWindowEndsAt: Date.now() - 1_000,
      answerWindowEndsAt: Date.now() + 6_000,
      buzzes: { p1: Date.now() - 1_000 },
    }),
  },
};

export const DailyDouble: Story = {
  args: {
    currentClientId: "p1",
    state: makeState({
      dailyDouble: true,
      dailyDoublePlayerId: "p1",
      waitingForWager: ["p1"],
      wagerWindowEndsAt: Date.now() + 25_000,
    }),
  },
};

export const FinalJeopardy: Story = {
  args: {
    currentClientId: "p1",
    state: makeState({
      round: "final-jeopardy",
      category: "Computing",
      value: 0,
      waitingForWager: ["p1"],
      wagerWindowEndsAt: Date.now() + 30_000,
    }),
  },
};

export const AnswerRevealed: Story = {
  args: {
    currentClientId: "p1",
    state: makeState({
      clue: "Red planet with the largest volcano.",
      correctResponse: "Mars",
      buzzes: { p1: Date.now() - 1_000 },
      answers: { p1: "Mars" },
      currentJudgePlayerId: "p1",
      canAdvance: false,
    }),
  },
};
