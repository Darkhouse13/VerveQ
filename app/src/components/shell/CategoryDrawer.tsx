import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Clock, Brain, Shuffle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";

export type ArenaCategory = "whichCameFirst" | "knowledge" | "mixedBag";

const CATEGORIES: {
  key: ArenaCategory;
  icon: LucideIcon;
  color: "primary" | "accent" | "blue";
}[] = [
  { key: "whichCameFirst", icon: Clock, color: "primary" },
  { key: "knowledge", icon: Brain, color: "blue" },
  { key: "mixedBag", icon: Shuffle, color: "accent" },
];

/**
 * Category picker for the Arena / Duels tiles. The three categories (Which Came
 * First / Knowledge / Mixed Bag) live INSIDE arena & duels; selecting one routes
 * the caller to the existing arena/duel entry. Lightweight custom sheet —
 * bottom-sheet on mobile, centered dialog on desktop — to avoid pulling in extra
 * dialog deps.
 */
export function CategoryDrawer({
  open,
  title,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSelect: (category: ArenaCategory) => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-foreground/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md md:max-w-lg bg-background neo-border neo-shadow-lg rounded-t-2xl md:rounded-2xl p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="font-heading font-bold text-lg">{title}</h2>
            <p className="text-xs text-muted-foreground">
              {t("drawer.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="neo-border rounded-lg bg-card p-1.5 transition-all active:neo-shadow-pressed"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {CATEGORIES.map((c) => (
            <NeoCard
              key={c.key}
              color={c.color}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => onSelect(c.key)}
            >
              <div className="neo-border rounded-lg bg-background p-2">
                <c.icon size={22} strokeWidth={2.5} className="text-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-sm">
                  {t(`drawer.categories.${c.key}`)}
                </p>
                <p className="text-xs opacity-80">
                  {t(`drawer.categories.${c.key}Desc`)}
                </p>
              </div>
            </NeoCard>
          ))}
        </div>
      </div>
    </div>
  );
}
