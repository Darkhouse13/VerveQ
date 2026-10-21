/**
 * AnswerOption — one multiple-choice answer in the solo MCQ modes (Quiz, Daily
 * Quiz, Blitz), with the shared verdict pattern (VerveQ ONE P3.1):
 *
 *   idle    a pressable card
 *   pending the player's pick while the server grades it — pressed in, flat,
 *           dashed, a spinner in the letter chip. It must not read as a
 *           button (or as a verdict): no fill, no shadow, no color.
 *   right   the right answer, revealed in green with ✓ — whether or not it
 *           was the pick
 *   wrong   the pick, when it was wrong: red with ✕
 *   dim     every other option once the verdict is in
 *
 * Green and red appear only here, as right and wrong.
 */
import { Check, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AnswerState } from "./answerState";

const STATE_CLASS: Record<AnswerState, string> = {
  idle: "bg-card text-card-foreground",
  pending: "!border-dashed bg-background text-foreground shadow-none translate-x-0.5 translate-y-0.5",
  right: "bg-verdict-right text-ink",
  wrong: "bg-verdict-wrong text-ink animate-shake-horizontal motion-reduce:animate-none",
  dim: "border-border/40 bg-background text-muted-foreground shadow-none",
};

export function AnswerOption({
  letter,
  label,
  state,
  disabled,
  onClick,
}: {
  letter: string;
  label: string;
  state: AnswerState;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      interactive
      elevation={state === "idle" || state === "right" || state === "wrong" ? "raised" : "flat"}
      padding="none"
      disabled={disabled}
      onClick={onClick}
      data-state={state}
      aria-busy={state === "pending" || undefined}
      className={cn("flex min-h-14 items-center gap-3 px-4 py-3", STATE_CLASS[state])}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full neo-border bg-background font-heading font-bold text-meta text-foreground"
        aria-hidden="true"
      >
        {state === "right" ? (
          <Check size={16} strokeWidth={3} />
        ) : state === "wrong" ? (
          <X size={16} strokeWidth={3} />
        ) : state === "pending" ? (
          <Loader2 size={16} strokeWidth={3} className="animate-spin motion-reduce:animate-none" />
        ) : (
          letter
        )}
      </span>
      <span className="font-heading font-bold text-body-sm">{label}</span>
    </Card>
  );
}
