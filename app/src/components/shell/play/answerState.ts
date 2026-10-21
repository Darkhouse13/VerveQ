/** The verdict state of one multiple-choice answer (see AnswerOption). */
export type AnswerState = "idle" | "pending" | "right" | "wrong" | "dim";

/** The state of option `idx` from the play hook's view state. */
export function answerState(
  idx: number,
  { selected, revealed, correctIdx }: { selected: number | null; revealed: boolean; correctIdx: number },
): AnswerState {
  if (!revealed) return selected === idx ? "pending" : "idle";
  if (idx === correctIdx) return "right";
  if (idx === selected) return "wrong";
  return "dim";
}
