/**
 * D2 — the pure run state machine.
 *
 * No I/O, no Date.now, no Math.random. Every transition is
 * applyChoice(board, config, state, choice) ⇒ new state (inputs never
 * mutated). replay(board, config, choiceLog) reproduces the identical
 * RunResult — property-tested in app/src/test/.
 *
 * Flow: 6 draft picks (one per row) → F1 plays automatically → on clear,
 * BANK (run ends) or PUSH (next fixture plays). Fail ⇒ final =
 * cumulative × bustKeep. Clearing the boss ⇒ final = cumulative × fullClearBonus.
 */

import { scoreRound } from "./scoring";
import type {
  BoardSpec,
  Card,
  Choice,
  ChoiceLog,
  EngineConfig,
  RunResult,
  RunState,
} from "./types";

export function initRun(board: BoardSpec): RunState {
  return {
    boardSeed: board.seed,
    phase: "draft",
    rowIndex: 0,
    squad: [],
    fixtureIndex: 0,
    cumulative: 0,
    rounds: [],
    choiceLog: [],
    outcome: null,
    finalScore: null,
  };
}

function squadCards(board: BoardSpec, state: RunState): Card[] {
  const byId = new Map<string, Card>();
  for (const row of board.rows) for (const card of row) byId.set(card.id, card);
  return state.squad.map((id) => {
    const card = byId.get(id);
    if (!card) throw new Error(`Squad card ${id} not on board ${board.seed}`);
    return card;
  });
}

/** Plays state.fixtureIndex and settles the aftermath. Mutates the (fresh) state. */
function playFixture(board: BoardSpec, config: EngineConfig, state: RunState): void {
  const fixture = board.fixtures[state.fixtureIndex];
  const round = scoreRound(board.seed, squadCards(board, state), fixture, config);
  state.rounds = [...state.rounds, round];
  if (!round.cleared) {
    state.phase = "done";
    state.outcome = "busted";
    state.finalScore = state.cumulative * config.bustKeep;
    return;
  }
  state.cumulative += round.score;
  if (fixture.isBoss) {
    state.phase = "done";
    state.outcome = "fullclear";
    state.finalScore = state.cumulative * config.fullClearBonus;
    return;
  }
  state.phase = "decision";
}

/**
 * Apply one choice. Throws on illegal choices (wrong phase, offer out of
 * range). Returns a new state; the input state is never modified.
 */
export function applyChoice(
  board: BoardSpec,
  config: EngineConfig,
  state: RunState,
  choice: Choice,
): RunState {
  if (state.phase === "done") throw new Error("Run is finished");
  const next: RunState = {
    ...state,
    squad: [...state.squad],
    rounds: [...state.rounds],
    choiceLog: [...state.choiceLog, choice],
  };

  if (state.phase === "draft") {
    if (choice.type !== "pick") throw new Error(`Expected a pick in draft phase, got ${choice.type}`);
    if (choice.offerIndex < 0 || choice.offerIndex >= config.offersPerRow || !Number.isInteger(choice.offerIndex)) {
      throw new Error(`offerIndex ${choice.offerIndex} out of range 0..${config.offersPerRow - 1}`);
    }
    next.squad.push(board.rows[state.rowIndex][choice.offerIndex].id);
    next.rowIndex = state.rowIndex + 1;
    if (next.rowIndex === config.rows) {
      // Draft complete — F1 plays immediately (no skips, no redraft).
      playFixture(board, config, next);
    }
    return next;
  }

  // decision phase
  if (choice.type === "bank") {
    next.phase = "done";
    next.outcome = "banked";
    next.finalScore = state.cumulative;
    return next;
  }
  if (choice.type === "push") {
    next.fixtureIndex = state.fixtureIndex + 1;
    playFixture(board, config, next);
    return next;
  }
  throw new Error(`Expected bank or push in decision phase, got ${choice.type}`);
}

export function toResult(state: RunState): RunResult {
  if (state.phase !== "done" || state.outcome === null || state.finalScore === null) {
    throw new Error("Run is not finished");
  }
  return {
    boardSeed: state.boardSeed,
    finalScore: state.finalScore,
    roundsCleared: state.rounds.filter((r) => r.cleared).length,
    outcome: state.outcome,
    rounds: state.rounds,
    choiceLog: state.choiceLog,
  };
}

/** Replay a full choice log from scratch. Must land on an identical RunResult. */
export function replay(board: BoardSpec, config: EngineConfig, log: ChoiceLog): RunResult {
  let state = initRun(board);
  for (const choice of log) state = applyChoice(board, config, state, choice);
  return toResult(state);
}

/** RunState is plain JSON data; these helpers make the round-trip contract explicit. */
export function serializeRunState(state: RunState): string {
  return JSON.stringify(state);
}

export function deserializeRunState(json: string): RunState {
  return JSON.parse(json) as RunState;
}
