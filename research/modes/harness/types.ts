/**
 * Adapter interface for unbuilt game-mode candidates.
 *
 * A candidate is a pure, deterministic state machine. All stochasticity must be
 * seeded at `init(seed)` and carried inside the state `S`, so that `apply` is a
 * pure function of `(state, action)`. The runner relies on this to seed-pair
 * agents: the same seed must produce the same starting position for every agent.
 */

/** Uniform random in [0, 1). */
export type Rng = () => number;

/** Inert, JSON-shaped data. Information sets are data, never behaviour. */
export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

/** What the mode shows the player. */
export type PublicInfo = Json;

/** The content knowledge the mode withholds. */
export type PrivateInfo = Json;

/**
 * THE TWO-LAYER HIDDEN MODEL (R0.6)
 *
 * Hidden state is not one thing. It splits into two layers that a knowledgeable
 * player relates to completely differently:
 *
 *  - **Knowable facts** — content a well-informed player genuinely knows. Which
 *    club a player actually played for; what a stadium's capacity actually is.
 *    Withheld by the UI, but recoverable from the world.
 *
 *  - **Secrets** — content nobody can know, because it was drawn at random when
 *    the episode was seeded. Which of sixteen values today's hidden target is.
 *    No amount of football knowledge recovers it; only deduction narrows it.
 *
 * Before R0.6 the knowledge agents were handed the raw state, so they saw both
 * layers. On a secret-bearing mode that made `dKnowledge` measure
 * **clairvoyance** — the value of being told the answer — rather than the value
 * of knowing facts, and every deduction mode would have scored as pure recall.
 *
 * `knowledgeView` is the fix. It is the adapter author's declaration of where
 * that line falls, and the harness cannot infer it: `hidden()` returns both
 * layers mixed together and nothing in the shape of the data says which is
 * which. A secret-bearing mode that omits `knowledgeView` will silently report
 * inflated `dKnowledge`. That is the single most damaging mistake an adapter
 * author can make here, and it is why the default is documented as a claim
 * ("this mode has no secrets") rather than as a convenience.
 *
 * ADAPTER AUTHOR CONTRACT — isolation preconditions the harness does NOT
 * enforce. Violating any of them silently corrupts recallShare for your
 * candidate; the calibration adapters will not catch it.
 *
 * 1. `legalActions(state)` must be a function of revealed info only. The
 *    blind view hands no-knowledge agents the true state's action list, so
 *    action identities or counts that vary with hidden content leak through
 *    the view. Count/order parity is runtime-checked; identity-encoding is
 *    not and cannot be.
 *
 * 2. `revealed(state)` must return fresh data — primitives or copies. A live
 *    reference into `state` exposes everything reachable from it, hidden
 *    content included.
 *
 * 3. `determinize(revealed, rng)` must resample hidden content from the true
 *    prior given revealed info only. Any correlation with the actual hidden
 *    content beyond that prior is a leak.
 *
 * 4. `knowledgeView(state, rng)` must resample **only** the secret layer, from
 *    the same prior `determinize` would use given what is currently revealed,
 *    and must leave every knowable fact exactly as it is in `state`. Resampling
 *    a knowable fact understates `dKnowledge`; leaving a secret true overstates
 *    it. Both are silent.
 */
export interface ModeCandidate<
  S,
  A,
  Pub extends PublicInfo = PublicInfo,
  Priv extends PrivateInfo = PrivateInfo,
> {
  readonly id: string;

  /** One line, reproduced in the report header. */
  readonly description: string;

  /** Deterministic given `seed`. Carries any per-episode randomness inside S. */
  init(seed: number): S;

  /**
   * Ordered action list. The order is part of the contract: `determinize` must
   * return a state whose `legalActions` correspond positionally to the actions
   * available in the state that produced the revealed info.
   */
  legalActions(state: S): A[];

  /** Pure. Must not consult any RNG outside `state`. */
  apply(state: S, action: A): S;

  isTerminal(state: S): boolean;

  /**
   * Defined for every state, not just terminal ones. For modes with no partial
   * credit this is 0 until terminal — that is a legitimate answer and it is
   * what makes 1-ply greedy degenerate to random, which is itself a finding.
   */
  score(state: S): number;

  /** Content knowledge the mode exposes. */
  revealed(state: S): Pub;

  /** Content knowledge the mode withholds. Agents may only reach this via S. */
  hidden(state: S): Priv;

  /**
   * A full state consistent with `revealed`, with hidden content resampled
   * uniformly from its plausible space. This is what lets a skill agent search
   * without gaining knowledge. Must preserve the legal-action count and order.
   */
  determinize(revealed: Pub, rng: Rng): S;

  /**
   * The knowledge agents' information set: the true state with the **secret**
   * layer resampled and every **knowable fact** left true. See the two-layer
   * note above.
   *
   * Omitting it asserts "this mode has no secrets" and the harness uses the
   * identity, which is exactly the pre-R0.6 behaviour — so an adapter that does
   * not implement it produces bit-for-bit the numbers it produced before.
   *
   * Called once per decision for the 1-ply knowledge agent, and once per
   * rollout for the searching knowledge agent, so that the latter integrates
   * over the secret posterior rather than committing to one draw of it. Must
   * preserve the legal-action count and order, same as `determinize`.
   */
  knowledgeView?(state: S, rng: Rng): S;

  /** Bucket label for the terminal-state distribution. Defaults to the score. */
  terminalLabel?(state: S): string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyCandidate = ModeCandidate<any, any, any, any>;
