/**
 * THE WEEKEND — crowd voting stack (FW-LAUNCH O2, CROWD_VOTING_SPEC v1.0.1;
 * EYE-TEST-TEN).
 *
 * A session is now a shape rather than a treadmill:
 *
 *   1. THE PICKER — "which games did you catch this weekend?" Serving draws
 *      pairs only from what he picked, so the stack stops asking about games
 *      he never saw. Re-editable from the stack ("+ add games").
 *   2. THE STACK — two player cards, one fixture context each, one tap:
 *      left, right, or "didn't see him" PER CARD (a pair can span two
 *      fixtures; one combined button only when both cards share one). A
 *      didn't-see cascades server-side: that game is retired for the weekend.
 *   3. TODAY'S TEN — the session's goal, "3 of 10", with a real done-state.
 *      The 300-pair gameweek ceiling still exists server-side; it is no
 *      longer a thing the voter is asked to fill.
 *   4. THE REVEAL — after each vote, where the crowd landed, with a beat
 *      before the next pair. POST-VOTE ONLY, by ruling (docs/DECISIONS.md):
 *      the card never argues, and that extends to never anchoring the ballot.
 *
 * Pairs are SERVER-served — this screen never chooses who to compare, it only
 * renders what servePair returned and reports the tap.
 *
 * Availability gating follows BudgetSquadScreen: imperative first query,
 * fail closed and silent to the quiet card.
 *
 * Views are exported for the contract suite; the default export is the data
 * container (house pattern).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { Check, EyeOff, Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";
import { leagueName } from "@/lib/leagueNames";
import { groupFixturesByDay } from "@/lib/weekendFixtures";
import {
  kickoffDayTag,
  localDayStart,
  orientedScore,
  revealTone,
  undoFixtureLine,
  undoToastMs,
  voteCardEvents,
  type VoteCardEvent,
} from "@/lib/weekendVoteCard";

export type VotingStatus = NonNullable<
  FunctionReturnType<typeof api.fantasyCrowdVoting.getVotingStatus>
>;
export type ServeResult = FunctionReturnType<typeof api.fantasyCrowdVoting.servePair>;
export type ServedPair = Extract<ServeResult, { status: "served" }>;
export type CastVoteResult = FunctionReturnType<typeof api.fantasyCrowdVoting.castVote>;
export type ConsensusReveal = NonNullable<CastVoteResult["reveal"]>;
/** EYE-TEST-SERVE: the five-second take-back the server offers after a
 *  didn't-see that actually retired a game. */
export type UndoOffer = NonNullable<CastVoteResult["undo"]>;
export type WeekendFixtures = NonNullable<
  FunctionReturnType<typeof api.fantasyMarket.getWeekendFixtures>
>;
export type PickerFixture = WeekendFixtures["fixtures"][number];

/** The tap, as the server names it. `skip` is the combined didn't-see, sent
 *  only when both cards share a fixture (and by a pre-EYE-TEST-TEN client). */
export type VoteChoice = "a" | "b" | "unseen_a" | "unseen_b" | "skip";

/** The beat between the reveal and the next pair. Long enough to read one
 *  short sentence, short enough that the stack still feels like a stack. */
export const REVEAL_BEAT_MS = 1100;

/** EYE-TEST-CONTEXT: factual events only, rendered as glyphs — a goal, an
 *  assist, a red. Yellows and anything derived are excluded by ruling. */
const EVENT_GLYPHS: Record<VoteCardEvent["kind"], string> = {
  goal: "⚽",
  assist: "🅰️",
  red: "🟥",
};

// ── the fixture picker ──

export function FixturePickerView({
  fixtures,
  selected,
  unseen,
  onToggle,
  onContinue,
  busy,
  editing,
}: {
  fixtures: readonly PickerFixture[];
  selected: ReadonlySet<string>;
  /** Retired by a didn't-see. Shown as already answered-for, never as an
   *  unpicked box — the server refuses to re-add them, so offering a tap that
   *  silently does nothing would be the worse lie. */
  unseen?: ReadonlySet<string>;
  onToggle: (fixtureId: string) => void;
  onContinue: () => void;
  busy: boolean;
  editing: boolean;
}) {
  const { t, i18n } = useTranslation();
  const days = useMemo(() => groupFixturesByDay(fixtures), [fixtures]);

  return (
    <div className="flex flex-col gap-4" data-testid="fixture-picker">
      <div className="text-center">
        <p className="font-heading font-bold text-lg leading-tight">
          {t("weekend.pickerTitle", {
            defaultValue: "Which games did you catch this weekend?",
          })}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("weekend.pickerBody", {
            defaultValue: "We'll only ask about players you actually saw.",
          })}
        </p>
      </div>

      {days.map((day) => (
        <div key={day.dayStart} className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {new Date(day.dayStart).toLocaleDateString(i18n.language, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </p>
          {day.fixtures.map((fixture) => {
            const on = selected.has(fixture.fixtureId);
            const retired = unseen?.has(fixture.fixtureId) === true;
            // Degraded loudly, never invented (the fixtures-screen rule).
            const home = fixture.homeName ?? fixture.homeClubId;
            const away = fixture.awayName ?? fixture.awayClubId;
            const tail = retired
              ? ` · ${t("weekend.pickerRetired", { defaultValue: "you didn't see this one" })}`
              : fixture.status === "finished"
                ? ""
                : ` · ${t("weekend.pickerNotFinished", { defaultValue: "not finished" })}`;
            const body = (
              <>
                <span
                  className={`shrink-0 w-5 h-5 rounded-[4px] neo-border flex items-center justify-center ${
                    on ? "bg-background text-foreground" : ""
                  } ${retired ? "opacity-40" : ""}`}
                  aria-hidden="true"
                >
                  {on && <Check size={13} strokeWidth={4} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading font-bold text-sm leading-tight break-words">
                    {home} — {away}
                  </span>
                  <span
                    className={`block font-mono text-[10px] uppercase tracking-[0.1em] ${
                      on ? "opacity-80" : "text-muted-foreground"
                    }`}
                  >
                    {leagueName(fixture.leagueId)}
                    {tail}
                  </span>
                </span>
              </>
            );
            // A retired game is a statement, not a control: it renders as a
            // plain row with no onClick, so NeoCard stays a div and no tap is
            // offered that the server would refuse.
            return retired ? (
              <NeoCard
                key={fixture.fixtureId}
                className="py-2.5 px-3 flex items-center gap-2.5 opacity-55"
                data-testid="picker-fixture"
                data-selected="0"
                data-retired="1"
              >
                {body}
              </NeoCard>
            ) : (
              <NeoCard
                key={fixture.fixtureId}
                shadow={on ? "lg" : "default"}
                color={on ? "primary" : "default"}
                className="py-2.5 px-3 flex items-center gap-2.5"
                aria-pressed={on}
                data-testid="picker-fixture"
                data-selected={on ? "1" : "0"}
                data-retired="0"
                onClick={busy ? () => undefined : () => onToggle(fixture.fixtureId)}
              >
                {body}
              </NeoCard>
            );
          })}
        </div>
      ))}

      <NeoButton
        size="full"
        variant={selected.size === 0 ? "outline" : "primary"}
        disabled={busy}
        data-testid="picker-continue"
        onClick={onContinue}
      >
        {selected.size === 0
          ? t("weekend.pickerNone", { defaultValue: "I didn't watch any" })
          : editing
            ? t("weekend.pickerSave", { defaultValue: "Save" })
            : t("weekend.pickerContinue", { defaultValue: "Continue" })}
      </NeoButton>
    </div>
  );
}

// ── the undo toast (EYE-TEST-SERVE) ──

/**
 * The five-second take-back for a didn't-see, as a toast — "Retired Real
 * Sociedad — Athletic Club · Undo".
 *
 * A toast rather than an inline control on purpose: the stack has already
 * moved to the next pair by the time this appears, and an undo that stopped
 * the session to ask would cost more than the mis-tap it fixes. It lives
 * exactly as long as the server's offer (undoToastMs) — never a fresh five
 * seconds — so an Undo button is never on screen after the server has started
 * refusing it, and a toast whose offer died in flight is not shown at all.
 *
 * What returns is the GAME, not the pair: the copy says "retired", never
 * "vote", because the pair stays answered either way.
 */
export function showUndoToast(
  undo: UndoOffer,
  t: TFunction,
  run: (pairId: UndoOffer["pairId"]) => Promise<unknown>,
): void {
  const duration = undoToastMs(undo.expiresAt);
  if (duration <= 0) return;
  const toastId = toast(
    t("weekend.undoRetired", {
      defaultValue: "Retired {{fixture}}",
      fixture: undoFixtureLine(undo.fixtures),
    }),
    {
      duration,
      action: {
        label: t("weekend.undoAction", { defaultValue: "Undo" }),
        onClick: () => {
          // Spend the affordance immediately. Sonner does not dismiss an
          // action toast automatically, so without this the same visible Undo
          // could be tapped again while the first mutation was already in
          // flight (the server refused it, but the UI still offered it).
          toast.dismiss(toastId);
          void run(undo.pairId)
            .then(() =>
              toast.success(
                t("weekend.undoDone", { defaultValue: "Back on your list." }),
              ),
            )
            .catch((e: unknown) =>
              toast.error(
                friendlyError(
                  e,
                  t("weekend.undoFailed", {
                    defaultValue: "Too late — that game stays retired.",
                  }),
                ),
              ),
            );
        },
      },
    },
  );
}

// ── the reveal ──

export function RevealView({ reveal }: { reveal: ConsensusReveal }) {
  const { t } = useTranslation();
  const tone = revealTone(reveal);
  const percent = reveal.percent ?? 0;

  return (
    <NeoCard
      color={tone === "with" ? "success" : "default"}
      className="text-center py-4"
      data-testid="vote-reveal"
      data-tone={tone}
    >
      <p className="font-heading font-bold" data-testid="vote-reveal-line">
        {tone === "first"
          ? t("weekend.revealFirst", {
              defaultValue: "You're one of the first on this one.",
            })
          : tone === "with"
            ? t("weekend.revealWith", {
                defaultValue: "{{percent}}% went with you",
                percent,
              })
            : t("weekend.revealAgainst", {
                defaultValue: "You're with the {{percent}}%",
                percent,
              })}
      </p>
      {tone !== "first" && (
        <span
          className="mt-2 block h-2 w-full neo-border rounded-full overflow-hidden bg-background"
          aria-hidden="true"
        >
          <span
            className="block h-full bg-primary"
            style={{ width: `${percent}%` }}
            data-testid="vote-reveal-bar"
          />
        </span>
      )}
    </NeoCard>
  );
}

// ── the done-state ──

export function DoneView({
  progress,
  exhausted,
  onKeepGoing,
}: {
  progress: { voted: number; goal: number };
  exhausted: boolean;
  onKeepGoing: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3" data-testid="vote-done">
      <NeoCard color="success" className="text-center py-6">
        <span
          className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full neo-border bg-background text-foreground"
          aria-hidden="true"
        >
          <Check size={20} strokeWidth={4} />
        </span>
        <p className="font-heading font-bold text-lg leading-tight">
          {exhausted
            ? t("weekend.doneExhausted", {
                defaultValue: "That's every game you picked.",
              })
            : t("weekend.doneTen", { defaultValue: "That's today's ten." })}
        </p>
        <p className="text-sm mt-1">
          {t("weekend.doneThanks", { defaultValue: "The crowd thanks you." })}
        </p>
      </NeoCard>
      {!exhausted && (
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline underline-offset-4 mx-auto"
          data-testid="vote-keep-going"
          onClick={onKeepGoing}
        >
          {t("weekend.doneKeepGoing", {
            defaultValue: "Keep going — extra pairs don't count, they just help.",
          })}
        </button>
      )}
      <p className="sr-only" data-testid="vote-done-progress">
        {progress.voted}/{progress.goal}
      </p>
    </div>
  );
}

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
  onEditPicker,
  busy,
}: {
  serve: ServeResult;
  onVote: (choice: VoteChoice) => void;
  onEditPicker?: () => void;
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
  // The picker's own empty answer, and the state a full cascade lands in:
  // every game he picked has been retired by a didn't-see. Friendly, never an
  // error — "didn't watch anything this weekend" is a real answer.
  if (serve.status === "no_fixtures") {
    return (
      <div className="flex flex-col gap-3" data-testid="vote-no-fixtures">
        <NeoCard className="text-center py-6">
          <p className="font-heading font-bold">
            {t("weekend.voteNoGames", { defaultValue: "Nothing to judge, then." })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("weekend.voteNoGamesBody", {
              defaultValue:
                "No games picked this weekend — that's a fine answer. Add one whenever you catch it.",
            })}
          </p>
        </NeoCard>
        {onEditPicker !== undefined && (
          <NeoButton variant="outline" size="full" disabled={busy} onClick={onEditPicker}>
            <Plus size={14} strokeWidth={3} className="mr-1.5" />
            {t("weekend.addGames", { defaultValue: "Add games" })}
          </NeoButton>
        )}
      </div>
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
      <div className="flex flex-col gap-3">
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
        {onEditPicker !== undefined && (
          <NeoButton variant="outline" size="full" disabled={busy} onClick={onEditPicker}>
            <Plus size={14} strokeWidth={3} className="mr-1.5" />
            {t("weekend.addGames", { defaultValue: "Add games" })}
          </NeoButton>
        )}
      </div>
    );
  }
  if (serve.status === "needs_picker") {
    // The container routes this to the picker; if it is ever rendered it means
    // the picker could not load — say so quietly rather than showing nothing.
    return (
      <NeoCard className="text-center py-6">
        <p className="font-heading font-bold">
          {t("weekend.voteNoBoardShort", { defaultValue: "No board is open right now." })}
        </p>
      </NeoCard>
    );
  }

  const [a, b] = serve.players;
  // Old-backend tolerance (DEPLOYMENT topology: frontend CI ships on push,
  // Convex is manual). A pre-EYE-TEST-TEN payload carries no fixtureId, so the
  // per-card cascade has nothing to retire — fall back to the single combined
  // "Didn't watch" that backend still understands, rather than sending it an
  // `unseen_*` choice its validator will reject.
  const cascadeReady = a.fixtureId !== undefined && b.fixtureId !== undefined;
  const sameFixture = cascadeReady && a.fixtureId === b.fixtureId;
  const progress = (serve as { progress?: { voted: number; goal: number } }).progress;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-heading font-bold text-center text-lg">
        {t("weekend.whoBetter", { defaultValue: "Who had the better game?" })}
      </p>
      <div className="flex gap-3">
        <PairCard player={a} busy={busy} onPick={() => onVote("a")} />
        <PairCard player={b} busy={busy} onPick={() => onVote("b")} />
      </div>

      {cascadeReady ? (
        <>
          {/* Per CARD, because a pair can span two fixtures: saying you missed
              one man must not retire the other man's game. */}
          <div className="flex gap-3">
            {(["a", "b"] as const).map((side) => (
              <NeoButton
                key={side}
                variant="ghost"
                size="sm"
                className="flex-1 min-w-0 text-[11px] normal-case tracking-normal"
                disabled={busy}
                data-testid={`didnt-see-${side}`}
                onClick={() => onVote(side === "a" ? "unseen_a" : "unseen_b")}
              >
                <EyeOff size={13} strokeWidth={3} className="mr-1" />
                <span className="truncate">
                  {t("weekend.didntSeeHim", { defaultValue: "Didn't see him" })}
                </span>
              </NeoButton>
            ))}
          </div>
          {sameFixture && (
            <NeoButton
              variant="ghost"
              size="full"
              className="py-2 text-sm"
              disabled={busy}
              data-testid="didnt-see-both"
              onClick={() => onVote("skip")}
            >
              <EyeOff size={14} strokeWidth={3} className="mr-1.5" />
              {t("weekend.didntSeeGame", { defaultValue: "Didn't see this game" })}
            </NeoButton>
          )}
        </>
      ) : (
        <NeoButton variant="ghost" size="full" disabled={busy} onClick={() => onVote("skip")}>
          <EyeOff size={14} strokeWidth={3} className="mr-1.5" />
          {t("weekend.didntWatch", { defaultValue: "Didn't watch" })}
        </NeoButton>
      )}

      <div className="flex items-center justify-center gap-3">
        {progress !== undefined && (
          <p
            className="text-[11px] text-muted-foreground font-mono"
            data-testid="vote-progress"
          >
            {t("weekend.tenProgress", {
              defaultValue: "{{voted}} of {{goal}}",
              voted: Math.min(progress.voted, progress.goal),
              goal: progress.goal,
            })}
          </p>
        )}
        {onEditPicker !== undefined && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline underline-offset-4"
            data-testid="vote-add-games"
            onClick={onEditPicker}
          >
            {t("weekend.addGamesShort", { defaultValue: "+ add games" })}
          </button>
        )}
      </div>
    </div>
  );
}

type Gate = "checking" | "closed" | "open";
type Phase = "stack" | "picker" | "done";

export default function VoteScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const convex = useConvex();
  const [gate, setGate] = useState<Gate>("checking");
  const [phase, setPhase] = useState<Phase>("stack");
  const [serve, setServe] = useState<ServeResult | null>(null);
  const [reveal, setReveal] = useState<ConsensusReveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [fixtures, setFixtures] = useState<readonly PickerFixture[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unseen, setUnseen] = useState<Set<string>>(new Set());
  const [doneState, setDoneState] = useState<{
    progress: { voted: number; goal: number };
    exhausted: boolean;
  } | null>(null);
  const serveMutation = useMutation(api.fantasyCrowdVoting.servePair);
  const castMutation = useMutation(api.fantasyCrowdVoting.castVote);
  const watchedMutation = useMutation(api.fantasyCrowdVoting.setWatchedFixtures);
  const undoMutation = useMutation(api.fantasyCrowdVoting.undoUnseen);
  const servedOnce = useRef(false);
  // A volunteer past today's ten: the done card fires once, and afterwards the
  // stack keeps serving without counting (uncounted framing, LOCKED copy).
  const keepGoing = useRef(false);
  const beat = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (beat.current !== null) clearTimeout(beat.current);
    },
    [],
  );

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

  /** Load the GW's fixtures plus the picker's current answer, then show it. */
  const openPicker = useCallback(() => {
    setBusy(true);
    setPhase("picker");
    Promise.all([
      convex.query(api.fantasyMarket.getWeekendFixtures, {}),
      convex.query(api.fantasyCrowdVoting.getWatchedFixtures, {}).catch(() => null),
    ])
      .then(([payload, watched]) => {
        setFixtures(payload?.fixtures ?? []);
        setSelected(new Set(watched?.selected ?? []));
        setUnseen(new Set(watched?.unseen ?? []));
      })
      .catch(() => {
        setFixtures([]);
      })
      .finally(() => setBusy(false));
  }, [convex]);

  const serveNext = useCallback(() => {
    setBusy(true);
    setReveal(null);
    serveMutation({ dayStartAt: localDayStart() })
      .then((next) => {
        if (next.status === "needs_picker") {
          openPicker();
          return;
        }
        // Exhaustion IS a done-state once the voter has judged something
        // today: a two-game picker can never reach ten, and telling him "no
        // more pairs" would read as a failure rather than a finish.
        if (
          next.status === "exhausted" &&
          next.progress.voted > 0 &&
          !keepGoing.current
        ) {
          setDoneState({ progress: next.progress, exhausted: true });
          setPhase("done");
          setServe(next);
          return;
        }
        setServe(next);
        setPhase("stack");
      })
      .catch((e: unknown) => {
        toast.error(
          friendlyError(e, t("weekend.serveFailed", { defaultValue: "Could not deal a pair." })),
        );
        setServe({ status: "closed" });
        setPhase("stack");
      })
      .finally(() => setBusy(false));
  }, [openPicker, serveMutation, t]);

  useEffect(() => {
    if (gate === "open" && !servedOnce.current) {
      servedOnce.current = true;
      serveNext();
    }
  }, [gate, serveNext]);

  const savePicker = () => {
    setBusy(true);
    watchedMutation({ fixtureIds: [...selected] as Id<"fantasyFixtures">[] })
      .then(() => serveNext())
      .catch((e: unknown) => {
        toast.error(
          friendlyError(
            e,
            t("weekend.pickerFailed", { defaultValue: "Could not save your games." }),
          ),
        );
        setBusy(false);
      });
  };

  const onVote = (choice: VoteChoice) => {
    if (serve === null || serve.status !== "served" || busy) return;
    setBusy(true);
    castMutation({ pairId: serve.pairId, choice, dayStartAt: localDayStart() })
      .then((result) => {
        // A didn't-see that retired a game is offered back for five seconds.
        // Fired before the stack advances so the toast and the next pair
        // arrive together, and independent of it — an undo that failed to
        // show must never hold up the session.
        const undo = result?.undo ?? null;
        if (undo !== null) {
          showUndoToast(undo, t, (pairId) => undoMutation({ pairId }));
        }
        // A didn't-see gets NO reveal (it is not a vote) — straight to the
        // next pair, which the cascade has already narrowed server-side.
        const nextReveal = result?.reveal ?? null;
        const progress = result?.progress;
        const finished =
          progress !== undefined && progress.complete && !keepGoing.current;

        const advance = () => {
          if (finished) {
            setDoneState({ progress, exhausted: false });
            setPhase("done");
            setReveal(null);
            setBusy(false);
            return;
          }
          serveNext();
        };

        if (nextReveal === null) {
          advance();
          return;
        }
        setReveal(nextReveal);
        setBusy(true);
        beat.current = setTimeout(advance, REVEAL_BEAT_MS);
      })
      .catch((e: unknown) => {
        toast.error(
          friendlyError(e, t("weekend.voteFailed", { defaultValue: "That vote didn't land." })),
        );
        setBusy(false);
      });
  };

  const toggleFixture = (fixtureId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fixtureId)) next.delete(fixtureId);
      else next.add(fixtureId);
      return next;
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
        {gate === "checking" ||
        (gate === "open" && phase === "stack" && serve === null) ||
        (phase === "picker" && fixtures === null) ? (
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
        ) : phase === "picker" ? (
          <FixturePickerView
            fixtures={fixtures ?? []}
            selected={selected}
            unseen={unseen}
            busy={busy}
            editing={servedOnce.current && serve !== null}
            onToggle={toggleFixture}
            onContinue={savePicker}
          />
        ) : phase === "done" && doneState !== null ? (
          <DoneView
            progress={doneState.progress}
            exhausted={doneState.exhausted}
            onKeepGoing={() => {
              keepGoing.current = true;
              setDoneState(null);
              serveNext();
            }}
          />
        ) : reveal !== null ? (
          <RevealView reveal={reveal} />
        ) : (
          serve !== null && (
            <VoteStackView
              serve={serve}
              busy={busy}
              onVote={onVote}
              onEditPicker={openPicker}
            />
          )
        )}
      </div>
    </ShellLayout>
  );
}
