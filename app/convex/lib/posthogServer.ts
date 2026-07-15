/**
 * Server-origin PostHog capture, for surfaces no browser ever reaches.
 *
 * /s/d/:linkCode is proxied by nginx straight to the share httpAction, which
 * serves an OG card to crawlers and 302s humans onward. The SPA never loads
 * there, so there is no client to fire share_link_opened — the server is the
 * only honest origin for it.
 *
 * Fail-closed like lib/analytics.ts: with no POSTHOG_KEY set on the
 * deployment, this is a complete no-op. It also never throws. The share route
 * contract is that it never errors and never blocks the human handoff, and
 * instrumentation does not get to break that.
 */

/** The live deployment (see scripts/lib/deployTarget.ts, which guards deploys
 *  to it). Anything else — the dev/staging deployment, a preview — is test by
 *  construction, so a scripted pass cannot forget to mark itself and a real
 *  open cannot be mislabelled by a spoofable query param. */
const PROD_DEPLOYMENT = "different-lynx-153";

function isProdDeployment(): boolean {
  return (process.env.CONVEX_CLOUD_URL ?? "").includes(PROD_DEPLOYMENT);
}

export async function captureServerEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const key = process.env.POSTHOG_KEY;
  if (!key) return;

  const host = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";
  const isTest = !isProdDeployment();

  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          // Events sent through the capture API are IDENTIFIED by default,
          // which would mint a person profile per share open and quietly
          // inflate the person count. A server-minted id can never stitch to
          // the opener's browser id anyway (persistence is localStorage, so
          // there is no cookie to read), so a profile here would be noise.
          // The open->play join is analysis-time work, via link_code.
          $process_person_profile: false,
          ...(isTest ? { is_test: true, env: "test" } : {}),
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Never throw: a share link must resolve even when analytics is down.
  }
}
