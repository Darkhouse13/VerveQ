import { useState } from "react";
import { X } from "lucide-react";

import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { normalizeArenaCode } from "@/lib/arena";

export default function JoinArenaModal({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const trimmed = normalizeArenaCode(code);
  const canSubmit = trimmed.length >= 4;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onJoin(trimmed);
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
          <p className="font-heading font-bold text-sm uppercase">Join arena</p>
          <div className="w-9" />
        </div>

        <form className="px-5 py-4 flex-1 space-y-4" onSubmit={handleSubmit}>
          <p className="text-xs text-muted-foreground">
            Enter the code your friend shared, or paste the arena link.
          </p>

          <NeoInput
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            placeholder="ABCD23"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="tracking-[0.4em] uppercase text-center text-lg font-heading"
            maxLength={16}
          />

          <NeoButton
            type="submit"
            variant="primary"
            size="full"
            disabled={!canSubmit}
          >
            Join
          </NeoButton>
        </form>
      </div>
    </div>
  );
}
