import { getShareBaseUrl } from "@/lib/shareBase";

export type CareerPathShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export function buildCareerPathSharePayload(text: string) {
  return {
    title: "VerveQ Career Path",
    text,
    // The indexable Career Path page, not the /play redirect: a shared result
    // posted publicly becomes a real link to a page that can rank, and the
    // page's Play button opens the game with no load. ref keeps attribution
    // (entrySource classifies *_share as share-link).
    url: `${getShareBaseUrl()}/games/career-path/?ref=career_share`,
  };
}

/** Native share on mobile, clipboard everywhere else. No result slug or
 * backend record is needed. */
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
