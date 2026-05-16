// Storybook deps are not in package.json to keep production installs lean.
// Install locally with: bun add -D @storybook/nextjs @storybook/react storybook
import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
  docs: {
    autodocs: false,
  },
};

export default config;
