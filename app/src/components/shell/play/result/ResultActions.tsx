/**
 * ResultActions — the ways on from a result (VerveQ ONE P2.2), in the owner's
 * order: ONE primary lime button (56px), then the "Next today" card, then the
 * secondary buttons. Taking actions as data rather than nodes is what keeps a
 * result screen at exactly one primary button.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, House, Type, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NextToday } from "./nextToday";

export interface ResultAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  testId?: string;
}

export interface ResultActionsProps {
  /** The screen's one primary action (lime on the ink ground). */
  primary: ResultAction;
  /** "Next today" — rendered between the primary and the secondaries. */
  next?: ReactNode;
  secondary?: ReadonlyArray<ResultAction>;
  /** A quiet line under the secondaries (e.g. the best endless streak). */
  note?: ReactNode;
}

export function ResultActions({ primary, next, secondary = [], note }: ResultActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        size="lg"
        block
        onClick={primary.onClick}
        disabled={primary.disabled}
        loading={primary.loading}
        data-testid={primary.testId}
      >
        {primary.icon}
        {primary.label}
      </Button>
      {next}
      {secondary.map((a) => (
        <Button
          key={a.testId ?? a.label}
          variant="secondary"
          size="md"
          block
          onClick={a.onClick}
          disabled={a.disabled}
          loading={a.loading}
          data-testid={a.testId}
        >
          {a.icon}
          {a.label}
        </Button>
      ))}
      {note}
    </div>
  );
}

/** The identifying tile per target: each daily in its own mode color. */
const TILE = {
  older: { cls: "bg-electric-blue text-ink", Icon: Users },
  letters: { cls: "bg-hot-pink text-ink", Icon: Type },
  home: { cls: "bg-muted text-foreground", Icon: House },
} as const;

/**
 * "Next today": a card-link to the other daily, or to Home once both are
 * done. `onFollow` fires on the tap (analytics).
 */
export function NextTodayCard({
  target,
  testId,
  onFollow,
}: {
  target: NextToday;
  testId?: string;
  onFollow?: () => void;
}) {
  const { t } = useTranslation("play");
  const key = target.kind === "game" ? target.game : "home";
  const { cls, Icon } = TILE[key];
  return (
    <Link
      to={target.route}
      onClick={onFollow}
      data-testid={testId}
      data-target={key}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-lg bg-card p-3 text-card-foreground neo-border neo-shadow",
        "transition duration-press active:translate-x-0.5 active:translate-y-0.5 active:neo-shadow-sm hover:bg-muted",
      )}
    >
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-md neo-border", cls)} aria-hidden="true">
        <Icon size={22} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-eyebrow uppercase text-muted-foreground">{t("result.nextToday")}</span>
        <span className="block font-heading font-bold text-body">{t(`result.next.${key}.title`)}</span>
        <span className="block truncate text-meta text-muted-foreground">{t(`result.next.${key}.body`)}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
