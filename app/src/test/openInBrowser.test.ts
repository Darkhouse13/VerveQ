import { beforeEach, describe, expect, it } from "vitest";
import {
  cacheToken,
  cameThroughHandoff,
  handoffHref,
  handoffPlatform,
  handoffTargetUrl,
  noteHandoffArrival,
  readCachedToken,
} from "@/lib/openInBrowser";

const IG_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 Instagram 352.0.0.0 Android";
const IG_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 352.0.0 (iPhone15,3; iOS 26_0)";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

describe("openInBrowser", () => {
  beforeEach(() => localStorage.clear());

  it("only offers the hand-off inside Instagram, per OS", () => {
    expect(handoffPlatform(IG_ANDROID)).toBe("android");
    expect(handoffPlatform(IG_IOS)).toBe("ios");
    expect(handoffPlatform(SAFARI)).toBeNull();
  });

  it("builds the target with the streak token and the ref", () => {
    const url = handoffTargetUrl("https://verveq.com", "letters", "abc");
    expect(url).toBe("https://verveq.com/letters?st=abc&ref=open_in_browser");
    expect(handoffTargetUrl("https://verveq.com", "older", null)).toBe("https://verveq.com/older?ref=open_in_browser");
  });

  it("wraps the target for Safari and Chrome", () => {
    const url = "https://verveq.com/older?st=abc&ref=open_in_browser";
    expect(handoffHref(url, "ios")).toBe("x-safari-https://verveq.com/older?st=abc&ref=open_in_browser");
    const android = handoffHref(url, "android");
    expect(android.startsWith("intent://verveq.com/older?st=abc&ref=open_in_browser#Intent;scheme=https;")).toBe(true);
    expect(android).toContain("package=com.android.chrome");
    expect(android).toContain(`S.browser_fallback_url=${encodeURIComponent(url)}`);
    expect(android.endsWith(";end")).toBe(true);
  });

  it("reuses a minted token for six days, then mints again", () => {
    const t0 = 1_800_000_000_000;
    cacheToken("older", "tok", t0);
    expect(readCachedToken("older", t0 + 5 * 86_400_000)).toBe("tok");
    expect(readCachedToken("older", t0 + 7 * 86_400_000)).toBeNull();
    expect(readCachedToken("letters", t0)).toBeNull();
  });

  it("remembers an arrival through the hand-off link", () => {
    expect(cameThroughHandoff()).toBe(false);
    expect(noteHandoffArrival("?ref=letters")).toBe(false);
    expect(cameThroughHandoff()).toBe(false);
    expect(noteHandoffArrival("?st=x&ref=open_in_browser")).toBe(true);
    expect(cameThroughHandoff()).toBe(true);
  });
});
