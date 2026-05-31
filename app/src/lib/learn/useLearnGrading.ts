/**
 * Learn v2 — the SINGLE grading seam.
 *
 * Every Learn answer in the app is graded through `submitLearnAnswer` returned
 * here. The UI never decides correctness; it awaits the `LearnVerdict`.
 *
 * Dispatch:
 *   - mcq on a LIVE session → existing server path `api.learn.submitLearnRung`
 *     (server-authoritative; returns { correct, correctAnswer, reveal }).
 *   - everything else → the quarantined stub (`gradeWithStub`).
 *
 * ── ONE-LINE SWAP ────────────────────────────────────────────────────────────
 * When Codex's graders land on `feat/v2-learn-graders`, replace the single
 * `gradeWithStub(question, answer)` call below with the real mutation:
 *
 *     const submitV2 = useMutation(api.learn.submitLearnAnswerV2);
 *     // …
 *     return await submitV2({ sessionId: session.id, questionId: question.id, answer });
 *
 * and delete `stubGrader.ts`. No other file changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LearnAnswer, LearnQuestion, LearnRating, LearnVerdict } from "./contract";
import { gradeWithStub } from "./stubGrader";

export interface LearnSessionRef {
  id: string;
  /** True when `id` is a real `learnSessions` row backing the MCQ ladder path. */
  live: boolean;
}

export function useLearnGrading(session: LearnSessionRef) {
  const submitRung = useMutation(api.learn.submitLearnRung);

  const submitLearnAnswer = useCallback(
    async (question: LearnQuestion, answer: LearnAnswer): Promise<LearnVerdict> => {
      // MCQ on a live session → existing server-graded ladder path.
      if (question.type === "mcq" && answer.type === "mcq" && session.live) {
        const res = await submitRung({
          sessionId: session.id as Id<"learnSessions">,
          rungId: question.id,
          chosenOption: answer.key,
        });
        return {
          correct: res.correct,
          teach: res.reveal,
          correctAnswer: res.correctAnswer,
          // A wrong pick with its own server reveal is, in effect, a known
          // misconception → surface the teaching detour before the reveal.
          branchId: res.correct ? undefined : `${question.id}:${answer.key}`,
        };
      }

      // text | numeric | order (and offline mcq) → stub until graders land.
      return gradeWithStub(question, answer);
    },
    [submitRung, session.id, session.live],
  );

  // Spaced-rep rating + felt signal have no server endpoint yet (Codex's pass).
  // Routed through the same seam so they swap to a real mutation in one place.
  const rateCard = useCallback(
    async (_questionId: string, _rating: LearnRating): Promise<void> => {
      // ONE-LINE SWAP: await rateLearnCardV2({ sessionId: session.id, questionId, rating });
      return;
    },
    [],
  );

  return { submitLearnAnswer, rateCard };
}
