import type { Preview } from "@storybook/react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { appTheme } from "../src/lib/foundation/theme";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "black",
      values: [{ name: "black", value: "#000" }],
    },
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <div style={{ background: "#000", minHeight: "100vh", padding: 24 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default preview;
