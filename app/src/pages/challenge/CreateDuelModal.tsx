import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, X, Link2, Users, Search, Share2 } from "lucide-react";
import { toast } from "sonner";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatCategoryLabel } from "@/lib/duel";
import type { Id } from "../../../convex/_generated/dataModel";

type Difficulty = "easy" | "intermediate" | "hard";
type DuelKind = "knowledge" | "came_first" | "sports";
type OpponentMode = "rival" | "username" | "link";

const SPORTS: { key: string; label: string; emoji: string }[] = [
  { key: "football", label: "Football", emoji: "⚽" },
  { key: "basketball", label: "Basketball", emoji: "🏀" },
  { key: "tennis", label: "Tennis", emoji: "🎾" },
];

const KNOWLEDGE_CATEGORIES = [
  "common_knowledge",
  "history",
  "geography",
  "science",
  "physics",
  "chemistry",
  "biology",
  "astronomy",
  "earth_science",
  "mathematics",
  "literature_arts",
  "philosophy",
  "language",
  "culture",
  "inventions",
  "discoveries",
  "fun_facts",
  "human_knowledge",
  "laws_of_universe",
];

const DIFFICULTIES: { key: Difficulty; label: string; color: "success" | "accent" | "destructive" }[] = [
  { key: "easy", label: "Easy", color: "success" },
  { key: "intermediate", label: "Medium", color: "accent" },
  { key: "hard", label: "Hard", color: "destructive" },
];

type Step = "kind" | "topic" | "difficulty" | "opponent" | "result";

export default function CreateDuelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (duelId: Id<"duels">) => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("kind");
  const [kind, setKind] = useState<DuelKind | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [opponentMode, setOpponentMode] = useState<OpponentMode>("rival");
  const [usernameQuery, setUsernameQuery] = useState("");
  const [pickedRival, setPickedRival] = useState<{ userId: Id<"users">; username: string } | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rivalriesRes = useQuery(api.rivalries.listMine, {});
  const rivalSuggestions = useMemo(() => {
    const list = rivalriesRes?.rivalries ?? [];
    return list.slice(0, 8);
  }, [rivalriesRes]);

  const trimmedSearch = usernameQuery.trim().toLowerCase();
  const usernameLookup = useQuery(
    api.users.getByUsername,
    trimmedSearch.length >= 3 ? { username: trimmedSearch } : "skip",
  );

  const createMut = useMutation(api.duels.create);

  const reset = () => {
    setStep("kind");
    setKind(null);
    setSport(null);
    setCategory(null);
    setDifficulty("intermediate");
    setOpponentMode("rival");
    setUsernameQuery("");
    setPickedRival(null);
    setLinkCode(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const goBack = () => {
    if (step === "topic") return setStep("kind");
    if (step === "difficulty") return setStep("topic");
    if (step === "opponent") return setStep("difficulty");
    if (step === "result") return handleClose();
    handleClose();
  };

  const headerTitle = (() => {
    switch (step) {
      case "kind":
        return "Pick a duel type";
      case "topic":
        return kind === "sports" ? "Pick a sport" : "Pick a category";
      case "difficulty":
        return "Pick a difficulty";
      case "opponent":
        return "Choose opponent";
      case "result":
        return "Duel created";
    }
  })();

  const handleSelectKind = (k: DuelKind) => {
    setKind(k);
    setSport(null);
    setCategory(null);
    if (k === "came_first") {
      setSport("football");
      setStep("difficulty");
    } else {
      setStep("topic");
    }
  };

  const handleSelectTopic = (key: string) => {
    if (kind === "sports") {
      setSport(key);
    } else {
      setCategory(key);
    }
    setStep("difficulty");
  };

  const canSubmitOpponent = (() => {
    if (opponentMode === "rival") return !!pickedRival;
    if (opponentMode === "username") return !!usernameLookup;
    return true;
  })();

  const handleCreate = async () => {
    if (!kind) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const baseArgs = {
        difficulty,
        mode: kind === "came_first" ? "came_first" : "quiz",
      };
      const args =
        kind === "knowledge"
          ? {
              type: "knowledge" as const,
              ...baseArgs,
              category: category ?? undefined,
            }
          : kind === "came_first"
            ? {
                type: "knowledge" as const,
                ...baseArgs,
                category: "which_came_first",
              }
            : {
                type: "sports" as const,
                ...baseArgs,
                sport: sport ?? undefined,
              };

      const opponentArgs: { opponentUserId?: Id<"users">; viaLink?: boolean } = {};
      if (opponentMode === "rival" && pickedRival) {
        opponentArgs.opponentUserId = pickedRival.userId;
      } else if (opponentMode === "username" && usernameLookup) {
        if (usernameLookup._id === user?._id) {
          toast.error("Pick someone other than yourself");
          setSubmitting(false);
          return;
        }
        opponentArgs.opponentUserId = usernameLookup._id;
      } else {
        opponentArgs.viaLink = true;
      }

      const result = await createMut({ ...args, ...opponentArgs });
      if (opponentMode === "link" || opponentArgs.viaLink) {
        setLinkCode(result.linkCode);
        setStep("result");
      } else {
        toast.success("Duel sent");
        onCreated(result.duelId);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create duel");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button
            type="button"
            onClick={goBack}
            className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed"
            aria-label="Back"
          >
            {step === "kind" ? <X size={18} strokeWidth={2.5} /> : <ChevronLeft size={18} strokeWidth={2.5} />}
          </button>
          <p className="font-heading font-bold text-sm uppercase">{headerTitle}</p>
          <div className="w-9" />
        </div>

        <div className="px-5 py-4 flex-1 space-y-4">
          {step === "kind" && (
            <div className="space-y-3">
              <NeoCard
                color="primary"
                onClick={() => handleSelectKind("sports")}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-heading font-bold">Sports trivia</p>
                  <p className="text-xs opacity-90">Football · Basketball · Tennis</p>
                </div>
                <span className="text-2xl">🏆</span>
              </NeoCard>
              <NeoCard
                color="blue"
                onClick={() => handleSelectKind("knowledge")}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-heading font-bold">Knowledge</p>
                  <p className="text-xs opacity-90">Science · History · Culture · more</p>
                </div>
                <span className="text-2xl">🧠</span>
              </NeoCard>
              <NeoCard
                color="accent"
                onClick={() => handleSelectKind("came_first")}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-heading font-bold">Which Came First</p>
                  <p className="text-xs opacity-90">Two events. Which happened earlier?</p>
                </div>
                <span className="text-2xl">⏳</span>
              </NeoCard>
            </div>
          )}

          {step === "topic" && (
            <div>
              {kind === "sports" && (
                <div className="grid grid-cols-2 gap-3">
                  {SPORTS.map((s) => (
                    <NeoCard
                      key={s.key}
                      color={sport === s.key ? "primary" : "default"}
                      onClick={() => handleSelectTopic(s.key)}
                      className="flex flex-col items-center gap-2 py-6"
                    >
                      <span className="text-4xl">{s.emoji}</span>
                      <p className="font-heading font-bold text-sm">{s.label}</p>
                    </NeoCard>
                  ))}
                </div>
              )}
              {kind === "knowledge" && (
                <div className="grid grid-cols-2 gap-2">
                  <NeoCard
                    color={!category ? "primary" : "default"}
                    onClick={() => handleSelectTopic("")}
                    className="text-center py-4"
                  >
                    <p className="font-heading font-bold text-sm">Mixed</p>
                    <p className="text-[10px] opacity-80">Any knowledge category</p>
                  </NeoCard>
                  {KNOWLEDGE_CATEGORIES.map((c) => (
                    <NeoCard
                      key={c}
                      color={category === c ? "primary" : "default"}
                      onClick={() => handleSelectTopic(c)}
                      className="text-center py-4"
                    >
                      <p className="font-heading font-bold text-xs">
                        {formatCategoryLabel(c)}
                      </p>
                    </NeoCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "difficulty" && (
            <div className="space-y-3">
              {DIFFICULTIES.map((d) => (
                <NeoCard
                  key={d.key}
                  color={difficulty === d.key ? d.color : "default"}
                  onClick={() => setDifficulty(d.key)}
                  className="flex items-center justify-between"
                >
                  <p className="font-heading font-bold">{d.label}</p>
                  <NeoBadge color={d.color} size="sm">{d.key}</NeoBadge>
                </NeoCard>
              ))}
              <NeoButton variant="primary" size="full" onClick={() => setStep("opponent")}>
                Continue
              </NeoButton>
            </div>
          )}

          {step === "opponent" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <ModePill
                  active={opponentMode === "rival"}
                  onClick={() => setOpponentMode("rival")}
                  icon={<Users size={14} strokeWidth={3} />}
                  label="Rivals"
                />
                <ModePill
                  active={opponentMode === "username"}
                  onClick={() => setOpponentMode("username")}
                  icon={<Search size={14} strokeWidth={3} />}
                  label="Username"
                />
                <ModePill
                  active={opponentMode === "link"}
                  onClick={() => setOpponentMode("link")}
                  icon={<Link2 size={14} strokeWidth={3} />}
                  label="Link"
                />
              </div>

              {opponentMode === "rival" && (
                <div className="space-y-2">
                  {rivalSuggestions.length === 0 ? (
                    <NeoCard className="text-center py-5 text-xs text-muted-foreground">
                      No rivals yet — search by username or share a link.
                    </NeoCard>
                  ) : (
                    rivalSuggestions.map((r) => (
                      <NeoCard
                        key={r.opponent.userId}
                        onClick={() =>
                          setPickedRival({
                            userId: r.opponent.userId,
                            username: r.opponent.username,
                          })
                        }
                        color={pickedRival?.userId === r.opponent.userId ? "primary" : "default"}
                        className="flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-heading font-bold text-sm truncate">
                            @{r.opponent.username}
                          </p>
                          <p className="text-[10px] font-mono">
                            {r.wins}-{r.losses}
                            {r.draws ? `-${r.draws}` : ""}
                          </p>
                        </div>
                        {r.currentStreakLen > 0 && (
                          <NeoBadge
                            color={r.currentStreakHolderId === user?._id ? "success" : "destructive"}
                            size="sm"
                          >
                            🔥 {r.currentStreakLen}
                          </NeoBadge>
                        )}
                      </NeoCard>
                    ))
                  )}
                </div>
              )}

              {opponentMode === "username" && (
                <div className="space-y-2">
                  <NeoInput
                    placeholder="@username"
                    value={usernameQuery}
                    onChange={(e) => setUsernameQuery(e.target.value)}
                    autoCapitalize="none"
                  />
                  {trimmedSearch.length >= 3 && (
                    <NeoCard className="text-sm">
                      {usernameLookup === undefined ? (
                        <p className="text-muted-foreground">Searching…</p>
                      ) : usernameLookup === null ? (
                        <p className="text-muted-foreground">
                          No user found for @{trimmedSearch}
                        </p>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="font-heading font-bold">@{usernameLookup.username}</p>
                          <NeoBadge color="success" size="sm">Found</NeoBadge>
                        </div>
                      )}
                    </NeoCard>
                  )}
                </div>
              )}

              {opponentMode === "link" && (
                <NeoCard className="text-sm">
                  <p className="font-heading font-bold mb-1">Share a link</p>
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll generate a one-shot link you can send to anyone.
                    They can play as a guest and claim the result by signing up.
                  </p>
                </NeoCard>
              )}

              <NeoButton
                variant="primary"
                size="full"
                disabled={!canSubmitOpponent || submitting}
                onClick={handleCreate}
              >
                {submitting ? "Creating…" : "Send duel"}
              </NeoButton>
            </div>
          )}

          {step === "result" && linkCode && (
            <ShareResult
              linkCode={linkCode}
              onDone={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ModePill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`neo-border rounded-lg px-2 py-2 text-[11px] font-heading font-bold uppercase cursor-pointer flex flex-col items-center gap-1 active:neo-shadow-pressed ${
        active ? "bg-primary text-primary-foreground neo-shadow" : "bg-background neo-shadow"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ShareResult({ linkCode, onDone }: { linkCode: string; onDone: () => void }) {
  const url = `${window.location.origin}/duel/${linkCode}`;
  const shareText = `I challenged you to a VerveQ duel — can you beat my score?`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "VerveQ duel", text: shareText, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled or no permission */
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="space-y-3">
      <NeoCard shadow="lg" className="text-center py-6">
        <Share2 size={26} strokeWidth={2.5} className="mx-auto mb-2" />
        <p className="font-heading font-bold text-lg">Send the link</p>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          The first person to open it plays the duel.
        </p>
        <div className="neo-border rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
          {url}
        </div>
      </NeoCard>
      <NeoButton variant="primary" size="full" onClick={handleShare}>
        <Share2 size={16} strokeWidth={3} /> Share link
      </NeoButton>
      <NeoButton variant="secondary" size="full" onClick={handleCopy}>
        Copy link
      </NeoButton>
      <NeoButton variant="ghost" size="full" onClick={onDone}>
        Done
      </NeoButton>
    </div>
  );
}
