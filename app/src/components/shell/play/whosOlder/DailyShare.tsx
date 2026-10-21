/**
 * The DAILY GAMES' share and follow pieces (docs/RETURN_LOOP.md, parts A + B).
 *
 * "Share result" opens a sheet with two ways out: a text share (the tier-
 * grouped grid plus the challenge link) and a 1080×1920 story image drawn on a
 * canvas. Both are prepared when the sheet opens, so the share call itself runs
 * straight from the tap — iOS drops the share sheet if an await sits between
 * the tap and navigator.share.
 *
 * The follow card is the "come back tomorrow" ask for Instagram visitors,
 * whose return path is the feed, not an inbox.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Image as ImageIcon, Instagram, Link2, Send } from "lucide-react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NeoButton } from "@/components/neo/NeoButton";
import { track } from "@/lib/analytics";
import type { DailyGame } from "./WhosOlderRetention";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, SHARE_UI, renderStoryImage, streakLinkUrl, tierGrid } from "@/lib/dailyShare";
import { getShareBaseUrl } from "@/lib/shareBase";
import { api } from "../../../../../convex/_generated/api";

// ── Share sheet ────────────────────────────────────────────────────────────

export type ShareResult = {
  edition: number;
  score: number;
  total: number;
  history: Array<{ correct: boolean }>;
  /** 0–100, only when the standing is shown on the result card. */
  standingPct: number | null;
};

export function ShareSheet({
  game,
  open,
  onOpenChange,
  result,
  makeLink,
}: {
  game: DailyGame;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ShareResult;
  /** Mints the challenge link (falls back to the plain link itself). Called once per open. */
  makeLink: () => Promise<string>;
}) {
  const { t } = useTranslation("play");
  const ui = SHARE_UI[game];
  const [link, setLink] = useState<string | null>(null);
  const [story, setStory] = useState<{ blob: Blob; url: string } | null>(null);
  const [showImage, setShowImage] = useState(false);
  const opened = useRef(false);

  const title = t(`${ui.ns}.title`);
  const standing =
    result.standingPct != null ? t("dailyShare.standing", { pct: result.standingPct }) : null;

  // Prepare both shares as the sheet opens, so each tap shares immediately.
  useEffect(() => {
    if (!open) {
      opened.current = false;
      setShowImage(false);
      return;
    }
    if (opened.current) return;
    opened.current = true;
    let cancelled = false;
    makeLink().then((l) => !cancelled && setLink(l));
    renderStoryImage({
      game,
      title,
      edition: result.edition,
      score: result.score,
      total: result.total,
      history: result.history,
      standing,
      cta: t("dailyShare.storyCta"),
    })
      .then((blob) => !cancelled && setStory({ blob, url: URL.createObjectURL(blob) }))
      .catch((err) => console.error("Story image failed:", err));
    return () => {
      cancelled = true;
    };
    // Prepared once per opening, from the result it opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => { if (story) URL.revokeObjectURL(story.url); }, [story]);

  const sent = (method: string) => track(`${ui.prefix}_share_sent`, { method, edition: result.edition });

  const shareText = () => {
    const lines = [
      t("dailyShare.text", { title, n: result.edition, score: result.score, total: result.total }),
      tierGrid(result.history),
    ];
    if (standing) lines.push(standing);
    return lines.join("\n");
  };

  const sendToFriend = async () => {
    if (!link) return;
    const url = link;
    const text = shareText();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        sent("native");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      sent("clipboard");
      toast.success(t(`${ui.ns}.copied`));
    } catch {
      toast.error(t(`${ui.ns}.shareFailed`));
    }
  };

  const postToStory = async () => {
    if (!story) return;
    const file = new File([story.blob], `${ui.prefix}-${result.edition}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        sent("image_native");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    // In-app browsers can't take files: show the image to press-and-hold save.
    setShowImage(true);
    sent("image_sheet");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${ui.theme} bg-background text-foreground border-[3px] border-border rounded-lg max-w-[min(28rem,calc(100vw-2rem))] max-h-[90dvh] overflow-y-auto`}
        data-testid={`${ui.tid}-share-sheet`}
      >
        <DialogTitle className="font-heading font-black uppercase text-xl pr-10">{t("dailyShare.sheetTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("dailyShare.sheetTitle")}</DialogDescription>
        {showImage && story ? (
          <div className="grid gap-3">
            <img
              src={story.url}
              alt={t("dailyShare.storyAlt", { title, n: result.edition })}
              className="w-full max-w-[16rem] mx-auto rounded-md border-2 border-border"
              data-testid={`${ui.tid}-story-image`}
            />
            <p className="text-sm text-center leading-snug">{t("dailyShare.storyHint")}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <NeoButton
              variant="pink"
              size="lg"
              onClick={sendToFriend}
              disabled={!link}
              data-testid={`${ui.tid}-share-friend`}
            >
              <Send size={18} className="mr-1.5" />
              {t("dailyShare.friend")}
            </NeoButton>
            <NeoButton
              variant="accent"
              size="lg"
              onClick={postToStory}
              disabled={!story}
              data-testid={`${ui.tid}-share-story`}
            >
              <ImageIcon size={18} className="mr-1.5" />
              {t("dailyShare.story")}
            </NeoButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Follow card ────────────────────────────────────────────────────────────

export function FollowCard({ game }: { game: DailyGame }) {
  const { t } = useTranslation("play");
  const ui = SHARE_UI[game];
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    track(`${ui.prefix}_follow_shown`);
  }, [ui.prefix]);
  return (
    <div
      data-testid={`${ui.tid}-follow`}
      className="neo-border border-black neo-shadow rounded-lg bg-yellow text-yellow-foreground px-4 py-4"
    >
      <p className="font-heading font-black text-lg uppercase leading-tight">
        {t("dailyShare.followTitle", { handle: INSTAGRAM_HANDLE })}
      </p>
      <p className="text-sm mt-1 leading-snug">{t("dailyShare.followBody")}</p>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track(`${ui.prefix}_follow_clicked`)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border-[3px] border-black bg-black text-white px-4 py-3 font-heading font-bold uppercase"
      >
        <Instagram size={18} />
        {t("dailyShare.followCta", { handle: INSTAGRAM_HANDLE })}
      </a>
    </div>
  );
}

// ── Streak link ────────────────────────────────────────────────────────────

/**
 * Under the streak, in Instagram's in-app browser only: copy a link that
 * carries the streak to Safari/Chrome (docs/RETURN_LOOP.md part C). The copy
 * hands the clipboard a promise so the write keeps the tap's permission while
 * the link is minted; where that is refused the link is shown to copy by hand.
 */
export function StreakLinkOffer({ game, streak }: { game: DailyGame; streak: number }) {
  const { t } = useTranslation("play");
  const ui = SHARE_UI[game];
  const create = useMutation(api.dailyStreakLinks.createTransfer);
  const [link, setLink] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "copied" | "shown">("idle");

  const copy = async () => {
    if (state === "busy") return;
    setState("busy");
    const minted = create({}).then(({ token }) => streakLinkUrl(getShareBaseUrl(), game, token));
    minted.catch(() => undefined); // handled below; keeps the promise from reporting unhandled
    let copied = false;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": minted.then((u) => new Blob([u], { type: "text/plain" })) }),
        ]);
      } else {
        await navigator.clipboard.writeText(await minted);
      }
      copied = true;
    } catch {
      // Clipboard refused (or the mint failed): fall through and show the link.
    }
    try {
      const url = await minted;
      setLink(url);
      setState(copied ? "copied" : "shown");
      track("daily_streak_link_created", { game, streak, copied });
    } catch (err) {
      setState("idle");
      const code =
        err instanceof ConvexError && typeof err.data === "object" && err.data && "code" in err.data
          ? String((err.data as { code: unknown }).code)
          : null;
      toast.error(code === "rate_limited" ? t("dailyShare.keepRateLimited") : t("dailyShare.keepFailed"));
    }
  };

  return (
    <div data-testid={`${ui.tid}-streak-link`} className="neo-border border-black rounded-lg bg-card px-4 py-3 grid gap-2">
      <p className="text-sm font-bold leading-snug">{t("dailyShare.keepTitle")}</p>
      <p className="text-sm leading-snug text-muted-foreground">{t("dailyShare.keepBody", { count: streak })}</p>
      {link ? (
        <>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t("dailyShare.keepCta")}
            data-testid={`${ui.tid}-streak-link-url`}
            className="w-full min-w-0 rounded-md border-2 border-border bg-background text-foreground px-2 py-1.5 font-mono text-xs"
          />
          <p className="text-xs text-accent" role="status">
            {state === "copied" ? t("dailyShare.keepCopied") : t("dailyShare.keepManual")}
          </p>
        </>
      ) : (
        <NeoButton
          variant="secondary"
          size="md"
          onClick={copy}
          disabled={state === "busy"}
          data-testid={`${ui.tid}-streak-link-copy`}
        >
          <Link2 size={16} className="mr-1.5" />
          {t("dailyShare.keepCta")}
        </NeoButton>
      )}
    </div>
  );
}
