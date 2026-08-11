/**
 * THE WEEKEND — the ONE formation chooser (FW-POLISH-2 R1).
 *
 * One component, one truth: shape (the famous-formation catalogue, R2) and
 * finisher roles together. Two entries render it:
 *
 *   1. The setup page ("Building for GW…") — inline, the full chooser above
 *      START BUILDING (CreateSquadView).
 *   2. The pitch screen — the header's "SHAPE — 4-2-3-1" label is tappable
 *      and opens the same chooser as a bottom sheet (FormationSection below).
 *      The old inline chip rows are gone.
 *
 * Selection semantics stay the parent's: a same-band pick is a pure re-layout
 * (client-side, no mutation); a band change goes through planFormationChange
 * and the parent's confirm/tray flow (budget: displaced picks wait in the
 * tray; crew: players field out of role after an explicit confirm). Locked
 * slots keep disabling what they make unreachable.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, Lock, X } from "lucide-react";
import { SLOT_ROLES, type SlotRole } from "../../../convex/lib/fantasyConstants";
import {
  FORMATION_CATALOGUE,
  currentShape,
  planFormationChange,
  sameShape,
  type FormationPlan,
  type NamedFormation,
  type PlannerSlot,
} from "@/lib/weekendFormations";
import { NeoButton } from "@/components/neo/NeoButton";

/** A finisher line in the chooser: `id` is echoed back by onFinisherRole
 *  (the finisher's slotIndex on a live squad; 0/1 during creation). */
export interface ChooserFinisher {
  id: number;
  role: SlotRole;
  locked: boolean;
}

export function FormationChooser({
  selectedName,
  disabledNames,
  busy = false,
  onSelectFormation,
  finishers,
  onFinisherRole,
}: {
  selectedName: string | null;
  disabledNames?: ReadonlySet<string>;
  busy?: boolean;
  onSelectFormation: (formation: NamedFormation) => void;
  finishers: ReadonlyArray<ChooserFinisher>;
  onFinisherRole: (id: number, role: SlotRole) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          {t("weekend.shape", { defaultValue: "Your shape" })}
        </p>
        <div className="grid grid-cols-3 gap-1.5" data-testid="formation-chips">
          {FORMATION_CATALOGUE.map((formation) => (
            <NeoButton
              key={formation.name}
              variant={selectedName === formation.name ? "primary" : "outline"}
              size="sm"
              className="font-mono tabular-nums px-1 text-[11px]"
              disabled={busy || (disabledNames?.has(formation.name) ?? false)}
              aria-pressed={selectedName === formation.name}
              onClick={() => onSelectFormation(formation)}
            >
              {formation.name}
            </NeoButton>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {t("weekend.shapeNote", {
            defaultValue:
              "Change it any time before kick-off — nothing is set in stone yet.",
          })}
        </p>
      </div>

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          {t("weekend.finisherRoles", { defaultValue: "Your finishers" })}
        </p>
        {finishers.map((finisher) => (
          <div key={finisher.id} className="flex gap-1.5 mb-1.5 items-center">
            {SLOT_ROLES.map((role) => (
              <NeoButton
                key={role}
                variant={finisher.role === role ? "primary" : "outline"}
                size="sm"
                className="flex-1"
                disabled={busy || finisher.locked}
                aria-pressed={finisher.role === role}
                onClick={() => onFinisherRole(finisher.id, role)}
              >
                {role}
              </NeoButton>
            ))}
            {finisher.locked && (
              <Lock size={12} strokeWidth={3} aria-label="locked" className="shrink-0" />
            )}
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          {t("weekend.finisherNote", {
            defaultValue:
              "Finishers score only from their entry minute — any position, free of your shape.",
          })}
        </p>
      </div>
    </div>
  );
}

/**
 * The pitch screen's entry into the chooser: the tappable SHAPE label plus
 * the bottom sheet. The parent owns every consequence of a selection —
 * `onRelayout` (same band: persist the display name, nothing else) and
 * `onShapePlan` (band change: run or confirm the plan); finisher role taps
 * apply immediately via `onFinisherRole` and keep the sheet open.
 */
export function FormationSection({
  slots,
  editable,
  displayFormation,
  busy,
  onRelayout,
  onShapePlan,
  onFinisherRole,
}: {
  slots: ReadonlyArray<PlannerSlot>;
  editable: boolean;
  displayFormation: NamedFormation | null;
  busy: boolean;
  onRelayout: (formation: NamedFormation) => void;
  onShapePlan: (formation: NamedFormation, plan: FormationPlan) => void;
  onFinisherRole: (slotIndex: number, role: SlotRole) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const shape = currentShape(slots);
  const label = displayFormation?.name ?? `${shape.DEF}-${shape.MID}-${shape.ATT}`;

  const disabledNames = useMemo(() => {
    const set = new Set<string>();
    for (const formation of FORMATION_CATALOGUE) {
      if (sameShape(formation.shape, shape)) continue;
      if (!planFormationChange(slots, formation.shape).ok) set.add(formation.name);
    }
    return set;
  }, [slots, shape]);

  const finishers: ChooserFinisher[] = slots
    .filter((s) => s.isFinisher)
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((s) => ({ id: s.slotIndex, role: s.slotRole, locked: s.locked }));

  if (!editable) {
    return (
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {t("weekend.shapeLockedLine", {
          defaultValue: "Set up in a {{label}}",
          label,
        })}
      </p>
    );
  }

  return (
    <div data-testid="formation-section">
      <button
        type="button"
        data-testid="shape-label"
        aria-label={t("weekend.shapeOpenAria", {
          defaultValue: "Change shape — currently {{label}}",
          label,
        })}
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground active:opacity-60"
      >
        {t("weekend.shapeLine", { defaultValue: "Shape — {{label}}", label })}
        <ChevronDown size={13} strokeWidth={3} aria-hidden />
      </button>

      {/* Bottom sheet on the raw Radix primitives (the DrawSheet precedent):
          components/ui/dialog is centre-anchored with centre-anchored motion;
          this is bottom-anchored with its own slide-up. The primitives still
          carry the focus trap, Escape, scroll lock and aria wiring. */}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            data-testid="formation-sheet"
            className="theme-weekend weekend-sheet-in fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm neo-border neo-shadow-lg rounded-t-xl border-b-0 bg-background text-foreground p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4 max-h-[80dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <DialogPrimitive.Title className="font-heading font-bold text-lg">
                {t("weekend.shapeSheetTitle", {
                  defaultValue: "Your shape & finishers",
                })}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="neo-border rounded bg-card p-1 shrink-0 active:neo-shadow-pressed"
                aria-label="Close"
              >
                <X size={14} strokeWidth={3} />
              </DialogPrimitive.Close>
            </div>
            <FormationChooser
              selectedName={displayFormation?.name ?? null}
              disabledNames={disabledNames}
              busy={busy}
              onSelectFormation={(formation) => {
                setOpen(false);
                if (sameShape(formation.shape, shape)) {
                  onRelayout(formation);
                  return;
                }
                const plan = planFormationChange(slots, formation.shape);
                if (plan.ok) onShapePlan(formation, plan);
              }}
              finishers={finishers}
              onFinisherRole={onFinisherRole}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
