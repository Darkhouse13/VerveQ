/**
 * FW-RECEIPT — the squad screen's two-tab switch: the squad itself, and its
 * weekend ledger. Segmented's look (44px tabs, the selected tab a cream chip,
 * never lime) with a test id per tab, which Segmented's options don't carry.
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <Button
            key={tab.key}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={selected}
            data-testid={tab.testid}
            onClick={() => onSelect(tab.key)}
            className={cn(
              "rounded-md border-0 px-2",
              selected && "bg-foreground text-background hover:bg-foreground",
            )}
          >
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}
