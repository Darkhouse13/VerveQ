/**
 * THE WEEKEND — the settlement receipt (FW-RECEIPT Part 3).
 *
 * A settled gameweek's receipt, screenshot-shaped: dark, Neo-brutalist,
 * 9:16-friendly at 380px — the on-screen card IS the product, built to be
 * screenshotted into a group chat. Share hands over an actual PNG (painted
 * by lib/receiptImage from the same payload) where the Web Share API takes
 * files; otherwise the text summary; download saves the PNG. No club
 * crests, no player likenesses — type and geometry only.
 *
 * Reached from the squad screen and the ledger's settled entry. Null
 * receipt (unsettled gameweek, no squad, or a pre-receipt backend) renders
 * the quiet "not yet" card — an unsettled weekend is a ledger, not a
 * receipt.
 */
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { Download, Share2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { SquadReceipt } from "../../../../convex/fantasyReceipts";
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { paintReceipt, receiptFilename } from "@/lib/receiptImage";
import { track } from "@/lib/analytics";

function signed(points: number): string {
  return points >= 0 ? `+${formatPoints(points)}` : formatPoints(points);
}

/** The share text — the receipt's facts, nothing invented. */
function shareTextOf(receipt: SquadReceipt, t: TFunction): string {
  const parts: string[] = [
    t("weekend.shareReceiptHeader", { defaultValue: "THE WEEKEND — GW{{gw}} settled: {{points}} pts.", gw: receipt.gwNumber, points: formatPoints(receipt.total) }),
  ];
  if (receipt.best !== null) {
    parts.push(t("weekend.shareReceiptBest", { defaultValue: "Best call {{name}} {{points}}.", name: receipt.best.playerName, points: signed(receipt.best.points) }));
  }
  if (receipt.percentile !== null && receipt.percentile.population > 1) {
    parts.push(
      t("weekend.shareReceiptBeat", { defaultValue: "Beat {{pct}}% of budget squads.", pct: Math.round((100 * receipt.percentile.beatCount) / receipt.percentile.population) }),
    );
  } else if (receipt.crewRank !== null) {
    parts.push(
      t("weekend.shareReceiptRank", { defaultValue: "{{rank}} of {{of}} in the room.", rank: `${receipt.crewRank.tied ? "T" : ""}${receipt.crewRank.rank}`, of: receipt.crewRank.of }),
    );
  }
  return parts.join(" ");
}

/** The card itself — DOM twin of lib/receiptImage's painting. */
export function ReceiptCard({ receipt }: { receipt: SquadReceipt }) {
  const { t, i18n } = useTranslation();
  const filled = receipt.slots.filter((slot) => slot.playerId !== null);
  const pct =
    receipt.percentile !== null && receipt.percentile.population > 1
      ? Math.round((100 * receipt.percentile.beatCount) / receipt.percentile.population)
      : null;
  const strongestCrowd =
    receipt.crowdMoved.length === 0
      ? null
      : [...receipt.crowdMoved].sort(
          (a, b) => Math.abs(b.crowdFactor) - Math.abs(a.crowdFactor),
        )[0];

  return (
    <div
      data-testid="receipt-card"
      className="neo-border neo-shadow-lg rounded-xl bg-background text-foreground p-5 flex flex-col gap-4"
    >
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          {t("weekend.receiptEyebrow", { defaultValue: "The Weekend — settled" })}
        </p>
        <h2 className="font-heading font-bold text-2xl leading-tight mt-1">
          {t("weekend.receiptTitle", {
            defaultValue: "Gameweek {{gw}} receipt",
            gw: receipt.gwNumber,
          })}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5">
          {receipt.season} ·{" "}
          {new Date(receipt.settledAt).toLocaleDateString(i18n.language, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>

      <div className="neo-border rounded-lg bg-card px-4 py-3 flex items-baseline gap-2">
        <span
          className="font-mono font-bold text-5xl tabular-nums text-primary"
          data-testid="receipt-total"
        >
          {formatPoints(receipt.total)}
        </span>
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {t("weekend.receiptFinal", { defaultValue: "pts final" })}
        </span>
      </div>

      <div className="neo-border rounded-lg bg-card px-3 py-2" data-testid="receipt-slots">
        {filled.map((slot) => (
          <div
            key={slot.slotIndex}
            className="flex items-center gap-2 py-1 border-b-2 border-border/40 last:border-b-0"
          >
            <span className="font-mono text-[9px] font-bold uppercase text-muted-foreground w-11 shrink-0">
              {slot.slotRole}
              {slot.isFinisher ? "·F" : ""}
            </span>
            <span className="font-heading font-bold text-xs min-w-0 flex-1 truncate">
              {slot.playerName ?? "—"}
            </span>
            {slot.points === null ? (
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                {t("weekend.awaitingData", { defaultValue: "awaiting data" })}
              </span>
            ) : (
              <span
                className={`font-mono font-bold text-xs tabular-nums shrink-0 ${
                  slot.points < 0 ? "text-destructive" : ""
                }`}
              >
                {formatPoints(slot.points)}
              </span>
            )}
          </div>
        ))}
      </div>

      {receipt.best !== null && receipt.worst !== null && (
        <div className="neo-border rounded-lg bg-card px-4 py-3 flex flex-col gap-1.5">
          <p className="text-sm flex items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary shrink-0">
              {t("weekend.receiptBest", { defaultValue: "Best call" })}
            </span>
            <span className="font-heading font-bold text-sm min-w-0 truncate" data-testid="receipt-best">
              {receipt.best.playerName}{" "}
              <span className="font-mono">{signed(receipt.best.points)}</span>
            </span>
          </p>
          <p className="text-sm flex items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground shrink-0">
              {t("weekend.receiptWorst", { defaultValue: "Worst call" })}
            </span>
            <span className="font-heading font-bold text-sm min-w-0 truncate" data-testid="receipt-worst">
              {receipt.worst.playerName}{" "}
              <span className="font-mono">{signed(receipt.worst.points)}</span>
            </span>
          </p>
        </div>
      )}

      {strongestCrowd !== null && (
        <p
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
          data-testid="receipt-crowd"
        >
          {receipt.crowdMoved.length === 1
            ? t("weekend.receiptCrowdOne", {
                defaultValue: "The crowd's verdict moved {{name}} {{pct}}%",
                name: strongestCrowd.playerName,
                pct: `${strongestCrowd.crowdFactor >= 0 ? "+" : ""}${Math.round(strongestCrowd.crowdFactor * 100)}`,
              })
            : t("weekend.receiptCrowdMany", {
                defaultValue:
                  "The crowd's verdict moved {{n}} of your 13 — biggest: {{name}} {{pct}}%",
                n: receipt.crowdMoved.length,
                name: strongestCrowd.playerName,
                pct: `${strongestCrowd.crowdFactor >= 0 ? "+" : ""}${Math.round(strongestCrowd.crowdFactor * 100)}`,
              })}
        </p>
      )}

      {pct !== null ? (
        <div
          className="neo-border rounded-lg bg-primary text-primary-foreground px-4 py-3"
          data-testid="receipt-percentile"
        >
          <p className="font-heading font-bold text-lg leading-tight">
            {t("weekend.receiptPercentile", {
              defaultValue: "Beat {{pct}}% of budget squads",
              pct,
            })}
          </p>
        </div>
      ) : receipt.crewRank !== null ? (
        <div
          className="neo-border rounded-lg bg-primary text-primary-foreground px-4 py-3"
          data-testid="receipt-crew-rank"
        >
          <p className="font-heading font-bold text-lg leading-tight">
            {t("weekend.receiptCrewRank", {
              defaultValue: "{{rank}} of {{of}} in the room",
              rank: `${receipt.crewRank.tied ? "T" : ""}${receipt.crewRank.rank}`,
              of: receipt.crewRank.of,
            })}
          </p>
        </div>
      ) : receipt.context === "budget" ? (
        // A settled squad with no number gets no standing — honestly absent.
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {t("weekend.receiptNoNumber", {
            defaultValue: "No scored player this weekend — no standing to claim.",
          })}
        </p>
      ) : null}

      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        verveq.com/weekend
      </p>
    </div>
  );
}

export default function WeekendReceiptScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { gameweekId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const [busy, setBusy] = useState(false);

  const receipt = useQuery(
    api.fantasyReceipts.getReceipt,
    gameweekId === ""
      ? "skip"
      : {
          gameweekId: gameweekId as Id<"fantasyGameweeks">,
          context: roomId === null ? ("budget" as const) : ("crew" as const),
          ...(roomId === null ? {} : { crewRoomId: roomId }),
        },
  );

  const handleShare = async () => {
    if (receipt == null || busy) return;
    setBusy(true);
    const text = shareTextOf(receipt, t);
    const url = `${window.location.origin}${SHELL_ROUTES.weekend}`;
    try {
      // Best: the painted card itself, where files can be shared.
      try {
        const blob = await paintReceipt(receipt);
        const file = new File([blob], receiptFilename(receipt), { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "VerveQ", text });
          track("weekend_receipt_shared", { gw_number: receipt.gwNumber, mode: "image" });
          return;
        }
      } catch {
        /* fall through to text share */
      }
      if (navigator.share) {
        await navigator.share({ title: "VerveQ", text, url });
        track("weekend_receipt_shared", { gw_number: receipt.gwNumber, mode: "text" });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      track("weekend_receipt_shared", { gw_number: receipt.gwNumber, mode: "copy" });
      toast.success(t("common.copied", { defaultValue: "Copied" }));
    } catch {
      /* user cancelled the share sheet — not an error */
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (receipt == null || busy) return;
    setBusy(true);
    try {
      const blob = await paintReceipt(receipt);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = receiptFilename(receipt);
      anchor.click();
      URL.revokeObjectURL(url);
      track("weekend_receipt_shared", { gw_number: receipt.gwNumber, mode: "download" });
    } catch {
      toast.error(
        t("weekend.receiptDownloadFailed", { defaultValue: "Could not build the image." }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.receiptScreenTitle", { defaultValue: "Receipt" })}
      back
      onBack={() => navigate(-1)}
      scroll
    >
      <div className="flex flex-col gap-4 max-w-sm mx-auto w-full pb-6">
        {receipt === undefined ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : receipt === null ? (
          <NeoCard className="text-center py-6" data-testid="receipt-not-ready">
            <p className="font-heading font-bold">
              {t("weekend.receiptNotReady", { defaultValue: "No receipt yet." })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("weekend.receiptNotReadyBody", {
                defaultValue:
                  "A receipt prints when the gameweek settles — until then the ledger tells the story.",
              })}
            </p>
          </NeoCard>
        ) : (
          <>
            <ReceiptCard receipt={receipt} />
            <div className="grid grid-cols-2 gap-2">
              <NeoButton
                variant="primary"
                size="md"
                disabled={busy}
                data-testid="receipt-share"
                onClick={() => void handleShare()}
              >
                <Share2 size={14} strokeWidth={3} className="mr-1.5" />
                {t("common.share", { defaultValue: "Share" })}
              </NeoButton>
              <NeoButton
                variant="secondary"
                size="md"
                disabled={busy}
                data-testid="receipt-download"
                onClick={() => void handleDownload()}
              >
                <Download size={14} strokeWidth={3} className="mr-1.5" />
                {t("common.download", { defaultValue: "Download" })}
              </NeoButton>
            </div>
            {receipt.awaitingSlots > 0 && (
              <NeoBadge color="muted">
                {t("weekend.receiptAwaitingNote", {
                  defaultValue: "{{n}} slot(s) never got data this weekend",
                  n: receipt.awaitingSlots,
                })}
              </NeoBadge>
            )}
          </>
        )}
      </div>
    </ShellLayout>
  );
}
