/**
 * THE WEEKEND — crowd voting stack (FW-LAUNCH O2, CROWD_VOTING_SPEC v1.0.1).
 *
 * Two player cards, one fixture context each, one tap: left, right, or
 * "didn't watch" (costless skip, LOCKED). Pairs are SERVER-served — this
 * screen never chooses who to compare, it only renders what servePair
 * returned and reports the tap. Blitz-style: a served stack, tap through,
 * stop whenever.
 *
 * Availability gating follows BudgetSquadScreen: imperative first query,
 * fail closed and silent to the quiet card. Route registered but UNLINKED.
 *
 * Views are exported for the contract suite; the default export is the data
 * container (house pattern).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { EyeOff } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";
import { leagueName } from "@/lib/leagueNames";
import {
  kickoffDayTag,
  orientedScore,
  voteCardEvents,
  type VoteCardEvent,
} from "@/lib/weekendVoteCard";

export type VotingStatus = NonNullable<
  FunctionReturnType<typeof api.fantasyCrowdVoting.getVotingStatus>
>;
export type ServeResult = FunctionReturnType<typeof api.fantasyCrowdVoting.servePair>;
export type ServedPair = Extract<ServeResult, { status: "served" }>;

/** EYE-TEST-CONTEXT: factual events only, rendered as glyphs — a goal, an
 *  assist, a red. Yellows and anything derived are excluded by ruling. */
const EVENT_GLYPHS: Record<VoteCardEvent["kind"], string> = {
  goal: "⚽",
  assist: "🅰️",
  red: "🟥",
};

export function PairCard({
  player,
  onPick,
  busy,
}: {
  player: ServedPair["players"][number];
  onPick: () => void;
  busy: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { fixture } = player;
  const score = orientedScore(player);
  const events = voteCardEvents(player);
  // Degraded-loudly fallbacks (the fixtures-screen rule): a club without a
  // label renders its raw id, never an invented name.
  const club = player.clubName ?? player.clubId;
  const opponent = player.opponentName ?? player.opponentClubId;
  const venue = player.isHome
    ? t("weekend.homeShort", { defaultValue: "H" })
    : t("weekend.awayShort", { defaultValue: "A" });

  // Old-backend tolerance: frontend CI ships on push while the Convex deploy
  // is manual (DEPLOYMENT topology), so a pre-EYE-TEST-CONTEXT payload can
  // reach this card. Without `minutes` there is no memory to locate — render
  // the pre-context card (raw scoreline) instead of a page of undefineds.
  // (The widened cast keeps TS from narrowing `player` to never: the CURRENT
  // type always carries minutes; only an old backend's payload does not.)
  if ((player as { minutes?: number }).minutes === undefined) {
    return (
      <NeoCard
        shadow="lg"
        className="flex-1 min-w-0 text-center py-4 px-2.5 disabled:opacity-60"
        onClick={busy ? undefined : onPick}
      >
        <NeoBadge color="muted" size="sm">
          {player.position}
        </NeoBadge>
        <p className="font-heading font-bold text-lg leading-tight mt-2">{player.name}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {fixture.homeGoals === null || fixture.awayGoals === null
            ? t("weekend.fullTime", { defaultValue: "full time" })
            : `${fixture.homeGoals}–${fixture.awayGoals}`}
        </p>
      </NeoCard>
    );
  }

  return (
    <NeoCard
      shadow="lg"
      className="flex-1 min-w-0 text-center py-4 px-2.5 disabled:opacity-60"
      onClick={busy ? undefined : onPick}
    >
      <NeoBadge color="muted" size="sm">
        {player.position}
      </NeoBadge>
      <p className="font-heading font-bold text-lg leading-tight mt-2">{player.name}</p>
      {/* where the memory happened: club, opponent, venue */}
      <p
        // clamp-3, not the fixtures screen's clamp-2: the venue letter closes
        // the line and is a fact the card must keep — the longest real pair
        // ("Borussia Mönchengladbach · vs Bayern München (A)") needs three
        // lines at half-viewport width before it would truncate.
        className="text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-3 break-words"
        data-testid="vote-card-match"
      >
        {t("weekend.voteMatchLine", {
          defaultValue: "{{club}} · vs {{opponent}} ({{venue}})",
          club,
          opponent,
          venue,
        })}
      </p>
      <p
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5"
        data-testid="vote-card-league"
      >
        {leagueName(fixture.leagueId)} · {kickoffDayTag(fixture.kickoffAt, i18n.language)}
      </p>
      {/* the score from his side — his team's number is the marked one */}
      <p className="font-mono font-bold tabular-nums mt-1.5" data-testid="vote-card-score">
        {score === null ? (
          <span className="text-[11px] text-muted-foreground font-normal">
            {t("weekend.fullTime", { defaultValue: "full time" })}
          </span>
        ) : (
          <>
            <span className="border-b-2 border-primary" data-testid="vote-card-score-us">
              {score.us}
            </span>
            <span className="text-muted-foreground">–{score.them}</span>
          </>
        )}
      </p>
      <p
        className="font-mono text-[11px] text-muted-foreground mt-0.5"
        data-testid="vote-card-minutes"
      >
        {t("weekend.minutesPlayed", {
          defaultValue: "{{minutes}}'",
          minutes: player.minutes,
        })}
      </p>
      {events.length > 0 && (
        <p className="text-xs mt-1 leading-none" data-testid="vote-card-events">
          {events.map((event) => (
            <span key={event.kind} className="mx-0.5 whitespace-nowrap">
              {EVENT_GLYPHS[event.kind]}
              {event.count > 1 && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  ×{event.count}
                </span>
              )}
            </span>
          ))}
        </p>
      )}
    </NeoCard>
  );
}

export function VoteStackView({
  serve,
  onVote,
  busy,
}: {
  serve: ServeResult;
  onVote: (choice: "a" | "b" | "skip") => void;
  busy: boolean;
}) {
  const { t } = useTranslation();

  if (serve.status === "closed") {
    return (
      <NeoCard className="text-center py-6">
        <p className="font-heading font-bold">
          {t("weekend.votingClosed", { defaultValue: "Voting is closed right now." })}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("weekend.votingClosedBody", {
            defaultValue:
              "The stack opens as matches finish and closes when the weekend settles.",
          })}
        </p>
      </NeoCard>
    );
  }
  if (serve.status === "cap_reached") {
    return (
      <NeoCard color="success" className="text-center py-6">
        <p className="font-heading font-bold">
          {t("weekend.voteCap", { defaultValue: "That's this weekend's limit." })}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("weekend.voteCapBody", {
            defaultValue: "{{served}} pairs served — thank you for the eyes.",
            served: serve.served,
          })}
        </p>
      </NeoCard>
    );
  }
  if (serve.status === "exhausted") {
    return (
      <NeoCard className="text-center py-6">
        <p className="font-heading font-bold">
          {t("weekend.voteExhausted", { defaultValue: "No more pairs for now." })}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("weekend.voteExhaustedBody", {
            defaultValue: "Come back after the next matches finish.",
          })}
        </p>
      </NeoCard>
    );
  }

  const [a, b] = serve.players;
  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading font-bold text-center text-lg">
        {t("weekend.whoBetter", { defaultValue: "Who had the better game?" })}
      </p>
      <div className="flex gap-3">
        <PairCard player={a} busy={busy} onPick={() => onVote("a")} />
        <PairCard player={b} busy={busy} onPick={() => onVote("b")} />
      </div>
      <NeoButton variant="ghost" size="full" disabled={busy} onClick={() => onVote("skip")}>
        <EyeOff size={14} strokeWidth={3} className="mr-1.5" />
        {t("weekend.didntWatch", { defaultValue: "Didn't watch" })}
      </NeoButton>
      <p className="text-[11px] text-muted-foreground text-center font-mono">
        {t("weekend.pairCount", {
          defaultValue: "{{served}} / {{cap}} pairs this weekend",
          served: serve.served,
          cap: serve.cap,
        })}
      </p>
    </div>
  );
}

type Gate = "checking" | "closed" | "open";

export default function VoteScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const convex = useConvex();
  const [gate, setGate] = useState<Gate>("checking");
  const [serve, setServe] = useState<ServeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const serveMutation = useMutation(api.fantasyCrowdVoting.servePair);
  const castMutation = useMutation(api.fantasyCrowdVoting.castVote);
  const servedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    convex
      .query(api.fantasyCrowdVoting.getVotingStatus, {})
      .then((status) => {
        if (!cancelled) setGate(status === null ? "closed" : "open");
      })
      .catch(() => {
        if (!cancelled) setGate("closed");
      });
    return () => {
      cancelled = true;
    };
  }, [convex]);

  const serveNext = useCallback(() => {
    setBusy(true);
    serveMutation({})
      .then(setServe)
      .catch((e: unknown) => {
        toast.error(
          friendlyError(e, t("weekend.serveFailed", { defaultValue: "Could not deal a pair." })),
        );
        setServe({ status: "closed" });
      })
      .finally(() => setBusy(false));
  }, [serveMutation, t]);

  useEffect(() => {
    if (gate === "open" && !servedOnce.current) {
      servedOnce.current = true;
      serveNext();
    }
  }, [gate, serveNext]);

  const onVote = (choice: "a" | "b" | "skip") => {
    if (serve === null || serve.status !== "served" || busy) return;
    setBusy(true);
    castMutation({ pairId: serve.pairId, choice })
      .then(() => serveNext())
      .catch((e: unknown) => {
        toast.error(
          friendlyError(e, t("weekend.voteFailed", { defaultValue: "That vote didn't land." })),
        );
        setBusy(false);
      });
  };

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.voteTitle", { defaultValue: "The eye test" })}
      back
      // U2: back walks UP the flow — this door's parent is the hub, not the
      // compete grid two levels above it.
      onBack={() => navigate(SHELL_ROUTES.weekend)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full">
        {gate === "checking" || (gate === "open" && serve === null) ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : gate === "closed" ? (
          <NeoCard className="text-center py-6">
            <p className="font-heading font-bold">
              {t("weekend.noBoard", { defaultValue: "No board is open right now." })}
            </p>
          </NeoCard>
        ) : (
          serve !== null && <VoteStackView serve={serve} busy={busy} onVote={onVote} />
        )}
      </div>
    </ShellLayout>
  );
}
