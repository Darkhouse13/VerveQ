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
 * Rating and felt signals also go to the server. The client submits the user's
 * self-report only; scheduling is computed from server-stored outcomes.
 */
import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type {
  LearnAnswer,
  LearnFelt,
  LearnQuestion,
  LearnRating,
  LearnVerdict,
} from "./contract";

export interface LearnSessionRef {
  id: string;
  /** True when `id` is a real `learnSessions` row (the server-graded ladder path). */
  live: boolean;
}

/** Shape the per-type answer into the raw value the server grader expects. */
function toServerAnswer(question: LearnQuestion, answer: LearnAnswer): unknown {
  switch (answer.type) {
    case "mcq":
      return answer.key;
    case "text":
      return answer.text;
    case "numeric":
      return question.type === "numeric" && question.unit
        ? { value: answer.value, unit: question.unit }
        : answer.value;
    case "order":
      return answer.order;
  }
}

export function useLearnGrading(session: LearnSessionRef) {
  const submitRung = useMutation(api.learn.submitLearnRung);
  const rateRung = useMutation(api.learn.rateLearnRung);
  const recordFelt = useMutation(api.learn.recordLearnRungFelt);
  const completeLadder = useMutation(api.learn.completeLearnLadder);

  const submitLearnAnswer = useCallback(
    async (question: LearnQuestion, answer: LearnAnswer): Promise<LearnVerdict> => {
      if (!session.live) {
        // Defense-in-depth: a non-live session (e.g. the dev fixture deck) must
        // never reach the Convex grader — its id is not a learnSessions row.
        throw new Error("Learn session is not live; cannot grade answers");
      }
      // Server-authoritative for every type: submit the answer, render the verdict.
      const verdict = await submitRung({
        sessionId: session.id as Id<"learnSessions">,
        questionId: question.id,
        answer: toServerAnswer(question, answer),
      });
      return {
        correct: verdict.correct,
        teach: verdict.teach,
        branchId: verdict.branchId,
        correctAnswer: verdict.correctAnswer,
        masteryDelta: verdict.masteryDelta,
        nextReview: verdict.nextReview,
      };
    },
    [submitRung, session.id, session.live],
  );

  const rateCard = useCallback(
    async (questionId: string, rating: LearnRating): Promise<void> => {
      if (!session.live) return;
      await rateRung({
        sessionId: session.id as Id<"learnSessions">,
        questionId,
        rating,
      });
    },
    [rateRung, session.id, session.live],
  );

  const recordFeltSignal = useCallback(
    async (questionId: string, felt: LearnFelt): Promise<void> => {
      if (!session.live) return;
      await recordFelt({
        sessionId: session.id as Id<"learnSessions">,
        questionId,
        felt,
      });
    },
    [recordFelt, session.id, session.live],
  );

  const completeLearnSession = useCallback(async (): Promise<void> => {
    if (!session.live) return;
    await completeLadder({ sessionId: session.id as Id<"learnSessions"> });
  }, [completeLadder, session.id, session.live]);

  return { submitLearnAnswer, rateCard, recordFeltSignal, completeLearnSession };
}
