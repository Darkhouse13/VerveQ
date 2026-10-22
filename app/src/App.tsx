import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Suspense, type ReactNode } from "react";
import { isInkEntryPath } from "./lib/inkEntry";
import { InkLoader } from "./components/shell/InkLoader";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, UsernameRequiredRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AnalyticsPageviews } from "./components/AnalyticsPageviews";
// Entry routing: "/" resolves by session (cold landing, login, or the shell
// Home at "/home").
import {
  EntryRoute,
  PlayShortLinkRoute,
  WhosOlderShortLinkRoute,
  MissingLettersShortLinkRoute,
  WeekendShortLinkRoute,
} from "./components/EntryRoutes";
// Deep-link aliases: legacy v1 mode URLs (and spelling variants like
// /vervegrid) forward to the shell surface for that mode so shared links land
// on the mode they name.
import { LegacyRedirect, DropV2Redirect } from "./components/LegacyRedirect";
// v1 screens still live in production (embedded in the shell or reused by the
// v2 play flow) stay statically imported.
import OnboardingScreen from "./pages/OnboardingScreen";
import DifficultyScreen from "./pages/DifficultyScreen";
import ChallengeScreen from "./pages/ChallengeScreen";
import ForgeScreen from "./pages/ForgeScreen";
import NotFound from "./pages/NotFound";
import { ShellGate } from "./components/shell/ShellGate";
import { FirstRunLanguagePrompt } from "./components/shell/FirstRunLanguagePrompt";
import { RouteMeta } from "./components/RouteMeta";
import { SeoPageHost, SeoRouteOutlet } from "./components/seo/SeoPageHost";
import { isOnStaticPage } from "./lib/seoPages";
import {
  SessionRoute,
  UsernameOnlyRoute,
  FullAccountRoute,
} from "./components/shell/ShellRouteGuards";

// The unified shell. Lazy so each screen stays out of the main bundle.
// ShellHomeScreen is the PLAY tab (decision 10): it replaced both Home and the
// Compete mode grid, whose screen was removed — /compete now redirects here.
const ShellHomeScreen = lazyWithRetry(() => import("./pages/shell/ShellHomeScreen"));
const RanksScreen = lazyWithRetry(() => import("./pages/shell/RanksScreen"));
const ShellProfileScreen = lazyWithRetry(() => import("./pages/shell/ShellProfileScreen"));
const SettingsScreen = lazyWithRetry(() => import("./pages/shell/SettingsScreen"));
const AccountChoiceScreen = lazyWithRetry(() => import("./pages/shell/AccountChoiceScreen"));
const WelcomeScreen = lazyWithRetry(() => import("./pages/shell/WelcomeScreen"));
const UpgradeScreen = lazyWithRetry(() => import("./pages/shell/UpgradeScreen"));
const ArenaHubScreen = lazyWithRetry(() => import("./pages/shell/ArenaHubScreen"));

// Public legal pages — flag-independent (app-store / launch necessities).
const PrivacyScreen = lazyWithRetry(() => import("./pages/legal/PrivacyScreen"));
const TermsScreen = lazyWithRetry(() => import("./pages/legal/TermsScreen"));

// Learn v2 (the Learn pillar) — lazy.
const LearnEntryScreen = lazyWithRetry(() => import("./pages/shell/learn/LearnEntryScreen"));
const LearnRunnerScreen = lazyWithRetry(() => import("./pages/shell/learn/LearnRunnerScreen"));
const LearnReviewScreen = lazyWithRetry(() => import("./pages/shell/learn/LearnReviewScreen"));
const LearnMasteryScreen = lazyWithRetry(() => import("./pages/shell/learn/LearnMasteryScreen"));

// In-game layout (migrated modes) — lazy.
const QuizPlayScreen = lazyWithRetry(() => import("./pages/shell/play/QuizPlayScreen"));
const BlitzPlayScreen = lazyWithRetry(() => import("./pages/shell/play/BlitzPlayScreen"));
const SurvivalPlayScreen = lazyWithRetry(() => import("./pages/shell/play/SurvivalPlayScreen"));
const HigherLowerPlayScreen = lazyWithRetry(() => import("./pages/shell/play/HigherLowerPlayScreen"));
const CareerPathPlayScreen = lazyWithRetry(() => import("./pages/shell/play/CareerPathPlayScreen"));
const VerveGridPlayScreen = lazyWithRetry(() => import("./pages/shell/play/VerveGridPlayScreen"));
const DailyQuizPlayScreen = lazyWithRetry(() => import("./pages/shell/play/DailyQuizPlayScreen"));
const WhosOlderPlayScreen = lazyWithRetry(() => import("./pages/shell/play/WhosOlderPlayScreen"));
const MissingLettersPlayScreen = lazyWithRetry(() => import("./pages/shell/play/MissingLettersPlayScreen"));
const ArenaPlayScreen = lazyWithRetry(() => import("./pages/shell/play/ArenaPlayScreen"));
// THE WEEKEND (FW-GO: launched, publicly linked). Hub first, then the surfaces.
const WeekendHubScreen = lazyWithRetry(() => import("./pages/shell/weekend/WeekendHubScreen"));
const WeekendCrewsScreen = lazyWithRetry(() => import("./pages/shell/weekend/WeekendCrewsScreen"));
const CrewScreen = lazyWithRetry(() => import("./pages/shell/weekend/CrewScreen"));
const CrewCommandScreen = lazyWithRetry(() => import("./pages/shell/weekend/CrewCommandScreen"));
const DraftRoomScreen = lazyWithRetry(() => import("./pages/shell/weekend/DraftRoomScreen"));
const BudgetSquadScreen = lazyWithRetry(() => import("./pages/shell/weekend/BudgetSquadScreen"));
const VoteScreen = lazyWithRetry(() => import("./pages/shell/weekend/VoteScreen"));
const VoteCardHarness = lazyWithRetry(() => import("./pages/shell/weekend/VoteCardHarness"));
const CourtScreen = lazyWithRetry(() => import("./pages/shell/weekend/CourtScreen"));
const CrewSheetScreen = lazyWithRetry(() => import("./pages/shell/weekend/CrewSheetScreen"));
const WeekendHowToPlayScreen = lazyWithRetry(() => import("./pages/shell/weekend/WeekendHowToPlayScreen"));
const FixturesScreen = lazyWithRetry(() => import("./pages/shell/weekend/FixturesScreen"));
const WeekendLeaderboardScreen = lazyWithRetry(() => import("./pages/shell/weekend/WeekendLeaderboardScreen"));
const WeekendReceiptScreen = lazyWithRetry(() => import("./pages/shell/weekend/WeekendReceiptScreen"));

const DuelPlayScreen = lazyWithRetry(() => import("./pages/DuelPlayScreen"));
const DuelLinkScreen = lazyWithRetry(() => import("./pages/DuelLinkScreen"));
const DuelResultScreen = lazyWithRetry(() => import("./pages/DuelResultScreen"));
const DuelHistoryScreen = lazyWithRetry(() => import("./pages/DuelHistoryScreen"));
const RivalsListScreen = lazyWithRetry(() => import("./pages/RivalsScreen"));
const RivalDetailScreen = lazyWithRetry(() =>
  import("./pages/RivalsScreen").then((m) => ({ default: m.RivalDetailScreen })),
);

// THE DRAW (Ticket B) — mock-driven, flag-gated via VITE_DRAW_ENABLED inside
// the screen itself; unlinked from any nav. Lazy so it stays out of the main
// bundle; with the flag off the route just bounces to "/".
const DrawScreen = lazyWithRetry(() => import("./pages/draw/DrawScreen"));
const DrawMockHarness = lazyWithRetry(() => import("./pages/draw/DrawMockHarness"));
const KitchenSink = lazyWithRetry(() => import("./pages/dev/KitchenSink"));
const DrawShareLanding = lazyWithRetry(() => import("./pages/draw/DrawShareLanding"));

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string,
);

function LazyFallback() {
  if (isInkEntryPath(window.location.pathname)) return <InkLoader />;
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="font-heading font-bold animate-pulse">Loading…</p>
    </div>
  );
}

/**
 * The app's frame. On a static SEO page the frame holds only overlays (the
 * page itself is the server-rendered #seo block after #root), so it must not
 * claim a full screen of height above that content.
 */
function AppFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const staticPage = isOnStaticPage(pathname);
  return (
    <div className={staticPage ? "max-w-md mx-auto relative" : "max-w-md mx-auto min-h-screen relative safe-pt"}>
      {children}
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
        {/* Static SEO layer bridge (app/seo/build.mjs): shows/hides the
            server-rendered #seo block and routes its Play links client-side. */}
        <SeoPageHost />
        {/* safe-pt covers the v1 screens, which render in normal document flow
            rather than inside one of the `fixed inset-0` shell frames. The
            frames are position:fixed and this wrapper creates no containing
            block for them (position:relative doesn't), so they keep their own
            inset and never double up with this one. */}
        <AppFrame>
          {/* One-time language chooser, overlays whatever screen loads first. */}
          <FirstRunLanguagePrompt />
          {/* The add-to-home-screen bar is NOT mounted here: it renders in
              flow inside ShellLayout (hub screens only), so it can never sit
              on top of a game's bottom-docked buttons. */}
          <Routes>
            <Route path="/" element={<EntryRoute />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingScreen />
                </ProtectedRoute>
              }
            />
            <Route path="/sport-select" element={<LegacyRedirect to="/home#more" />} />
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
            {/* The v1 result pages are retired (VerveQ ONE P3.1): every solo
                mode shows its result in place, inside its own frame, so these
                paths only catch stale links and history entries. A result
                page with no run behind it has nothing to show, so each lands
                where its mode lives: the mode grid, or Home's Today row for
                the dailies. */}
            <Route path="/results" element={<LegacyRedirect to="/home#more" />} />
            <Route path="/challenge" element={<LegacyRedirect to="/duels" />} />
            {/* Bare /duel(s) name the head-to-head surface; only the deeper
                /duel/:linkCode + play/result URLs are real v1 flows. */}
            <Route path="/duel" element={<LegacyRedirect to="/duels" />} />
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
            <Route path="/daily-quiz" element={<LegacyRedirect to="/daily?sport=football" />} />
            <Route path="/daily-results" element={<LegacyRedirect to="/home" />} />
            <Route path="/blitz-results" element={<LegacyRedirect to="/home#more" />} />
            {/* Live Match was removed 2026-07: nothing in the product could
                create a match (the challenge subsystem went in PR #11), so the
                viewer routes advertised a dead end. Old /live-match and
                /waiting-room URLs now fall through to NotFound. */}
            <Route path="/higherlower" element={<LegacyRedirect to="/higher-lower?sport=football" />} />
            <Route path="/vervegrid" element={<LegacyRedirect to="/verve-grid?sport=football" />} />
            {/* Old Learn prototype URLs forward to the Learn pillar. */}
            <Route path="/learn/geography" element={<LegacyRedirect to="/learn" />} />
            <Route path="/learn/geography/:nodeId" element={<LegacyRedirect to="/learn" />} />
            <Route path="/learn/prototype" element={<LegacyRedirect to="/learn" />} />
            {/* Shell routes. ShellGate gives each a local Suspense boundary. */}
            <Route path="/home" element={<ShellGate><ShellHomeScreen /></ShellGate>} />
            {/* Account chooser for logged-out visitors hitting a gated surface:
                sign in / create account / play as guest. Carries ?next=. */}
            <Route path="/account" element={<ShellGate><AccountChoiceScreen /></ShellGate>} />
            {/* Username-only onboarding (no password) — the guest path and the
                invite-flow ask. Carries ?next= + ?code=. */}
            <Route path="/welcome" element={<ShellGate><WelcomeScreen /></ShellGate>} />
            {/* Anonymous + username -> full account upgrade. Carries ?next=. */}
            <Route path="/upgrade" element={<ShellGate><UpgradeScreen /></ShellGate>} />
            {/* Compete merged into Play (decision 10): every Compete URL lands
                on Play with the More games catalogue open (#more) — that is
                where the modes the grid listed now live. Params and an
                incoming #anchor survive (LegacyRedirect). SEO pages and old
                links still point at /compete, so these stay registered. */}
            <Route path="/compete" element={<LegacyRedirect to="/home#more" />} />
            <Route path="/compete/sport" element={<LegacyRedirect to="/home#more" />} />
            <Route path="/compete/sport/:sport" element={<LegacyRedirect to="/home#more" />} />
            {/* Ranks (decision 10): ONE screen, Ladder | Leaderboard segments,
                each with its own URL so old links open the right one. Open to
                all (username-only sees the locked ranked pitch); Profile needs
                a server identity, so it mirrors the casual-mode gate. */}
            <Route path="/ranks" element={<ShellGate><RanksScreen /></ShellGate>} />
            <Route path="/leaderboard" element={<ShellGate><RanksScreen /></ShellGate>} />
            <Route
              path="/profile"
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
              path="/settings"
              element={
                <ShellGate>
                  <SettingsScreen />
                </ShellGate>
              }
            />
            {/* Duels, Rivals and the Forge — shell-native screens (VerveQ ONE
                P3.3) that render their own ShellLayout. Gating mirrors the old
                v1 routes. */}
            <Route
              path="/duels"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <ChallengeScreen />
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            <Route
              path="/duels/history"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <DuelHistoryScreen />
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            {/* Arena entry hub — group challenge rooms (create / join by code),
                distinct from Duels. Same server gate as the rooms themselves:
                any user WITH a username (assertUsernameRequiredUser); logged-out
                visitors onboard with ?next= back here instead of bouncing home. */}
            <Route
              path="/arena"
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
              path="/forge"
              element={
                <ShellGate>
                  <FullAccountRoute>
                    <ForgeScreen />
                  </FullAccountRoute>
                </ShellGate>
              }
            />
            <Route
              path="/rivals"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <RivalsListScreen />
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            <Route
              path="/rivals/:opponentUserId"
              element={
                <ShellGate>
                  <UsernameOnlyRoute>
                    <RivalDetailScreen />
                  </UsernameOnlyRoute>
                </ShellGate>
              }
            />
            {/* Learn v2 — Learn pillar (entry / run / review / mastery). */}
            <Route path="/learn" element={<ShellGate><SessionRoute><LearnEntryScreen /></SessionRoute></ShellGate>} />
            <Route path="/learn/run" element={<ShellGate><SessionRoute><LearnRunnerScreen /></SessionRoute></ShellGate>} />
            <Route path="/learn/review" element={<ShellGate><SessionRoute><LearnReviewScreen /></SessionRoute></ShellGate>} />
            <Route path="/learn/mastery" element={<ShellGate><SessionRoute><LearnMasteryScreen /></SessionRoute></ShellGate>} />
            {/* In-game prototype layout — migrated modes. Gating reflects the
                server's eligibility (convex/lib/authz.ts): ranked modes require a
                full account; casual/social modes admit anyone with a username
                (anonymous or full). Arena self-gates inline to preserve its code. */}
            {/* Ranked: full account required. */}
            <Route path="/quiz" element={<ShellGate><FullAccountRoute><QuizPlayScreen /></FullAccountRoute></ShellGate>} />
            <Route path="/survival" element={<ShellGate><FullAccountRoute><SurvivalPlayScreen /></FullAccountRoute></ShellGate>} />
            {/* Casual/social: username-only playable. */}
            <Route path="/blitz" element={<ShellGate><SessionRoute><BlitzPlayScreen /></SessionRoute></ShellGate>} />
            <Route path="/higher-lower" element={<ShellGate><SessionRoute><HigherLowerPlayScreen /></SessionRoute></ShellGate>} />
            {/* Career Path is the marketed mode: GUEST-PLAYABLE with zero login.
                No route guard — a logged-out visitor plays instantly via a client
                guestToken (careerPath.ts accepts unauthenticated guests). */}
            <Route path="/career-path" element={<ShellGate><CareerPathPlayScreen /></ShellGate>} />
            {/* /play — the short link on promo endcards + social bio links.
                Public redirect into Career Path with attribution preserved
                (a bare hit gets ?ref=play); see lib/playShortLink.ts. */}
            <Route path="/play" element={<PlayShortLinkRoute />} />
            <Route path="/verve-grid" element={<ShellGate><SessionRoute><VerveGridPlayScreen /></SessionRoute></ShellGate>} />
            {/* Daily reuses the migrated Quiz view but runs the DAILY session.
                Username tier (anonymous OK): the daily is the habit loop, so a
                one-tap guest must reach it — attempts and streaks key off the
                server identity, and the daily never touches ELO. */}
            <Route path="/daily" element={<ShellGate><SessionRoute><DailyQuizPlayScreen /></SessionRoute></ShellGate>} />
            {/* Daily Survival — the same SurvivalPlayScreen running the shared
                daily queue. Username tier like the daily quiz: casual, no ELO. */}
            <Route path="/daily-survival" element={<ShellGate><SessionRoute><SurvivalPlayScreen daily /></SessionRoute></ShellGate>} />
            {/* WHO'S OLDER? — the daily twin of the reel format, then endless.
                Username tier like the other dailies: casual, no ELO, so a reel
                visitor plays on a silently-minted anonymous session. /older is the
                caption short link; a cold landing on either gets ?ref=older. */}
            <Route path="/whos-older" element={<WhosOlderShortLinkRoute><ShellGate><SessionRoute><WhosOlderPlayScreen /></SessionRoute></ShellGate></WhosOlderShortLinkRoute>} />
            <Route path="/older" element={<WhosOlderShortLinkRoute />} />
            {/* MISSING LETTERS — the daily twin of the reel the feed runs three
                times a day, then endless. Same tier and short-link rules as
                Who's Older: /letters is the short link; a cold landing on either
                gets ?ref=letters. */}
            <Route path="/missing-letters" element={<MissingLettersShortLinkRoute><ShellGate><SessionRoute><MissingLettersPlayScreen /></SessionRoute></ShellGate></MissingLettersShortLinkRoute>} />
            <Route path="/letters" element={<MissingLettersShortLinkRoute />} />
            {/* Arena (multi-user) is username-only playable; the screen onboards
                inline so a shared invite link never drops its lobby code. */}
            <Route path="/arena/:code" element={<ShellGate><ArenaPlayScreen /></ShellGate>} />
            {/* THE WEEKEND hub (FW-GO) — the mode's public front door. ShellGate
                only, no session guard: a short-link visitor sees the mode before
                being asked for anything; each door's route keeps its own tier. */}
            {/* /weekend is also the reel-caption + bio link: a cold landing
                gets ?ref=weekend, and paid links carrying ?start=budget go
                straight into the budget-squad builder (WKND-ENTRY); see
                lib/weekendDeepLink.ts. */}
            <Route path="/weekend" element={<WeekendShortLinkRoute><ShellGate><WeekendHubScreen /></ShellGate></WeekendShortLinkRoute>} />
            {/* THE WEEKEND crew draft rooms (FW-3). Username tier, Arena-style:
                crews are the social unit; UsernameOnlyRoute preserves ?next= so
                a shared crew link onboards and lands back on the crew page,
                where the screen attempts the idempotent code join. */}
            <Route path="/weekend/crews" element={<ShellGate><UsernameOnlyRoute><WeekendCrewsScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/weekend/crew/:code" element={<ShellGate><UsernameOnlyRoute><CrewScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/weekend/crew/:code/command" element={<ShellGate><UsernameOnlyRoute><CrewCommandScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/weekend/draft/:roomId" element={<ShellGate><UsernameOnlyRoute><DraftRoomScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* THE WEEKEND budget mode (FW-LAUNCH O1). Linked from the hub; the
                screen still gates on the backend answering (fail-closed).
                SessionRoute, not UsernameOnlyRoute (WKND-ENTRY): the budget
                squad is solo — no other human sees a name — and the server
                asserts only an identity (fantasySquads.requireUserId), so the
                username gate here was stricter than the backend and blocked
                the paid direct-to-builder entry. */}
            <Route path="/weekend/squad" element={<ShellGate><SessionRoute><BudgetSquadScreen /></SessionRoute></ShellGate>} />
            <Route path="/weekend/vote" element={<ShellGate><UsernameOnlyRoute><VoteScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* DEV-only vote-card harness (EYE-TEST-CONTEXT; DrawMockHarness
                precedent): fabricated pair, no auth. Redirects home in prod. */}
            <Route path="/weekend/vote-harness" element={<ShellGate><VoteCardHarness /></ShellGate>} />
            <Route path="/weekend/court" element={<ShellGate><UsernameOnlyRoute><CourtScreen /></UsernameOnlyRoute></ShellGate>} />
            <Route path="/weekend/sheet/:roomId" element={<ShellGate><UsernameOnlyRoute><CrewSheetScreen /></UsernameOnlyRoute></ShellGate>} />
            {/* THE WEEKEND rules screen (FW-EXPAND U3). Public like the hub —
                rules need no session. */}
            <Route path="/weekend/how-to-play" element={<ShellGate><WeekendHowToPlayScreen /></ShellGate>} />
            {/* THE WEEKEND fixtures (FW-IMMERSE A3). Public like the hub —
                the weekend's matchday list is read-only, no session. */}
            <Route path="/weekend/fixtures" element={<ShellGate><FixturesScreen /></ShellGate>} />
            {/* Global THE WEEKEND table — public like the fixtures, and scoped
                strictly to budget squads for the open gameweek. */}
            <Route path="/weekend/leaderboard" element={<ShellGate><WeekendLeaderboardScreen /></ShellGate>} />
            {/* THE WEEKEND settlement receipt (FW-RECEIPT). Username tier —
                a receipt is the caller's own squad, settled. */}
            <Route path="/weekend/receipt/:gameweekId" element={<ShellGate><UsernameOnlyRoute><WeekendReceiptScreen /></UsernameOnlyRoute></ShellGate>} />
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
            {/* DEV-only design-system kitchen sink (VerveQ ONE P1.8). Redirects home in prod. */}
            <Route path="/dev/kitchen-sink" element={<KitchenSink />} />
            {/* Public legal pages — no auth, no flag gate (launch/app-store
                requirements; must render regardless of rollout state). */}
            <Route path="/privacy" element={<PrivacyScreen />} />
            <Route path="/terms" element={<TermsScreen />} />
            {/* Static SEO layer — the page HTML is already in the document. */}
            <Route path="/games/*" element={<SeoRouteOutlet />} />
            <Route path="/football-quiz/*" element={<SeoRouteOutlet />} />
            <Route path="/who-played-for/*" element={<SeoRouteOutlet />} />
            <Route path="/career-path-quiz/*" element={<SeoRouteOutlet />} />
            <Route path="/fr/*" element={<SeoRouteOutlet />} />
            <Route path="/es/*" element={<SeoRouteOutlet />} />
            <Route path="/about/*" element={<SeoRouteOutlet />} />
            {/* The shell used to live under /v2 (until 2026-10). nginx 301s those
                URLs; this catches the ones that never reach nginx (an installed
                PWA's service worker serves the app shell from cache). */}
            <Route path="/v2" element={<DropV2Redirect />} />
            <Route path="/v2/*" element={<DropV2Redirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppFrame>
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
