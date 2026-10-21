import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ExitGameButtonProps {
  title?: string;
  description?: string;
  destination?: string;
  /** Optional cleanup fired before navigating (e.g. forfeit mutation). */
  onConfirm?: () => void | Promise<void>;
  className?: string;
}

export function ExitGameButton({
  title,
  description,
  destination = "/home",
  onConfirm,
  className,
}: ExitGameButtonProps) {
  const { t } = useTranslation("screens");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const resolvedTitle = title ?? t("exitGame.defaultTitle");
  const resolvedDescription = description ?? t("exitGame.defaultDescription");

  const handleConfirm = async () => {
    setOpen(false);
    if (onConfirm) {
      try {
        await onConfirm();
      } catch {
        /* swallow — exit shouldn't be blocked by cleanup failure */
      }
    }
    navigate(destination);
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("exitGame.exitAria")}
        onClick={() => setOpen(true)}
        className={
          className ??
          "neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed transition-all"
        }
      >
        <ArrowLeft size={20} strokeWidth={2.5} />
      </button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={resolvedTitle}
        description={resolvedDescription}
        cancelLabel={t("exitGame.keepPlaying")}
        confirmLabel={t("exitGame.quit")}
        danger
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
