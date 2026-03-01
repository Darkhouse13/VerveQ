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
import type * as challenges from "../challenges.js";
import type * as games from "../games.js";
import type * as http from "../http.js";
import type * as leaderboards from "../leaderboards.js";
import type * as lib_elo from "../lib/elo.js";
import type * as lib_fuzzy from "../lib/fuzzy.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as profile from "../profile.js";
import type * as quizSessions from "../quizSessions.js";
import type * as seedAchievements from "../seedAchievements.js";
import type * as seedQuestions from "../seedQuestions.js";
import type * as sports from "../sports.js";
import type * as survivalSessions from "../survivalSessions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  achievements: typeof achievements;
  auth: typeof auth;
  challenges: typeof challenges;
  games: typeof games;
  http: typeof http;
  leaderboards: typeof leaderboards;
  "lib/elo": typeof lib_elo;
  "lib/fuzzy": typeof lib_fuzzy;
  "lib/scoring": typeof lib_scoring;
  profile: typeof profile;
  quizSessions: typeof quizSessions;
  seedAchievements: typeof seedAchievements;
  seedQuestions: typeof seedQuestions;
  sports: typeof sports;
  survivalSessions: typeof survivalSessions;
  users: typeof users;
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
