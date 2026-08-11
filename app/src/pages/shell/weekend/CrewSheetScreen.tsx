/**
 * THE WEEKEND — a drafter's crew sheet (FW-LAUNCH O5).
 *
 * The surface FW-1's crew arrangement rules never had: the 13 drafted
 * players on their sheet, swappable between XI and finisher slots via the
 * atomic setFormation (players are FIXED — the 13 are the 13, FW-3), with
 * FW-4's score surfaces once the weekend runs. Reuses BudgetSquadScreen's
 * exported views with `playersFixed`.
 *
 * Gated like its siblings: imperative first query, fail closed and silent.
 * Reached from the completed draft room and the crew page — both of which
 * are themselves unlinked until launch.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { SlotRole } from "../../../../convex/lib/fantasyConstants";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";
import type { FormationPlan } from "@/lib/weekendFormations";
import { FormationSection, SquadView } from "./BudgetSquadScreen";

export type CrewSheet = NonNullable<
  FunctionReturnType<typeof api.fantasySquads.getMyCrewSheet>
>;

type Gate = "checking" | "closed" | "open";

export default function CrewSheetScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { roomId = "" } = useParams();
  const convex = useConvex();
  const [gate, setGate] = useState<Gate>("checking");
  const [busy, setBusy] = useState(false);
  const [swapSource, setSwapSource] = useState<number | null>(null);
  /** A shape change that re-roles fielded players awaits this confirm — on a
   *  crew sheet nobody can leave the 13, so "displaced" means out-of-role. */
  const [confirmShape, setConfirmShape] = useState<{
    plan: FormationPlan;
    label: string;
    names: string[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    convex
      .query(api.fantasySquads.getMyCrewSheet, {
        roomId: roomId as Id<"fantasyDraftRooms">,
      })
      .then((sheet) => {
        if (!cancelled) setGate(sheet === null ? "closed" : "open");
      })
      .catch(() => {
        if (!cancelled) setGate("closed");
      });
    return () => {
      cancelled = true;
    };
  }, [convex, roomId]);

  const sheet = useQuery(
    api.fantasySquads.getMyCrewSheet,
    gate === "open" ? { roomId: roomId as Id<"fantasyDraftRooms"> } : "skip",
  );
  const score = useQuery(
    api.fantasyScores.getSquadScore,
    gate === "open" && sheet != null
      ? { gameweekId: sheet.gameweekId, context: "crew" as const, crewRoomId: roomId }
      : "skip",
  );
  const marketNominal = useQuery(api.fantasyMarket.getMarket, gate === "open" ? {} : "skip");
  const setFormationMutation = useMutation(api.fantasySquads.setFormation);

  const nominalByPlayer = useMemo(() => {
    const map = new Map<string, SlotRole>();
    for (const p of marketNominal?.players ?? []) map.set(p.playerId, p.position);
    return map;
  }, [marketNominal]);

  const editable =
    sheet != null && (sheet.gameweekStatus === "upcoming" || sheet.gameweekStatus === "live");

  const swapSlots = (a: number, b: number) => {
    if (sheet == null || busy) return;
    const byIndex = new Map(sheet.slots.map((s) => [s.slotIndex, s]));
    const slotA = byIndex.get(a);
    const slotB = byIndex.get(b);
    if (slotA === undefined || slotB === undefined) return;
    setBusy(true);
    void setFormationMutation({
      squadId: sheet.squadId,
      slots: sheet.slots.map((s) => ({
        slotIndex: s.slotIndex,
        slotRole:
          s.slotIndex === a ? slotB.slotRole : s.slotIndex === b ? slotA.slotRole : s.slotRole,
        isFinisher:
          s.slotIndex === a
            ? slotB.isFinisher
            : s.slotIndex === b
              ? slotA.isFinisher
              : s.isFinisher,
      })),
    })
      .catch((e: unknown) =>
        toast.error(
          friendlyError(e, t("weekend.swapFailed", { defaultValue: "That swap isn't legal." })),
        ),
      )
      .finally(() => setBusy(false));
  };

  const runShapeChange = (
    plan: FormationPlan,
  ) => {
    if (sheet == null || busy) return;
    setBusy(true);
    void setFormationMutation({ squadId: sheet.squadId, slots: plan.payload })
      .catch((e: unknown) =>
        toast.error(
          friendlyError(
            e,
            t("weekend.shapeFailed", { defaultValue: "Couldn't switch the shape." }),
          ),
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.sheetTitle", { defaultValue: "Your team sheet" })}
      back
      onBack={() => navigate(SHELL_ROUTES.weekendCrews)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full">
        {gate === "checking" || (gate === "open" && sheet === undefined) ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : gate === "closed" || sheet === null ? (
          <NeoCard className="text-center py-6">
            <p className="font-heading font-bold">
              {t("weekend.noSheet", {
                defaultValue: "No sheet of yours here — it appears once your draft completes.",
              })}
            </p>
          </NeoCard>
        ) : sheet !== undefined ? (
          <>
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground text-center">
              GW {sheet.gwNumber} ·{" "}
              {t("weekend.sheetNote", {
                defaultValue: "the 13 are the 13 — arrange, don't re-man",
              })}
            </p>
            <FormationSection
              slots={sheet.slots}
              editable={editable}
              onApply={(plan, label) => {
                if (plan.displaced.length > 0) {
                  setConfirmShape({
                    plan,
                    label,
                    names: plan.displaced.map(
                      (d) =>
                        sheet.slots.find((s) => s.slotIndex === d.slotIndex)?.playerName ??
                        "…",
                    ),
                  });
                } else {
                  runShapeChange(plan);
                }
              }}
            />
            <SquadView
              squad={{ budget: null, slots: sheet.slots }}
              score={score}
              nominalByPlayer={nominalByPlayer}
              editable={editable}
              playersFixed
              swapSource={swapSource}
              onAssign={() => undefined}
              onClear={() => undefined}
              onSwap={(slotIndex) => {
                if (swapSource === null) {
                  setSwapSource(slotIndex);
                } else if (swapSource === slotIndex) {
                  setSwapSource(null);
                } else {
                  const source = swapSource;
                  setSwapSource(null);
                  swapSlots(source, slotIndex);
                }
              }}
            />
            <Dialog
              open={confirmShape !== null}
              onOpenChange={(next) => !next && setConfirmShape(null)}
            >
              <DialogContent className="theme-weekend neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto">
                <DialogTitle className="font-heading font-bold text-lg">
                  {t("weekend.shapeConfirmTitle", {
                    defaultValue: "Switch to {{label}}?",
                    label: confirmShape?.label ?? "",
                  })}
                </DialogTitle>
                <p className="text-sm">
                  {t("weekend.crewShapeConfirmBody", {
                    defaultValue:
                      "Your 13 all stay on the sheet, but {{names}} would field out of listed position — ×0.75 risk if the verdict agrees.",
                    names: confirmShape?.names.join(", ") ?? "",
                  })}
                </p>
                <div className="flex gap-2">
                  <NeoButton
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirmShape(null)}
                  >
                    {t("weekend.shapeConfirmCancel", { defaultValue: "Keep shape" })}
                  </NeoButton>
                  <NeoButton
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const pending = confirmShape;
                      setConfirmShape(null);
                      if (pending !== null) runShapeChange(pending.plan);
                    }}
                  >
                    {t("weekend.shapeConfirmGo", { defaultValue: "Switch shape" })}
                  </NeoButton>
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </div>
    </ShellLayout>
  );
}
