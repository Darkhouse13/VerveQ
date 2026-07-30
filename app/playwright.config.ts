/**
 * Playwright — THE WEEKEND mobile smoke (FW-LAUNCH O5, H1).
 *
 * Not part of `npm run check`: it boots the real app against the DEV Convex
 * deployment and drives real flows on a phone viewport, so it runs on
 * demand (`npx playwright test`), serially, from a clean DEV state, and the
 * spec purges what it creates.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 5"], // chromium-based mobile profile (WebKit not installed)
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx vite --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
    env: { VITE_V2_SHELL_ENABLED: "true" },
  },
});
