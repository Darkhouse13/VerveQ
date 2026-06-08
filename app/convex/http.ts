import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  createAnonymousOnboardingIpPermitToken,
  deriveAnonymousOnboardingIpKey,
} from "./anonymousOnboardingIp";

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
    const ipKey = deriveAnonymousOnboardingIpKey(request.headers);
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
  }),
});

export default http;
