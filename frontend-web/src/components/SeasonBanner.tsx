import { NeoCard } from "@/components/neo/NeoCard";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCountdown } from "@/hooks/useCountdown";
import { Trophy } from "lucide-react";

export function SeasonBanner() {
  const season = useQuery(api.seasonManager.getCurrentSeason);

  if (!season) return null;

  const daysLeft = Math.ceil((season.endDate - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft > 7) return null;

  return <SeasonEndingBanner endDate={season.endDate} seasonNumber={season.seasonNumber} />;
}

function SeasonEndingBanner({ endDate, seasonNumber }: { endDate: number; seasonNumber: number }) {
  const { hours, minutes, seconds } = useCountdown(endDate);
  const days = Math.floor((endDate - Date.now()) / (1000 * 60 * 60 * 24));

  const timeStr = days > 0
    ? `${days}d ${hours % 24}h ${minutes}m`
    : `${hours}h ${minutes}m ${seconds}s`;

  return (
    <NeoCard shadow="lg" className="bg-electric-blue text-electric-blue-foreground">
      <div className="flex items-center gap-3">
        <div className="neo-border rounded-xl bg-background p-2.5">
          <Trophy size={24} strokeWidth={2.5} className="text-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-heading font-bold text-lg">Season {seasonNumber} Ending!</p>
          <p className="text-xs opacity-90">Finalize your rank before the reset</p>
        </div>
        <p className="font-mono font-bold text-sm">{timeStr}</p>
      </div>
    </NeoCard>
  );
}
