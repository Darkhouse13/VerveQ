/**
 * FW-RECEIPT — the squad screen's two-tab switch: the squad itself, and its
 * weekend ledger. A plain segmented control in the Neo language; no motion.
 */
import type { ReactNode } from "react";

export function SquadTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: ReadonlyArray<{ key: T; label: ReactNode; testid: string }>;
  active: T;
  onSelect: (key: T) => void;
}) {
  return (
    <div
      className="neo-border rounded-lg bg-card p-1 grid grid-flow-col auto-cols-fr gap-1"
      role="tablist"
      data-testid="squad-tabs"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          data-testid={tab.testid}
          onClick={() => onSelect(tab.key)}
          className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] rounded-md py-1.5 px-2 ${
            active === tab.key
              ? "bg-primary text-primary-foreground neo-border"
              : "text-muted-foreground active:opacity-60"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
