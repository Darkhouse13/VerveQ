import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { AuthProvider } from "./contexts/AuthContext";
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
import DashboardScreen from "./pages/DashboardScreen";
import DailyQuizScreen from "./pages/DailyQuizScreen";
import DailySurvivalScreen from "./pages/DailySurvivalScreen";
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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <div className="max-w-md mx-auto min-h-screen relative">
            <Routes>
              <Route path="/" element={<LoginScreen />} />
              <Route path="/onboarding" element={<OnboardingScreen />} />
              <Route path="/home" element={<HomeScreen />} />
              <Route path="/sport-select" element={<SportSelectScreen />} />
              <Route path="/difficulty" element={<DifficultyScreen />} />
              <Route path="/quiz" element={<QuizScreen />} />
              <Route path="/survival" element={<SurvivalScreen />} />
              <Route path="/results" element={<ResultScreen />} />
              <Route path="/leaderboard" element={<LeaderboardScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/challenge" element={<ChallengeScreen />} />
              <Route path="/dashboard" element={<DashboardScreen />} />
              <Route path="/daily-quiz" element={<DailyQuizScreen />} />
              <Route path="/daily-survival" element={<DailySurvivalScreen />} />
              <Route path="/daily-results" element={<DailyResultScreen />} />
              <Route path="/blitz" element={<BlitzScreen />} />
              <Route path="/blitz-results" element={<BlitzResultScreen />} />
              <Route path="/waiting-room" element={<WaitingRoomScreen />} />
              <Route path="/live-match" element={<LiveMatchScreen />} />
              <Route path="/forge" element={<ForgeScreen />} />
              <Route path="/higher-lower" element={<HigherLowerScreen />} />
              <Route path="/verve-grid" element={<VerveGridScreen />} />
              <Route path="/who-am-i" element={<WhoAmIScreen />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </ConvexAuthProvider>
);

export default App;
