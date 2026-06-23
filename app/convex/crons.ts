import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("season-check", { hourUTC: 0, minuteUTC: 0 }, internal.seasonManager.checkSeason);
crons.daily("daily-challenge-generator", { hourUTC: 0, minuteUTC: 1 }, internal.dailyChallenge.generateTodaysChallenges);
crons.daily("elo-decay-check", { hourUTC: 0, minuteUTC: 5 }, internal.eloDecay.runDecay);
crons.interval("live-match-stale-check", { minutes: 1 }, internal.liveMatches.reapStaleMatches);
crons.interval("expired-session-cleanup", { hours: 1 }, internal.maintenance.cleanupExpiredSessions, {});
crons.interval("async-duel-expiry", { hours: 1 }, internal.duels.expireStaleDuels, {});
crons.interval("challenge-arena-expiry", { hours: 1 }, internal.challengeArenas.expireStaleArenas);
// Founder ops: emails the prior UTC day's unique-player count (incl. guests).
crons.daily("daily-active-users-email", { hourUTC: 0, minuteUTC: 30 }, internal.opsActiveUsers.emailDailyReport, {});

export default crons;
