import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

import {
  capturePageview,
  initAnalytics,
  scrubPath,
  scrubSearch,
  track,
} from "../lib/analytics";

const read = (path: string) => readFileSync(path, "utf8");

describe("analytics privacy scrubbing", () => {
  it("replaces share/join codes in code-bearing paths", () => {
    expect(scrubPath("/duel/DQTESTLINK01")).toBe("/duel/:code");
    expect(scrubPath("/duel/play/abc123")).toBe("/duel/play/:id");
    expect(scrubPath("/duel/result/abc123")).toBe("/duel/result/:id");
    expect(scrubPath("/arena/X7K2P9")).toBe("/arena/:code");
    expect(scrubPath("/v2/arena/X7K2P9")).toBe("/v2/arena/:code");
    expect(scrubPath("/s/d/DQTESTLINK01")).toBe("/s/d/:code");
    expect(scrubPath("/rivals/j5762abcdef")).toBe("/rivals/:id");
  });

  it("passes ordinary mode routes through untouched (the path IS the metric)", () => {
    for (const path of [
      "/",
      "/v2/daily",
      "/v2/survival",
      "/v2/career-path",
      "/v2/higher-lower",
      "/games/daily-football-quiz/",
    ]) {
      expect(scrubPath(path)).toBe(path);
    }
  });

  it("keeps only attribution query params", () => {
    expect(scrubSearch("?ref=daily_share")).toBe("?ref=daily_share");
    expect(scrubSearch("?utm_source=x&utm_campaign=wc")).toBe(
      "?utm_source=x&utm_campaign=wc",
    );
    expect(scrubSearch("?next=%2Fduel%2FDQTESTLINK01")).toBe("");
    expect(scrubSearch("?sport=football&ref=seo_daily")).toBe(
      "?ref=seo_daily",
    );
    expect(scrubSearch("")).toBe("");
  });
});

describe("analytics fail-closed init", () => {
  it("does not init outside production builds (vitest is non-PROD)", () => {
    initAnalytics();
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("capture and track are no-ops while uninitialized", () => {
    capturePageview("/v2/daily", "");
    track("game_completed", { mode: "daily" });
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });
});

describe("analytics wiring (source contract)", () => {
  it("main.tsx initializes analytics before first render", () => {
    const source = read("src/main.tsx");
    expect(source).toContain('import { initAnalytics } from "./lib/analytics"');
    expect(source).toContain("initAnalytics();");
  });

  it("App mounts AnalyticsPageviews inside the router", () => {
    const source = read("src/App.tsx");
    expect(source).toContain("<AnalyticsPageviews />");
    expect(source.indexOf("<AnalyticsPageviews />")).toBeGreaterThan(
      source.indexOf("<BrowserRouter"),
    );
  });

  it("init is gated on PROD + key, with recording/autocapture off", () => {
    const source = read("src/lib/analytics.ts");
    expect(source).toContain("if (!import.meta.env.PROD || !key) return");
    expect(source).toContain("autocapture: false");
    expect(source).toContain("disable_session_recording: true");
    expect(source).toContain("capture_pageview: false");
  });

  it("deploy forwards the optional PostHog env vars", () => {
    const source = read("../deploy/build-and-run.sh");
    expect(source).toContain("VITE_POSTHOG_KEY");
    expect(source).toContain("VITE_POSTHOG_HOST");
  });

  it("the privacy policy discloses PostHog usage analytics", () => {
    const source = read("src/pages/legal/PrivacyScreen.tsx");
    expect(source).toContain("PostHog");
    expect(source).toContain("Usage analytics");
  });
});
