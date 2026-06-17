import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NeoButton } from "@/components/neo/NeoButton";

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="neo-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">{resolvedTitle}</DialogTitle>
            <DialogDescription className="text-sm">{resolvedDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <NeoButton
              variant="secondary"
              size="full"
              onClick={() => setOpen(false)}
            >
              {t("exitGame.keepPlaying")}
            </NeoButton>
            <NeoButton variant="danger" size="full" onClick={handleConfirm}>
              {t("exitGame.quit")}
            </NeoButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
