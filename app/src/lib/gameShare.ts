/**
 * Plain text-and-link result sharing for the solo modes that have no result
 * page of their own (VerveGrid, Higher or Lower) — the same shape as Career
 * Path's `lib/careerPathShare.ts`: native share on mobile, clipboard
 * everywhere else, no backend record. The link goes to the mode's indexable
 * /games page; `ref=*_share` makes entrySource classify the visit as a share.
 */
import { getShareBaseUrl } from "@/lib/shareBase";

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export function buildGridSharePayload(text: string): SharePayload {
  return { title: "VerveQ VerveGrid", text, url: `${getShareBaseUrl()}/games/football-grid/?ref=grid_share` };
}

export function buildHigherLowerSharePayload(text: string): SharePayload {
  return {
    title: "VerveQ Higher or Lower",
    text,
    url: `${getShareBaseUrl()}/games/higher-or-lower/?ref=higher_lower_share`,
  };
}

/** The 3×3 board as emoji squares, row by row: 🟩 right, 🟥 wrong, ⬜ missed. */
export function gridEmojiBoard(cells: ReadonlyArray<boolean | undefined>): string {
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    rows.push(
      [0, 1, 2]
        .map((c) => {
          const v = cells[r * 3 + c];
          return v === true ? "🟩" : v === false ? "🟥" : "⬜";
        })
        .join(""),
    );
  }
  return rows.join("\n");
}

export async function shareResult(payload: SharePayload): Promise<ShareOutcome> {
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
