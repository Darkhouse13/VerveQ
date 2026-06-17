import { useState } from "react";
import { useMutation } from "convex/react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { friendlyError } from "@/lib/errors";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { api } from "../../../convex/_generated/api";
import { ARENA_MODE_OPTIONS, type ArenaMode } from "@/lib/arena";

export default function CreateArenaModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (code: string) => void;
}) {
  const { t } = useTranslation("screens");
  const [mode, setMode] = useState<ArenaMode>("1v1");
  const [submitting, setSubmitting] = useState(false);
  const create = useMutation(api.challengeArenas.create);

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await create({ mode });
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

        <div className="px-5 flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-none md:flex-none md:max-h-[60vh]">
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
        </div>

        <div className="shrink-0 bg-background border-t-[3px] border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <NeoButton
            variant="primary"
            size="full"
            disabled={submitting}
            onClick={handleCreate}
          >
            {submitting ? t("createArena.creating") : t("createArena.createButton")}
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
