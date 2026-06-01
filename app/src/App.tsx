import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, UsernameRequiredRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoginScreen from "./pages/LoginScreen";
import OnboardingScreen from "./pages/OnboardingScreen";
import HomeScreen from "./pages/HomeScreen";
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

// v2 unified shell (additive, flag-gated via VITE_V2_SHELL_ENABLED). Lazy so it
// stays out of the main bundle; ShellGate redirects to /home when the flag is off.
const ShellHomeScreen = lazy(() => import("./pages/shell/ShellHomeScreen"));
const CompeteCategoryScreen = lazy(() => import("./pages/shell/CompeteCategoryScreen"));
const CompeteSportScreen = lazy(() => import("./pages/shell/CompeteSportScreen"));
const CompeteModeGridScreen = lazy(() => import("./pages/shell/CompeteModeGridScreen"));
const RanksPlaceholderScreen = lazy(() => import("./pages/shell/RanksPlaceholderScreen"));

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
            <Route path="/" element={<LoginScreen />} />
            <Route path="/leaderboard" element={<LeaderboardScreen />} />
            <Route
              path="/ranks"
              element={
                <ProtectedRoute>
                  <LeaderboardScreen />
                </ProtectedRoute>
              }
            />
            <Route path="/home" element={<HomeScreen />} />
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
                <ProtectedRoute>
                  <SportSelectScreen />
                </ProtectedRoute>
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
                <UsernameRequiredRoute>
                  <QuizScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/survival"
              element={
                <UsernameRequiredRoute>
                  <SurvivalScreen />
                </UsernameRequiredRoute>
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
                <ProtectedRoute>
                  <ProfileScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/challenge"
              element={
                <UsernameRequiredRoute>
                  <ChallengeScreen />
                </UsernameRequiredRoute>
              }
            />
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
            <Route
              path="/arena/:code"
              element={
                <UsernameRequiredRoute>
                  <ErrorBoundary>
                    <ChallengeArenaScreen />
                  </ErrorBoundary>
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/rivals"
              element={
                <UsernameRequiredRoute>
                  <RivalsListScreen />
                </UsernameRequiredRoute>
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
                <UsernameRequiredRoute>
                  <DailyQuizScreen />
                </UsernameRequiredRoute>
              }
            />
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
                <UsernameRequiredRoute>
                  <BlitzScreen />
                </UsernameRequiredRoute>
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
                <UsernameRequiredRoute>
                  <LiveMatchScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/forge"
              element={
                <UsernameRequiredRoute>
                  <ForgeScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/higher-lower"
              element={
                <UsernameRequiredRoute>
                  <HigherLowerScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/verve-grid"
              element={
                <UsernameRequiredRoute>
                  <VerveGridScreen />
                </UsernameRequiredRoute>
              }
            />
            <Route
              path="/who-am-i"
              element={
                <UsernameRequiredRoute>
                  <WhoAmIScreen />
                </UsernameRequiredRoute>
              }
            />
            {/* Dev/preview only — Learn node picker + graph-built ladders. Not wired into home, nav, or any scored mode. */}
            <Route path="/learn" element={<LearnNodePickerScreen />} />
            <Route path="/learn/geography" element={<LearnNodePickerScreen />} />
            <Route path="/learn/geography/:nodeId" element={<LearnLadderScreen />} />
            <Route path="/learn/prototype" element={<LearnPrototypeScreen />} />
            {/* v2 unified shell — additive, flag-gated. ShellGate redirects to
                /home when VITE_V2_SHELL_ENABLED is off, so these are invisible
                until enabled and never shadow existing routes. */}
            <Route path="/v2" element={<ShellGate><ShellHomeScreen /></ShellGate>} />
            <Route path="/compete" element={<ShellGate><CompeteCategoryScreen /></ShellGate>} />
            <Route path="/compete/sport" element={<ShellGate><CompeteSportScreen /></ShellGate>} />
            <Route path="/compete/sport/:sport" element={<ShellGate><CompeteModeGridScreen /></ShellGate>} />
            <Route path="/v2/ranks" element={<ShellGate><RanksPlaceholderScreen /></ShellGate>} />
            {/* Learn v2 — Learn pillar (entry / run / review / mastery). */}
            <Route path="/v2/learn" element={<ShellGate><LearnEntryScreen /></ShellGate>} />
            <Route path="/v2/learn/run" element={<ShellGate><LearnRunnerScreen /></ShellGate>} />
            <Route path="/v2/learn/review" element={<ShellGate><LearnReviewScreen /></ShellGate>} />
            <Route path="/v2/learn/mastery" element={<ShellGate><LearnMasteryScreen /></ShellGate>} />
            {/* In-game prototype layout — migrated modes (solo Quiz, multi-user Arena). */}
            <Route path="/v2/quiz" element={<ShellGate><QuizPlayScreen /></ShellGate>} />
            <Route path="/v2/blitz" element={<ShellGate><BlitzPlayScreen /></ShellGate>} />
            <Route path="/v2/survival" element={<ShellGate><SurvivalPlayScreen /></ShellGate>} />
            <Route path="/v2/higher-lower" element={<ShellGate><HigherLowerPlayScreen /></ShellGate>} />
            <Route path="/v2/who-am-i" element={<ShellGate><WhoAmIPlayScreen /></ShellGate>} />
            <Route path="/v2/verve-grid" element={<ShellGate><VerveGridPlayScreen /></ShellGate>} />
            {/* Daily reuses the migrated Quiz view but runs the DAILY session;
                same auth requirement as the live /daily-quiz route. */}
            <Route path="/v2/daily" element={<ShellGate><UsernameRequiredRoute><DailyQuizPlayScreen /></UsernameRequiredRoute></ShellGate>} />
            <Route path="/v2/arena/:code" element={<ShellGate><ArenaPlayScreen /></ShellGate>} />
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
