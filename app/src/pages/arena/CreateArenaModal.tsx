import { useState } from "react";
import { useMutation } from "convex/react";
import { ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";

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
      toast.error(e instanceof Error ? e.message : "Failed to create arena");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
          <p className="font-heading font-bold text-sm uppercase">Create arena</p>
          <div className="w-9" />
        </div>

        <div className="px-5 py-4 flex-1 space-y-3">
          <p className="text-xs text-muted-foreground">
            Pick a mode. You&apos;ll get a code to share with friends.
          </p>

          {ARENA_MODE_OPTIONS.map((opt) => (
            <NeoCard
              key={opt.key}
              color={mode === opt.key ? "primary" : "default"}
              onClick={() => setMode(opt.key)}
              className="flex items-center justify-between"
            >
              <div className="min-w-0">
                <p className="font-heading font-bold text-base">{opt.label}</p>
                <p className="text-xs opacity-90 truncate">{opt.description}</p>
              </div>
              <NeoBadge
                color={mode === opt.key ? "accent" : "muted"}
                size="sm"
              >
                {opt.capacity} max
              </NeoBadge>
            </NeoCard>
          ))}
        </div>

        <div className="p-5 sticky bottom-0 bg-background border-t-[3px] border-border space-y-2">
          <NeoButton
            variant="primary"
            size="full"
            disabled={submitting}
            onClick={handleCreate}
          >
            {submitting ? "Creating…" : "Create arena"}
          </NeoButton>
          <NeoButton variant="ghost" size="full" onClick={onClose}>
            <ChevronLeft size={16} strokeWidth={3} /> Back
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
