/**
 * Learn v2 — the four question-type renderers (controlled).
 *
 * Each renders distinctly and is server-authoritative: reveal coloring is driven
 * by the `LearnVerdict` from the grading seam, never by client-side grading.
 *
 * VerveQ ONE P4.3: the verdict colors are the app's — green for right, red for
 * wrong (no more coral) — and a miss shows the right answer in green whenever
 * the server returns it (`verdict.correctAnswer`): the green option for a
 * multiple choice, a revealed answer under a typed, numeric or ordering one.
 */
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { Card } from "@/components/ui/card";
import { RevealedAnswer } from "@/components/shell/play/StageSignals";
import type {
  LearnMcqQuestion,
  LearnNumericQuestion,
  LearnOrderQuestion,
  LearnQuestion,
  LearnTextQuestion,
  LearnVerdict,
} from "@/lib/learn/contract";
import type { LearnDraft } from "@/lib/learn/draft";

interface RendererProps {
  question: LearnQuestion;
  draft: LearnDraft;
  setDraft: (next: LearnDraft) => void;
  /** True once the attempt is graded → render the read-only reveal state. */
  reveal: boolean;
  verdict: LearnVerdict | null;
}

/** "The right answer: X", in green, under a missed typed/numeric/order answer. */
function RightAnswer({ label, answer }: { label: string; answer: string }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground" data-testid="learn-right-answer">
      {label}
      <RevealedAnswer>{answer}</RevealedAnswer>
    </p>
  );
}

const INPUT =
  "w-full neo-border rounded-lg px-4 outline-none disabled:cursor-default placeholder:text-muted-foreground";

/** The verdict fill for a graded input or row: green right, red wrong. */
function verdictFill(reveal: boolean, correct: boolean | undefined): string {
  if (!reveal) return "bg-card text-card-foreground";
  return correct ? "bg-verdict-right text-ink" : "bg-verdict-wrong text-ink";
}

function McqRenderer({ question, draft, setDraft, reveal, verdict }: RendererProps) {
  const q = question as LearnMcqQuestion;
  const picked = typeof draft === "string" ? draft : null;
  return (
    <div className="flex flex-col gap-2 md:gap-2.5">
      {q.options.map((o, index) => {
        const isPicked = picked === o.key;
        // Curated reveal rungs keep the correct answer private (it's carried in
        // the teach). Drill rungs return `correctAnswer` on a miss so the right
        // option is shown green here — the drill stays learnable without a fake
        // teach card.
        const isAnswer =
          reveal &&
          !!verdict?.correctAnswer &&
          (o.text === verdict.correctAnswer || o.key === verdict.correctAnswer);
        const correct = reveal && !!verdict && ((isPicked && verdict.correct) || isAnswer);
        const wrong = reveal && isPicked && !!verdict && !verdict.correct && !isAnswer;
        const dimmed = reveal && !isPicked && !isAnswer;
        return (
          <Card
            key={o.key}
            interactive
            elevation="flat"
            padding="none"
            disabled={reveal}
            onClick={() => setDraft(o.key)}
            aria-pressed={!reveal ? isPicked : undefined}
            data-verdict={correct ? "right" : wrong ? "wrong" : undefined}
            className={cn(
              "min-h-12 px-4 py-2.5 flex items-center gap-3 font-medium text-body disabled:cursor-default",
              "transition-[transform,background-color] duration-press md:py-3.5",
              correct && "bg-verdict-right text-ink",
              wrong && "bg-verdict-wrong text-ink",
              !reveal && isPicked && "bg-foreground text-background translate-x-0.5 translate-y-0.5",
              !reveal && !isPicked && "bg-card text-card-foreground neo-shadow-sm hover:bg-muted",
              dimmed && "bg-card text-muted-foreground",
            )}
          >
            {/* Display letter comes from position — live ladders key options by
                their text, which would otherwise be crammed into this chip. */}
            <span className="font-heading grid place-items-center w-7 h-7 shrink-0 rounded-md border-2 border-current text-body-sm">
              {String.fromCharCode(65 + index)}
            </span>
            <span className="flex-1">{o.text}</span>
            {correct && <Check size={18} strokeWidth={3} aria-hidden="true" />}
            {wrong && <X size={18} strokeWidth={3} aria-hidden="true" />}
          </Card>
        );
      })}
    </div>
  );
}

function TextRenderer({ question, draft, setDraft, reveal, verdict }: RendererProps) {
  const q = question as LearnTextQuestion;
  const { t } = useTranslation("learn");
  const value = typeof draft === "string" ? draft : "";
  return (
    <div>
      <input
        value={value}
        disabled={reveal}
        placeholder={q.placeholder ?? t("run.textPlaceholder")}
        onChange={(e) => setDraft(e.target.value)}
        className={cn(INPUT, "py-4 text-title-sm font-semibold", verdictFill(reveal, verdict?.correct))}
      />
      {reveal && verdict && !verdict.correct && verdict.correctAnswer && (
        <RightAnswer label={t("run.rightAnswer")} answer={verdict.correctAnswer} />
      )}
    </div>
  );
}

function NumericRenderer({ question, draft, setDraft, reveal, verdict }: RendererProps) {
  const q = question as LearnNumericQuestion;
  const { t } = useTranslation("learn");
  const value = typeof draft === "string" ? draft : "";
  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          disabled={reveal}
          placeholder="00"
          onChange={(e) => setDraft(e.target.value)}
          className={cn(
            INPUT,
            "w-36 py-3 text-center font-heading font-bold text-display",
            verdictFill(reveal, verdict?.correct),
          )}
        />
        {q.unit && <span className="font-heading text-title text-muted-foreground">{q.unit}</span>}
      </div>
      {reveal && verdict && !verdict.correct && verdict.correctAnswer && (
        <RightAnswer label={t("run.rightAnswer")} answer={verdict.correctAnswer} />
      )}
    </div>
  );
}

function OrderRenderer({ question, draft, setDraft, reveal, verdict }: RendererProps) {
  const q = question as LearnOrderQuestion;
  const { t } = useTranslation("learn");
  const order: string[] = Array.isArray(draft) ? draft : q.items.map((i) => i.id);
  const byId = Object.fromEntries(q.items.map((i) => [i.id, i] as const));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {order.map((id, i) => {
        const it = byId[id];
        return (
          <div
            key={id}
            className={cn(
              "neo-border rounded-lg neo-shadow-sm min-h-12 px-3.5 py-1 flex items-center gap-3",
              verdictFill(reveal, verdict?.correct),
            )}
          >
            <span className="font-heading text-body w-5 text-center">{i + 1}</span>
            <span className="flex-1 font-bold text-body-sm">{it?.text}</span>
            {!reveal && (
              <div className="flex gap-1">
                <IconButton
                  variant="ghost"
                  aria-label={t("run.moveUp")}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ChevronUp aria-hidden="true" />
                </IconButton>
                <IconButton
                  variant="ghost"
                  aria-label={t("run.moveDown")}
                  disabled={i === order.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown aria-hidden="true" />
                </IconButton>
              </div>
            )}
          </div>
        );
      })}
      {reveal && verdict && !verdict.correct && verdict.correctAnswer && (
        <RightAnswer label={t("run.correctOrder")} answer={verdict.correctAnswer} />
      )}
    </div>
  );
}

export function QuestionRenderer(props: RendererProps) {
  switch (props.question.type) {
    case "mcq":
      return <McqRenderer {...props} />;
    case "text":
      return <TextRenderer {...props} />;
    case "numeric":
      return <NumericRenderer {...props} />;
    case "order":
      return <OrderRenderer {...props} />;
    default:
      return null;
  }
}
