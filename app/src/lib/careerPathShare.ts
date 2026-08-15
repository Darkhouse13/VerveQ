import { getShareBaseUrl } from "@/lib/shareBase";

export type CareerPathShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export function buildCareerPathSharePayload(text: string) {
  return {
    title: "VerveQ Career Path",
    text,
    url: `${getShareBaseUrl()}/play`,
  };
}

/** Native share on mobile, clipboard everywhere else. The public CTA stays
 * the marketed /play door; no result slug or backend record is needed. */
export async function shareCareerPathResult(text: string): Promise<CareerPathShareOutcome> {
  const payload = buildCareerPathSharePayload(text);

  if (navigator.share) {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  try {
    await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
