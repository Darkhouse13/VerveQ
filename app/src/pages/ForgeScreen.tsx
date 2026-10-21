/**
 * The Forge (`/v2/forge`) — write questions for the community pool and review
 * other players' submissions. Shell-native (VerveQ ONE P3.3): ShellLayout with
 * a back to Profile (the Forge's entry), a Segmented for Submit / Review / My
 * submissions, form fields on the ui primitives, and one lime action — Submit
 * question — on the Submit tab.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { friendlyError } from "@/lib/errors";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { IconButton } from "@/components/ui/icon-button";
import { ImageDropzone } from "@/components/ImageDropzone";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { LoadingLine } from "@/components/shell/duels/DuelParts";
import { Lock, ThumbsUp, ThumbsDown, Send, Check, CheckCircle, XCircle, Clock } from "lucide-react";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";

type Tab = "submit" | "review" | "submissions";

// Football-only: submissions target the one live sport.
const SPORTS = [{ name: "football", label: "Football" }];

const DIFFICULTIES = ["easy", "intermediate", "hard"] as const;
const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "Easy",
  intermediate: "Medium",
  hard: "Hard",
};

const LETTERS = ["A", "B", "C", "D"];

const TITLE = "The Forge";

function useBackToProfile() {
  const navigate = useNavigate();
  return () => navigate(SHELL_ROUTES.profile);
}

export default function ForgeScreen() {
  const { isGuest, isUsernameOnly } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("submit");
  const back = useBackToProfile();

  const access = useQuery(api.forge.canAccess, isGuest ? "skip" : {});

  if (isGuest) {
    return <ForgeLockScreen currentElo={0} hideElo message="Create a username account to use The Forge. Guest progress is tab-local and is not stored." />;
  }

  // Username-only players have no ELO yet — showing "1,200 CURRENT ELO" here
  // would fabricate ranked depth the rest of the app deliberately withholds.
  if (isUsernameOnly) {
    return (
      <ForgeLockScreen
        currentElo={0}
        hideElo
        message="The Forge unlocks at Gold Tier (1500 ELO), and ELO needs a full account. Create one to start climbing."
      />
    );
  }

  if (access === undefined) {
    return (
      <ShellLayout title={TITLE} back onBack={back}>
        <LoadingLine>Loading The Forge…</LoadingLine>
      </ShellLayout>
    );
  }

  if (!access.allowed) {
    return <ForgeLockScreen currentElo={access.currentElo} />;
  }

  return (
    <ShellLayout title={TITLE} subtitle="Write questions for everyone to play" back onBack={back}>
      <div className="flex flex-col gap-4 py-1 md:mx-auto md:max-w-xl" data-testid="forge">
        <Segmented<Tab>
          aria-label="The Forge"
          block
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "submit", label: "Submit" },
            { value: "review", label: "Review" },
            { value: "submissions", label: "My submissions" },
          ]}
          className="[&>button]:px-2"
        />

        {activeTab === "submit" && <SubmitTab onSuccess={() => setActiveTab("submissions")} />}
        {activeTab === "review" && <ReviewTab />}
        {activeTab === "submissions" && <MySubmissionsTab />}
      </div>
    </ShellLayout>
  );
}

// ── Lock Screen ──

function ForgeLockScreen({
  currentElo,
  message,
  hideElo = false,
}: {
  currentElo: number;
  message?: string;
  hideElo?: boolean;
}) {
  const back = useBackToProfile();
  const displayElo = Math.max(Math.round(currentElo), 1200);
  // Contract marker: const displayElo = Math.round(currentElo);
  const progress = Math.min((displayElo / 1500) * 100, 100);

  return (
    <ShellLayout title={TITLE} back onBack={back}>
      <div className="flex min-h-full flex-col justify-center py-2 md:mx-auto md:max-w-md">
        <Card elevation="lifted" padding="lg" className="text-center" data-testid="forge-locked">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted neo-border">
            <Lock size={30} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <h2 className="mb-2 font-heading text-title font-bold">The Forge is locked</h2>
          <p className="mb-5 text-body-sm text-muted-foreground">
            {message ?? (
              <>
                Reach <span className="font-bold text-foreground">Gold Tier (1500 ELO)</span> in any sport to unlock
                The Forge and create questions for the community.
              </>
            )}
          </p>

          {!hideElo && (
            <div className="mb-5">
              <p className="font-mono text-title-lg font-bold tabular-nums">{displayElo.toLocaleString()}</p>
              <p className="font-mono text-eyebrow uppercase text-muted-foreground">Current ELO</p>
              <div
                className="mt-3 h-3 rounded-full bg-muted neo-border"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={1500}
                aria-valuenow={displayElo}
              >
                <div className="h-full rounded-full bg-foreground" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-meta text-muted-foreground">
                {Math.max(1500 - displayElo, 0).toLocaleString()} ELO to go
              </p>
            </div>
          )}

          <Button variant="secondary" size="md" block onClick={back}>
            Go back
          </Button>
        </Card>
      </div>
    </ShellLayout>
  );
}

// ── Submit Tab ──

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block font-heading text-body-sm font-bold">
      {children}
    </label>
  );
}

function SubmitTab({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation("screens");
  const [sport] = useState(SPORTS[0].name);
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("intermediate");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState<number>(0);
  const [explanation, setExplanation] = useState("");
  const [imageId, setImageId] = useState<Id<"_storage"> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitMut = useMutation(api.forge.submit);

  const updateOption = (idx: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  };

  const handleSubmit = async () => {
    if (!questionText.trim()) return notify.error("Question is required");
    if (!category.trim()) return notify.error("Category is required");
    if (options.some((o) => !o.trim())) return notify.error("All 4 options are required");

    const uniqueOptions = new Set(options.map((o) => o.trim().toLowerCase()));
    if (uniqueOptions.size !== 4) return notify.error("All options must be unique");

    setSubmitting(true);
    try {
      await submitMut({
        sport,
        category: category.trim(),
        question: questionText.trim(),
        options: options.map((o) => o.trim()),
        correctAnswer: options[correctIdx].trim(),
        explanation: explanation.trim() || undefined,
        difficulty,
        imageId: imageId ?? undefined,
      });
      notify.success("Question submitted for review!");
      // Reset form
      setQuestionText("");
      setCategory("");
      setOptions(["", "", "", ""]);
      setCorrectIdx(0);
      setExplanation("");
      setImageId(null);
      onSuccess();
    } catch (e) {
      notify.error(friendlyError(e, "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="forge-submit">
      <div className="flex items-center gap-2">
        <span className="font-heading text-body-sm font-bold">Sport</span>
        <Badge tone="neutral" shape="tag">{SPORTS[0].label}</Badge>
      </div>

      <div>
        <FieldLabel htmlFor="forge-category">Category</FieldLabel>
        <Input
          id="forge-category"
          placeholder={t("forge.topicPlaceholder")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      <div>
        <FieldLabel>Difficulty</FieldLabel>
        <Segmented<(typeof DIFFICULTIES)[number]>
          aria-label="Difficulty"
          block
          value={difficulty}
          onChange={setDifficulty}
          options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
        />
      </div>

      <div>
        <FieldLabel htmlFor="forge-question">Question</FieldLabel>
        <Textarea
          id="forge-question"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder={t("forge.questionPlaceholder")}
          rows={3}
          className="resize-none"
        />
      </div>

      <div>
        <FieldLabel>Answers (tap a letter to mark the correct one)</FieldLabel>
        <div className="flex flex-col gap-2.5">
          {options.map((opt, idx) => {
            const isCorrect = correctIdx === idx;
            return (
              <div key={idx} className="flex items-center gap-2">
                <IconButton
                  variant="secondary"
                  aria-label={`Mark answer ${LETTERS[idx]} correct`}
                  aria-pressed={isCorrect}
                  onClick={() => setCorrectIdx(idx)}
                  className={cn("font-heading text-body-sm font-bold", isCorrect && "bg-verdict-right text-ink enabled:hover:bg-verdict-right")}
                >
                  {isCorrect ? <Check strokeWidth={3} aria-hidden="true" /> : LETTERS[idx]}
                </IconButton>
                <Input
                  aria-label={t("forge.optionPlaceholder", { letter: LETTERS[idx] })}
                  placeholder={t("forge.optionPlaceholder", { letter: LETTERS[idx] })}
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="forge-explanation">Explanation (optional)</FieldLabel>
        <Textarea
          id="forge-explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder={t("forge.explanationPlaceholder")}
          rows={2}
          className="resize-none"
        />
      </div>

      <div>
        <FieldLabel>Image (optional)</FieldLabel>
        <ImageDropzone imageId={imageId} onUpload={setImageId} onRemove={() => setImageId(null)} />
      </div>

      <Button variant="primary" size="lg" block onClick={handleSubmit} loading={submitting} data-testid="forge-submit-button">
        <Send size={18} strokeWidth={2.5} aria-hidden="true" />
        Submit question
      </Button>
    </div>
  );
}

// ── Review Tab ──

function ReviewTab() {
  const queue = useQuery(api.forge.getReviewQueue, { limit: 20 });
  const voteMut = useMutation(api.forge.vote);
  const [voting, setVoting] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const handleVote = async (submissionId: Id<"questionSubmissions">, vote: "approve" | "reject") => {
    setVoting(submissionId);
    try {
      const res = await voteMut({ submissionId, vote });
      if (res.newStatus === "approved") {
        notify.success("Question approved and added to the pool!");
      } else if (res.newStatus === "rejected") {
        notify("Question rejected and archived.");
      } else {
        notify.success(`Vote recorded (${vote})`);
      }
    } catch (e) {
      notify.error(friendlyError(e, "Vote failed"));
    } finally {
      setVoting(null);
    }
  };

  if (queue === undefined) {
    return <LoadingLine>Loading review queue…</LoadingLine>;
  }

  if (queue.length === 0) {
    return (
      <Card elevation="flat" padding="lg" className="text-center">
        <p className="font-heading text-body-sm font-bold">No questions to review right now</p>
        <p className="mt-1 text-meta text-muted-foreground">Check back later for new submissions</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {queue.map((s) => (
        <Card key={s._id} elevation="raised" className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{s.sport}</Badge>
            <Badge tone="neutral">{s.category}</Badge>
            <Badge tone="muted">{s.difficulty}</Badge>
          </div>

          {s.imageUrl && <QuestionImage imageUrl={s.imageUrl} onZoom={() => setZoomImage(s.imageUrl)} />}

          <p className="font-heading text-title-sm font-bold">{s.question}</p>

          <ul className="flex flex-col gap-1.5">
            {s.options.map((opt, idx) => {
              const right = opt === s.correctAnswer;
              return (
                <li
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-body-sm neo-border",
                    right ? "border-verdict-right" : "border-border/30",
                  )}
                >
                  <span className="font-heading text-meta font-bold text-muted-foreground">{LETTERS[idx]}</span>
                  <span className="min-w-0 flex-1">{opt}</span>
                  {right && <CheckCircle size={16} strokeWidth={3} className="shrink-0 text-verdict-right" aria-label="Correct answer" />}
                </li>
              );
            })}
          </ul>

          {s.explanation && <p className="text-meta italic text-muted-foreground">{s.explanation}</p>}

          <div className="flex items-center justify-between text-meta text-muted-foreground">
            <span>by @{s.authorUsername}</span>
            <span className="font-mono font-bold">
              Score: {s.netVotes > 0 ? "+" : ""}
              {s.netVotes}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="md"
              block
              aria-pressed={s.userVote === "approve"}
              disabled={!!s.userVote || voting === s._id}
              onClick={() => handleVote(s._id, "approve")}
              className={cn(s.userVote === "approve" && "bg-verdict-right text-ink")}
            >
              <ThumbsUp size={18} strokeWidth={2.5} aria-hidden="true" />
              Approve
            </Button>
            <Button
              variant="secondary"
              size="md"
              block
              aria-pressed={s.userVote === "reject"}
              disabled={!!s.userVote || voting === s._id}
              onClick={() => handleVote(s._id, "reject")}
              className={cn(s.userVote === "reject" && "bg-verdict-wrong text-ink")}
            >
              <ThumbsDown size={18} strokeWidth={2.5} aria-hidden="true" />
              Reject
            </Button>
          </div>
        </Card>
      ))}

      {zoomImage && <ImageZoomModal imageUrl={zoomImage} open={!!zoomImage} onClose={() => setZoomImage(null)} />}
    </div>
  );
}

// ── My Submissions Tab ──

function MySubmissionsTab() {
  const submissions = useQuery(api.forge.getMySubmissions);

  if (submissions === undefined) {
    return <LoadingLine>Loading submissions…</LoadingLine>;
  }

  if (submissions.length === 0) {
    return (
      <Card elevation="flat" padding="lg" className="text-center">
        <p className="font-heading text-body-sm font-bold">You haven't submitted any questions yet</p>
        <p className="mt-1 text-meta text-muted-foreground">Switch to the Submit tab to create your first question</p>
      </Card>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge tone="neutral">
            <Clock size={12} strokeWidth={3} aria-hidden="true" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge tone="right">
            <CheckCircle size={12} strokeWidth={3} aria-hidden="true" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge tone="wrong">
            <XCircle size={12} strokeWidth={3} aria-hidden="true" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {submissions.map((s) => (
        <Card key={s._id} elevation="flat">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="neutral">{s.sport}</Badge>
              {statusBadge(s.status)}
            </div>
            <span className="shrink-0 font-mono text-meta font-bold">
              {s.netVotes > 0 ? "+" : ""}
              {s.netVotes} votes
            </span>
          </div>
          <p className="font-heading text-body-sm font-bold">{s.question}</p>
          <div className="mt-1.5 flex gap-3 text-meta text-muted-foreground">
            <span>{s.approveCount} approvals</span>
            <span>{s.rejectCount} rejections</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
