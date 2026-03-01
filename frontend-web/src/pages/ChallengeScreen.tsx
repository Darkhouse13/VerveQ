import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { BottomNav } from "@/components/neo/BottomNav";
import { useState } from "react";
import { Trophy, User, Gamepad2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

const sportPills = ["football", "tennis", "basketball"];
const modePills = ["quiz", "survival"];

export default function ChallengeScreen() {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const [username, setUsername] = useState("");
  const [selectedSport, setSelectedSport] = useState("football");
  const [selectedMode, setSelectedMode] = useState("quiz");
  const [sending, setSending] = useState(false);

  const pending = useQuery(api.challenges.getPending);
  const createChallengeMut = useMutation(api.challenges.create);
  const acceptMut = useMutation(api.challenges.accept);
  const declineMut = useMutation(api.challenges.decline);

  const handleSend = async () => {
    if (!username.trim()) {
      toast.error("Enter a username");
      return;
    }
    setSending(true);
    try {
      await createChallengeMut({
        challengedUsername: username.trim(),
        sport: selectedSport,
        mode: selectedMode,
      });
      toast.success("Challenge sent!");
      setUsername("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  const challenges = pending?.challenges ?? [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-6 space-y-6">
        <h1 className="text-2xl font-heading font-bold">Challenge</h1>

        {isGuest ? (
          <NeoCard shadow="lg" className="text-center py-8">
            <p className="font-heading font-bold text-lg">
              Login to challenge friends
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Create an account to send challenges
            </p>
          </NeoCard>
        ) : (
          <NeoCard shadow="lg">
            <h3 className="font-heading font-bold text-sm mb-3">
              Challenge a Friend
            </h3>
            <NeoInput
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mb-3"
            />

            <p className="text-xs font-heading font-bold uppercase text-muted-foreground mb-2">
              Sport
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {sportPills.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSport(s)}
                  className={`neo-border rounded-full px-3 py-1 text-xs font-heading font-bold cursor-pointer transition-all capitalize ${selectedSport === s ? "bg-primary text-primary-foreground neo-shadow" : "bg-background"}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <p className="text-xs font-heading font-bold uppercase text-muted-foreground mb-2">
              Mode
            </p>
            <div className="flex gap-2 mb-4">
              {modePills.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMode(m)}
                  className={`neo-border rounded-full px-3 py-1 text-xs font-heading font-bold cursor-pointer transition-all capitalize ${selectedMode === m ? "bg-primary text-primary-foreground neo-shadow" : "bg-background"}`}
                >
                  {m}
                </button>
              ))}
            </div>

            <NeoButton
              variant="primary"
              size="full"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? "Sending..." : "Send Challenge"}
            </NeoButton>
          </NeoCard>
        )}

        <div>
          <h3 className="font-heading font-bold text-lg mb-3">
            Pending Challenges
          </h3>
          {challenges.length === 0 ? (
            <NeoCard className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                No pending challenges
              </p>
            </NeoCard>
          ) : (
            <div className="space-y-2.5">
              {challenges.map((c) => (
                <NeoCard key={c.challengeId} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="neo-border rounded-full w-8 h-8 bg-muted flex items-center justify-center font-heading font-bold text-xs">
                      {c.challenger[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-bold text-sm">
                        {c.challenger}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {c.sport} · {c.mode}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NeoButton
                      variant="success"
                      size="sm"
                      onClick={async () => {
                        await acceptMut({ challengeId: c.challengeId });
                        toast.success("Accepted!");
                      }}
                    >
                      Accept
                    </NeoButton>
                    <NeoButton
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        await declineMut({ challengeId: c.challengeId });
                        toast.info("Declined");
                      }}
                    >
                      Decline
                    </NeoButton>
                  </div>
                </NeoCard>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-heading font-bold text-lg mb-3">
            Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Trophy, label: "Ranks", path: "/leaderboard" },
              { icon: User, label: "Profile", path: "/profile" },
              {
                icon: Gamepad2,
                label: "Play Now",
                path: "/sport-select?mode=quiz",
              },
            ].map((a) => (
              <NeoCard
                key={a.label}
                className="flex flex-col items-center gap-1 py-4 cursor-pointer"
                onClick={() => navigate(a.path)}
              >
                <a.icon size={22} strokeWidth={2.5} />
                <p className="text-[10px] font-heading font-bold uppercase">
                  {a.label}
                </p>
              </NeoCard>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
