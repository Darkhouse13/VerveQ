import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Check, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { friendlyError } from "@/lib/errors";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
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
      <p className="font-heading font-bold text-sm">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDec}
          disabled={!canDec}
          aria-label={`${label} −`}
          className="neo-border neo-shadow rounded-lg w-9 h-9 bg-background inline-flex items-center justify-center cursor-pointer active:neo-shadow-pressed disabled:opacity-40 disabled:cursor-not-allowed disabled:active:neo-shadow"
        >
          <Minus size={16} strokeWidth={3} />
        </button>
        <span className="font-mono font-bold text-base w-6 text-center tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          disabled={!canInc}
          aria-label={`${label} +`}
          className="neo-border neo-shadow rounded-lg w-9 h-9 bg-background inline-flex items-center justify-center cursor-pointer active:neo-shadow-pressed disabled:opacity-40 disabled:cursor-not-allowed disabled:active:neo-shadow"
        >
          <Plus size={16} strokeWidth={3} />
        </button>
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

  const categories = useMemo(
    () => buildArenaCategories(subjects, rounds),
    [subjects, rounds],
  );
  const total = rounds * perRound;
  const configError = arenaConfigError({ rounds, perRound, categories });
  const canIncRounds =
    rounds < ARENA_MAX_ROUNDS && (rounds + 1) * perRound <= ARENA_MAX_TOTAL_QUESTIONS;
  const canIncPerRound =
    perRound < ARENA_MAX_PER_ROUND &&
    rounds * (perRound + 1) <= ARENA_MAX_TOTAL_QUESTIONS;

  const toggleSubject = (key: string) => {
    setSubjects((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleCreate = async () => {
    if (submitting || configError) return;
    setSubmitting(true);
    try {
      const result = await create({ mode, rounds, perRound, categories });
      onCreated(result.code);
    } catch (e) {
      toast.error(friendlyError(e, t("createArena.createError")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden md:items-center md:justify-center md:bg-background/80 md:backdrop-blur-sm md:p-6">
      <div className="w-full md:max-w-md mx-auto flex flex-col bg-background h-dvh max-h-dvh md:h-auto md:max-h-[88dvh] md:neo-border md:neo-shadow-lg md:rounded-xl md:overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed"
            aria-label={t("createArena.closeAria")}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
          <p className="font-heading font-bold text-sm uppercase">{t("createArena.title")}</p>
          <div className="w-9" />
        </div>

        <div className="px-5 flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-none md:flex-none md:max-h-[60vh] pb-2">
          <p className="text-xs text-muted-foreground mb-3">
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
                  <p className="font-heading font-bold text-sm leading-tight">
                    {t(`createArena.mode_${opt.key}_label`, { defaultValue: opt.label })}
                  </p>
                  <p className="text-[11px] opacity-90 truncate leading-tight mt-0.5">
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

          <p className="font-heading font-bold text-xs uppercase tracking-wide mt-5 mb-2">
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
            <p className="text-[11px] text-muted-foreground">
              {t("createArena.totalSummary", {
                defaultValue: "{{total}} questions total (max {{max}}).",
                total,
                max: ARENA_MAX_TOTAL_QUESTIONS,
              })}
            </p>
          </NeoCard>

          <p className="font-heading font-bold text-xs uppercase tracking-wide mt-5 mb-1">
            {t("createArena.subjectsHeading", { defaultValue: "Subjects" })}
          </p>
          <p className="text-[11px] text-muted-foreground mb-2">
            {t("createArena.subjectsHint", {
              defaultValue: "Rounds rotate through the subjects you pick.",
            })}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {ARENA_CATEGORY_OPTIONS.map((opt) => {
              const selected = subjects.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleSubject(opt.key)}
                  aria-pressed={selected}
                  className={`neo-border rounded-lg p-2.5 text-left flex items-start gap-2 cursor-pointer transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground neo-shadow"
                      : "bg-background neo-shadow active:neo-shadow-pressed"
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5">{opt.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-heading font-bold text-[13px] leading-tight flex items-center gap-1">
                      {t(`createArena.subject_${opt.key}`, { defaultValue: opt.label })}
                      {selected && <Check size={13} strokeWidth={3} className="shrink-0" />}
                    </span>
                    <span className="block text-[10px] opacity-80 leading-tight mt-0.5">
                      {t(`createArena.subjectBlurb_${opt.key}`, { defaultValue: opt.blurb })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {configError && (
            <p className="text-[11px] text-destructive font-medium mt-3">
              {configError}
            </p>
          )}
        </div>

        <div className="shrink-0 bg-background border-t-[3px] border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <NeoButton
            variant="primary"
            size="full"
            disabled={submitting || !!configError}
            onClick={handleCreate}
          >
            {submitting ? t("createArena.creating") : t("createArena.createButton")}
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
