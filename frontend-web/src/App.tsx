import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
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
                <ProtectedRoute>
                  <DifficultyScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz"
              element={
                <ProtectedRoute>
                  <QuizScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/survival"
              element={
                <ProtectedRoute>
                  <SurvivalScreen />
                </ProtectedRoute>
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
                <ProtectedRoute>
                  <ChallengeScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/daily-quiz"
              element={
                <ProtectedRoute>
                  <DailyQuizScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/daily-results"
              element={
                <ProtectedRoute>
                  <DailyResultScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/blitz"
              element={
                <ProtectedRoute>
                  <BlitzScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/blitz-results"
              element={
                <ProtectedRoute>
                  <BlitzResultScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/waiting-room"
              element={
                <ProtectedRoute>
                  <WaitingRoomScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live-match"
              element={
                <ProtectedRoute>
                  <LiveMatchScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forge"
              element={
                <ProtectedRoute>
                  <ForgeScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/higher-lower"
              element={
                <ProtectedRoute>
                  <HigherLowerScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/verve-grid"
              element={
                <ProtectedRoute>
                  <VerveGridScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/who-am-i"
              element={
                <ProtectedRoute>
                  <WhoAmIScreen />
                </ProtectedRoute>
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
