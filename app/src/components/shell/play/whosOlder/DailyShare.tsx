/**
 * The DAILY GAMES' share and follow pieces (docs/RETURN_LOOP.md, parts A + B).
 *
 * "Share" opens a sheet with two ways out: a text share (the tier-grouped
 * grid plus the challenge link) and a 1080×1920 story image drawn on a
 * canvas. Both are prepared when the sheet opens, so the share call itself runs
 * straight from the tap — iOS drops the share sheet if an await sits between
 * the tap and navigator.share.
 *
 * The follow link is the "come back tomorrow" ask for Instagram visitors,
 * whose return path is the feed, not an inbox. It sits in the result screen's
 * quiet bottom line next to the email reminder.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "@/lib/notify";
import { ExternalLink, Image as ImageIcon, Instagram, Link2, Send } from "lucide-react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import type { DailyGame } from "./WhosOlderRetention";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, SHARE_UI, renderStoryImage, streakLinkUrl, tierGrid } from "@/lib/dailyShare";
import { getShareBaseUrl } from "@/lib/shareBase";
import {
  type HandoffPlatform,
  cacheToken,
  handoffHref,
  handoffPlatform,
  handoffTargetUrl,
  readCachedToken,
} from "@/lib/openInBrowser";
import { api } from "../../../../../convex/_generated/api";

// ── Share sheet ────────────────────────────────────────────────────────────

export type ShareResult = {
  edition: number;
  score: number;
  total: number;
  history: Array<{ correct: boolean }>;
  /** 0–100, only when the standing is shown on the result card (≥ 50%). */
  standingPct: number | null;
  /** Today's daily streak, drawn on the story in the standing's place. */
  streak: number | null;
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
      standing: standing != null && result.standingPct != null ? { pct: result.standingPct, text: standing } : null,
      streak: result.streak
        ? { days: result.streak, text: t("dailyShare.storyStreak", { count: result.streak }) }
        : null,
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
      notify.success(t(`${ui.ns}.copied`));
    } catch {
      notify.error(t(`${ui.ns}.shareFailed`));
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
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      mdCenter
      eyebrow={`${title} #${result.edition}`}
      title={t("dailyShare.sheetTitle")}
      testId={`${ui.tid}-share-sheet`}
    >
      {showImage && story ? (
        <div className="grid gap-3">
          <img
            src={story.url}
            alt={t("dailyShare.storyAlt", { title, n: result.edition })}
            className="mx-auto max-h-[55dvh] w-auto max-w-full rounded-md neo-border"
            data-testid={`${ui.tid}-story-image`}
          />
          <p className="text-center text-body-sm">{t("dailyShare.storyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <Button
            variant="primary"
            size="lg"
            block
            onClick={sendToFriend}
            disabled={!link}
            data-testid={`${ui.tid}-share-friend`}
          >
            <Send size={18} aria-hidden="true" />
            {t("dailyShare.friend")}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            onClick={postToStory}
            disabled={!story}
            data-testid={`${ui.tid}-share-story`}
          >
            <ImageIcon size={18} aria-hidden="true" />
            {t("dailyShare.story")}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

// ── Follow link ────────────────────────────────────────────────────────────

/**
 * "Follow @playverveq" as one quiet link for Instagram visitors. Fires
 * `*_follow_shown` when it first renders and `*_follow_clicked` on the tap,
 * as the card it replaced did.
 */
export function FollowLink({ game }: { game: DailyGame }) {
  const { t } = useTranslation("play");
  const ui = SHARE_UI[game];
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    track(`${ui.prefix}_follow_shown`);
  }, [ui.prefix]);
  return (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`${ui.tid}-follow`}
      title={t("dailyShare.followBody")}
      onClick={() => track(`${ui.prefix}_follow_clicked`)}
      className="inline-flex min-h-11 items-center gap-2 px-2 text-body-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      <Instagram size={16} className="shrink-0" aria-hidden="true" />
      {t("dailyShare.followCta", { handle: INSTAGRAM_HANDLE })}
    </a>
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
      notify.error(code === "rate_limited" ? t("dailyShare.keepRateLimited") : t("dailyShare.keepFailed"));
    }
  };

  return (
    <Card elevation="flat" padding="sm" className="grid gap-2" data-testid={`${ui.tid}-streak-link`}>
      <p className="text-body-sm font-bold">{t("dailyShare.keepTitle")}</p>
      <p className="text-body-sm text-muted-foreground">{t("dailyShare.keepBody", { count: streak })}</p>
      {link ? (
        <>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t("dailyShare.keepCta")}
            data-testid={`${ui.tid}-streak-link-url`}
            className="w-full min-w-0 rounded-md neo-border bg-background px-2 py-1.5 font-mono text-meta text-foreground"
          />
          <p className="text-meta text-muted-foreground" role="status">
            {state === "copied" ? t("dailyShare.keepCopied") : t("dailyShare.keepManual")}
          </p>
        </>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={copy}
          loading={state === "busy"}
          data-testid={`${ui.tid}-streak-link-copy`}
        >
          <Link2 size={16} aria-hidden="true" />
          {t("dailyShare.keepCta")}
        </Button>
      )}
    </Card>
  );
}

// ── Open in browser ────────────────────────────────────────────────────────

/**
 * Inside Instagram's in-app browser: one tap opens this game in Chrome
 * (Android) or Safari (iOS) with the streak carried over (lib/openInBrowser).
 * The streak link is minted as the card mounts so the tap is a plain link with
 * nothing to wait on. Where the OS can't be told apart, the copy-a-link card
 * stays. After the tap the card also offers the link to copy, for when
 * Instagram swallows the hand-off.
 */
export function StreakHandoff({ game, streak }: { game: DailyGame; streak: number }) {
  const platform = handoffPlatform();
  if (!platform) return <StreakLinkOffer game={game} streak={streak} />;
  return <OpenInBrowserOffer game={game} streak={streak} platform={platform} />;
}

function OpenInBrowserOffer({
  game,
  streak,
  platform,
}: {
  game: DailyGame;
  streak: number;
  platform: HandoffPlatform;
}) {
  const { t } = useTranslation("play");
  const ui = SHARE_UI[game];
  const path = game === "letters" ? "letters" : "older";
  const create = useMutation(api.dailyStreakLinks.createTransfer);
  // undefined = minting; null = no token (the link still opens the browser, without the streak).
  const [token, setToken] = useState<string | null | undefined>(() => readCachedToken(path) ?? undefined);
  const [tapped, setTapped] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (token !== undefined) return;
    let cancelled = false;
    create({})
      .then(({ token: minted }) => {
        cacheToken(path, minted);
        if (!cancelled) setToken(minted);
      })
      .catch(() => !cancelled && setToken(null));
    return () => {
      cancelled = true;
    };
  }, [create, path, token]);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    track("open_in_browser_shown", { game, platform, streak });
  }, [game, platform, streak]);

  const target = handoffTargetUrl(getShareBaseUrl(), path, token ?? null);
  const browser = platform === "ios" ? "Safari" : "Chrome";

  return (
    <Card elevation="flat" padding="sm" className="grid gap-2" data-testid={`${ui.tid}-open-in-browser`}>
      <p className="text-body-sm font-bold">{t("dailyShare.handoffTitle", { count: streak })}</p>
      <p className="text-body-sm text-muted-foreground">{t("dailyShare.handoffBody", { browser })}</p>
      <Button
        variant="primary"
        size="md"
        block
        loading={token === undefined}
        onClick={() => {
          setTapped(true);
          track("open_in_browser_clicked", { game, platform, streak, with_streak: token !== null });
          // Straight from the tap: Instagram only lets a user gesture leave its browser.
          window.location.href = handoffHref(target, platform);
        }}
        data-testid={`${ui.tid}-open-in-browser-cta`}
      >
        <ExternalLink size={16} aria-hidden="true" />
        {t("dailyShare.handoffCta", { browser })}
      </Button>
      {tapped && (
        <>
          <p className="text-meta text-muted-foreground">{t("dailyShare.handoffFallback", { browser })}</p>
          <input
            readOnly
            value={target}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t("dailyShare.keepCta")}
            className="w-full min-w-0 rounded-md neo-border bg-background px-2 py-1.5 font-mono text-meta text-foreground"
          />
        </>
      )}
    </Card>
  );
}
