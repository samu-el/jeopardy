import type { Meta, StoryObj } from "@storybook/react";
import { RoomToolbar } from "./RoomToolbar";

const meta: Meta<typeof RoomToolbar> = {
  title: "Game/RoomToolbar",
  component: RoomToolbar,
  parameters: { layout: "padded" },
  args: {
    onOpenPicker: () => {},
    onOpenBrowser: () => {},
    onToggleShortcuts: () => {},
    onToggleTranscript: () => {},
    onOpenReplay: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof RoomToolbar>;

export const Default: Story = {};
