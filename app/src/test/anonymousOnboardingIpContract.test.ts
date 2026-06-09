import { describe, expect, it, vi, type Mock } from "vitest";
import * as ipLimiter from "../../convex/anonymousOnboardingIp";
import { handleAnonymousOnboardingIpPermitRequest } from "../../convex/http";
import type { AnonymousOnboardingIpPermitActionCtx } from "../../convex/http";

function handlerOf<T>(mutation: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const fn = mutation as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof fn._handler !== "function") {
    throw new Error("not a Convex mutation with an accessible handler");
  }
  return fn._handler;
}

function makeIpPermitCtx(options?: {
  permits?: Array<Record<string, unknown>>;
  insert?: Mock;
  patch?: Mock;
}) {
  const permits = [...(options?.permits ?? [])];
  const insert = options?.insert ?? vi.fn(async (_table: string, row: Record<string, unknown>) => {
    const id = `permit_${permits.length + 1}`;
    permits.push({ _id: id, ...row });
    return id;
  });
  const patch = options?.patch ?? vi.fn(async (id: string, updates: Record<string, unknown>) => {
    const permit = permits.find((row) => row._id === id);
    if (permit) Object.assign(permit, updates);
  });

  return {
    db: {
      insert,
      patch,
      query: (table: string) => {
        if (table !== "anonymousOnboardingIpPermits") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          withIndex: (
            _indexName: string,
            builder: (q: {
              eq: (field: string, value: unknown) => unknown;
              gte: (field: string, value: unknown) => unknown;
            }) => unknown,
          ) => {
            const eqFilters: Record<string, unknown> = {};
            const gteFilters: Record<string, unknown> = {};
            const q = {
              eq: (field: string, value: unknown) => {
                eqFilters[field] = value;
                return q;
              },
              gte: (field: string, value: unknown) => {
                gteFilters[field] = value;
                return q;
              },
            };
            builder(q);
            const filtered = permits.filter((row) => {
              const eqOk = Object.entries(eqFilters).every(
                ([field, value]) => row[field] === value,
              );
              const gteOk = Object.entries(gteFilters).every(
                ([field, value]) =>
                  typeof row[field] === "number" &&
                  typeof value === "number" &&
                  row[field] >= value,
              );
              return eqOk && gteOk;
            });
            return {
              collect: async () => filtered,
              unique: async () => {
                if (filtered.length > 1) throw new Error("not unique");
                return filtered[0] ?? null;
              },
            };
          },
        };
      },
    },
    permits,
    insert,
    patch,
  };
}

describe("anonymous onboarding IP permits", () => {
  it("derives an IP key from trusted request metadata and fails closed when missing", async () => {
    await expect(
      ipLimiter.deriveAnonymousOnboardingIpKeyFromMetadata({
        meta: {
          getRequestMetadata: async () => ({ ip: "203.0.113.10" }),
        },
      }),
    ).resolves.toBe(
      "ip:203.0.113.10",
    );
    await expect(
      ipLimiter.deriveAnonymousOnboardingIpKeyFromMetadata({
        meta: {
          getRequestMetadata: async () => ({ ip: null }),
        },
      }),
    ).resolves.toBeNull();
  });

  it("ignores spoofed forwarding headers and keeps using the trusted metadata IP bucket", async () => {
    const runMutation = vi.fn(
      async (_mutation: unknown, _args: Record<string, unknown>) => ({
        permitToken: "permit_token",
        expiresAt: Date.now() + 60_000,
      }),
    );
    const ctx = {
      meta: {
        getRequestMetadata: async () => ({ ip: "198.51.100.42" }),
      },
      runMutation,
    } as unknown as AnonymousOnboardingIpPermitActionCtx;

    await handleAnonymousOnboardingIpPermitRequest(
      ctx,
      new Request("https://example.test/anonymous-onboarding/ip-permit", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.1" },
      }),
    );
    await handleAnonymousOnboardingIpPermitRequest(
      ctx,
      new Request("https://example.test/anonymous-onboarding/ip-permit", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.2" },
      }),
    );

    expect(runMutation).toHaveBeenCalledTimes(2);
    expect(runMutation.mock.calls[0][1]).toEqual(
      expect.objectContaining({ ipKey: "ip:198.51.100.42" }),
    );
    expect(runMutation.mock.calls[1][1]).toEqual(
      expect.objectContaining({ ipKey: "ip:198.51.100.42" }),
    );
  });

  it("enforces the per-IP ten-minute limit before issuing a permit", async () => {
    const now = Date.now();
    const ctx = makeIpPermitCtx({
      permits: Array.from(
        { length: ipLimiter.ANONYMOUS_ONBOARDING_IP_RATE_LIMITS.perIpTenMinutes.max },
        (_, index) => ({
          _id: `permit_${index}`,
          ipKey: "ip:203.0.113.10",
          permitToken: `token_${index}`,
          issuedAt: now - 60_000,
          expiresAt: now + 60_000,
        }),
      ),
    });

    await expect(
      handlerOf(ipLimiter.issueAnonymousOnboardingIpPermit)(ctx, {
        ipKey: "ip:203.0.113.10",
        now,
        permitToken: "next_token",
      }),
    ).rejects.toThrow(/this network/i);
    expect(ctx.insert).not.toHaveBeenCalled();
  });

  it("does not block a normal friend-group invite burst from one network", async () => {
    const now = Date.now();
    const ctx = makeIpPermitCtx();

    for (let index = 0; index < 25; index += 1) {
      await handlerOf(ipLimiter.issueAnonymousOnboardingIpPermit)(ctx, {
        ipKey: "ip:203.0.113.20",
        now: now + index,
        permitToken: `burst_token_${index}`,
      });
    }

    expect(ctx.permits).toHaveLength(25);
  });

  it("consumes permits once and rejects reuse", async () => {
    const now = Date.now();
    const ctx = makeIpPermitCtx({
      permits: [
        {
          _id: "permit_1",
          ipKey: "ip:203.0.113.10",
          permitToken: "valid_token",
          issuedAt: now - 1_000,
          expiresAt: now + 60_000,
        },
      ],
    });

    const result = await handlerOf(ipLimiter.consumeAnonymousOnboardingIpPermit)(
      ctx,
      { permitToken: "valid_token" },
    );

    expect(result).toMatchObject({ permitId: "permit_1" });
    expect(ctx.patch).toHaveBeenCalledWith(
      "permit_1",
      expect.objectContaining({ consumedAt: expect.any(Number) }),
    );
    await expect(
      handlerOf(ipLimiter.consumeAnonymousOnboardingIpPermit)(ctx, {
        permitToken: "valid_token",
      }),
    ).rejects.toThrow(/ip check/i);
  });
});
