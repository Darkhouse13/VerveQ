/**
 * Learn v2 — the four question-type renderers (controlled).
 *
 * Each renders distinctly and is server-authoritative: reveal coloring is driven
 * by the `LearnVerdict` from the grading seam, never by client-side grading.
 */
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
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

function isOptionCorrect(optKey: string, optText: string, verdict: LearnVerdict | null) {
  if (!verdict) return false;
  return verdict.correctAnswer === optKey || verdict.correctAnswer === optText;
}

function McqRenderer({ question, draft, setDraft, reveal, verdict }: RendererProps) {
  const q = question as LearnMcqQuestion;
  const picked = typeof draft === "string" ? draft : null;
  return (
    <div className="flex flex-col gap-2.5">
      {q.options.map((o) => {
        const isPicked = picked === o.key;
        const correct = reveal && isOptionCorrect(o.key, o.text, verdict);
        const wrong = reveal && isPicked && !correct;
        const dimmed = reveal && !correct && !wrong;
        return (
          <button
            key={o.key}
            type="button"
            disabled={reveal}
            onClick={() => setDraft(o.key)}
            className={cn(
              "neo-border rounded-xl px-4 py-3.5 text-left flex items-center gap-3 font-medium transition-all",
              correct && "bg-success text-success-foreground",
              wrong && "bg-destructive text-destructive-foreground",
              !reveal && isPicked && "bg-foreground text-background translate-x-0.5 translate-y-0.5",
              !reveal && !isPicked && "bg-card neo-shadow-sm hover:-translate-x-0.5 hover:-translate-y-0.5",
              dimmed && "bg-card opacity-50",
            )}
          >
            <span className="font-heading grid place-items-center w-7 h-7 shrink-0 rounded-md border-2 border-current text-sm">
              {o.key}
            </span>
            <span className="flex-1">{o.text}</span>
            {correct && <Check size={18} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

function TextRenderer({ question, draft, setDraft, reveal, verdict }: RendererProps) {
  const q = question as LearnTextQuestion;
  const { t } = useTranslation("learn");
  const value = typeof draft === "string" ? draft : "";
  const ok = reveal && !!verdict?.correct;
  return (
    <div>
      <input
        value={value}
        disabled={reveal}
        placeholder={q.placeholder ?? t("run.textPlaceholder")}
        onChange={(e) => setDraft(e.target.value)}
        className={cn(
          "w-full neo-border rounded-xl neo-shadow-sm px-4 py-4 text-lg font-semibold outline-none",
          reveal && ok ? "bg-success text-success-foreground" : "bg-card",
        )}
      />
      {reveal && verdict?.correctAnswer && (
        <p className="font-mono text-xs mt-2.5 text-muted-foreground">
          {t("run.accepted")}{" "}
          <b className="text-foreground">{verdict.correctAnswer}</b>
        </p>
      )}
    </div>
  );
}

function NumericRenderer({ question, draft, setDraft, reveal, verdict }: RendererProps) {
  const q = question as LearnNumericQuestion;
  const value = typeof draft === "string" ? draft : "";
  const ok = reveal && !!verdict?.correct;
  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        inputMode="numeric"
        value={value}
        disabled={reveal}
        placeholder="00"
        onChange={(e) => setDraft(e.target.value)}
        className={cn(
          "w-36 neo-border rounded-xl neo-shadow-sm px-4 py-3 text-center font-heading font-black text-4xl outline-none",
          reveal && ok ? "bg-success text-success-foreground" : "bg-card",
        )}
      />
      {q.unit && (
        <span className="font-heading text-xl text-muted-foreground">{q.unit}</span>
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
              "neo-border rounded-xl neo-shadow-sm px-3.5 py-3 flex items-center gap-3",
              reveal
                ? verdict?.correct
                  ? "bg-success text-success-foreground"
                  : "bg-destructive text-destructive-foreground"
                : "bg-card",
            )}
          >
            <span className="font-heading text-base w-5 text-center">{i + 1}</span>
            <span className="flex-1 font-bold text-sm">{it?.text}</span>
            {!reveal && (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  aria-label={t("run.moveUp")}
                  onClick={() => move(i, -1)}
                  className="border-2 border-foreground rounded bg-card w-7 h-5 grid place-items-center text-[10px] leading-none"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={t("run.moveDown")}
                  onClick={() => move(i, 1)}
                  className="border-2 border-foreground rounded bg-card w-7 h-5 grid place-items-center text-[10px] leading-none"
                >
                  ▼
                </button>
              </div>
            )}
          </div>
        );
      })}
      {reveal && verdict?.correctAnswer && (
        <p className="font-mono text-xs mt-1 text-muted-foreground">
          {t("run.correctOrder")}{" "}
          <b className="text-foreground">{verdict.correctAnswer}</b>
        </p>
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
