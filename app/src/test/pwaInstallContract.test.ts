/**
 * PWA-1 contract tests.
 *
 * Two invariants worth pinning:
 *  - the install affordance never nags (dismissal is permanent, and storage
 *    failure fails closed rather than open);
 *  - the generated service worker never takes ownership of Convex, PostHog or
 *    the /s/d/ share route. That one is asserted against dist/sw.js itself
 *    rather than the vite config, because the config landing correctly is the
 *    thing that can silently regress.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  armInstallPromptCapture,
  getDeferredInstallPrompt,
  hasDismissedInstall,
  isIosSafari,
  isStandalone,
  markInstallDismissed,
  subscribeInstallPrompt,
  takeDeferredInstallPrompt,
} from "@/lib/installPrompt";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = `${IPHONE_SAFARI.replace("Safari/604.1", "CriOS/126.0 Mobile/15E148 Safari/604.1")}`;
const IPHONE_INSTAGRAM = `${IPHONE_SAFARI} Instagram 300.0.0.0.0`;
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

const nav = (userAgent: string, maxTouchPoints = 5) =>
  ({ userAgent, maxTouchPoints }) as Navigator;

describe("install affordance gating", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("offers the iOS hint only in real iOS Safari", () => {
    expect(isIosSafari(nav(IPHONE_SAFARI))).toBe(true);
    // Chrome on iOS has no Add to Home Screen entry in its share sheet.
    expect(isIosSafari(nav(IPHONE_CHROME))).toBe(false);
    // Neither do in-app webviews.
    expect(isIosSafari(nav(IPHONE_INSTAGRAM))).toBe(false);
    expect(isIosSafari(nav(ANDROID_CHROME))).toBe(false);
    // iPadOS 13+ claims to be a Mac; touch points are the only tell.
    expect(isIosSafari(nav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5))).toBe(true);
    expect(isIosSafari(nav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0))).toBe(false);
  });

  it("treats an installed app as standalone via either signal", () => {
    const matchMedia = (matches: boolean) =>
      ({ matchMedia: () => ({ matches }) }) as unknown as Window;
    expect(isStandalone({} as Navigator, matchMedia(true))).toBe(true);
    expect(isStandalone({ standalone: true } as unknown as Navigator, matchMedia(false))).toBe(true);
    expect(isStandalone({} as Navigator, matchMedia(false))).toBe(false);
  });

  it("never re-asks once dismissed", () => {
    expect(hasDismissedInstall()).toBe(false);
    markInstallDismissed();
    expect(hasDismissedInstall()).toBe(true);
  });

  it("fails closed when storage is unavailable", () => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("private mode");
    };
    try {
      // Better to never show the prompt than to show it on every load.
      expect(hasDismissedInstall()).toBe(true);
    } finally {
      Storage.prototype.getItem = getItem;
    }
  });
});

describe("install bar placement", () => {
  const src = (rel: string) =>
    readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", rel), "utf8");

  it("is never a global overlay that can cover a game's bottom-docked buttons", () => {
    // Regression pin: it was a `fixed bottom-0 z-50` bar mounted in App, and on
    // iPhone Safari it sat on top of every play screen's answer buttons.
    expect(src("App.tsx")).not.toMatch(/<InstallPrompt\b/);
    const bar = src("components/InstallPrompt.tsx");
    expect(bar).not.toMatch(/className="[^"]*\bfixed\b/);
  });

  it("renders in flow in the shell column, only where the nav is shown", () => {
    const layout = src("components/shell/ShellLayout.tsx");
    expect(layout).toContain("{!hideNav && <InstallPrompt />}");
    // Play screens use PlayStage, which is not a ShellLayout.
    expect(src("components/shell/play/PlayStage.tsx")).not.toContain("InstallPrompt");
  });

  it("captures Chromium's one-shot event app-wide and hands it out once", () => {
    localStorage.clear();
    armInstallPromptCapture(window);
    let notified = 0;
    const unsubscribe = subscribeInstallPrompt(() => notified++);

    const event = new Event("beforeinstallprompt", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(getDeferredInstallPrompt()).toBe(event);
    expect(takeDeferredInstallPrompt()).toBe(event);
    expect(getDeferredInstallPrompt()).toBeNull();

    window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true }));
    window.dispatchEvent(new Event("appinstalled"));
    expect(getDeferredInstallPrompt()).toBeNull();
    expect(hasDismissedInstall()).toBe(true);
    expect(notified).toBeGreaterThanOrEqual(3);
    unsubscribe();
  });
});

describe("service worker exclusions", () => {
  const swPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../dist/sw.js",
  );

  // dist/ is a build artifact; a bare `vitest` run without a preceding build
  // shouldn't fail, but CI's `npm run check` builds before this matters.
  const maybe = existsSync(swPath) ? it : it.skip;

  maybe("routes Convex and PostHog to the network on both GET and POST", () => {
    const sw = readFileSync(swPath, "utf8");
    const routes = [...sw.matchAll(/registerRoute\((\/.+?\/),new \w+\.(\w+)[^"]*"(\w+)"\)/g)].map(
      ([, pattern, handler, method]) => ({ pattern, handler, method }),
    );

    for (const host of ["convex", "posthog"]) {
      for (const method of ["GET", "POST"]) {
        const match = routes.find((r) => r.pattern.includes(host) && r.method === method);
        expect(match, `${host} ${method} route missing from dist/sw.js`).toBeDefined();
        expect(match?.handler).toBe("NetworkOnly");
      }
    }
  });

  maybe("never serves the app shell in place of the /s/d/ share route", () => {
    const sw = readFileSync(swPath, "utf8");
    const denylist = sw.match(/denylist:\[(.+?)\]/)?.[1] ?? "";
    expect(denylist).toContain("\\/s\\/d\\/");
    // And it is a NetworkOnly route too, so subresource fetches pass through.
    expect(sw).toContain("registerRoute(/^\\/s\\/d\\//,new");
  });
});
