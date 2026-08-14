/**
 * EYE-TEST-CONTEXT — DEV-ONLY visual harness for the vote cards
 * (the DrawMockHarness precedent): renders VoteStackView with a fabricated
 * served pair — no Convex, no auth — so the 380px fit check and screenshot
 * (e2e/voteCardQa.spec.ts) never depend on DEV having finished fixtures
 * inside a live voting window. The payload deliberately stresses the
 * layout: long club names, a two-goal-one-assist line against a red-card
 * line, one home and one away orientation. Production builds redirect home.
 */
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { VoteStackView, type ServedPair } from "./VoteScreen";

const SATURDAY_KICKOFF = Date.UTC(2026, 7, 15, 16, 30); // Sat 2026-08-15
const SUNDAY_KICKOFF = Date.UTC(2026, 7, 16, 19, 0); // Sun 2026-08-16

const HARNESS_PAIR = {
  status: "served",
  pairId: "harness-pair" as ServedPair["pairId"],
  served: 3,
  cap: 300,
  players: [
    {
      playerId: "harness-a",
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
    },
    {
      playerId: "harness-b",
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
    },
  ],
} as unknown as ServedPair;

export default function VoteCardHarness() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.voteTitle", { defaultValue: "The eye test" })}
      back
      onBack={() => navigate(SHELL_ROUTES.weekend)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full">
        <VoteStackView serve={HARNESS_PAIR} busy={false} onVote={() => undefined} />
      </div>
    </ShellLayout>
  );
}
