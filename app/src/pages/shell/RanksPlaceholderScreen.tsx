import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { Construction } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type TierKey = "bronze" | "silver" | "gold" | "platinum";

// Mirrors lib/elo.ts tiers (read-only display; no scoring happens here).
const TIERS: { key: TierKey; min: number; max: number | null; color: string }[] = [
  { key: "bronze", min: 0, max: 1199, color: "bg-[#b87333]" },
  { key: "silver", min: 1200, max: 1499, color: "bg-[#9ca3af]" },
  { key: "gold", min: 1500, max: 1999, color: "bg-[#d4af37]" },
  { key: "platinum", min: 2000, max: null, color: "bg-[#5fc9e8]" },
];

function tierFromElo(elo: number): TierKey {
  if (elo >= 2000) return "platinum";
  if (elo >= 1500) return "gold";
  if (elo >= 1200) return "silver";
  return "bronze";
}

/**
 * Ranks placeholder. Prominent dark tiers screen, explicitly labelled as a
 * work-in-progress redesign. The user's tier/ELO is read from the existing
 * server-authoritative `profile.get` query; the full leaderboard stays one tap
 * away at the existing route.
 */
export default function RanksPlaceholderScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isGuest } = useAuth();
  const userId = !isGuest && user?.username ? (user._id as Id<"users">) : undefined;
  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");

  const elo = profile?.eloRating;
  const currentTier = elo != null ? tierFromElo(elo) : null;

  return (
    <ShellLayout title={t("ranks.title")} back theme="dark">
      <div className="flex flex-col gap-5 md:h-full md:justify-center">
        <NeoCard color="primary" className="flex items-center gap-3">
          <Construction size={26} strokeWidth={2.5} className="shrink-0" />
          <div>
            <p className="font-heading font-bold text-sm uppercase tracking-wide">
              {t("ranks.wip")}
            </p>
            <p className="text-xs opacity-90">{t("ranks.subtitle")}</p>
          </div>
        </NeoCard>

        <NeoCard className="text-center py-5">
          <p className="text-xs uppercase font-heading opacity-70 tracking-wide">
            {t("ranks.yourElo")}
          </p>
          <p className="font-mono font-bold text-4xl my-1">{elo ?? "—"}</p>
          <NeoBadge color="primary" rotated>
            {currentTier
              ? t(`ranks.tiers.${currentTier}`)
              : t("ranks.unranked")}
          </NeoBadge>
        </NeoCard>

        <div className="space-y-3">
          {TIERS.map((tier) => {
            const active = tier.key === currentTier;
            return (
              <div
                key={tier.key}
                className={
                  "neo-border rounded-lg p-3 flex items-center gap-3 transition-all " +
                  (active
                    ? "neo-shadow bg-card ring-2 ring-primary"
                    : "bg-card/40 opacity-80")
                }
              >
                <span className={"w-4 h-4 rounded-full neo-border shrink-0 " + tier.color} />
                <span className="font-heading font-bold flex-1">
                  {t(`ranks.tiers.${tier.key}`)}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {t("ranks.tierRange", {
                    min: tier.min,
                    max: tier.max ?? "∞",
                  })}
                </span>
                {active && <NeoBadge color="primary" size="sm">★</NeoBadge>}
              </div>
            );
          })}
        </div>

        <NeoButton variant="secondary" size="full" onClick={() => navigate("/leaderboard")}>
          {t("ranks.viewFullBoard")}
        </NeoButton>
      </div>
    </ShellLayout>
  );
}
