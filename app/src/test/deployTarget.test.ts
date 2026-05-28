import { describe, expect, it } from "vitest";
import {
  LIVE_CONFIRM_ENV,
  guardTarget,
  resolveConvexTarget,
} from "../../scripts/lib/deployTarget";

const NO_ENV_FILES: string[] = [];

describe("deploy target safety guard", () => {
  it("refuses the known live deployment without caller opt-in", () => {
    expect(() =>
      guardTarget({
        env: {
          CONVEX_DEPLOYMENT: "dev:admired-warthog-495",
        },
        envFilePaths: NO_ENV_FILES,
      }),
    ).toThrow(/Blocked live Convex target/);
  });

  it("requires exact live deployment confirmation when live is allowed", () => {
    expect(() =>
      guardTarget({
        allowLive: true,
        env: {
          CONVEX_DEPLOYMENT: "dev:admired-warthog-495",
          [LIVE_CONFIRM_ENV]: "true",
        },
        envFilePaths: NO_ENV_FILES,
      }),
    ).toThrow(/CONFIRM_LIVE_DEPLOY=admired-warthog-495 exactly/);

    const target = guardTarget({
      allowLive: true,
      env: {
        CONVEX_DEPLOYMENT: "dev:admired-warthog-495",
        [LIVE_CONFIRM_ENV]: "admired-warthog-495",
      },
      envFilePaths: NO_ENV_FILES,
    });

    expect(target.deploymentName).toBe("admired-warthog-495");
  });

  it("refuses empty resolution instead of guessing", () => {
    expect(() =>
      resolveConvexTarget({
        env: {},
        envFilePaths: NO_ENV_FILES,
      }),
    ).toThrow(/Could not resolve a Convex target/);
  });

  it("refuses empty explicit env values instead of falling through", () => {
    expect(() =>
      resolveConvexTarget({
        env: {
          CONVEX_URL: "",
        },
        envFilePaths: NO_ENV_FILES,
      }),
    ).toThrow(/present but empty/);
  });

  it("refuses ambiguous target signals", () => {
    expect(() =>
      resolveConvexTarget({
        env: {
          CONVEX_URL: "https://careful-otter-111.convex.cloud",
          CONVEX_DEPLOYMENT: "dev:steady-lark-222",
        },
        envFilePaths: NO_ENV_FILES,
      }),
    ).toThrow(/Ambiguous Convex target resolution/);
  });

  it("allows a non-live dev target", () => {
    const target = guardTarget({
      env: {
        CONVEX_URL: "https://careful-otter-111.convex.cloud",
        CONVEX_DEPLOYMENT: "dev:careful-otter-111",
      },
      envFilePaths: NO_ENV_FILES,
    });

    expect(target).toMatchObject({
      deploymentName: "careful-otter-111",
      convexUrl: "https://careful-otter-111.convex.cloud",
    });
  });
});
