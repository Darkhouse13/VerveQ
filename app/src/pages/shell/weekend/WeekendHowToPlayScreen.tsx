/**
 * THE WEEKEND — How to Play (FW-EXPAND U3).
 *
 * A rules screen, not a spec mirror: every number below is stated in
 * BUDGET_MODE_SPEC v1.3.0, DRAFT_ROOM_SPEC v1.4.0, SCORING_SPEC v0.5.2,
 * CROWD_VOTING v1.2.0 or RECLAMATION_COURT v1.2.1 — nothing is invented
 * here, and anything the specs don't state is left unsaid. Public like the
 * hub (ShellGate only, no session guard): rules are for the curious too.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { NeoCard } from "@/components/neo/NeoCard";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

function Section({
  eyebrow,
  children,
  testId,
}: {
  eyebrow: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <NeoCard className="flex flex-col gap-2 p-4" data-testid={testId}>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
        {eyebrow}
      </p>
      {children}
    </NeoCard>
  );
}

function Rule({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <p className="text-sm leading-snug">
      {label && <span className="font-heading font-bold">{label} </span>}
      <span className="text-muted-foreground">{children}</span>
    </p>
  );
}

/* ── FW-RECEIPT P4: one small decorative figure per concept that genuinely
   needs a picture — the pitch shape, the chess clock, the ×0.75 dampener.
   Inline SVG on theme tokens only (currentColor + text-primary), static
   (reduced-motion safe by construction), aria-hidden: the adjacent rule
   text already says everything these draw. ── */

/** 1 GK · 4 DEF · 3 MID · 3 ATT as dots on a sideways mini-pitch. */
function PitchShapeFigure() {
  const { t } = useTranslation("shell");
  const band = (x: number, ys: number[]) =>
    ys.map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={5} />);
  return (
    <div aria-hidden className="text-muted-foreground mt-1" data-testid="htp-figure-shape">
      <svg viewBox="0 0 220 96" className="w-full max-w-[260px] h-auto" role="presentation">
        {/* pitch: outline, halfway line, goal boxes */}
        <g fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45">
          <rect x="2" y="2" width="216" height="76" rx="6" />
          <line x1="110" y1="2" x2="110" y2="78" />
          <rect x="2" y="22" width="18" height="36" />
          <rect x="200" y="22" width="18" height="36" />
        </g>
        <g className="text-primary" fill="currentColor">
          {band(26, [40])}
        </g>
        <g fill="currentColor">
          {band(68, [14, 31, 49, 66])}
          {band(124, [20, 40, 60])}
          {band(178, [20, 40, 60])}
        </g>
        <g
          fill="currentColor"
          opacity="0.7"
          fontSize="8"
          fontFamily="inherit"
          textAnchor="middle"
        >
          <text x="26" y="92">{t("weekend.roleGk", { defaultValue: "GK" })}</text>
          <text x="68" y="92">{t("weekend.roleDef", { defaultValue: "DEF" })}</text>
          <text x="124" y="92">{t("weekend.roleMid", { defaultValue: "MID" })}</text>
          <text x="178" y="92">{t("weekend.roleAtt", { defaultValue: "ATT" })}</text>
        </g>
      </svg>
    </div>
  );
}

/** A two-faced chess clock, one side live and pressed. */
function ChessClockFigure() {
  return (
    <div aria-hidden className="text-muted-foreground mt-1" data-testid="htp-figure-clock">
      <svg viewBox="0 0 200 74" className="w-full max-w-[200px] h-auto" role="presentation">
        {/* buttons: the live side's plunger sits pressed */}
        <g fill="currentColor" opacity="0.55">
          <rect x="48" y="10" width="22" height="10" rx="2" />
          <rect x="130" y="4" width="22" height="16" rx="2" />
        </g>
        {/* body */}
        <rect
          x="6"
          y="18"
          width="188"
          height="50"
          rx="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        {/* live face */}
        <g className="text-primary">
          <rect
            x="18"
            y="27"
            width="74"
            height="32"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <text
            x="55"
            y="49"
            fill="currentColor"
            fontSize="15"
            fontFamily="inherit"
            fontWeight="bold"
            textAnchor="middle"
          >
            0:30
          </text>
        </g>
        {/* waiting face */}
        <g opacity="0.6">
          <rect
            x="108"
            y="27"
            width="74"
            height="32"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <text
            x="145"
            y="49"
            fill="currentColor"
            fontSize="15"
            fontFamily="inherit"
            fontWeight="bold"
            textAnchor="middle"
          >
            0:30
          </text>
        </g>
      </svg>
    </div>
  );
}

/** The ×0.75 dampener: the honest-slot bar, then the mis-slot bar with the
 *  shaved quarter drawn as a dashed ghost. */
function MismatchFigure() {
  const { t } = useTranslation("shell");
  return (
    <div aria-hidden className="text-muted-foreground mt-1" data-testid="htp-figure-mismatch">
      <svg viewBox="0 0 220 64" className="w-full max-w-[260px] h-auto" role="presentation">
        <g fontSize="8" fontFamily="inherit" fill="currentColor" opacity="0.8">
          <text x="0" y="12">{t("weekend.slotMatchesVerdict", { defaultValue: "slot matches the verdict" })}</text>
          <text x="0" y="44">{t("weekend.slotMismatched", { defaultValue: "slot mismatched" })}</text>
        </g>
        {/* honest bar: full length */}
        <rect x="0" y="16" width="160" height="10" rx="2" className="text-primary" fill="currentColor" />
        {/* mis-slot bar: 75% solid, the lost quarter dashed */}
        <rect x="0" y="48" width="120" height="10" rx="2" fill="currentColor" opacity="0.6" />
        <rect
          x="121"
          y="48"
          width="39"
          height="10"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.5"
        />
        <text
          x="166"
          y="57"
          fontSize="9"
          fontFamily="inherit"
          fontWeight="bold"
          fill="currentColor"
        >
          ×0.75
        </text>
      </svg>
    </div>
  );
}

export default function WeekendHowToPlayScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("shell");

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.howToPlayTitle", { defaultValue: "How to play" })}
      subtitle={t("weekend.hubSubtitle", { defaultValue: "Eight leagues, one squad." })}
      back
      onBack={() => navigate(SHELL_ROUTES.weekend)}
      scroll
    >
      <div
        className="flex flex-col gap-3 md:max-w-md md:mx-auto md:w-full pb-6"
        data-testid="how-to-play"
      >
        <Section eyebrow={t("weekend.howWeekend", { defaultValue: "The Weekend" })} testId="htp-what">
          <Rule>{t("weekend.howWeekendBody", { defaultValue: "One squad for the whole European football weekend. Eight leagues, every fixture in the window counts, and the board resets fresh for each gameweek — weekend windows run Friday through Monday, midweek windows Tuesday through Thursday. No season-long grind." })}</Rule>
        </Section>

        <Section eyebrow={t("weekend.howModes", { defaultValue: "Two ways to play" })} testId="htp-modes">
          <Rule label={t("weekend.howBudgetLabel", { defaultValue: "Budget squad." })}>{t("weekend.howBudgetBody", { defaultValue: "Build your own 13 under a 91.0 budget. Prices run 4.0–13.0 in half-point steps, identical for everyone and fixed within the gameweek." })}</Rule>
          <Rule label={t("weekend.howCrewLabel", { defaultValue: "Crew draft." })}>{t("weekend.howCrewBody", { defaultValue: "2–8 friends, share-code to join, snake draft where every player can be owned once per room. Each drafter gets a chess-clock bank of 30 seconds per round — 390s spent freely across all 13 picks; an empty bank auto-picks the rest." })}</Rule>
          <ChessClockFigure />
        </Section>

        <Section eyebrow={t("weekend.howSquad", { defaultValue: "Your squad" })} testId="htp-squad">
          <Rule label={t("weekend.howThirteenLabel", { defaultValue: "Thirteen players:" })}>{t("weekend.howThirteenBody", { defaultValue: "an XI plus 2 finishers (your bench with intent)." })}</Rule>
          <Rule label={t("weekend.howShapeLabel", { defaultValue: "Any shape that adds up:" })}>{t("weekend.howShapeBody", { defaultValue: "exactly 1 GK, 3–5 DEF, 2–5 MID, 1–3 ATT in the XI. Finishers carry their own position, chosen freely." })}</Rule>
          <PitchShapeFigure />
          <Rule label={t("weekend.howClubCapLabel", { defaultValue: "Club cap:" })}>{t("weekend.howClubCapBody", { defaultValue: "at most 3 players from one club — 4 from your favorite club. Set it once from the Favorite club card on the Weekend home. It is permanent: it can never be changed, so choose the club you actually support." })}</Rule>
          <Rule label={t("weekend.howDuplicatesLabel", { defaultValue: "No duplicates:" })}>{t("weekend.howDuplicatesBody", { defaultValue: "a squad is 13 players, not 13 slots." })}</Rule>
        </Section>

        <Section eyebrow={t("weekend.howLocks", { defaultValue: "Locks" })} testId="htp-locks">
          <Rule>{t("weekend.howLocksBody", { defaultValue: "Each player locks individually at his own kickoff. Until then swap, re-slot and reshuffle freely; after it, that slot is frozen and the cost committed. A player whose match has already kicked off can't be swapped IN — no hindsight picks. Editing Sunday around a locked Saturday is the intended skill." })}</Rule>
        </Section>

        <Section eyebrow={t("weekend.howScoring", { defaultValue: "Scoring, in plain language" })} testId="htp-scoring">
          <Rule label={t("weekend.howShowingLabel", { defaultValue: "Showing up:" })}>{t("weekend.howShowingBody", { defaultValue: "+1 for any minutes played." })}</Rule>
          <Rule label={t("weekend.howGoalsLabel", { defaultValue: "Goals & assists:" })}>{t("weekend.howGoalsBody", { defaultValue: "goals pay +5 to +8 and assists +3 to +6 — the deeper the position, the more they pay (a GK goal is +8, a striker's +5)." })}</Rule>
          <Rule label={t("weekend.howTeamLabel", { defaultValue: "Team result:" })}>{t("weekend.howTeamBody", { defaultValue: "+1 for a win, +0.5 for a draw, if the player played 60+ minutes." })}</Rule>
          <Rule label={t("weekend.howDefendingLabel", { defaultValue: "Defending:" })}>{t("weekend.howDefendingBody", { defaultValue: "clean sheets pay GK +5 / DEF +4 / MID +1 (60+ minutes); GKs and DEFs lose 1 point per 2 goals conceded. Tackles, interceptions, blocks, saves, key passes and dribbles all score small amounts, each capped so volume can't be farmed. Sustained excellence pays via ramps: defenders' duel dominance and midfielders' pass completion each earn up to +2." })}</Rule>
          <Rule label={t("weekend.howCardsLabel", { defaultValue: "Cards:" })}>{t("weekend.howCardsBody", { defaultValue: "yellow −1, red −4 (a second-yellow dismissal totals −6)." })}</Rule>
          <Rule label={t("weekend.howTemplatesLabel", { defaultValue: "Position templates:" })}>{t("weekend.howTemplatesBody", { defaultValue: "a player scores through the template of the slot YOU fielded him in. If the match verdict says he actually played a different position, a positive score is dampened ×0.75 — mis-slotting never outscores honest slotting." })}</Rule>
          <MismatchFigure />
          <Rule label={t("weekend.howFinishersLabel", { defaultValue: "Finishers:" })}>{t("weekend.howFinishersBody", { defaultValue: "score only from their entry minute onward, and their goals and assists after the 75th minute are multiplied ×1.25 — the decisive-moment multiplier." })}</Rule>
          <Rule label={t("weekend.howCrowdLabel", { defaultValue: "The crowd's verdict:" })}>{t("weekend.howCrowdBody", { defaultValue: "head-to-head crowd votes on real performances move a player's score by up to ±15%. Performances with too few votes keep their base score." })}</Rule>
        </Section>

        <Section eyebrow={t("weekend.howCourt", { defaultValue: "The court" })} testId="htp-court">
          <Rule>{t("weekend.howCourtBody", { defaultValue: "Think the feed called a player's position wrong? File a claim — you get 2 filings per gameweek, and filing counts as the first endorsement. A claim that gathers enough endorsements (at least 15, or 0.5% of the gameweek's actives) goes to trial; a trial passes on a 60% share with quorum (at least 30, or 1%). Filing closes Monday 23:59; verdicts land Tuesday evening and re-score the player before scores go final." })}</Rule>
        </Section>

        <Section eyebrow={t("weekend.howTies", { defaultValue: "Ties & finality" })} testId="htp-ties">
          <Rule label={t("weekend.howTableLabel", { defaultValue: "Crew table:" })}>{t("weekend.howTableBody", { defaultValue: "ranked by cumulative points; equal points are broken by head-to-head weekend wins; still level is a displayed tie." })}</Rule>
          <Rule label={t("weekend.howFinalityLabel", { defaultValue: "Finality:" })}>{t("weekend.howFinalityBody", { defaultValue: "scores go final at 23:59 (Paris time) the day after the window closes." })}</Rule>
        </Section>
      </div>
    </ShellLayout>
  );
}
