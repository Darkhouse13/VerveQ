import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, UsernameRequiredRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
// Flag-gated entry routing: v1 LoginScreen/HomeScreen when off, v2 shell
// landing when VITE_V2_SHELL_ENABLED is on. Keeps "/" and "/home" as a clean
// rollback seam (the only routes whose default destination the flag flips).
import { EntryRoute, HomeRoute } from "./components/EntryRoutes";
// Deep-link aliases: with the v2 shell live, v1 mode URLs (and spelling
// variants like /vervegrid) forward to the v2 surface for that mode so shared
// links land on the mode they name. Flag-off renders children unchanged.
import { V2Redirect, V2ArenaCodeRedirect } from "./components/V2Redirect";
import OnboardingScreen from "./pages/OnboardingScreen";
import SportSelectScreen from "./pages/SportSelectScreen";
import DifficultyScreen from "./pages/DifficultyScreen";
import QuizScreen from "./pages/QuizScreen";
import SurvivalScreen from "./pages/SurvivalScreen";
import ResultScreen from "./pages/ResultScreen";
import LeaderboardScreen from "./pages/LeaderboardScreen";
import ProfileScreen from "./pages/ProfileScreen";
import ChallengeScreen from "./pages/ChallengeScreen";
import DailyQuizScreen from "./pages/DailyQuizScreen";
import DailyResultScreen from "./pages/DailyResultScreen";
import BlitzScreen from "./pages/BlitzScreen";
import BlitzResultScreen from "./pages/BlitzResultScreen";
import WaitingRoomScreen from "./pages/WaitingRoomScreen";
import LiveMatchScreen from "./pages/LiveMatchScreen";
import ForgeScreen from "./pages/ForgeScreen";
import HigherLowerScreen from "./pages/HigherLowerScreen";
import VerveGridScreen from "./pages/VerveGridScreen";
import WhoAmIScreen from "./pages/WhoAmIScreen";
import LearnPrototypeScreen from "./pages/LearnPrototypeScreen";
import LearnNodePickerScreen from "./pages/LearnNodePickerScreen";
import LearnLadderScreen from "./pages/LearnLadderScreen";
import NotFound from "./pages/NotFound";
import { ShellGate } from "./components/shell/ShellGate";
import { ShellLayout } from "./components/shell/ShellLayout";
import {
  UsernameOnlyRoute,
  FullAccountRoute,
} from "./components/shell/ShellRouteGuards";

// v2 unified shell (additive, flag-gated via VITE_V2_SHELL_ENABLED). Lazy so it
// stays out of the main bundle; ShellGate redirects to /home when the flag is off.
const ShellHomeScreen = lazy(() => import("./pages/shell/ShellHomeScreen"));
// CompeteCategoryScreen / CompeteSportScreen are parked (see their files): with
// Sport→Football the only live path, /compete lands directly on the mode grid.
const CompeteModeGridScreen = lazy(() => import("./pages/shell/CompeteModeGridScreen"));
const RanksScreen = lazy(() => import("./pages/shell/RanksScreen"));
const ShellProfileScreen = lazy(() => import("./pages/shell/ShellProfileScreen"));
const WelcomeScreen = lazy(() => import("./pages/shell/WelcomeScreen"));
const UpgradeScreen = lazy(() => import("./pages/shell/UpgradeScreen"));
const ArenaHubScreen = lazy(() => import("./pages/shell/ArenaHubScreen"));
const ShellLeaderboardScreen = lazy(() => import("./pages/shell/ShellLeaderboardScreen"));

// Public legal pages — flag-independent (app-store / launch necessities).
const PrivacyScreen = lazy(() => import("./pages/legal/PrivacyScreen"));
const TermsScreen = lazy(() => import("./pages/legal/TermsScreen"));

// Learn v2 (the Learn pillar) — additive, flag-gated, lazy.
const LearnEntryScreen = lazy(() => import("./pages/shell/learn/LearnEntryScreen"));
const LearnRunnerScreen = lazy(() => import("./pages/shell/learn/LearnRunnerScreen"));
const LearnReviewScreen = lazy(() => import("./pages/shell/learn/LearnReviewScreen"));
const LearnMasteryScreen = lazy(() => import("./pages/shell/learn/LearnMasteryScreen"));

// In-game prototype layout (migrated modes) — additive, flag-gated, lazy.
const QuizPlayScreen = lazy(() => import("./pages/shell/play/QuizPlayScreen"));
const BlitzPlayScreen = lazy(() => import("./pages/shell/play/BlitzPlayScreen"));
const SurvivalPlayScreen = lazy(() => import("./pages/shell/play/SurvivalPlayScreen"));
const HigherLowerPlayScreen = lazy(() => import("./pages/shell/play/HigherLowerPlayScreen"));
const WhoAmIPlayScreen = lazy(() => import("./pages/shell/play/WhoAmIPlayScreen"));
const VerveGridPlayScreen = lazy(() => import("./pages/shell/play/VerveGridPlayScreen"));
const DailyQuizPlayScreen = lazy(() => import("./pages/shell/play/DailyQuizPlayScreen"));
const ArenaPlayScreen = lazy(() => import("./pages/shell/play/ArenaPlayScreen"));
const LiveMatchPlayScreen = lazy(() => import("./pages/shell/play/LiveMatchPlayScreen"));

const DuelPlayScreen = lazy(() => import("./pages/DuelPlayScreen"));
const DuelLinkScreen = lazy(() => import("./pages/DuelLinkScreen"));
const DuelResultScreen = lazy(() => import("./pages/DuelResultScreen"));
const RivalsListScreen = lazy(() => import("./pages/RivalsScreen"));
const RivalDetailScreen = lazy(() =>
  import("./pages/RivalsScreen").then((m) => ({ default: m.RivalDetailScreen })),
);
const ChallengeArenaScreen = lazy(() => import("./pages/ChallengeArenaScreen"));

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string,
);

function LazyFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="font-heading font-bold animate-pulse">Loading…</p>
    </div>
  );
}

const AppRoutes = () => (
  <ConvexAuthProvider client={convex}>
    <AuthProvider>
      <Sonner />
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <div className="max-w-md mx-auto min-h-screen relative">
          <Routes>
            <Route path="/" element={<EntryRoute />} />
            <Route
              path="/leaderboard"
              element={
                <V2Redirect to="/v2/leaderboard">
                  <LeaderboardScreen />
                </V2Redirect>
              }
            />
            <Route
              path="/ranks"
              element={
                <V2Redirect to="/v2/ranks">
                  <ProtectedRoute>
                    <LeaderboardScreen />
                  </ProtectedRoute>
                </V2Redirect>
              }
            />
            <Route path="/home" element={<HomeRoute />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sport-select"
              element={
                <V2Redirect to="/compete">
                  <ProtectedRoute>
                    <SportSelectScreen />
                  </ProtectedRoute>
                </V2Redirect>
              }
            />
            <Route
              path="/difficulty"
              element={
                <UsernameRequiredRoute>
                  <DifficultyScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/quiz"
              element={
                <V2Redirect to="/v2/quiz?sport=football">
                  <UsernameRequiredRoute>
                    <QuizScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route
              path="/survival"
              element={
                <V2Redirect to="/v2/survival?sport=football">
                  <UsernameRequiredRoute>
                    <SurvivalScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route
              path="/results"
              element={
                <ProtectedRoute>
                  <ResultScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <V2Redirect to="/v2/profile">
                  <ProtectedRoute>
                    <ProfileScreen />
                  </ProtectedRoute>
                </V2Redirect>
              }
            />
            <Route
              path="/challenge"
              element={
                <V2Redirect to="/v2/duels">
                  <UsernameRequiredRoute>
                    <ChallengeScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            {/* Bare /duel(s) name the head-to-head surface; only the deeper
                /duel/:linkCode + play/result URLs are real v1 flows. */}
            <Route path="/duel" element={<V2Redirect to="/v2/duels"><NotFound /></V2Redirect>} />
            <Route path="/duels" element={<V2Redirect to="/v2/duels"><NotFound /></V2Redirect>} />
            <Route
              path="/duel/play/:duelId"
              element={
                <UsernameRequiredRoute>
                  <DuelPlayScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/duel/result/:duelId"
              element={
                <UsernameRequiredRoute>
                  <DuelResultScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route path="/duel/:linkCode" element={<DuelLinkScreen />} />
            {/* Bare /arena names the group-challenge-room hub (create/join). */}
            <Route path="/arena" element={<V2Redirect to="/v2/arena"><NotFound /></V2Redirect>} />
            <Route
              path="/arena/:code"
              element={
                <V2ArenaCodeRedirect>
                  <UsernameRequiredRoute>
                    <ErrorBoundary>
                      <ChallengeArenaScreen />
                    </ErrorBoundary>
                  </UsernameRequiredRoute>
                </V2ArenaCodeRedirect>
              }
            />
            <Route
              path="/rivals"
              element={
                <V2Redirect to="/v2/rivals">
                  <UsernameRequiredRoute>
                    <RivalsListScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route
              path="/rivals/:opponentUserId"
              element={
                <UsernameRequiredRoute>
                  <RivalDetailScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/daily-quiz"
              element={
                <V2Redirect to="/v2/daily?sport=football">
                  <UsernameRequiredRoute>
                    <DailyQuizScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            {/* /daily is the natural name for the Daily challenge. */}
            <Route path="/daily" element={<V2Redirect to="/v2/daily?sport=football"><NotFound /></V2Redirect>} />
            <Route
              path="/daily-results"
              element={
                <UsernameRequiredRoute>
                  <DailyResultScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/blitz"
              element={
                <V2Redirect to="/v2/blitz?sport=football">
                  <UsernameRequiredRoute>
                    <BlitzScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route
              path="/blitz-results"
              element={
                <UsernameRequiredRoute>
                  <BlitzResultScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/waiting-room"
              element={
                <UsernameRequiredRoute>
                  <WaitingRoomScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/live-match"
              element={
                <V2Redirect to="/v2/live-match">
                  <UsernameRequiredRoute>
                    <LiveMatchScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route
              path="/forge"
              element={
                <V2Redirect to="/v2/forge">
                  <UsernameRequiredRoute>
                    <ForgeScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route
              path="/higher-lower"
              element={
                <V2Redirect to="/v2/higher-lower?sport=football">
                  <UsernameRequiredRoute>
                    <HigherLowerScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route path="/higherlower" element={<V2Redirect to="/v2/higher-lower?sport=football"><NotFound /></V2Redirect>} />
            <Route
              path="/verve-grid"
              element={
                <V2Redirect to="/v2/verve-grid?sport=football">
                  <UsernameRequiredRoute>
                    <VerveGridScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route path="/vervegrid" element={<V2Redirect to="/v2/verve-grid?sport=football"><NotFound /></V2Redirect>} />
            <Route
              path="/who-am-i"
              element={
                <V2Redirect to="/v2/who-am-i?sport=football">
                  <UsernameRequiredRoute>
                    <WhoAmIScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
              }
            />
            <Route path="/whoami" element={<V2Redirect to="/v2/who-am-i?sport=football"><NotFound /></V2Redirect>} />
            {/* Dev/preview only — Learn node picker + graph-built ladders. Not wired into home, nav, or any scored mode. */}
            <Route path="/learn" element={<V2Redirect to="/v2/learn"><LearnNodePickerScreen /></V2Redirect>} />
            <Route path="/learn/geography" element={<V2Redirect to="/v2/learn"><LearnNodePickerScreen /></V2Redirect>} />
            <Route path="/learn/geography/:nodeId" element={<V2Redirect to="/v2/learn"><LearnLadderScreen /></V2Redirect>} />
            <Route path="/learn/prototype" element={<V2Redirect to="/v2/learn"><LearnPrototypeScreen /></V2Redirect>} />
            {/* v2 unified shell — additive, flag-gated. ShellGate redirects to
                /home when VITE_V2_SHELL_ENABLED is off, so these are invisible
                until enabled and never shadow existing routes. */}
            <Route path="/v2" element={<ShellGate><ShellHomeScreen /></ShellGate>} />
            {/* Username-only onboarding (no password). Carries ?next= + ?code=. */}
            <Route path="/v2/welcome" element={<ShellGate><WelcomeScreen /></ShellGate>} />
            {/* Anonymous + username -> full account upgrade. Carries ?next=. */}
            <Route path="/v2/upgrade" element={<ShellGate><UpgradeScreen /></ShellGate>} />
            {/* Compete lands DIRECTLY on the (football) mode grid — the category
                and sport steps are collapsed while Sport/Football is the only
                live path. The old step URLs redirect so deep links keep working
                and reintroducing a category/sport step later is cheap. */}
            <Route path="/compete" element={<ShellGate><CompeteModeGridScreen /></ShellGate>} />
            <Route path="/compete/sport" element={<ShellGate><Navigate to="/compete" replace /></ShellGate>} />
            <Route path="/compete/sport/:sport" element={<ShellGate><Navigate to="/compete" replace /></ShellGate>} />
            {/* Shell-native Ranks + Profile (v2 designs). Ranks is open to all
                (username-only sees the locked ranked pitch); Profile needs a
                server identity, so it mirrors the casual-mode gate. */}
            <Route path="/v2/ranks" element={<ShellGate><RanksScreen /></ShellGate>} />
            <Route
              path="/v2/profile"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <ShellProfileScreen />
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            {/* Contained legacy surfaces — the existing v1 screens embedded in
                the shell chrome (v2 nav retained, v1 bottom nav suppressed) so a
                shell nav target or Compete tile never drops the user back into
                the v1 app. Gating mirrors the corresponding v1 routes. */}
            <Route
              path="/v2/duels"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <ShellLayout embed><ChallengeScreen embedded /></ShellLayout>
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            {/* Arena entry hub — group challenge rooms (create / join by code),
                distinct from Duels. Same server gate as the rooms themselves:
                any user WITH a username (assertUsernameRequiredUser); logged-out
                visitors onboard with ?next= back here instead of bouncing home. */}
            <Route
              path="/v2/arena"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <ArenaHubScreen />
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            <Route
              path="/v2/forge"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <ShellLayout embed><ForgeScreen embedded /></ShellLayout>
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            <Route
              path="/v2/leaderboard"
              element={<ShellGate><ShellLeaderboardScreen /></ShellGate>}
            />
            <Route
              path="/v2/rivals"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <ShellLayout embed><RivalsListScreen embedded /></ShellLayout>
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            <Route
              path="/v2/rivals/:opponentUserId"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <ShellLayout embed><RivalDetailScreen embedded /></ShellLayout>
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            {/* Learn v2 — Learn pillar (entry / run / review / mastery). */}
            <Route path="/v2/learn" element={<ShellGate><UsernameOnlyRoute><LearnEntryScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/learn/run" element={<ShellGate><UsernameOnlyRoute><LearnRunnerScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/learn/review" element={<ShellGate><UsernameOnlyRoute><LearnReviewScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/learn/mastery" element={<ShellGate><UsernameOnlyRoute><LearnMasteryScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* In-game prototype layout — migrated modes. Gating reflects the
                server's eligibility (convex/lib/authz.ts): ranked modes require a
                full account; casual/social modes admit anyone with a username
                (anonymous or full). Arena self-gates inline to preserve its code. */}
            {/* Ranked: full account required. */}
            <Route path="/v2/quiz" element={<ShellGate><FullAccountRoute><QuizPlayScreen /></FullAccountRoute></ShellGate>} />
            <Route path="/v2/survival" element={<ShellGate><FullAccountRoute><SurvivalPlayScreen /></FullAccountRoute></ShellGate>} />
            {/* Casual/social: username-only playable. */}
            <Route path="/v2/blitz" element={<ShellGate><UsernameOnlyRoute><BlitzPlayScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/higher-lower" element={<ShellGate><UsernameOnlyRoute><HigherLowerPlayScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/who-am-i" element={<ShellGate><UsernameOnlyRoute><WhoAmIPlayScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/verve-grid" element={<ShellGate><UsernameOnlyRoute><VerveGridPlayScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* Daily reuses the migrated Quiz view but runs the DAILY session;
                the official daily leaderboard/streaks are full-account only. */}
            <Route path="/v2/daily" element={<ShellGate><FullAccountRoute><DailyQuizPlayScreen /></FullAccountRoute></ShellGate>} />
            {/* Arena (multi-user) is username-only playable; the screen onboards
                inline so a shared invite link never drops its lobby code. */}
            <Route path="/v2/arena/:code" element={<ShellGate><ArenaPlayScreen /></ShellGate>} />
            {/* Live Match (1v1 realtime) on the shell — reskin over the existing
                liveMatches backend; realtime/matchmaking/ELO unchanged. Live ELO
                is ranked, so a full account is required. */}
            <Route path="/v2/live-match" element={<ShellGate><FullAccountRoute><LiveMatchPlayScreen /></FullAccountRoute></ShellGate>} />
            {/* Public legal pages — no auth, no flag gate (launch/app-store
                requirements; must render regardless of rollout state). */}
            <Route path="/privacy" element={<PrivacyScreen />} />
            <Route path="/terms" element={<TermsScreen />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  </ConvexAuthProvider>
);

const App = () => (
  <ErrorBoundary>
    <Suspense fallback={<LazyFallback />}>
      <AppRoutes />
    </Suspense>
  </ErrorBoundary>
);

export default App;
