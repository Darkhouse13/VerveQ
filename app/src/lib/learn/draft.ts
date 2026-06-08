/**
 * Learn v2 — per-type editable draft helpers (pure; no React, no correctness).
 *
 * Kept separate from the renderers so the component module exports only
 * components (satisfies react-refresh/only-export-components).
 */
import type { LearnAnswer, LearnQuestion } from "./contract";

/** Per-type editable draft held by the runner. */
export type LearnDraft = string | string[] | null;

/** Build the typed answer the grading seam expects from the per-type draft. */
export function draftToAnswer(question: LearnQuestion, draft: LearnDraft): LearnAnswer {
  switch (question.type) {
    case "mcq":
      return { type: "mcq", key: typeof draft === "string" ? draft : "" };
    case "text":
      return { type: "text", text: typeof draft === "string" ? draft : "" };
    case "numeric":
      return { type: "numeric", value: Number(typeof draft === "string" ? draft : "") };
    case "order":
      return {
        type: "order",
        order: Array.isArray(draft) ? draft : question.items.map((i) => i.id),
      };
  }
}

/** Whether the current draft is submittable (UI gate only — NOT correctness). */
export function canSubmit(question: LearnQuestion, draft: LearnDraft): boolean {
  if (question.type === "order") return true; // always has a default order
  if (Array.isArray(draft)) return draft.length > 0;
  return typeof draft === "string" && draft.trim().length > 0;
}
