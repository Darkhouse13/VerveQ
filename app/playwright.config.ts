/**
 * Playwright — THE WEEKEND mobile smoke (FW-LAUNCH O5, H1).
 *
 * Not part of `npm run check`: it boots the real app against the DEV Convex
 * deployment and drives real flows on a phone viewport, so it runs on
 * demand (`npx playwright test`), serially, from a clean DEV state, and the
 * spec purges what it creates.
 */
import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets a second checkout (a worktree) run its own dev server instead
// of `reuseExistingServer` silently testing whichever one holds 5173.
const PORT = Number(process.env.E2E_PORT ?? 5173);

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 5"], // chromium-based mobile profile (WebKit not installed)
    baseURL: `http://localhost:${PORT}`,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
