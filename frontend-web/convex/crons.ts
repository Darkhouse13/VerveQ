import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("season-check", { hourUTC: 0, minuteUTC: 0 }, internal.seasonManager.checkSeason);
crons.daily("elo-decay-check", { hourUTC: 0, minuteUTC: 5 }, internal.eloDecay.runDecay);

export default crons;
