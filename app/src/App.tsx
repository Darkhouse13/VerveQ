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
