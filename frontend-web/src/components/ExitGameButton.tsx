import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  title = "Quit game?",
  description = "Your progress in this round will be lost.",
  destination = "/home",
  onConfirm,
  className,
}: ExitGameButtonProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

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
        aria-label="Exit game"
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
            <DialogTitle className="font-heading uppercase">{title}</DialogTitle>
            <DialogDescription className="text-sm">{description}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <NeoButton
              variant="secondary"
              size="full"
              onClick={() => setOpen(false)}
            >
              Keep Playing
            </NeoButton>
            <NeoButton variant="danger" size="full" onClick={handleConfirm}>
              Quit
            </NeoButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
