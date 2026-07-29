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
// FW-3 draft rooms: expires dead lobbies and re-drives any room whose
// scheduled hop was lost. Every action is a guarded no-op on a healthy room,
// so the tight interval buys stall-recovery, not load.
crons.interval("fantasy-draft-room-sweep", { minutes: 5 }, internal.fantasyDraftRooms.draftRoomSweep, {});

export default crons;
