/**
 * Error-monitoring contract (Sentry — errors only, privacy-safe):
 *
 *  - the root ErrorBoundary renders the on-brand Neo fallback (never a white
 *    screen) when a child throws, and forwards the error to Sentry;
 *  - the PII scrub fails closed: user/request/server_name envelopes are
 *    dropped (no IP, no page URLs / duel link codes), console breadcrumbs are
 *    dropped, fetch/xhr/navigation breadcrumbs are reduced to query-stripped
 *    allowlists;
 *  - initSentry is a no-op outside production builds (vitest runs with
 *    PROD=false, so init must not fire here);
 *  - deploy/nginx.conf hard-404s .map probes so hidden source maps can never
 *    be fetched even if one leaked into the webroot.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initSentry, scrubEvent, scrubBreadcrumb } from "@/lib/sentry";
import type { ErrorEvent } from "@sentry/react";

// The path must flow through a parameter (same shape as
// publicPagesContract.test.tsx): with a string literal, Vite's asset
// transform rewrites `new URL(lit, import.meta.url)` to a non-file URL.
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const nginx = read("../../../deploy/nginx.conf");

afterEach(() => {
  vi.clearAllMocks();
});

function Bomb(): never {
  throw new Error("boom: forced render error");
}

describe("root error boundary", () => {
  it("renders the Neo fallback with a reload action instead of a white screen", () => {
    // React logs the rethrown error even when a boundary catches it — keep
    // the test output clean without asserting on console internals.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went off-script")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
    consoleError.mockRestore();
  });

  it("forwards the caught error to Sentry", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const [error] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect((error as Error).message).toBe("boom: forced render error");
    consoleError.mockRestore();
  });
});

describe("initSentry guard", () => {
  it("does not init outside production builds", () => {
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});

describe("PII scrub fails closed", () => {
  it("drops user, request, and server_name envelopes", () => {
    const event = {
      user: { id: "u1", username: "hamza", ip_address: "203.0.113.7" },
      request: { url: "https://verveq.com/duel/SECRETCODE" },
      server_name: "host-1",
      exception: { values: [{ type: "Error", value: "boom" }] },
    } as unknown as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.server_name).toBeUndefined();
    expect(scrubbed.exception).toBeTruthy();
  });

  it("drops console breadcrumbs and strips queries from fetch/navigation", () => {
    expect(
      scrubBreadcrumb({ category: "console", message: "user hamza did x" }),
    ).toBeNull();

    const fetchCrumb = scrubBreadcrumb({
      category: "fetch",
      data: {
        method: "POST",
        status_code: 500,
        url: "https://api.example.com/path?token=leaky#frag",
        body: "should never survive",
      },
    });
    expect(fetchCrumb?.data).toEqual({
      method: "POST",
      status_code: 500,
      url: "https://api.example.com/path",
    });

    const navCrumb = scrubBreadcrumb({
      category: "navigation",
      data: { from: "/duel/CODE?x=1", to: "/home#y" },
    });
    expect(navCrumb?.data).toEqual({ from: "/duel/CODE", to: "/home" });

    const clickCrumb = scrubBreadcrumb({
      category: "ui.click",
      message: "button.neo-button",
      data: { arbitrary: "payload" },
    });
    expect(clickCrumb?.data).toBeUndefined();
    expect(clickCrumb?.message).toBe("button.neo-button");
  });

  it("re-scrubs the event breadcrumb list as a backstop", () => {
    const event = {
      breadcrumbs: [
        { category: "console", message: "secret" },
        { category: "navigation", data: { from: "/a?q=1", to: "/b" } },
      ],
    } as unknown as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.breadcrumbs).toHaveLength(1);
    expect(scrubbed.breadcrumbs?.[0].category).toBe("navigation");
  });
});

describe("deploy/nginx.conf blocks source-map probes", () => {
  it("hard-404s .map URLs instead of SPA-fallbacking to the app shell", () => {
    expect(nginx).toMatch(/\\\.map\$[\s\S]*?return 404/);
  });
});
