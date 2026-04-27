import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCountdown } from "@/hooks/useCountdown";
import { AlertTriangle } from "lucide-react";

export function DecayWarningBanner() {
  const warnings = useQuery(api.eloDecay.getDecayWarnings);
  const dismiss = useMutation(api.eloDecay.dismissDecayWarning);

  if (!warnings || warnings.length === 0) return null;

  // Show the most urgent warning
  const warning = warnings.sort((a, b) => a.decayDate - b.decayDate)[0];

  return (
    <DecayWarningCard
      decayDate={warning.decayDate}
      sport={warning.sport}
      mode={warning.mode}
      onDismiss={() => dismiss({ notificationId: warning._id })}
    />
  );
}

function DecayWarningCard({
  decayDate,
  sport,
  mode,
  onDismiss,
}: {
  decayDate: number;
  sport: string;
  mode: string;
  onDismiss: () => void;
}) {
  const { hours, minutes, seconds } = useCountdown(decayDate);
  const days = Math.floor((decayDate - Date.now()) / (1000 * 60 * 60 * 24));

  const timeStr = days > 0
    ? `${days}d ${hours % 24}h`
    : `${hours}h ${minutes}m ${seconds}s`;

  return (
    <NeoCard shadow="lg" className="bg-destructive text-destructive-foreground">
      <div className="flex items-center gap-3">
        <div className="neo-border rounded-xl bg-background p-2.5">
          <AlertTriangle size={24} strokeWidth={2.5} className="text-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-heading font-bold text-sm">ELO Decay Warning</p>
          <p className="text-xs opacity-90">
            {sport} {mode} — play to prevent -25 ELO in {timeStr}
          </p>
        </div>
        <NeoButton variant="secondary" size="sm" onClick={onDismiss}>
          Dismiss
        </NeoButton>
      </div>
    </NeoCard>
  );
}
