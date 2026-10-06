import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false,
  workers: process.env.CI ? 2 : undefined,
  outputDir: "test-results",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5175",
    channel:
      process.env.CI || process.env.WORLD_DECK_BROWSER === "chromium"
        ? undefined
        : "msedge",
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: !process.env.CI,
  },
});
