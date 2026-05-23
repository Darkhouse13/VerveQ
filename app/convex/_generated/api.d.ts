/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievements from "../achievements.js";
import type * as auth from "../auth.js";
import type * as authEmail from "../authEmail.js";
import type * as blitz from "../blitz.js";
import type * as challengeArenaContent from "../challengeArenaContent.js";
import type * as challengeArenas from "../challengeArenas.js";
import type * as challenges from "../challenges.js";
import type * as crons from "../crons.js";
import type * as dailyChallenge from "../dailyChallenge.js";
import type * as duels from "../duels.js";
import type * as eloDecay from "../eloDecay.js";
import type * as forge from "../forge.js";
import type * as games from "../games.js";
import type * as higherLower from "../higherLower.js";
import type * as http from "../http.js";
import type * as knowledgeQuestions from "../knowledgeQuestions.js";
import type * as leaderboards from "../leaderboards.js";
import type * as lib_answerOptions from "../lib/answerOptions.js";
import type * as lib_daily from "../lib/daily.js";
import type * as lib_elo from "../lib/elo.js";
import type * as lib_fuzzy from "../lib/fuzzy.js";
import type * as lib_imageQuestions from "../lib/imageQuestions.js";
import type * as lib_passwordPolicy from "../lib/passwordPolicy.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as liveMatches from "../liveMatches.js";
import type * as maintenance from "../maintenance.js";
import type * as notifications from "../notifications.js";
import type * as profile from "../profile.js";
import type * as quizSessions from "../quizSessions.js";
import type * as rivalries from "../rivalries.js";
import type * as seasonManager from "../seasonManager.js";
import type * as seedAchievements from "../seedAchievements.js";
import type * as seedQuestions from "../seedQuestions.js";
import type * as seedSportsData from "../seedSportsData.js";
import type * as sports from "../sports.js";
import type * as storage from "../storage.js";
import type * as survivalSessions from "../survivalSessions.js";
import type * as users from "../users.js";
import type * as verveGrid from "../verveGrid.js";
import type * as whoAmI from "../whoAmI.js";
import type * as whoAmIPlayerSearch from "../whoAmIPlayerSearch.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  achievements: typeof achievements;
  auth: typeof auth;
  authEmail: typeof authEmail;
  blitz: typeof blitz;
  challengeArenaContent: typeof challengeArenaContent;
  challengeArenas: typeof challengeArenas;
  challenges: typeof challenges;
  crons: typeof crons;
  dailyChallenge: typeof dailyChallenge;
  duels: typeof duels;
  eloDecay: typeof eloDecay;
  forge: typeof forge;
  games: typeof games;
  higherLower: typeof higherLower;
  http: typeof http;
  knowledgeQuestions: typeof knowledgeQuestions;
  leaderboards: typeof leaderboards;
  "lib/answerOptions": typeof lib_answerOptions;
  "lib/daily": typeof lib_daily;
  "lib/elo": typeof lib_elo;
  "lib/fuzzy": typeof lib_fuzzy;
  "lib/imageQuestions": typeof lib_imageQuestions;
  "lib/passwordPolicy": typeof lib_passwordPolicy;
  "lib/scoring": typeof lib_scoring;
  liveMatches: typeof liveMatches;
  maintenance: typeof maintenance;
  notifications: typeof notifications;
  profile: typeof profile;
  quizSessions: typeof quizSessions;
  rivalries: typeof rivalries;
  seasonManager: typeof seasonManager;
  seedAchievements: typeof seedAchievements;
  seedQuestions: typeof seedQuestions;
  seedSportsData: typeof seedSportsData;
  sports: typeof sports;
  storage: typeof storage;
  survivalSessions: typeof survivalSessions;
  users: typeof users;
  verveGrid: typeof verveGrid;
  whoAmI: typeof whoAmI;
  whoAmIPlayerSearch: typeof whoAmIPlayerSearch;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
