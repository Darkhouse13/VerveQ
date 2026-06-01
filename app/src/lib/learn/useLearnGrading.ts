/**
 * Learn v2 — the SINGLE grading seam.
 *
 * Every Learn answer in the app is graded through `submitLearnAnswer` returned
 * here. The UI never decides correctness; it submits `{ sessionId, questionId,
 * answer }` and awaits the server's `LearnVerdict`.
 *
 * All four question types (mcq | text | numeric | order) route through the one
 * server-authoritative mutation `api.learn.submitLearnRung`. The mutation grades
 * the submission against the committed ladder (held server-side) and returns
 * `{ correct, branchId?, teach, masteryDelta?, nextReview? }`. The correct answer
 * itself is never returned — `teach` is the only reveal text, authored on the
 * server. There is NO client-side correctness logic anywhere in the Learn UI.
 *
 * Live content note: live ladders are MCQ-only today, so MCQ is the type
 * exercised end-to-end at runtime; text/numeric/order grade through the same
 * seam and are covered by the server grader tests until live content lands.
 */
import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LearnAnswer, LearnQuestion, LearnRating, LearnVerdict } from "./contract";

export interface LearnSessionRef {
  id: string;
  /** True when `id` is a real `learnSessions` row (the server-graded ladder path). */
  live: boolean;
}

/** Shape the per-type answer into the raw value the server grader expects. */
function toServerAnswer(answer: LearnAnswer): unknown {
  switch (answer.type) {
    case "mcq":
      return answer.key;
    case "text":
      return answer.text;
    case "numeric":
      return answer.value;
    case "order":
      return answer.order;
  }
}

export function useLearnGrading(session: LearnSessionRef) {
  const submitRung = useMutation(api.learn.submitLearnRung);

  const submitLearnAnswer = useCallback(
    async (question: LearnQuestion, answer: LearnAnswer): Promise<LearnVerdict> => {
      // Server-authoritative for every type: submit the answer, render the verdict.
      const verdict = await submitRung({
        sessionId: session.id as Id<"learnSessions">,
        questionId: question.id,
        answer: toServerAnswer(answer),
      });
      return {
        correct: verdict.correct,
        teach: verdict.teach,
        branchId: verdict.branchId,
        masteryDelta: verdict.masteryDelta,
        nextReview: verdict.nextReview,
      };
    },
    [submitRung, session.id],
  );

  // Spaced-rep rating + felt signal have no server endpoint yet. Routed through
  // the same seam so they swap to a real mutation in one place. Decides nothing.
  const rateCard = useCallback(
    async (_questionId: string, _rating: LearnRating): Promise<void> => {
      // ONE-LINE SWAP: await rateLearnCardV2({ sessionId: session.id, questionId, rating });
      return;
    },
    [],
  );

  return { submitLearnAnswer, rateCard };
}
