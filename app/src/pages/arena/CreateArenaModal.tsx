import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Check, Minus, Plus } from "lucide-react";
import { notify } from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { friendlyError } from "@/lib/errors";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { FullscreenFlow } from "@/components/ui/fullscreen-flow";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import {
  ARENA_CATEGORY_OPTIONS,
  ARENA_DEFAULT_CATEGORIES,
  ARENA_DEFAULT_PER_ROUND,
  ARENA_DEFAULT_ROUNDS,
  ARENA_MAX_PER_ROUND,
  ARENA_MAX_ROUNDS,
  ARENA_MAX_TOTAL_QUESTIONS,
  ARENA_MIN_PER_ROUND,
  ARENA_MIN_ROUNDS,
  ARENA_MODE_OPTIONS,
  arenaConfigError,
  arenaConfigErrorFallback,
  buildArenaCategories,
  type ArenaMode,
} from "@/lib/arena";

function Stepper({
  label,
  value,
  onDec,
  onInc,
  canDec,
  canInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  canDec: boolean;
  canInc: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="font-heading font-bold text-body-sm">{label}</p>
      <div className="flex items-center gap-3">
        <IconButton
          variant="secondary"
          onClick={onDec}
          disabled={!canDec}
          aria-label={`${label} −`}
          className="disabled:is-dimmed"
        >
          <Minus strokeWidth={3} />
        </IconButton>
        <span className="font-mono font-bold text-body w-6 text-center tabular-nums">
          {value}
        </span>
        <IconButton
          variant="secondary"
          onClick={onInc}
          disabled={!canInc}
          aria-label={`${label} +`}
          className="disabled:is-dimmed"
        >
          <Plus strokeWidth={3} />
        </IconButton>
      </div>
    </div>
  );
}

export default function CreateArenaModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (code: string) => void;
}) {
  const { t } = useTranslation("screens");
  const [mode, setMode] = useState<ArenaMode>("1v1");
  const [rounds, setRounds] = useState(ARENA_DEFAULT_ROUNDS);
  const [perRound, setPerRound] = useState(ARENA_DEFAULT_PER_ROUND);
  const [subjects, setSubjects] = useState<string[]>([...ARENA_DEFAULT_CATEGORIES]);
  const [submitting, setSubmitting] = useState(false);
  const create = useMutation(api.challengeArenas.create);

  // You can't pick more subjects than there are rounds (extra subjects would
  // never appear in the rotation). When rounds shrinks below the current
  // selection, drop the trailing subjects (keeping option order) to match.
  useEffect(() => {
    setSubjects((prev) => {
      if (prev.length <= rounds) return prev;
      const trimmed = ARENA_CATEGORY_OPTIONS.map((o) => o.key)
        .filter((key) => prev.includes(key))
        .slice(0, rounds);
      return trimmed;
    });
  }, [rounds]);

  const categories = useMemo(
    () => buildArenaCategories(subjects, rounds),
    [subjects, rounds],
  );
  const total = rounds * perRound;
  const configError = arenaConfigError({ rounds, perRound, categories });
  const configErrorText = configError
    ? t(`createArena.error_${configError.code}`, {
        defaultValue: arenaConfigErrorFallback(configError),
        min:
          configError.code === "perRound" ? ARENA_MIN_PER_ROUND : ARENA_MIN_ROUNDS,
        max:
          configError.code === "perRound"
            ? ARENA_MAX_PER_ROUND
            : configError.code === "total"
              ? ARENA_MAX_TOTAL_QUESTIONS
              : ARENA_MAX_ROUNDS,
        total: configError.code === "total" ? configError.total : undefined,
      })
    : null;
  const atSubjectCap = subjects.length >= rounds;
  const canIncRounds =
    rounds < ARENA_MAX_ROUNDS && (rounds + 1) * perRound <= ARENA_MAX_TOTAL_QUESTIONS;
  const canIncPerRound =
    perRound < ARENA_MAX_PER_ROUND &&
    rounds * (perRound + 1) <= ARENA_MAX_TOTAL_QUESTIONS;

  const toggleSubject = (key: string) => {
    setSubjects((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= rounds) return prev; // at cap — can't add more
      return [...prev, key];
    });
  };

  const handleCreate = async () => {
    if (submitting || configError) return;
    setSubmitting(true);
    try {
      const result = await create({ mode, rounds, perRound, categories });
      onCreated(result.code);
    } catch (e) {
      notify.error(friendlyError(e, t("createArena.createError")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FullscreenFlow
      onClose={onClose}
      title={t("createArena.title")}
      closeLabel={t("createArena.closeAria")}
      bodyClassName="px-5 pb-2 pt-1 scrollbar-none"
      footer={
        <NeoButton
          variant="primary"
          size="full"
          disabled={submitting || !!configError}
          onClick={handleCreate}
        >
          {submitting ? t("createArena.creating") : t("createArena.createButton")}
        </NeoButton>
      }
    >
      <p className="text-meta text-muted-foreground mb-3">
        {t("createArena.pickModeHint")}
      </p>

      <div className="space-y-2">
        {ARENA_MODE_OPTIONS.map((opt) => (
          <NeoCard
            key={opt.key}
            color={mode === opt.key ? "primary" : "default"}
            onClick={() => setMode(opt.key)}
            className="flex items-center justify-between !p-3"
          >
            <div className="min-w-0">
              <p className="font-heading font-bold text-body-sm leading-tight">
                {t(`createArena.mode_${opt.key}_label`, { defaultValue: opt.label })}
              </p>
              <p className="text-meta text-muted-foreground truncate leading-tight mt-0.5">
                {t(`createArena.mode_${opt.key}_desc`, { defaultValue: opt.description })}
              </p>
            </div>
            <NeoBadge
              color={mode === opt.key ? "accent" : "muted"}
              size="sm"
            >
              {t("createArena.capacityMax", { count: opt.capacity })}
            </NeoBadge>
          </NeoCard>
        ))}
      </div>

      <p className="font-heading font-bold text-eyebrow uppercase mt-5 mb-2">
        {t("createArena.formatHeading", { defaultValue: "Format" })}
      </p>

      <NeoCard className="!p-4 space-y-4">
        <Stepper
          label={t("createArena.roundsLabel", { defaultValue: "Rounds" })}
          value={rounds}
          onDec={() => setRounds((r) => Math.max(ARENA_MIN_ROUNDS, r - 1))}
          onInc={() => setRounds((r) => r + 1)}
          canDec={rounds > ARENA_MIN_ROUNDS}
          canInc={canIncRounds}
        />
        <Stepper
          label={t("createArena.perRoundLabel", { defaultValue: "Questions / round" })}
          value={perRound}
          onDec={() =>
            setPerRound((p) => Math.max(ARENA_MIN_PER_ROUND, p - 1))
          }
          onInc={() => setPerRound((p) => p + 1)}
          canDec={perRound > ARENA_MIN_PER_ROUND}
          canInc={canIncPerRound}
        />
        <p className="text-meta text-muted-foreground">
          {t("createArena.totalSummary", {
            defaultValue: "{{total}} questions total (max {{max}}).",
            total,
            max: ARENA_MAX_TOTAL_QUESTIONS,
          })}
        </p>
      </NeoCard>

      <p className="font-heading font-bold text-eyebrow uppercase mt-5 mb-1">
        {t("createArena.subjectsHeading", { defaultValue: "Subjects" })}
      </p>
      <p className="text-meta text-muted-foreground mb-2">
        {t("createArena.subjectsHint", {
          defaultValue: "Rounds rotate through the subjects you pick.",
        })}{" "}
        {t("createArena.subjectsCapHint", {
          defaultValue: "Up to {{count}} (one per round).",
          count: rounds,
        })}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {ARENA_CATEGORY_OPTIONS.map((opt) => {
          const selected = subjects.includes(opt.key);
          const disabled = !selected && atSubjectCap;
          return (
            <Card
              key={opt.key}
              interactive
              padding="none"
              onClick={() => toggleSubject(opt.key)}
              aria-pressed={selected}
              disabled={disabled}
              className={cn(
                "p-2.5 flex items-start gap-2",
                selected ? "bg-primary text-primary-foreground on-fill" : "bg-background disabled:is-dimmed",
              )}
            >
              <span className="text-title-sm leading-none mt-0.5">{opt.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="font-heading font-bold text-meta leading-tight flex items-center gap-1">
                  {t(`createArena.subject_${opt.key}`, { defaultValue: opt.label })}
                  {selected && <Check size={13} strokeWidth={3} className="shrink-0" />}
                </span>
                <span className="block text-meta text-muted-foreground leading-tight mt-0.5">
                  {t(`createArena.subjectBlurb_${opt.key}`, { defaultValue: opt.blurb })}
                </span>
              </span>
            </Card>
          );
        })}
      </div>

      {configErrorText && (
        <p className="text-meta text-destructive font-medium mt-3">
          {configErrorText}
        </p>
      )}
    </FullscreenFlow>
  );
}
