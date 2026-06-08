import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ANONYMOUS_ONBOARDING_IP_PERMIT_PARAM =
  "anonymousOnboardingIpPermit";

export const ANONYMOUS_ONBOARDING_IP_RATE_LIMITS = {
  perIpTenMinutes: { max: 50, windowMs: 10 * MINUTE_MS },
  perIpDay: { max: 150, windowMs: DAY_MS },
  permitTtlMs: 5 * MINUTE_MS,
} as const;

export function createAnonymousOnboardingIpPermitToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `aip_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getAnonymousOnboardingIpPermitParam(
  params: Record<string, unknown>,
): string | null {
  const value = params[ANONYMOUS_ONBOARDING_IP_PERMIT_PARAM];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function deriveAnonymousOnboardingIpKey(headers: Headers): string | null {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-real-ip"),
    parseForwardedHeader(headers.get("forwarded")),
    parseXForwardedFor(headers.get("x-forwarded-for")),
  ];
  const ip = candidates
    .map((candidate) => normalizeClientIp(candidate))
    .find((candidate): candidate is string => candidate !== null);
  return ip ? `ip:${ip}` : null;
}

function parseXForwardedFor(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() ?? null;
}

function parseForwardedHeader(value: string | null): string | null {
  if (!value) return null;
  const firstEntry = value.split(",")[0];
  const match = firstEntry?.match(/(?:^|;)\s*for=("[^"]+"|[^;]+)/i);
  return match?.[1]?.trim() ?? null;
}

function normalizeClientIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim().toLowerCase();
  if (!candidate || candidate === "unknown") return null;
  if (candidate.startsWith("\"") && candidate.endsWith("\"")) {
    candidate = candidate.slice(1, -1);
  }
  if (candidate.startsWith("[")) {
    const closeBracket = candidate.indexOf("]");
    if (closeBracket > 1) {
      candidate = candidate.slice(1, closeBracket);
    }
  }
  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) {
    candidate = ipv4WithPort[1];
  }
  if (isValidIpv4(candidate) || isPlausibleIpv6(candidate)) {
    return candidate;
  }
  return null;
}

function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const octet = Number(part);
    return octet >= 0 && octet <= 255;
  });
}

function isPlausibleIpv6(value: string): boolean {
  return (
    value.includes(":") &&
    /^[0-9a-f:.]+$/.test(value) &&
    value.split(":").length >= 3
  );
}

async function countRecentIpPermitAttempts(
  ctx: Pick<MutationCtx, "db">,
  ipKey: string,
  since: number,
) {
  const permits = await ctx.db
    .query("anonymousOnboardingIpPermits")
    .withIndex("by_ip_time", (q) => q.eq("ipKey", ipKey).gte("issuedAt", since))
    .collect();
  return permits.length;
}

export async function assertAnonymousOnboardingIpRateLimits(
  ctx: Pick<MutationCtx, "db">,
  args: { ipKey: string; now: number },
) {
  const tenMinuteCount = await countRecentIpPermitAttempts(
    ctx,
    args.ipKey,
    args.now - ANONYMOUS_ONBOARDING_IP_RATE_LIMITS.perIpTenMinutes.windowMs,
  );
  if (tenMinuteCount >= ANONYMOUS_ONBOARDING_IP_RATE_LIMITS.perIpTenMinutes.max) {
    throw new Error("Too many anonymous onboarding attempts from this network. Try again later.");
  }

  const dayCount = await countRecentIpPermitAttempts(
    ctx,
    args.ipKey,
    args.now - ANONYMOUS_ONBOARDING_IP_RATE_LIMITS.perIpDay.windowMs,
  );
  if (dayCount >= ANONYMOUS_ONBOARDING_IP_RATE_LIMITS.perIpDay.max) {
    throw new Error("Too many anonymous onboarding attempts from this network today. Try again later.");
  }
}

export const issueAnonymousOnboardingIpPermit = internalMutation({
  args: {
    ipKey: v.string(),
    now: v.number(),
    permitToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertAnonymousOnboardingIpRateLimits(ctx, {
      ipKey: args.ipKey,
      now: args.now,
    });
    const expiresAt =
      args.now + ANONYMOUS_ONBOARDING_IP_RATE_LIMITS.permitTtlMs;
    const permitId = await ctx.db.insert("anonymousOnboardingIpPermits", {
      ipKey: args.ipKey,
      permitToken: args.permitToken,
      issuedAt: args.now,
      expiresAt,
    });
    return {
      permitId,
      permitToken: args.permitToken,
      expiresAt,
    };
  },
});

export const consumeAnonymousOnboardingIpPermit = internalMutation({
  args: {
    permitToken: v.string(),
  },
  handler: async (ctx, args) => {
    const token = args.permitToken.trim();
    if (!token) {
      throw new Error("Anonymous onboarding IP check is required.");
    }
    const permit = await ctx.db
      .query("anonymousOnboardingIpPermits")
      .withIndex("by_permit_token", (q) => q.eq("permitToken", token))
      .unique();
    if (!permit) {
      throw new Error("Anonymous onboarding IP check is required.");
    }
    const now = Date.now();
    if (permit.expiresAt < now || permit.consumedAt !== undefined) {
      throw new Error("Anonymous onboarding IP check is required.");
    }
    await ctx.db.patch(permit._id, { consumedAt: now });
    return {
      permitId: permit._id,
      issuedAt: permit.issuedAt,
    };
  },
});
