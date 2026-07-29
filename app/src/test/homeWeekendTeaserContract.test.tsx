/**
 * THE WEEKEND home teaser contract (Ticket FW-P1).
 *
 * Locks the card's fail-closed gate and its two identity paths:
 *  - backend absent / query rejects / auth still loading ⇒ the card does not
 *    exist and Home renders exactly as before;
 *  - signed-in: one-tap COUNT ME IN, server-persisted membership shows the
 *    confirmed state on load;
 *  - anonymous: email form + the one-email consent promise, client-side
 *    reject before any mutation, session-visual confirmation;
 *  - the count line exists only at >= 50;
 *  - PostHog events (teaser_viewed / waitlist_join_clicked / waitlist_joined)
 *    with utm_source-derived source, and never any email in properties.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const authMock = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));
const convexMock = vi.hoisted(() => ({
  client: {
    query: vi.fn<(ref: unknown, args: unknown) => Promise<unknown>>(),
    mutation: vi.fn<(ref: unknown, args: unknown) => Promise<unknown>>(),
  },
}));
const trackMock = vi.hoisted(() => ({
  calls: [] as Array<[string, Record<string, unknown> | undefined]>,
}));
const coldSourceMock = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMock.value,
}));
vi.mock("convex/react", () => ({
  useConvex: () => convexMock.client,
}));
vi.mock("@/lib/analytics", () => ({
  track: (event: string, properties?: Record<string, unknown>) => {
    trackMock.calls.push([event, properties]);
  },
}));
vi.mock("@/lib/coldSession", () => ({
  readColdSource: () => coldSourceMock.value,
}));

import { HomeWeekendTeaser } from "@/components/weekend/HomeWeekendTeaser";

function signedIn() {
  authMock.value = { hasUsername: true, accountState: "usernameOnly" };
}
function anonymous() {
  authMock.value = { hasUsername: false, accountState: "loggedOut" };
}

async function renderTeaser() {
  const utils = render(<HomeWeekendTeaser />);
  // Let the imperative status read settle either way.
  await act(async () => {});
  return utils;
}

beforeEach(() => {
  convexMock.client.query.mockReset();
  convexMock.client.mutation.mockReset();
  convexMock.client.query.mockResolvedValue({ member: false, count: 0 });
  convexMock.client.mutation.mockResolvedValue({ ok: true, joined: true });
  trackMock.calls.length = 0;
  coldSourceMock.value = undefined;
  anonymous();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fail-closed gate", () => {
  it("renders nothing while auth is settling (no status query fired)", async () => {
    authMock.value = { hasUsername: false, accountState: "loading" };
    await renderTeaser();
    expect(screen.queryByTestId("home-weekend-teaser")).toBeNull();
    expect(convexMock.client.query).not.toHaveBeenCalled();
  });

  it("renders nothing when the waitlist backend rejects, and stays silent", async () => {
    convexMock.client.query.mockRejectedValue(new Error("Could not find function"));
    await renderTeaser();
    expect(screen.queryByTestId("home-weekend-teaser")).toBeNull();
    expect(trackMock.calls).toHaveLength(0);
  });

  it("fires teaser_viewed once with the utm-derived source when it does render", async () => {
    coldSourceMock.value = "x_promo";
    await renderTeaser();
    expect(screen.getByTestId("home-weekend-teaser")).toBeTruthy();
    expect(trackMock.calls).toEqual([["teaser_viewed", { source: "x_promo" }]]);
  });
});

describe("signed-in path", () => {
  beforeEach(signedIn);

  it("one tap joins, confirms instantly, and reports method: user", async () => {
    await renderTeaser();
    fireEvent.click(screen.getByTestId("weekend-cta-user"));
    await waitFor(() =>
      expect(screen.getByTestId("weekend-confirmed")).toBeTruthy(),
    );
    expect(convexMock.client.mutation).toHaveBeenCalledTimes(1);
    expect(convexMock.client.mutation.mock.calls[0][1]).toEqual({
      source: "home_teaser",
    });
    expect(trackMock.calls).toContainEqual([
      "waitlist_join_clicked",
      { method: "user", source: "home_teaser" },
    ]);
    expect(trackMock.calls).toContainEqual([
      "waitlist_joined",
      { method: "user", source: "home_teaser" },
    ]);
    // No email form ever exists on this path.
    expect(screen.queryByTestId("weekend-email-input")).toBeNull();
  });

  it("shows the confirmed state on revisit from server-side membership", async () => {
    convexMock.client.query.mockResolvedValue({ member: true, count: 3 });
    await renderTeaser();
    expect(screen.getByTestId("weekend-confirmed")).toBeTruthy();
    expect(screen.queryByTestId("weekend-cta-user")).toBeNull();
  });
});

describe("anonymous path", () => {
  it("shows the email form with the one-email consent promise", async () => {
    await renderTeaser();
    expect(screen.getByTestId("weekend-email-input")).toBeTruthy();
    expect(
      screen.getByText("We'll email you once, when it starts."),
    ).toBeTruthy();
  });

  it("rejects an invalid email locally — no mutation leaves the client", async () => {
    await renderTeaser();
    fireEvent.change(screen.getByTestId("weekend-email-input"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByTestId("weekend-cta-email"));
    await waitFor(() =>
      expect(screen.getByTestId("weekend-error")).toBeTruthy(),
    );
    expect(convexMock.client.mutation).not.toHaveBeenCalled();
  });

  it("joins with a valid email, confirms (session-visual), reports method: email — and never puts the email in analytics", async () => {
    await renderTeaser();
    fireEvent.change(screen.getByTestId("weekend-email-input"), {
      target: { value: "drafter@example.com" },
    });
    fireEvent.click(screen.getByTestId("weekend-cta-email"));
    await waitFor(() =>
      expect(screen.getByTestId("weekend-confirmed")).toBeTruthy(),
    );
    expect(convexMock.client.mutation).toHaveBeenCalledTimes(1);
    expect(convexMock.client.mutation.mock.calls[0][1]).toEqual({
      email: "drafter@example.com",
      source: "home_teaser",
    });
    expect(trackMock.calls).toContainEqual([
      "waitlist_joined",
      { method: "email", source: "home_teaser" },
    ]);
    for (const [, properties] of trackMock.calls) {
      expect(JSON.stringify(properties ?? {})).not.toContain("drafter@example.com");
    }
  });

  it("surfaces the server's invalid_email verdict inline", async () => {
    convexMock.client.mutation.mockResolvedValue({
      ok: false,
      code: "invalid_email",
    });
    await renderTeaser();
    fireEvent.change(screen.getByTestId("weekend-email-input"), {
      target: { value: "passes.client@example.com" },
    });
    fireEvent.click(screen.getByTestId("weekend-cta-email"));
    await waitFor(() =>
      expect(screen.getByTestId("weekend-error")).toBeTruthy(),
    );
    expect(screen.queryByTestId("weekend-confirmed")).toBeNull();
  });
});

describe("count line", () => {
  it("does not exist below 50", async () => {
    convexMock.client.query.mockResolvedValue({ member: false, count: 49 });
    await renderTeaser();
    expect(screen.queryByTestId("weekend-count")).toBeNull();
  });

  it("renders at >= 50", async () => {
    convexMock.client.query.mockResolvedValue({ member: false, count: 50 });
    await renderTeaser();
    expect(screen.getByTestId("weekend-count").textContent).toBe(
      "50 drafters already in",
    );
  });
});
