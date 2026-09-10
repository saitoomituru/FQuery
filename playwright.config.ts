import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev:browser",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env, GEMINI_API_KEY: "" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chrome-stable",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
