/**
 * EYE-TEST-CONTEXT / EYE-TEST-TEN — DEV-ONLY visual harness for the vote
 * session (the DrawMockHarness precedent): renders each of the session's
 * surfaces from fabricated payloads — no Convex, no auth — so the 380px fit
 * checks and screenshots (e2e/voteCardQa.spec.ts, e2e/voteTenQa.spec.ts)
 * never depend on DEV having finished fixtures inside a live voting window.
 *
 * `?view=` selects the surface:
 *   stack  (default) — a pair SPANNING TWO FIXTURES: two per-card
 *                      "didn't see him", no combined button
 *   same             — both cards from ONE fixture: per-card buttons PLUS the
 *                      combined "didn't see this game"
 *   picker           — the fixture picker, first screen of a session
 *   reveal           — the post-vote consensus reveal (majority)
 *   reveal-minority  — the same reveal from the smaller share
 *   reveal-first     — below the sample threshold: no percentage at all
 *   done             — Today's Ten done-state + the quiet "keep going"
 *   undo             — the five-second "Retired … · Undo" toast (EYE-TEST-SERVE),
 *                      fired by a button so it can be caught mid-life
 *
 * The stack payloads deliberately stress the layout: long club names, a
 * two-goal-one-assist line against a red-card line, one home and one away
 * orientation. Production builds redirect home.
 */
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { CROWD_UNDO_WINDOW_MS } from "../../../../convex/lib/fantasyCrowd";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { NeoButton } from "@/components/neo/NeoButton";
import {
  DoneView,
  FixturePickerView,
  RevealView,
  VoteStackView,
  showUndoToast,
  type ConsensusReveal,
  type PickerFixture,
  type ServedPair,
  type UndoOffer,
} from "./VoteScreen";

const SATURDAY_KICKOFF = Date.UTC(2026, 7, 15, 16, 30); // Sat 2026-08-15
const SUNDAY_KICKOFF = Date.UTC(2026, 7, 16, 19, 0); // Sun 2026-08-16

const PLAYER_A = {
  playerId: "harness-a",
  fixtureId: "harness-fixture-1",
  name: "Mikel Oyarzabal",
  position: "ATT",
  clubId: "club-rso",
  clubName: "Real Sociedad",
  opponentClubId: "club-ath",
  opponentName: "Athletic Club",
  isHome: true,
  minutes: 90,
  goals: 2,
  assists: 1,
  redCard: false,
  fixture: {
    leagueId: 140,
    kickoffAt: SATURDAY_KICKOFF,
    homeClubId: "club-rso",
    awayClubId: "club-ath",
    homeGoals: 3,
    awayGoals: 1,
  },
};

const PLAYER_B = {
  playerId: "harness-b",
  fixtureId: "harness-fixture-2",
  name: "Julian Weigl",
  position: "MID",
  clubId: "club-bmg",
  clubName: "Borussia Mönchengladbach",
  opponentClubId: "club-fcb",
  opponentName: "Bayern München",
  isHome: false,
  minutes: 78,
  goals: 0,
  assists: 0,
  redCard: true,
  fixture: {
    leagueId: 78,
    kickoffAt: SUNDAY_KICKOFF,
    homeClubId: "club-fcb",
    awayClubId: "club-bmg",
    homeGoals: 4,
    awayGoals: 0,
  },
};

/** The cross-fixture pair — the case the per-card cascade exists for. */
const HARNESS_PAIR = {
  status: "served",
  pairId: "harness-pair" as ServedPair["pairId"],
  served: 3,
  cap: 300,
  progress: { voted: 3, goal: 10, complete: false },
  players: [PLAYER_A, PLAYER_B],
} as unknown as ServedPair;

/** Both cards from one game — the only case a combined button is honest. */
const HARNESS_PAIR_SAME_FIXTURE = {
  ...HARNESS_PAIR,
  players: [PLAYER_A, { ...PLAYER_B, fixtureId: PLAYER_A.fixtureId }],
} as unknown as ServedPair;

const HARNESS_FIXTURES: PickerFixture[] = [
  {
    fixtureId: "harness-fixture-1",
    leagueId: 140,
    kickoffAt: SATURDAY_KICKOFF,
    status: "finished",
    homeClubId: "club-rso",
    awayClubId: "club-ath",
    homeName: "Real Sociedad",
    awayName: "Athletic Club",
    homeGoals: 3,
    awayGoals: 1,
    scored: true,
  },
  {
    fixtureId: "harness-fixture-2",
    leagueId: 78,
    kickoffAt: SUNDAY_KICKOFF,
    status: "finished",
    homeClubId: "club-fcb",
    awayClubId: "club-bmg",
    homeName: "Bayern München",
    awayName: "Borussia Mönchengladbach",
    homeGoals: 4,
    awayGoals: 0,
    scored: true,
  },
  {
    fixtureId: "harness-fixture-3",
    leagueId: 39,
    kickoffAt: SUNDAY_KICKOFF + 2 * 60 * 60 * 1000,
    status: "live",
    homeClubId: "club-nfo",
    awayClubId: "club-bha",
    homeName: "Nottingham Forest",
    awayName: "Brighton & Hove Albion",
    homeGoals: null,
    awayGoals: null,
    scored: false,
  },
] as unknown as PickerFixture[];

const REVEAL_MAJORITY = {
  total: 41,
  withYou: 28,
  percent: 68,
  lowSample: false,
  majority: true,
} as ConsensusReveal;

const REVEAL_MINORITY = {
  total: 41,
  withYou: 13,
  percent: 32,
  lowSample: false,
  majority: false,
} as ConsensusReveal;

const REVEAL_FIRST = {
  total: 2,
  withYou: 1,
  percent: null,
  lowSample: true,
  majority: false,
} as ConsensusReveal;

/** EYE-TEST-SERVE: the take-back offer as the server sends it, minus the
 *  stamp — `expiresAt` is taken at fire time so the toast lives its full
 *  window however long the harness has been open. */
const HARNESS_UNDO = {
  pairId: "harness-pair",
  fixtures: [{ fixtureId: "harness-fixture-1", label: "Real Sociedad — Athletic Club" }],
} as unknown as UndoOffer;

export default function VoteCardHarness() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [picked, setPicked] = useState<Set<string>>(new Set(["harness-fixture-1"]));
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  const view = params.get("view") ?? "stack";

  const body =
    view === "picker" ? (
      <FixturePickerView
        fixtures={HARNESS_FIXTURES}
        selected={picked}
        // The third row is retired by an earlier didn't-see: shown as
        // answered-for, offering no tap the server would refuse.
        unseen={new Set(["harness-fixture-3"])}
        busy={false}
        editing={false}
        onToggle={(fixtureId) =>
          setPicked((current) => {
            const next = new Set(current);
            if (next.has(fixtureId)) next.delete(fixtureId);
            else next.add(fixtureId);
            return next;
          })
        }
        onContinue={() => undefined}
      />
    ) : view === "reveal" ? (
      <RevealView reveal={REVEAL_MAJORITY} />
    ) : view === "reveal-minority" ? (
      <RevealView reveal={REVEAL_MINORITY} />
    ) : view === "reveal-first" ? (
      <RevealView reveal={REVEAL_FIRST} />
    ) : view === "undo" ? (
      // The toast is the surface here, not the page: the stack behind it is
      // the pair the voter has already moved on to when the offer appears.
      <div className="flex flex-col gap-3">
        <NeoButton
          size="full"
          data-testid="harness-undo-fire"
          onClick={() =>
            showUndoToast(
              { ...HARNESS_UNDO, expiresAt: Date.now() + CROWD_UNDO_WINDOW_MS },
              t,
              () => Promise.resolve(),
            )
          }
        >
          Fire the undo toast
        </NeoButton>
        <VoteStackView
          serve={HARNESS_PAIR}
          busy={false}
          onVote={() => undefined}
          onEditPicker={() => undefined}
        />
      </div>
    ) : view === "done" ? (
      <DoneView
        progress={{ voted: 10, goal: 10 }}
        exhausted={false}
        onKeepGoing={() => undefined}
      />
    ) : (
      <VoteStackView
        serve={view === "same" ? HARNESS_PAIR_SAME_FIXTURE : HARNESS_PAIR}
        busy={false}
        onVote={() => undefined}
        onEditPicker={() => undefined}
      />
    );

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.voteTitle", { defaultValue: "The eye test" })}
      back
      onBack={() => navigate(SHELL_ROUTES.weekend)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full">{body}</div>
    </ShellLayout>
  );
}
