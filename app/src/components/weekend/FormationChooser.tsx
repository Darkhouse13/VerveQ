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
import { ChevronDown, Lock } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button, type ButtonProps } from "@/components/ui/button";
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
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

/**
 * A pressable choice chip (shape / finisher role): 44px tall, sentence case,
 * the selected chip is a cream chip like Segmented's — never lime, which
 * stays free for the screen's one action (START BUILDING sits right below).
 */
function ChoiceChip({
  selected,
  className,
  ...props
}: Omit<ButtonProps, "variant" | "size"> & { selected: boolean }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={selected}
      className={cn(
        "px-1",
        selected && "bg-foreground text-background hover:bg-foreground",
        className,
      )}
      {...props}
    />
  );
}

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
        <Eyebrow className="mb-2 font-bold">
          {t("weekend.shape", { defaultValue: "Your shape" })}
        </Eyebrow>
        <div className="grid grid-cols-3 gap-1.5" data-testid="formation-chips">
          {FORMATION_CATALOGUE.map((formation) => (
            <ChoiceChip
              key={formation.name}
              selected={selectedName === formation.name}
              className="font-mono tabular-nums"
              disabled={busy || (disabledNames?.has(formation.name) ?? false)}
              onClick={() => onSelectFormation(formation)}
            >
              {formation.name}
            </ChoiceChip>
          ))}
        </div>
        <p className="text-meta text-muted-foreground mt-2">
          {t("weekend.shapeNote", {
            defaultValue:
              "Change it any time before kick-off — nothing is set in stone yet.",
          })}
        </p>
      </div>

      <div>
        <Eyebrow className="mb-2 font-bold">
          {t("weekend.finisherRoles", { defaultValue: "Your finishers" })}
        </Eyebrow>
        {finishers.map((finisher) => (
          <div key={finisher.id} className="flex gap-1.5 mb-1.5 items-center">
            {SLOT_ROLES.map((role) => (
              <ChoiceChip
                key={role}
                selected={finisher.role === role}
                className="flex-1"
                disabled={busy || finisher.locked}
                onClick={() => onFinisherRole(finisher.id, role)}
              >
                {role}
              </ChoiceChip>
            ))}
            {finisher.locked && (
              <Lock
                size={12}
                strokeWidth={3}
                aria-label={t("weekend.lockedBadge", { defaultValue: "Locked" })}
                className="shrink-0"
              />
            )}
          </div>
        ))}
        <p className="text-meta text-muted-foreground">
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
      <Eyebrow className="font-bold">
        {t("weekend.shapeLockedLine", {
          defaultValue: "Set up in a {{label}}",
          label,
        })}
      </Eyebrow>
    );
  }

  return (
    <div data-testid="formation-section">
      <Button
        variant="ghost"
        size="sm"
        data-testid="shape-label"
        aria-label={t("weekend.shapeOpenAria", {
          defaultValue: "Change shape — currently {{label}}",
          label,
        })}
        onClick={() => setOpen(true)}
        className="-mx-2 gap-1.5 px-2 font-mono text-eyebrow uppercase text-muted-foreground"
      >
        {t("weekend.shapeLine", { defaultValue: "Shape — {{label}}", label })}
        <ChevronDown size={14} strokeWidth={3} aria-hidden />
      </Button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        testId="formation-sheet"
        title={t("weekend.shapeSheetTitle", {
          defaultValue: "Your shape & finishers",
        })}
      >
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
      </Sheet>
    </div>
  );
}
