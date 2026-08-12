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
        <Section eyebrow="The Weekend" testId="htp-what">
          <Rule>
            One squad for the whole European football weekend. Eight leagues,
            every fixture in the window counts, and the board resets fresh for
            each gameweek — weekend windows run Friday through Monday, midweek
            windows Tuesday through Thursday. No season-long grind.
          </Rule>
        </Section>

        <Section eyebrow="Two ways to play" testId="htp-modes">
          <Rule label="Budget squad.">
            Build your own 13 under a 91.0 budget. Prices run 4.0–13.0 in
            half-point steps, identical for everyone and fixed within the
            gameweek.
          </Rule>
          <Rule label="Crew draft.">
            2–8 friends, share-code to join, snake draft where every player can
            be owned once per room. Each drafter gets a chess-clock bank of 30
            seconds per round — 390s spent freely across all 13 picks; an
            empty bank auto-picks the rest.
          </Rule>
        </Section>

        <Section eyebrow="Your squad" testId="htp-squad">
          <Rule label="Thirteen players:">
            an XI plus 2 finishers (your bench with intent).
          </Rule>
          <Rule label="Any shape that adds up:">
            exactly 1 GK, 3–5 DEF, 2–5 MID, 1–3 ATT in the XI. Finishers carry
            their own position, chosen freely.
          </Rule>
          <Rule label="Club cap:">
            at most 3 players from one club — except your favorite club, which
            is unlimited (changing favorites has a 28-day cooldown).
          </Rule>
          <Rule label="No duplicates:">a squad is 13 players, not 13 slots.</Rule>
        </Section>

        <Section eyebrow="Locks" testId="htp-locks">
          <Rule>
            Each player locks individually at his own kickoff. Until then swap,
            re-slot and reshuffle freely; after it, that slot is frozen and the
            cost committed. A player whose match has already kicked off can't
            be swapped IN — no hindsight picks. Editing Sunday around a locked
            Saturday is the intended skill.
          </Rule>
        </Section>

        <Section eyebrow="Scoring, in plain language" testId="htp-scoring">
          <Rule label="Showing up:">+1 for any minutes played.</Rule>
          <Rule label="Goals & assists:">
            goals pay +5 to +8 and assists +3 to +6 — the deeper the position,
            the more they pay (a GK goal is +8, a striker's +5).
          </Rule>
          <Rule label="Team result:">
            +1 for a win, +0.5 for a draw, if the player played 60+ minutes.
          </Rule>
          <Rule label="Defending:">
            clean sheets pay GK +5 / DEF +4 / MID +1 (60+ minutes); GKs and
            DEFs lose 1 point per 2 goals conceded. Tackles, interceptions,
            blocks, saves, key passes and dribbles all score small amounts,
            each capped so volume can't be farmed. Sustained excellence pays
            via ramps: defenders' duel dominance and midfielders' pass
            completion each earn up to +2.
          </Rule>
          <Rule label="Cards:">yellow −1, red −4 (a second-yellow dismissal totals −6).</Rule>
          <Rule label="Position templates:">
            a player scores through the template of the slot YOU fielded him
            in. If the match verdict says he actually played a different
            position, a positive score is dampened ×0.75 — mis-slotting never
            outscores honest slotting.
          </Rule>
          <Rule label="Finishers:">
            score only from their entry minute onward, and their goals and
            assists after the 75th minute are multiplied ×1.25 — the
            decisive-moment multiplier.
          </Rule>
          <Rule label="The crowd's verdict:">
            head-to-head crowd votes on real performances move a player's
            score by up to ±15%. Performances with too few votes keep their
            base score.
          </Rule>
        </Section>

        <Section eyebrow="The court" testId="htp-court">
          <Rule>
            Think the feed called a player's position wrong? File a claim — you
            get 2 filings per gameweek, and filing counts as the first
            endorsement. A claim that gathers enough endorsements (at least 15,
            or 0.5% of the gameweek's actives) goes to trial; a trial passes on
            a 60% share with quorum (at least 30, or 1%). Filing closes Monday
            23:59; verdicts land Tuesday evening and re-score the player before
            scores go final.
          </Rule>
        </Section>

        <Section eyebrow="Ties & finality" testId="htp-ties">
          <Rule label="Crew table:">
            ranked by cumulative points; equal points are broken by
            head-to-head weekend wins; still level is a displayed tie.
          </Rule>
          <Rule label="Finality:">
            scores go final at 23:59 (Paris time) the day after the window
            closes.
          </Rule>
        </Section>
      </div>
    </ShellLayout>
  );
}
