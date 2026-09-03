import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // The multiplayer specs share one server-side room registry, so give the
  // suite a single worker rather than racing rooms across processes.
  workers: 1,
  // Round intros, clue readouts and buzz windows are real seconds of game
  // pacing, so a full flow needs more than Playwright's 30s default.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    // Sandboxes and CI images ship the browser at different paths; honour an
    // explicit override when one is provided.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
