import { useState } from "react";
import { useTranslation } from "react-i18next";

import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { FullscreenFlow } from "@/components/ui/fullscreen-flow";
import { normalizeArenaCode } from "@/lib/arena";

export default function JoinArenaModal({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => void;
}) {
  const { t } = useTranslation("screens");
  const [code, setCode] = useState("");
  const trimmed = normalizeArenaCode(code);
  const canSubmit = trimmed.length >= 4;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onJoin(trimmed);
  };

  return (
    <FullscreenFlow
      onClose={onClose}
      title={t("joinArena.title")}
      closeLabel={t("joinArena.closeAria")}
    >
      <form className="px-5 py-4 flex-1 space-y-4" onSubmit={handleSubmit}>
        <p className="text-meta text-muted-foreground">
          {t("joinArena.instructions")}
        </p>

        <NeoInput
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          placeholder="ABCD23"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="tracking-code uppercase text-center text-title-sm font-heading"
          maxLength={128}
        />

        <NeoButton
          type="submit"
          variant="primary"
          size="full"
          disabled={!canSubmit}
        >
          {t("joinArena.joinButton")}
        </NeoButton>
      </form>
    </FullscreenFlow>
  );
}
