import type { Meta, StoryObj } from "@storybook/react";
import type { PublicGameState } from "@/lib/game";
import { Board } from "./Board";

const categories = ["Science", "Geography", "History", "Pop", "Math", "Misc"];
const values = [200, 400, 600, 800, 1000];

function buildBoardState(revealed: string[] = []): PublicGameState {
  const board = categories.flatMap((category, ci) =>
    values.map((value, vi) => {
      const id = `c-${ci}-${vi}`;
      return {
        id,
        category,
        value,
        revealed: revealed.includes(id),
      };
    }),
  );
  return {
    roomId: "story-board",
    round: "jeopardy",
    serverTime: 0,
    players: [],
    board,
    settings: {
      allowMultipleCorrect: false,
      hostId: "host",
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
}

const meta: Meta<typeof Board> = {
  title: "Game/Board",
  component: Board,
};

export default meta;

type Story = StoryObj<typeof Board>;

export const Empty: Story = {
  args: { state: null, canPick: false },
};

export const FreshDeal: Story = {
  args: { state: buildBoardState(), canPick: true },
};

export const MidRound: Story = {
  args: {
    state: buildBoardState(["c-0-0", "c-2-1", "c-4-3"]),
    canPick: true,
  },
};
