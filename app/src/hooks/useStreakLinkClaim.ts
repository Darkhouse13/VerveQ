/**
 * A streak link was opened (`?st=<token>`, docs/RETURN_LOOP.md part C): join
 * this browser's account to the player's other browsers so their daily streak
 * follows them here. Claimed once, then stripped from the address bar so a
 * copied URL never carries the token.
 *
 * Returns whether the claim has settled: the screen waits for it before
 * dealing today's daily, so a browser joined to one that already finished it
 * is shown that result instead of a fresh board.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import type { DailyGame } from "@/components/shell/play/whosOlder/WhosOlderRetention";
import { api } from "../../convex/_generated/api";

export function useStreakLinkClaim(game: DailyGame) {
  const { t } = useTranslation("play");
  const claim = useMutation(api.dailyStreakLinks.claimTransfer);
  const done = useRef(false);
  const [settled, setSettled] = useState(() => !new URLSearchParams(window.location.search).has("st"));
  useEffect(() => {
    if (done.current) return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("st");
    if (!token) return;
    done.current = true;
    url.searchParams.delete("st");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    void claim({ token })
      .then((res) => {
        track("daily_streak_link_claimed", {
          game,
          ok: res.ok,
          ...(res.ok ? { accounts: res.accounts, already_linked: res.alreadyLinked } : { reason: res.reason }),
        });
        if (res.ok && !res.alreadyLinked) toast.success(t("dailyShare.linkConnected"));
        else if (!res.ok && res.reason === "expired") toast.error(t("dailyShare.linkExpired"));
        else if (!res.ok && (res.reason === "used_up" || res.reason === "group_full")) toast.error(t("dailyShare.linkUsedUp"));
      })
      .catch((err) => console.error("Streak link failed:", err))
      .finally(() => setSettled(true));
  }, [claim, game, t]);
  return settled;
}
