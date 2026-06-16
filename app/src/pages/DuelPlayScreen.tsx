import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Check, X, Clock, Trophy, ArrowLeft, Swords } from "lucide-react";
import { toast } from "sonner";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { QuestionImage } from "@/components/QuestionImage";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildShareUrl,
  formatModeLabel,
  formatRelativeTime,
  readGuestDuelToken,
} from "@/lib/duel";

const AUTO_ADVANCE_DELAY_MS = 1500;

type DuelView = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  type: "sports" | "knowledge";
  category: string | null;
  sport: string | null;
  difficulty: "easy" | "intermediate" | "hard";
  mode: string;
  expiresAt: number;
  questionCount: number;
  challenger: { id: Id<"users">; username: string; displayName: string };
  opponent: { id: Id<"users"> | null; username: string; displayName: string };
  myResult: {
    score: number;
    completedAt: number | null;
    perQuestion: Array<{
      questionIndex: number;
      checksum: string;
      answer: string;
      correct: boolean;
      score: number;
    }>;
  };
  opponentResult: {
    score: number;
    completedAt: number | null;
    answeredCount: number;
  };
  winnerId: Id<"users"> | null;
  currentQuestion: {
    checksum: string;
    question: string;
    options: string[];
    category: string;
    difficulty: string;
    imageUrl: string | null;
  } | null;
  linkCode: string | null;
};

type DuelStatus = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  resolvedAt: number | null;
  questionCount: number;
  myScore: number;
  myAnsweredCount: number;
  myCompleted: boolean;
  opponentScore: number;
  opponentAnsweredCount: number;
  opponentCompleted: boolean;
  winnerId: Id<"users"> | null;
  openRematch: { duelId: Id<"duels">; byMe: boolean } | null;
  bucket: "your_turn" | "awaiting_opponent" | "resolved";
};

interface DuelPlayProps {
  duelId: Id<"duels">;
  guestToken?: string;
  initialView?: DuelView;
}

export default function DuelPlayScreen() {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/?from=duel", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!duelId || !isAuthenticated) return null;
  // Keyed so navigating between duels (e.g. into a rematch) remounts with
  // fresh state instead of carrying the previous duel's view.
  return <DuelPlay key={duelId} duelId={duelId as Id<"duels">} />;
}

export function DuelPlay({ duelId, guestToken, initialView }: DuelPlayProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const getMyDuel = useMutation(api.duels.getMyDuel);
  const submitAnswer = useMutation(api.duels.submitAnswer);
  const completeDuel = useMutation(api.duels.complete);
  const rematchMut = useMutation(api.duels.rematch);

  const [view, setView] = useState<DuelView | null>(initialView ?? null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<{
    correctAnswer: string;
    correct: boolean;
    explanation: string | null;
    score: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const completeCalled = useRef(false);

  const guestTokenForArgs = guestToken
    ? guestToken
    : view?.linkCode
      ? readGuestDuelToken(view.linkCode) ?? undefined
      : undefined;
  const liveStatus = useQuery(
    api.duels.getDuelStatus,
    view
      ? guestTokenForArgs
        ? { duelId, guestToken: guestTokenForArgs }
        : { duelId }
      : "skip",
  ) as DuelStatus | undefined;

  const refresh = useCallback(async () => {
    try {
      const fresh = (await getMyDuel({
        duelId,
        guestToken: guestTokenForArgs,
      })) as DuelView;
      setView(fresh);
      setLoadError(null);
      return fresh;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load duel";
      setLoadError(msg);
      return null;
    }
  }, [duelId, getMyDuel, guestTokenForArgs]);

  useEffect(() => {
    if (!initialView) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the player has answered every question, ask the server to lock.
  useEffect(() => {
    if (!view) return;
    if (view.status !== "awaiting_opponent") return;
    const answered = view.myResult.perQuestion.length;
    if (
      !completeCalled.current &&
      answered >= view.questionCount &&
      !view.myResult.completedAt
    ) {
      completeCalled.current = true;
      (async () => {
        try {
          await completeDuel({ duelId, guestToken: guestTokenForArgs });
        } catch {
          /* server may already be locked; refresh handles state */
        } finally {
          await refresh();
        }
      })();
    }
  }, [view, completeDuel, duelId, guestTokenForArgs, refresh]);

  // Tap = submit, matching the other versus modes (arena, live match): there is
  // no separate confirm step. The selected index just drives the brief
  // pre-reveal highlight while the server result is in flight.
  const handleSelect = async (idx: number) => {
    if (!view || !view.currentQuestion) return;
    if (selected !== null || submitting || revealed) return;
    setSelected(idx);
    const questionIndex = view.myResult.perQuestion.length;
    setSubmitting(true);
    try {
      const result = await submitAnswer({
        duelId,
        questionIndex,
        answer: view.currentQuestion.options[idx],
        guestToken: guestTokenForArgs,
      });
      setRevealed({
        correctAnswer: result.correctAnswer,
        correct: result.correct,
        explanation: result.explanation,
        score: result.score,
      });
      advanceTimer.current = window.setTimeout(async () => {
        advanceTimer.current = null;
        setRevealed(null);
        setSelected(null);
        await refresh();
      }, AUTO_ADVANCE_DELAY_MS);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit answer");
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRematch = async () => {
    if (!view || guestTokenForArgs) return;
    setRematching(true);
    try {
      const result = await rematchMut({ duelId: view.duelId });
      if (result.existing) {
        toast.success("Rematch already open — joining it");
      } else if (result.linkCode) {
        toast.success("Rematch ready");
      } else {
        toast.success("Rematch sent");
      }
      navigate(`/duel/play/${result.duelId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rematch failed");
    } finally {
      setRematching(false);
    }
  };

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, []);

  if (loadError) {
    return (
      <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center justify-center">
        <NeoCard shadow="lg" className="w-full max-w-md text-center py-8">
          <p className="font-heading font-bold text-lg mb-2">Couldn&apos;t load duel</p>
          <p className="text-xs text-muted-foreground mb-4 break-words">{loadError}</p>
          <NeoButton variant="primary" size="full" onClick={() => navigate("/challenge")}>
            Back to duels
          </NeoButton>
        </NeoCard>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading duel…</p>
      </div>
    );
  }

  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  const isCameFirst = view.mode === "came_first";
  const totalQ = view.questionCount;
  const answered = view.myResult.perQuestion.length;
  const progress = `Q ${Math.min(answered + 1, totalQ)} / ${totalQ}`;

  const openRematchHandler = (rematchDuelId: Id<"duels">) =>
    navigate(`/duel/play/${rematchDuelId}`);

  if (liveStatus && liveStatus.status !== "awaiting_opponent") {
    return (
      <LiveResolvedStatus
        view={view}
        status={liveStatus}
        userId={user?._id ?? null}
        canRematch={!guestTokenForArgs && !!user?._id}
        rematching={rematching}
        onRematch={handleRematch}
        onOpenRematch={openRematchHandler}
        onBack={() => navigate("/challenge")}
        onSeeResult={() => navigate(`/duel/result/${duelId}`)}
      />
    );
  }

  if (view.status === "resolved" || view.status === "expired" || view.status === "declined") {
    return (
      <DuelLocked
        view={view}
        userId={user?._id ?? null}
        openRematch={
          !guestTokenForArgs && user?._id ? liveStatus?.openRematch ?? null : null
        }
        onOpenRematch={openRematchHandler}
        onBack={() => navigate("/challenge")}
        onSeeResult={() => navigate(`/duel/result/${duelId}`)}
      />
    );
  }

  if (view.myResult.completedAt && !view.currentQuestion) {
    return (
      <WaitingForOpponent
        view={view}
        liveStatus={liveStatus}
        userId={user?._id ?? null}
        canRematch={!guestTokenForArgs && !!user?._id}
        rematching={rematching}
        onRematch={handleRematch}
        onOpenRematch={openRematchHandler}
        onBack={() => navigate("/challenge")}
        onSeeResult={() => navigate(`/duel/result/${duelId}`)}
      />
    );
  }

  const question = view.currentQuestion;
  if (!question) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading question…</p>
      </div>
    );
  }

  const correctIdx = revealed
    ? question.options.indexOf(revealed.correctAnswer)
    : -1;

  const getOptionStyle = (idx: number) => {
    if (!revealed)
      return selected === idx
        ? "bg-primary text-primary-foreground"
        : "bg-card text-card-foreground";
    if (idx === correctIdx) return "bg-success text-success-foreground";
    if (idx === selected) return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground opacity-50";
  };

  const letters = ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => navigate("/challenge")}
          className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed"
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <p className="font-mono font-bold text-sm inline-flex items-center gap-1">
          <Clock size={14} strokeWidth={3} /> {formatRelativeTime(view.expiresAt)}
        </p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-heading font-bold uppercase truncate">
          {view.opponent.id === null && view.role === "challenger"
            ? "Set your score"
            : `vs @${opponentName}`}
        </p>
        <p className="font-heading font-bold text-xs">{progress}</p>
      </div>

      <div className="flex items-center justify-between mb-1">
        <p className="font-mono font-bold text-sm">Score: {view.myResult.score}</p>
        <NeoBadge color="primary" size="sm">
          {formatModeLabel(view.mode)}
        </NeoBadge>
      </div>
      <p className="text-[10px] text-muted-foreground mb-4">
        Fast answers score more — correct always counts.
      </p>

      {isCameFirst ? (
        <NeoCard shadow="lg" className="mb-5 text-center">
          <p className="text-xs font-heading uppercase text-muted-foreground mb-1">
            Which came first?
          </p>
          <p className="font-heading font-bold text-lg leading-tight">
            {question.question}
          </p>
        </NeoCard>
      ) : (
        <NeoCard shadow="lg" className="mb-5">
          {question.imageUrl && (
            <div className="mb-3">
              <QuestionImage
                imageUrl={question.imageUrl}
                alt={`Image for: ${question.question}`}
              />
            </div>
          )}
          <p className="font-heading font-bold text-xl leading-tight">
            {question.question}
          </p>
        </NeoCard>
      )}

      <div className={`flex-1 ${isCameFirst ? "grid grid-cols-1 gap-3" : "space-y-2.5"}`}>
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={!!revealed || submitting}
            onClick={() => void handleSelect(idx)}
            className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all cursor-pointer ${!revealed ? "active:neo-shadow-pressed" : ""} ${getOptionStyle(idx)}`}
          >
            {!isCameFirst && (
              <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-xs bg-background text-foreground shrink-0">
                {revealed && idx === correctIdx ? (
                  <Check size={16} strokeWidth={3} />
                ) : revealed && idx === selected ? (
                  <X size={16} strokeWidth={3} />
                ) : (
                  letters[idx]
                )}
              </span>
            )}
            <span className="font-heading font-bold text-sm">{opt}</span>
          </button>
        ))}
      </div>

      {revealed && (
        <NeoCard
          color={revealed.correct ? "success" : "default"}
          className="mt-4 text-sm leading-snug"
        >
          <p className="font-heading font-bold text-sm">
            {revealed.correct ? `Correct · +${revealed.score} pts` : "Wrong · no points"}
          </p>
          {revealed.explanation && <p className="mt-1">{revealed.explanation}</p>}
        </NeoCard>
      )}
    </div>
  );
}

function RematchPrompt({
  openRematch,
  opponentName,
  onOpen,
}: {
  openRematch: { duelId: Id<"duels">; byMe: boolean } | null;
  opponentName: string;
  onOpen: (duelId: Id<"duels">) => void;
}) {
  if (!openRematch) return null;
  if (openRematch.byMe) {
    return (
      <NeoCard className="w-full mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading font-bold text-sm">Rematch sent</p>
          <p className="text-xs text-muted-foreground truncate">
            Waiting for @{opponentName} to play.
          </p>
        </div>
        <NeoButton
          variant="secondary"
          size="sm"
          onClick={() => onOpen(openRematch.duelId)}
        >
          Open
        </NeoButton>
      </NeoCard>
    );
  }
  return (
    <NeoCard color="accent" shadow="lg" className="w-full mb-3 space-y-2">
      <p className="font-heading font-bold text-sm inline-flex items-center gap-1.5">
        <Swords size={14} strokeWidth={3} /> @{opponentName} wants a rematch!
      </p>
      <NeoButton
        variant="primary"
        size="full"
        onClick={() => onOpen(openRematch.duelId)}
      >
        Accept rematch
      </NeoButton>
    </NeoCard>
  );
}

function WaitingForOpponent({
  view,
  liveStatus,
  userId,
  canRematch,
  rematching,
  onRematch,
  onOpenRematch,
  onBack,
  onSeeResult,
}: {
  view: DuelView;
  liveStatus?: DuelStatus;
  userId: string | null;
  canRematch: boolean;
  rematching: boolean;
  onRematch: () => void;
  onOpenRematch: (duelId: Id<"duels">) => void;
  onBack: () => void;
  onSeeResult: () => void;
}) {
  const markShared = useMutation(api.duels.markShared);

  if (liveStatus && liveStatus.status !== "awaiting_opponent") {
    return (
      <LiveResolvedStatus
        view={view}
        status={liveStatus}
        userId={userId}
        canRematch={canRematch}
        rematching={rematching}
        onRematch={onRematch}
        onOpenRematch={onOpenRematch}
        onBack={onBack}
        onSeeResult={onSeeResult}
      />
    );
  }

  // Only the challenger of a link duel can invite (their view carries linkCode).
  const canInvite = !!view.linkCode;
  // Play-first: finished a solo round, nobody invited yet.
  const opponentBound = view.opponent.id !== null;

  const share = async () => {
    if (!view.linkCode) return;
    // The share IS the "challenge issued" moment for a play-first duel — record
    // it server-side (idempotent), then open the share sheet.
    markShared({ duelId: view.duelId }).catch(() => {});
    const url = buildShareUrl(view.linkCode);
    try {
      if (navigator.share) {
        await navigator.share({ text: `Beat my ${view.myResult.score}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* ignore */
    }
  };

  if (canInvite && !opponentBound) {
    return (
      <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
        <NeoCard shadow="lg" className="w-full text-center py-8 mb-5">
          <Trophy size={28} strokeWidth={2.5} className="mx-auto mb-2" />
          <p className="font-heading font-bold text-lg">That&apos;s your score</p>
          <p className="font-mono font-bold text-3xl mt-3">{view.myResult.score}</p>
          <p className="text-[10px] font-heading uppercase text-muted-foreground">
            your score
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Now invite a friend to beat it — the first to open your link plays the
            same questions.
          </p>
        </NeoCard>
        <div className="w-full space-y-3">
          <NeoButton variant="primary" size="full" onClick={share}>
            Invite a friend
          </NeoButton>
          <NeoButton variant="secondary" size="full" onClick={onBack}>
            Back to duels
          </NeoButton>
        </div>
      </div>
    );
  }

  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <NeoCard shadow="lg" className="w-full text-center py-8 mb-5">
        <Clock size={28} strokeWidth={2.5} className="mx-auto mb-2" />
        <p className="font-heading font-bold text-lg">Locked in</p>
        <p className="text-sm text-muted-foreground mt-1">
          Waiting for @{opponentName} to finish.
        </p>
        <p className="font-mono font-bold text-3xl mt-4">{view.myResult.score}</p>
        <p className="text-[10px] font-heading uppercase text-muted-foreground">
          your score
        </p>
      </NeoCard>
      <div className="w-full space-y-3">
        {canInvite && (
          <NeoButton variant="secondary" size="full" onClick={share}>
            Share challenge link
          </NeoButton>
        )}
        <NeoButton variant="primary" size="full" onClick={onBack}>
          Back to duels
        </NeoButton>
      </div>
    </div>
  );
}

function statusHeadline(
  view: DuelView,
  status: Pick<DuelStatus, "status" | "winnerId">,
  userId: string | null,
) {
  if (status.status === "expired") {
    return { title: "Duel expired", color: "muted" as const };
  }
  if (status.status === "declined") {
    return { title: "Duel declined", color: "muted" as const };
  }
  if (!status.winnerId) {
    return { title: "Draw", color: "blue" as const };
  }
  const challengerWon = status.winnerId === view.challenger.id;
  const mine =
    userId && status.winnerId === userId
      ? true
      : view.role === "challenger"
        ? challengerWon
        : !challengerWon;
  return mine
    ? { title: "You won", color: "success" as const }
    : { title: "You lost", color: "destructive" as const };
}

function LiveResolvedStatus({
  view,
  status,
  userId,
  canRematch,
  rematching,
  onRematch,
  onOpenRematch,
  onBack,
  onSeeResult,
}: {
  view: DuelView;
  status: DuelStatus;
  userId: string | null;
  canRematch: boolean;
  rematching: boolean;
  onRematch: () => void;
  onOpenRematch: (duelId: Id<"duels">) => void;
  onBack: () => void;
  onSeeResult: () => void;
}) {
  const headline = statusHeadline(view, status, userId);
  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  const openRematch = canRematch ? status.openRematch : null;

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <NeoCard shadow="lg" className="w-full text-center py-8 mb-5">
        <Trophy size={28} strokeWidth={2.5} className="mx-auto mb-2" />
        <p className="text-xs font-heading uppercase text-muted-foreground mb-2">
          @{opponentName} finished
        </p>
        <NeoBadge color={headline.color} rotated size="md" className="text-lg px-5 py-2">
          {headline.title}
        </NeoBadge>
        <p className="font-mono font-bold text-3xl mt-4">
          {status.myScore} — {status.opponentScore}
        </p>
      </NeoCard>
      <RematchPrompt
        openRematch={openRematch}
        opponentName={opponentName}
        onOpen={onOpenRematch}
      />
      <div className="w-full space-y-3">
        {canRematch && !openRematch && (
          <NeoButton
            variant="primary"
            size="full"
            disabled={rematching}
            onClick={onRematch}
          >
            <Swords size={16} strokeWidth={3} />
            {rematching ? "Sending…" : "Rematch"}
          </NeoButton>
        )}
        <NeoButton variant={canRematch ? "secondary" : "primary"} size="full" onClick={onSeeResult}>
          See full result
        </NeoButton>
        <NeoButton variant="ghost" size="full" onClick={onBack}>
          Back to duels
        </NeoButton>
      </div>
    </div>
  );
}

function DuelLocked({
  view,
  userId,
  openRematch,
  onOpenRematch,
  onBack,
  onSeeResult,
}: {
  view: DuelView;
  userId: string | null;
  openRematch: { duelId: Id<"duels">; byMe: boolean } | null;
  onOpenRematch: (duelId: Id<"duels">) => void;
  onBack: () => void;
  onSeeResult: () => void;
}) {
  let title = "Duel resolved";
  let color: "success" | "destructive" | "blue" | "muted" = "blue";
  if (view.status === "expired") {
    title = "Duel expired";
    color = "muted";
  } else if (view.status === "declined") {
    title = "Duel declined";
    color = "muted";
  } else if (view.winnerId && userId && view.winnerId === userId) {
    title = "You won";
    color = "success";
  } else if (view.winnerId && userId && view.winnerId !== userId) {
    title = "You lost";
    color = "destructive";
  } else {
    title = "Draw";
    color = "blue";
  }
  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <NeoCard shadow="lg" className="w-full text-center py-8 mb-5">
        <Trophy size={28} strokeWidth={2.5} className="mx-auto mb-2" />
        <NeoBadge color={color} rotated size="md" className="text-lg px-5 py-2">
          {title}
        </NeoBadge>
        <p className="font-mono font-bold text-3xl mt-4">
          {view.myResult.score} — {view.opponentResult.score}
        </p>
      </NeoCard>
      <RematchPrompt
        openRematch={openRematch}
        opponentName={
          view.role === "challenger"
            ? view.opponent.displayName
            : view.challenger.displayName
        }
        onOpen={onOpenRematch}
      />
      <div className="w-full space-y-3">
        <NeoButton variant="primary" size="full" onClick={onSeeResult}>
          See full result
        </NeoButton>
        <NeoButton variant="secondary" size="full" onClick={onBack}>
          Back to duels
        </NeoButton>
      </div>
    </div>
  );
}
