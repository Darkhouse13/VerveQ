/**
 * One-tap result share for the solo modes' result screens (VerveQ ONE P3.1),
 * lifted from the retired v1 daily result page: the native share sheet where
 * it exists (mobile — WhatsApp et al.), the clipboard everywhere else. A
 * dismissed sheet (AbortError) is not an error and not a share.
 *
 * `navigator.share` is called straight from the tap, with no await before it:
 * iOS drops the share sheet when an await sits between the tap and the call.
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "@/lib/notify";
import { track } from "@/lib/analytics";
import { getShareBaseUrl } from "@/lib/shareBase";

export type ShareOutcome = "native" | "clipboard" | "cancelled" | "failed";

/** The mode slug a share is reported under. */
export type ShareMode = "quiz" | "survival" | "daily-quiz" | "daily-survival" | "blitz";

export async function shareResultText(text: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return "native";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Any other failure (unsupported payload, permissions) falls through to
      // the clipboard, as the v1 page did.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "clipboard";
  } catch {
    return "failed";
  }
}

/**
 * A result's public link: a static landing page (so the share unfurls with
 * that game's card) plus a `ref` ending in `_share`, which cold-entry
 * attribution counts as a share arrival (lib/entrySource.ts). Built on the
 * canonical share origin, never the render origin.
 */
export function resultShareUrl(path: string, ref: string): string {
  return `${getShareBaseUrl()}${path}?ref=${ref}`;
}

/** The Share button's handler: share, confirm a copy, report both steps. */
export function useResultShare(mode: ShareMode, text: string, score: number): () => void {
  const { t } = useTranslation("play");
  return useCallback(() => {
    track("result_share_pressed", { mode, score });
    void shareResultText(text).then((outcome) => {
      if (outcome === "native" || outcome === "clipboard") {
        track("result_share_sent", { mode, method: outcome });
      }
      if (outcome === "clipboard") notify.success(t("result.shareCopied"));
      if (outcome === "failed") notify.error(t("result.shareFailed"));
    });
  }, [mode, score, t, text]);
}

/**
 * The emoji grid the dailies have always shared: 🟩 right in ≤3s, 🟨 right,
 * 🟥 wrong.
 */
export function answerGrid(rows: ReadonlyArray<{ correct: boolean; timeTaken: number }>): string {
  return rows.map((r) => (!r.correct ? "🟥" : r.timeTaken <= 3 ? "🟩" : "🟨")).join("");
}
