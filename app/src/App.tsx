import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Suspense } from "react";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, UsernameRequiredRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AnalyticsPageviews } from "./components/AnalyticsPageviews";
import { InstallPrompt } from "./components/InstallPrompt";
// Flag-gated entry routing: v1 LoginScreen/HomeScreen when off, v2 shell
// landing when VITE_V2_SHELL_ENABLED is on. Keeps "/" and "/home" as a clean
// rollback seam (the only routes whose default destination the flag flips).
import { EntryRoute, HomeRoute, PlayShortLinkRoute } from "./components/EntryRoutes";
// Deep-link aliases: with the v2 shell live, v1 mode URLs (and spelling
// variants like /vervegrid) forward to the v2 surface for that mode so shared
// links land on the mode they name. Flag-off renders children unchanged.
import { V2Redirect, V2ArenaCodeRedirect } from "./components/V2Redirect";
// v1 screens still live in production (embedded in the shell or reused by the
// v2 play flow) stay statically imported.
import OnboardingScreen from "./pages/OnboardingScreen";
import DifficultyScreen from "./pages/DifficultyScreen";
import ResultScreen from "./pages/ResultScreen";
import ChallengeScreen from "./pages/ChallengeScreen";
import DailyResultScreen from "./pages/DailyResultScreen";
import BlitzResultScreen from "./pages/BlitzResultScreen";
import ForgeScreen from "./pages/ForgeScreen";
import NotFound from "./pages/NotFound";
import { ShellGate } from "./components/shell/ShellGate";
import { ShellLayout } from "./components/shell/ShellLayout";
import { FirstRunLanguagePrompt } from "./components/shell/FirstRunLanguagePrompt";
import { RouteMeta } from "./components/RouteMeta";
import {
  UsernameOnlyRoute,
  FullAccountRoute,
} from "./components/shell/ShellRouteGuards";

// Rollback-only v1 mode screens: with the v2 shell flag on they sit behind
// V2Redirect and never render, so they load lazily to stay out of the main
// bundle. Flag-off (rollback) loads them through the app-level Suspense.
const SportSelectScreen = lazyWithRetry(() => import("./pages/SportSelectScreen"));
const QuizScreen = lazyWithRetry(() => import("./pages/QuizScreen"));
const SurvivalScreen = lazyWithRetry(() => import("./pages/SurvivalScreen"));
const LeaderboardScreen = lazyWithRetry(() => import("./pages/LeaderboardScreen"));
const ProfileScreen = lazyWithRetry(() => import("./pages/ProfileScreen"));
const DailyQuizScreen = lazyWithRetry(() => import("./pages/DailyQuizScreen"));
const BlitzScreen = lazyWithRetry(() => import("./pages/BlitzScreen"));
const HigherLowerScreen = lazyWithRetry(() => import("./pages/HigherLowerScreen"));
const VerveGridScreen = lazyWithRetry(() => import("./pages/VerveGridScreen"));
const LearnPrototypeScreen = lazyWithRetry(() => import("./pages/LearnPrototypeScreen"));
const LearnNodePickerScreen = lazyWithRetry(() => import("./pages/LearnNodePickerScreen"));
const LearnLadderScreen = lazyWithRetry(() => import("./pages/LearnLadderScreen"));

// v2 unified shell (additive, flag-gated via VITE_V2_SHELL_ENABLED). Lazy so it
// stays out of the main bundle; ShellGate redirects to /home when the flag is off.
const ShellHomeScreen = lazyWithRetry(() => import("./pages/shell/ShellHomeScreen"));
// With Sport→Football the only live path, /compete lands directly on the mode
// grid (the old category/sport chooser screens were removed).
const CompeteModeGridScreen = lazyWithRetry(() => import("./pages/shell/CompeteModeGridScreen"));
const RanksScreen = lazyWithRetry(() => import("./pages/shell/RanksScreen"));
const ShellProfileScreen = lazyWithRetry(() => import("./pages/shell/ShellProfileScreen"));
const SettingsScreen = lazyWithRetry(() => import("./pages/shell/SettingsScreen"));
const AccountChoiceScreen = lazyWithRetry(() => import("./pages/shell/AccountChoiceScreen"));
const WelcomeScreen = lazyWithRetry(() => import("./pages/shell/WelcomeScreen"));
const UpgradeScreen = lazyWithRetry(() => import("./pages/shell/UpgradeScreen"));
const ArenaHubScreen = lazyWithRetry(() => import("./pages/shell/ArenaHubScreen"));
const ShellLeaderboardScreen = lazyWithRetry(() => import("./pages/shell/ShellLeaderboardScreen"));

// Public legal pages — flag-independent (app-store / launch necessities).
const PrivacyScreen = lazyWithRetry(() => import("./pages/legal/PrivacyScreen"));
const TermsScreen = lazyWithRetry(() => import("./pages/legal/TermsScreen"));

// Learn v2 (the Learn pillar) — additive, flag-gated, lazy.
const LearnEntryScreen = lazyWithRetry(() => import("./pages/shell/learn/LearnEntryScreen"));
const LearnRunnerScreen = lazyWithRetry(() => import("./pages/shell/learn/LearnRunnerScreen"));
const LearnReviewScreen = lazyWithRetry(() => import("./pages/shell/learn/LearnReviewScreen"));
const LearnMasteryScreen = lazyWithRetry(() => import("./pages/shell/learn/LearnMasteryScreen"));

// In-game prototype layout (migrated modes) — additive, flag-gated, lazy.
const QuizPlayScreen = lazyWithRetry(() => import("./pages/shell/play/QuizPlayScreen"));
const BlitzPlayScreen = lazyWithRetry(() => import("./pages/shell/play/BlitzPlayScreen"));
const SurvivalPlayScreen = lazyWithRetry(() => import("./pages/shell/play/SurvivalPlayScreen"));
const HigherLowerPlayScreen = lazyWithRetry(() => import("./pages/shell/play/HigherLowerPlayScreen"));
const CareerPathPlayScreen = lazyWithRetry(() => import("./pages/shell/play/CareerPathPlayScreen"));
const VerveGridPlayScreen = lazyWithRetry(() => import("./pages/shell/play/VerveGridPlayScreen"));
const DailyQuizPlayScreen = lazyWithRetry(() => import("./pages/shell/play/DailyQuizPlayScreen"));
const ArenaPlayScreen = lazyWithRetry(() => import("./pages/shell/play/ArenaPlayScreen"));
// THE WEEKEND crew draft rooms (FW-3).
const WeekendCrewsScreen = lazyWithRetry(() => import("./pages/shell/weekend/WeekendCrewsScreen"));
const CrewScreen = lazyWithRetry(() => import("./pages/shell/weekend/CrewScreen"));
const DraftRoomScreen = lazyWithRetry(() => import("./pages/shell/weekend/DraftRoomScreen"));
// THE WEEKEND budget mode (FW-LAUNCH O1) — unlinked from any nav until launch.
const BudgetSquadScreen = lazyWithRetry(() => import("./pages/shell/weekend/BudgetSquadScreen"));
const VoteScreen = lazyWithRetry(() => import("./pages/shell/weekend/VoteScreen"));
const CourtScreen = lazyWithRetry(() => import("./pages/shell/weekend/CourtScreen"));
const CrewSheetScreen = lazyWithRetry(() => import("./pages/shell/weekend/CrewSheetScreen"));

const DuelPlayScreen = lazyWithRetry(() => import("./pages/DuelPlayScreen"));
const DuelLinkScreen = lazyWithRetry(() => import("./pages/DuelLinkScreen"));
const DuelResultScreen = lazyWithRetry(() => import("./pages/DuelResultScreen"));
const DuelHistoryScreen = lazyWithRetry(() => import("./pages/DuelHistoryScreen"));
const RivalsListScreen = lazyWithRetry(() => import("./pages/RivalsScreen"));
const RivalDetailScreen = lazyWithRetry(() =>
  import("./pages/RivalsScreen").then((m) => ({ default: m.RivalDetailScreen })),
);
const ChallengeArenaScreen = lazyWithRetry(() => import("./pages/ChallengeArenaScreen"));

// THE DRAW (Ticket B) — mock-driven, flag-gated via VITE_DRAW_ENABLED inside
// the screen itself; unlinked from any nav. Lazy so it stays out of the main
// bundle; with the flag off the route just bounces to "/".
const DrawScreen = lazyWithRetry(() => import("./pages/draw/DrawScreen"));
const DrawMockHarness = lazyWithRetry(() => import("./pages/draw/DrawMockHarness"));
const DrawShareLanding = lazyWithRetry(() => import("./pages/draw/DrawShareLanding"));

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
        <AnalyticsPageviews />
        {/* Per-route title/description/canonical. Without it every SPA route
            keeps the homepage head for the whole session. */}
        <RouteMeta />
        {/* safe-pt covers the v1 screens, which render in normal document flow
            rather than inside one of the `fixed inset-0` shell frames. The
            frames are position:fixed and this wrapper creates no containing
            block for them (position:relative doesn't), so they keep their own
            inset and never double up with this one. */}
        <div className="max-w-md mx-auto min-h-screen relative safe-pt">
          {/* One-time language chooser, overlays whatever screen loads first. */}
          <FirstRunLanguagePrompt />
          {/* Add-to-home-screen bar. Renders nothing unless the browser can
              actually install and the user hasn't already dismissed it. */}
          <InstallPrompt />
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
            {/* The difficulty picker is PURE CLIENT STATE: it reads query params
                and navigates — it calls no Convex function and needs no
                identity (see pages/DifficultyScreen). It used to sit behind the
                v1 UsernameRequiredRoute, whose logged-out branch is a bare
                `Navigate to="/"` with no ?next=, so a cold visitor tapping
                Quiz / Knowledge Quiz / Which Came First on the Compete grid was
                silently dumped on the landing page with their intent discarded
                (FR-0 Part 2.2). Ungated, the picker renders for everyone and
                the real gate stays exactly where the server enforces it — one
                step later, on the mode route, which preserves intent via
                ?next=. */}
            <Route path="/difficulty" element={<DifficultyScreen />} />
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
            <Route
              path="/duels/history"
              element={
                <V2Redirect to="/v2/duels/history">
                  <UsernameRequiredRoute>
                    <DuelHistoryScreen />
                  </UsernameRequiredRoute>
                </V2Redirect>
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
            {/* Live Match was removed 2026-07: nothing in the product could
                create a match (the challenge subsystem went in PR #11), so the
                viewer routes advertised a dead end. Old /live-match and
                /waiting-room URLs now fall through to NotFound. */}
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
            {/* Dev/preview only — Learn node picker + graph-built ladders. Not wired into home, nav, or any scored mode. */}
            <Route path="/learn" element={<V2Redirect to="/v2/learn"><LearnNodePickerScreen /></V2Redirect>} />
            <Route path="/learn/geography" element={<V2Redirect to="/v2/learn"><LearnNodePickerScreen /></V2Redirect>} />
            <Route path="/learn/geography/:nodeId" element={<V2Redirect to="/v2/learn"><LearnLadderScreen /></V2Redirect>} />
            <Route path="/learn/prototype" element={<V2Redirect to="/v2/learn"><LearnPrototypeScreen /></V2Redirect>} />
            {/* v2 unified shell — additive, flag-gated. ShellGate redirects to
                /home when VITE_V2_SHELL_ENABLED is off, so these are invisible
                until enabled and never shadow existing routes. */}
            <Route path="/v2" element={<ShellGate><ShellHomeScreen /></ShellGate>} />
            {/* Account chooser for logged-out visitors hitting a gated surface:
                sign in / create account / play as guest. Carries ?next=. */}
            <Route path="/v2/account" element={<ShellGate><AccountChoiceScreen /></ShellGate>} />
            {/* Username-only onboarding (no password) — the guest path and the
                invite-flow ask. Carries ?next= + ?code=. */}
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
            {/* Preferences + account hub. NOT identity-gated — language is a
                device preference everyone can change; the account section adapts
                to auth state (sign-in CTA when logged out). */}
            <Route
              path="/v2/settings"
              element={
                <ShellGate>
                  <SettingsScreen />
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
            <Route
              path="/v2/duels/history"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <ShellLayout embed><DuelHistoryScreen embedded /></ShellLayout>
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
            {/* Forge is FULL-ACCOUNT, not username-only: every write asserts a
                full account server-side (convex/forge.ts submitQuestion /
                reviewQuestion) and its reads return empty for anyone else. The
                username-only guard here admitted users the backend then
                rejected, so the UI showed an empty Forge that errored on submit
                (FR-0 Part 4c). The route now mirrors the server's own rule. */}
            <Route
              path="/v2/forge"
              element={
                <ShellGate>
                  <FullAccountRoute>
                    <ShellLayout embed><ForgeScreen embedded /></ShellLayout>
                  </FullAccountRoute>
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
            {/* Career Path is the marketed mode: GUEST-PLAYABLE with zero login.
                No route guard — a logged-out visitor plays instantly via a client
                guestToken (careerPath.ts accepts unauthenticated guests). */}
            <Route path="/v2/career-path" element={<ShellGate><CareerPathPlayScreen /></ShellGate>} />
            {/* /play — the short link on promo endcards + social bio links.
                Public redirect into Career Path with attribution preserved
                (a bare hit gets ?ref=play); see lib/playShortLink.ts. */}
            <Route path="/play" element={<PlayShortLinkRoute />} />
            <Route path="/v2/verve-grid" element={<ShellGate><UsernameOnlyRoute><VerveGridPlayScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* Daily reuses the migrated Quiz view but runs the DAILY session.
                Username tier (anonymous OK): the daily is the habit loop, so a
                one-tap guest must reach it — attempts and streaks key off the
                server identity, and the daily never touches ELO. */}
            <Route path="/v2/daily" element={<ShellGate><UsernameOnlyRoute><DailyQuizPlayScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* Daily Survival — the same SurvivalPlayScreen running the shared
                daily queue. Username tier like the daily quiz: casual, no ELO. */}
            <Route path="/v2/daily-survival" element={<ShellGate><UsernameOnlyRoute><SurvivalPlayScreen daily /></UsernameOnlyRoute></ShellGate>} />
            {/* Arena (multi-user) is username-only playable; the screen onboards
                inline so a shared invite link never drops its lobby code. */}
            <Route path="/v2/arena/:code" element={<ShellGate><ArenaPlayScreen /></ShellGate>} />
            {/* THE WEEKEND crew draft rooms (FW-3). Username tier, Arena-style:
                crews are the social unit; UsernameOnlyRoute preserves ?next= so
                a shared crew link onboards and lands back on the crew page,
                where the screen attempts the idempotent code join. */}
            <Route path="/v2/weekend/crews" element={<ShellGate><UsernameOnlyRoute><WeekendCrewsScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/weekend/crew/:code" element={<ShellGate><UsernameOnlyRoute><CrewScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/weekend/draft/:roomId" element={<ShellGate><UsernameOnlyRoute><DraftRoomScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* THE WEEKEND budget mode (FW-LAUNCH O1). Unlinked from any nav;
                the screen itself gates on the backend answering (fail-closed,
                HomeWeekendTeaser-style), so the frontend can ship first. */}
            <Route path="/v2/weekend/squad" element={<ShellGate><UsernameOnlyRoute><BudgetSquadScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/weekend/vote" element={<ShellGate><UsernameOnlyRoute><VoteScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/weekend/court" element={<ShellGate><UsernameOnlyRoute><CourtScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/v2/weekend/sheet/:roomId" element={<ShellGate><UsernameOnlyRoute><CrewSheetScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* THE DRAW — dev/preview only, flag-gated (VITE_DRAW_ENABLED),
                not linked from home, nav, or any mode grid. */}
            <Route path="/draw" element={<DrawScreen />} />
            {/* THE DRAW share-link landing (Ticket I) — bare like
                /duel/:linkCode: no auth wall, no chrome, works logged-out.
                Unlike /s/d/ (nginx→Convex OG route), /s/r/ is an SPA route. */}
            <Route path="/s/r/:slug" element={<DrawShareLanding />} />
            {/* DEV-only mock harness (Ticket G3): LocalMockApi-driven, for
                visual QA of the c13-2 UI. Redirects home in prod builds. */}
            <Route path="/draw-harness" element={<DrawMockHarness />} />
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
