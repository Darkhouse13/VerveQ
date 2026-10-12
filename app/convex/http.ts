import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  createAnonymousOnboardingIpPermitToken,
  deriveAnonymousOnboardingIpKeyFromMetadata,
} from "./anonymousOnboardingIp";
import {
  APP_DUEL_URL_BASE,
  APP_HOME_URL,
  buildCrawlerHtml,
  buildShareCardTexts,
  cardVariantToken,
  CARD_IMAGE_SUFFIX,
  FALLBACK_PNG_BASE64,
  GENERIC_CARD_KEY,
  isCrawlerUserAgent,
  parseShareRoutePath,
  resolveSharePublicBase,
  SHARE_ROUTE_PREFIX,
  type ShareCardData,
} from "./lib/duelShareCard";
import { ensureShareCardCached } from "./duelShare";

const http = httpRouter();
auth.addHttpRoutes(http);

const IP_PERMIT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  Vary: "Origin",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...IP_PERMIT_CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

export type AnonymousOnboardingIpPermitActionCtx = Pick<
  ActionCtx,
  "meta" | "runMutation"
>;

export async function handleAnonymousOnboardingIpPermitRequest(
  ctx: AnonymousOnboardingIpPermitActionCtx,
  _request: Request,
) {
  const ipKey = await deriveAnonymousOnboardingIpKeyFromMetadata(ctx);
  if (!ipKey) {
    return jsonResponse({ error: "ip_required" }, 403);
  }

  try {
    const permit = await ctx.runMutation(
      internal.anonymousOnboardingIp.issueAnonymousOnboardingIpPermit,
      {
        ipKey,
        now: Date.now(),
        permitToken: createAnonymousOnboardingIpPermitToken(),
      },
    );
    return jsonResponse(
      {
        permitToken: permit.permitToken,
        expiresAt: permit.expiresAt,
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.toLowerCase().includes("too many") ? 429 : 500;
    return jsonResponse({ error: message }, status);
  }
}

http.route({
  path: "/anonymous-onboarding/ip-permit",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: IP_PERMIT_CORS_HEADERS,
    });
  }),
});

http.route({
  path: "/anonymous-onboarding/ip-permit",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleAnonymousOnboardingIpPermitRequest(ctx, request);
  }),
});

// ── Duel share route: /s/d/:linkCode (+ /card.png) ──
// Crawlers get a minimal OG/Twitter document (no state change, no event);
// humans get a link_tap event and a 302 to the existing open guest landing
// at verveq.com/duel/:linkCode — same linkCode, guest bridge untouched.
// Contract: this route never errors and never leaks — any failure degrades
// to a generic card and/or the redirect.

function redirectResponse(location: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

function pngResponse(body: Blob | ArrayBuffer | Uint8Array<ArrayBuffer>) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // The og:image URL is versioned via the one-way variant token, so a
      // long client cache is safe — score changes mint a new URL.
      "Cache-Control": "public, max-age=86400",
    },
  });
}

const EMPTY_CARD_DATA: ShareCardData = {
  found: false,
  challengerName: null,
  challengerScore: null,
};

async function loadShareCardData(
  ctx: ActionCtx,
  linkCode: string,
): Promise<ShareCardData> {
  try {
    return await ctx.runQuery(internal.duelShare.getShareCardData, {
      linkCode,
    });
  } catch {
    return EMPTY_CARD_DATA;
  }
}

async function serveSharePage(
  ctx: ActionCtx,
  request: Request,
  requestUrl: URL,
  linkCode: string,
): Promise<Response> {
  const duelUrl = `${APP_DUEL_URL_BASE}${encodeURIComponent(linkCode)}`;
  if (!isCrawlerUserAgent(request.headers.get("user-agent"))) {
    try {
      await ctx.runMutation(internal.duelShare.logLinkTap, { linkCode });
    } catch {
      // Instrumentation must never block the human handoff.
    }
    try {
      // Scheduled, not awaited inline: the redirect is what the human is
      // waiting on, and PostHog's round trip does not belong in front of it.
      await ctx.scheduler.runAfter(
        0,
        internal.duelShare.captureShareLinkOpened,
        { linkCode, openId: crypto.randomUUID() },
      );
    } catch {
      // Same contract as above — the handoff outranks the telemetry.
    }
    return redirectResponse(duelUrl);
  }

  const data = await loadShareCardData(ctx, linkCode);
  const texts = buildShareCardTexts(data);
  const cacheKey = data.found ? linkCode : GENERIC_CARD_KEY;
  const variant = cardVariantToken(cacheKey, data.challengerScore);
  // og:image lives on the public (vanity) host — verveq.com proxies /s/d/*
  // to this deployment — so previews never expose the .convex.site origin.
  const publicBase = resolveSharePublicBase(
    process.env.SHARE_PUBLIC_BASE_URL,
    requestUrl.origin,
  );
  const imageUrl = `${publicBase}${SHARE_ROUTE_PREFIX}${encodeURIComponent(
    linkCode,
  )}${CARD_IMAGE_SUFFIX}?v=${variant}`;
  const html = buildCrawlerHtml({
    title: texts.title,
    description: texts.description,
    imageUrl,
    duelUrl,
  });
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

async function serveShareCardImage(
  ctx: ActionCtx,
  linkCode: string,
): Promise<Response> {
  const png = await ensureShareCardCached(ctx, linkCode);
  if (png) return pngResponse(png);
  // Renderer unavailable: serve a tiny placeholder PNG rather than a 500
  // (crawlers degrade to a text-only preview).
  const fallback = Uint8Array.from(atob(FALLBACK_PNG_BASE64), (c) =>
    c.charCodeAt(0),
  );
  return pngResponse(fallback);
}

http.route({
  pathPrefix: SHARE_ROUTE_PREFIX,
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const requestUrl = new URL(request.url);
      const parsed = parseShareRoutePath(requestUrl.pathname);
      if (!parsed) return redirectResponse(APP_HOME_URL);
      if (parsed.kind === "card") {
        return await serveShareCardImage(ctx, parsed.linkCode);
      }
      return await serveSharePage(ctx, request, requestUrl, parsed.linkCode);
    } catch {
      return redirectResponse(APP_HOME_URL);
    }
  }),
});

// ── Daily-game reminder unsubscribe: /whos-older/unsubscribe?t=TOKEN ──
// GET is the link in the email body (a tiny confirmation page); POST is the
// RFC 8058 one-click unsubscribe mail clients send from the List-Unsubscribe
// header. Both are idempotent and never reveal whether a token exists.

function unsubscribePage(game: "older" | "letters" | null): Response {
  const title = game === "letters" ? "Missing Letters" : "Who's Older?";
  const href = game === "letters" ? "https://verveq.com/letters" : "https://verveq.com/older";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed · VerveQ</title></head>
<body style="margin:0;background:#111;color:#fff8f0;font-family:Arial,Helvetica,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:420px;padding:24px;text-align:center"><p style="font-family:'Courier New',monospace;color:#c6ff1a;letter-spacing:3px;font-weight:bold">VERVEQ</p>
<h1 style="font-size:26px">You're unsubscribed.</h1><p style="color:#cfc8c0;line-height:1.5">No more ${title} reminders. You can switch them back on from any finished daily.</p>
<p><a href="${href}" style="color:#c6ff1a;font-weight:bold">Play today's game</a></p></div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// One route for both daily games' reminders (whosOlderReminders.ts): the
// token identifies the reminder, and the reminder knows its game.
async function handleReminderUnsubscribe(ctx: ActionCtx, request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  let game: "older" | "letters" | null = null;
  if (token.length >= 32 && token.length <= 128) {
    try {
      ({ game } = await ctx.runMutation(internal.whosOlderReminders.unsubscribeByToken, { token }));
    } catch (err) {
      console.error("[whos-older/unsubscribe] failed:", err);
    }
  }
  return request.method === "POST" ? new Response(null, { status: 200 }) : unsubscribePage(game);
}

http.route({
  path: "/whos-older/unsubscribe",
  method: "GET",
  handler: httpAction(handleReminderUnsubscribe),
});

http.route({
  path: "/whos-older/unsubscribe",
  method: "POST",
  handler: httpAction(handleReminderUnsubscribe),
});

export default http;
