/**
 * ⚠️ TEMPORARY — SERVER GRADER STAND-IN. DELETE ON SWAP. ⚠️
 *
 * This module is the ONLY place in the client that decides correctness, and it
 * exists solely so the Learn v2 UI (reveal, branch, rating) is reviewable before
 * the real server graders land. It emulates what the server will return for
 * `text | numeric | order` questions.
 *
 * Codex implements the real graders on `feat/v2-learn-graders`. When they land,
 * the ONE-LINE SWAP in `useLearnGrading.ts` replaces the call to
 * `gradeWithStub(...)` with the real `api.learn.submitLearnAnswerV2(...)`
 * mutation, and this file is deleted. No correctness logic lives anywhere else
 * in the frontend (the live MCQ path is already fully server-graded).
 *
 * The answer key below is quarantined here on purpose: it is NOT imported by any
 * component, page, hook, or the render-only fixtures.
 */
import type { LearnAnswer, LearnQuestion, LearnVerdict } from "./contract";

interface StubAnswerKey {
  /** Canonical display answer shown on reveal. */
  correctAnswer: string;
  /** Correct option key (mcq). */
  correctKey?: string;
  /** Trap option key that routes to a teaching detour (mcq). */
  branchOn?: string;
  /** Detour teaching for the trap answer (mcq). */
  branchTeach?: string;
  /** Accepted normalized strings (text). */
  accept?: string[];
  /** Correct numeric value (numeric). */
  value?: number;
  /** Correct id order, earliest first (order). */
  order?: string[];
  /** Server teaching payload — the "why", never restates the answer. */
  teach: string;
}

const STUB_KEY: Record<string, StubAnswerKey> = {
  "fx-mcq-gd": {
    correctAnswer: "They win the league — points come first.",
    correctKey: "A",
    branchOn: "C",
    branchTeach:
      "Tempting — GD is famous for deciding 1989 and 2012. But those were teams LEVEL on points. Here one side has more points, so the tiebreaker never triggers.",
    teach:
      "Goal difference only matters when points are LEVEL. With more points you're champion outright — GD never enters the picture. The 'level on points' detail is the trap.",
  },
  "fx-text-wc": {
    correctAnswer: "Brazil",
    accept: ["brazil"],
    teach:
      "Brazil is the constant — present at all 22 tournaments since 1930. A useful anchor: build other World Cup facts around 'who was missing', because Brazil never was.",
  },
  "fx-num-players": {
    correctAnswer: "7",
    value: 7,
    teach:
      "Below 7 and the match is abandoned. The logic: a team is 11, and the laws tolerate losing up to 4 (red cards / injuries) before the contest is no longer valid.",
  },
  "fx-order-pl": {
    correctAnswer: "Man Utd → Arsenal → Chelsea → Man City",
    order: ["mu", "ars", "che", "mc"],
    teach:
      "Order tracks the eras: United owned the 90s, Arsenal's 'Invincibles' build began late-90s, Chelsea arrived with new ownership in '05, City's project peaked in 2012.",
  },
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Emulated server verdict for non-MCQ types. Mirrors the real contract exactly.
 * Sets `pendingGrader: true` so the UI can surface that this verdict came from
 * the stand-in, not the real grader.
 */
export function gradeWithStub(
  question: LearnQuestion,
  answer: LearnAnswer,
): LearnVerdict {
  const key = STUB_KEY[question.id];
  if (!key) {
    return {
      correct: false,
      teach: "Grader pending — this question type is graded server-side.",
      pendingGrader: true,
    };
  }

  // MCQ wrong-but-known-trap → teaching detour (branch) before the reveal.
  if (answer.type === "mcq" && key.correctKey) {
    const correct = answer.key === key.correctKey;
    const hitTrap = !correct && answer.key === key.branchOn;
    return {
      correct,
      teach: hitTrap && key.branchTeach ? key.branchTeach : key.teach,
      correctAnswer: key.correctAnswer,
      branchId: hitTrap ? `${question.id}:${answer.key}` : undefined,
      pendingGrader: true,
    };
  }

  let correct = false;
  if (answer.type === "text" && key.accept) {
    correct = key.accept.includes(norm(answer.text));
  } else if (answer.type === "numeric" && key.value != null) {
    correct = answer.value === key.value;
  } else if (answer.type === "order" && key.order) {
    correct = JSON.stringify(answer.order) === JSON.stringify(key.order);
  }

  return {
    correct,
    teach: key.teach,
    correctAnswer: key.correctAnswer,
    pendingGrader: true,
  };
}
