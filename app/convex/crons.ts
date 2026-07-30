import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("season-check", { hourUTC: 0, minuteUTC: 0 }, internal.seasonManager.checkSeason);
crons.daily("daily-challenge-generator", { hourUTC: 0, minuteUTC: 1 }, internal.dailyChallenge.generateTodaysChallenges);
crons.daily("elo-decay-check", { hourUTC: 0, minuteUTC: 5 }, internal.eloDecay.runDecay);
// live-match-stale-check was removed 2026-07 with the liveMatches subsystem.
crons.interval("expired-session-cleanup", { hours: 1 }, internal.maintenance.cleanupExpiredSessions, {});
crons.interval("async-duel-expiry", { hours: 1 }, internal.duels.expireStaleDuels, {});
crons.interval("challenge-arena-expiry", { hours: 1 }, internal.challengeArenas.expireStaleArenas);
// Founder ops: emails the prior UTC day's unique-player count (incl. guests).
crons.daily("daily-active-users-email", { hourUTC: 0, minuteUTC: 30 }, internal.opsActiveUsers.emailDailyReport, {});
// THE DRAW: pregenerate today's board (P0-runtime reroll chain, idempotent —
// draw.ts also generates lazily on the first request if this hasn't run).
crons.daily("draw-daily-board", { hourUTC: 0, minuteUTC: 2 }, internal.drawBoards.generateTodaysBoard, {});
// Weekend Fantasy (FW-2). ORDER IS LOAD-BEARING: the sync refreshes kickoff
// times, then the sweep stamps locks against them. Expressed as two cron
// schedules 5 minutes apart rather than one interval pair, because
// crons.interval gives no ordering guarantee between two jobs and a sweep that
// ran against a stale kickoff would stamp a lock at the wrong instant.
// 5 requests per sync x 96 runs/day = ~480/day against a measured 7,500/day cap.
crons.cron("fantasy-sync-fixtures", "0,15,30,45 * * * *", internal.fantasyIngest.syncFixtures, {});
crons.cron("fantasy-lock-sweep", "5,20,35,50 * * * *", internal.fantasyLocks.lockSweep, {});
// Weekend Fantasy scoring (FW-4). POST-FIXTURE ONLY — a fixture is read once it
// is FT-class and more than 2h past kickoff (ruling R2), never in play. Runs at
// :10 past each quarter, i.e. AFTER the :00/:15/:30/:45 fixture sync, because the
// pass decides what is scoreable from FW-2's fixture status rather than by asking
// the feed for it again. Idempotent: a fixture whose stat hash has not changed
// writes nothing at all, so a tick that finds nothing costs one query and zero
// requests. The action prints its call plan before every pull and refuses to
// spend if a gameweek projects past 500 calls.
crons.cron("fantasy-score-fixtures", "10,25,40,55 * * * *", internal.fantasyScores.scoreDueFixtures, {});
// Settlement (FW-4 R3/R7): flips a gameweek's totals provisional -> final at the
// finality instant FW-2 derived, and writes the unscored alert 6h before it.
// Quarter-hourly so a total is labelled final within 15 minutes of the cut, and
// so the 6h alert lands inside its window; it makes no network request at all.
crons.cron("fantasy-settle-gameweeks", "2,17,32,47 * * * *", internal.fantasyScores.settleGameweeks, {});
// Reclamation court (FW-LAUNCH O3): kills sub-threshold claims at Monday
// 23:59 and resolves trials in the Tuesday 21:00-23:59 verdict window —
// BEFORE the settlement above stamps the gameweek, by construction: runs at
// :7/:22/:37/:52 so a verdict never waits on the same tick that settles.
// Guarded no-op outside those windows; settled gameweeks are skipped whole.
crons.cron("fantasy-court-resolve", "7,22,37,52 * * * *", internal.fantasyCourt.resolveDueClaims, {});
// FW-3 draft rooms: expires dead lobbies and re-drives any room whose
// scheduled hop was lost. Every action is a guarded no-op on a healthy room,
// so the tight interval buys stall-recovery, not load.
crons.interval("fantasy-draft-room-sweep", { minutes: 5 }, internal.fantasyDraftRooms.draftRoomSweep, {});

export default crons;
