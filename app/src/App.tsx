import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, UsernameRequiredRoute } from "./components/ProtectedRoute";
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
import NotFound from "./pages/NotFound";

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string,
);

const App = () => (
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  </ConvexAuthProvider>
);

export default App;
