/**
 * The Forge (`/forge`) — write questions for the community pool and review
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
const SPORTS = [{ name: "football", labelKey: "forge.sportFootball" }];

const DIFFICULTIES = ["easy", "intermediate", "hard"] as const;
/** Locale keys (screens ns), resolved with t() at render. */
const DIFFICULTY_LABEL_KEYS: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "forge.difficultyEasy",
  intermediate: "forge.difficultyMedium",
  hard: "forge.difficultyHard",
};

const LETTERS = ["A", "B", "C", "D"];

const TITLE_KEY = "forge.title";

function useBackToProfile() {
  const navigate = useNavigate();
  return () => navigate(SHELL_ROUTES.profile);
}

export default function ForgeScreen() {
  const { t } = useTranslation("screens");
  const { isGuest, isUsernameOnly } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("submit");
  const back = useBackToProfile();

  const access = useQuery(api.forge.canAccess, isGuest ? "skip" : {});

  if (isGuest) {
    return <ForgeLockScreen currentElo={0} hideElo message={t("forge.lockedGuest")} />;
  }

  // Username-only players have no ELO yet — showing "1,200 CURRENT ELO" here
  // would fabricate ranked depth the rest of the app deliberately withholds.
  if (isUsernameOnly) {
    return (
      <ForgeLockScreen
        currentElo={0}
        hideElo
        message={t("forge.lockedUsernameOnly")}
      />
    );
  }

  if (access === undefined) {
    return (
      <ShellLayout title={t(TITLE_KEY)} back onBack={back}>
        <LoadingLine>{t("forge.loading")}</LoadingLine>
      </ShellLayout>
    );
  }

  if (!access.allowed) {
    return <ForgeLockScreen currentElo={access.currentElo} />;
  }

  return (
    <ShellLayout title={t(TITLE_KEY)} subtitle={t("forge.subtitle")} back onBack={back}>
      <div className="flex flex-col gap-4 py-1 md:mx-auto md:max-w-xl" data-testid="forge">
        <Segmented<Tab>
          aria-label={t(TITLE_KEY)}
          block
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "submit", label: t("forge.tabSubmit") },
            { value: "review", label: t("forge.tabReview") },
            { value: "submissions", label: t("forge.tabSubmissions") },
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
  const { t } = useTranslation("screens");
  const back = useBackToProfile();
  const displayElo = Math.max(Math.round(currentElo), 1200);
  // Contract marker: const displayElo = Math.round(currentElo);
  const progress = Math.min((displayElo / 1500) * 100, 100);

  return (
    <ShellLayout title={t(TITLE_KEY)} back onBack={back}>
      <div className="flex min-h-full flex-col justify-center py-2 md:mx-auto md:max-w-md">
        <Card elevation="lifted" padding="lg" className="text-center" data-testid="forge-locked">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted neo-border">
            <Lock size={30} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <h2 className="mb-2 font-heading text-title font-bold">{t("forge.lockedTitle")}</h2>
          <p className="mb-5 text-body-sm text-muted-foreground">
            {message ?? (
              <>
                {t("forge.lockedBodyBefore")}<span className="font-bold text-foreground">{t("forge.lockedGoal")}</span>{t("forge.lockedBodyAfter")}
              </>
            )}
          </p>

          {!hideElo && (
            <div className="mb-5">
              <p className="font-mono text-title-lg font-bold tabular-nums">{displayElo.toLocaleString()}</p>
              <p className="font-mono text-eyebrow uppercase text-muted-foreground">{t("forge.currentRating")}</p>
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
                {t("forge.toGo", { n: Math.max(1500 - displayElo, 0).toLocaleString() })}
              </p>
            </div>
          )}

          <Button variant="secondary" size="md" block onClick={back}>
            {t("forge.back")}
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
    if (!questionText.trim()) return notify.error(t("forge.errorQuestion"));
    if (!category.trim()) return notify.error(t("forge.errorCategory"));
    if (options.some((o) => !o.trim())) return notify.error(t("forge.errorOptions"));

    const uniqueOptions = new Set(options.map((o) => o.trim().toLowerCase()));
    if (uniqueOptions.size !== 4) return notify.error(t("forge.errorUnique"));

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
      notify.success(t("forge.submitted"));
      // Reset form
      setQuestionText("");
      setCategory("");
      setOptions(["", "", "", ""]);
      setCorrectIdx(0);
      setExplanation("");
      setImageId(null);
      onSuccess();
    } catch (e) {
      notify.error(friendlyError(e, t("forge.submitFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="forge-submit">
      <div className="flex items-center gap-2">
        <span className="font-heading text-body-sm font-bold">{t("forge.sport")}</span>
        <Badge tone="neutral" shape="tag">{t(SPORTS[0].labelKey)}</Badge>
      </div>

      <div>
        <FieldLabel htmlFor="forge-category">{t("forge.category")}</FieldLabel>
        <Input
          id="forge-category"
          placeholder={t("forge.topicPlaceholder")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      <div>
        <FieldLabel>{t("forge.difficulty")}</FieldLabel>
        <Segmented<(typeof DIFFICULTIES)[number]>
          aria-label={t("forge.difficulty")}
          block
          value={difficulty}
          onChange={setDifficulty}
          options={DIFFICULTIES.map((d) => ({ value: d, label: t(DIFFICULTY_LABEL_KEYS[d]) }))}
        />
      </div>

      <div>
        <FieldLabel htmlFor="forge-question">{t("forge.question")}</FieldLabel>
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
        <FieldLabel>{t("forge.answers")}</FieldLabel>
        <div className="flex flex-col gap-2.5">
          {options.map((opt, idx) => {
            const isCorrect = correctIdx === idx;
            return (
              <div key={idx} className="flex items-center gap-2">
                <IconButton
                  variant="secondary"
                  aria-label={t("forge.markCorrect", { letter: LETTERS[idx] })}
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
        <FieldLabel htmlFor="forge-explanation">{t("forge.explanation")}</FieldLabel>
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
        <FieldLabel>{t("forge.image")}</FieldLabel>
        <ImageDropzone imageId={imageId} onUpload={setImageId} onRemove={() => setImageId(null)} />
      </div>

      <Button variant="primary" size="lg" block onClick={handleSubmit} loading={submitting} data-testid="forge-submit-button">
        <Send size={18} strokeWidth={2.5} aria-hidden="true" />
        {t("forge.submit")}
      </Button>
    </div>
  );
}

// ── Review Tab ──

function ReviewTab() {
  const { t } = useTranslation("screens");
  const queue = useQuery(api.forge.getReviewQueue, { limit: 20 });
  const voteMut = useMutation(api.forge.vote);
  const [voting, setVoting] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const handleVote = async (submissionId: Id<"questionSubmissions">, vote: "approve" | "reject") => {
    setVoting(submissionId);
    try {
      const res = await voteMut({ submissionId, vote });
      if (res.newStatus === "approved") {
        notify.success(t("forge.approvedToast"));
      } else if (res.newStatus === "rejected") {
        notify(t("forge.rejectedToast"));
      } else {
        notify.success(vote === "approve" ? t("forge.voteApprove") : t("forge.voteReject"));
      }
    } catch (e) {
      notify.error(friendlyError(e, t("forge.voteFailed")));
    } finally {
      setVoting(null);
    }
  };

  if (queue === undefined) {
    return <LoadingLine>{t("forge.loadingQueue")}</LoadingLine>;
  }

  if (queue.length === 0) {
    return (
      <Card elevation="flat" padding="lg" className="text-center">
        <p className="font-heading text-body-sm font-bold">{t("forge.queueEmpty")}</p>
        <p className="mt-1 text-meta text-muted-foreground">{t("forge.queueEmptyBody")}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {queue.map((s) => (
        <Card key={s._id} elevation="raised" className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{s.sport === "football" ? t("forge.sportFootball") : s.sport}</Badge>
            <Badge tone="neutral">{s.category}</Badge>
            <Badge tone="muted">
              {s.difficulty in DIFFICULTY_LABEL_KEYS
                ? t(DIFFICULTY_LABEL_KEYS[s.difficulty as (typeof DIFFICULTIES)[number]])
                : s.difficulty}
            </Badge>
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
                  {right && <CheckCircle size={16} strokeWidth={3} className="shrink-0 text-verdict-right" aria-label={t("forge.correctAnswer")} />}
                </li>
              );
            })}
          </ul>

          {s.explanation && <p className="text-meta italic text-muted-foreground">{s.explanation}</p>}

          <div className="flex items-center justify-between text-meta text-muted-foreground">
            <span>{t("forge.byAuthor", { username: s.authorUsername })}</span>
            <span className="font-mono font-bold">
              {t("forge.score", { score: `${s.netVotes > 0 ? "+" : ""}${s.netVotes}` })}
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
              {t("forge.approve")}
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
              {t("forge.reject")}
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
  const { t } = useTranslation("screens");
  const submissions = useQuery(api.forge.getMySubmissions);

  if (submissions === undefined) {
    return <LoadingLine>{t("forge.loadingSubmissions")}</LoadingLine>;
  }

  if (submissions.length === 0) {
    return (
      <Card elevation="flat" padding="lg" className="text-center">
        <p className="font-heading text-body-sm font-bold">{t("forge.submissionsEmpty")}</p>
        <p className="mt-1 text-meta text-muted-foreground">{t("forge.submissionsEmptyBody")}</p>
      </Card>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge tone="neutral">
            <Clock size={12} strokeWidth={3} aria-hidden="true" />
            {t("forge.statusPending")}
          </Badge>
        );
      case "approved":
        return (
          <Badge tone="right">
            <CheckCircle size={12} strokeWidth={3} aria-hidden="true" />
            {t("forge.statusApproved")}
          </Badge>
        );
      case "rejected":
        return (
          <Badge tone="wrong">
            <XCircle size={12} strokeWidth={3} aria-hidden="true" />
            {t("forge.statusRejected")}
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
              <Badge tone="neutral">{s.sport === "football" ? t("forge.sportFootball") : s.sport}</Badge>
              {statusBadge(s.status)}
            </div>
            <span className="shrink-0 font-mono text-meta font-bold">
              {t("forge.votes", { count: s.netVotes, signed: `${s.netVotes > 0 ? "+" : ""}${s.netVotes}` })}
            </span>
          </div>
          <p className="font-heading text-body-sm font-bold">{s.question}</p>
          <div className="mt-1.5 flex gap-3 text-meta text-muted-foreground">
            <span>{t("forge.approvals", { count: s.approveCount })}</span>
            <span>{t("forge.rejections", { count: s.rejectCount })}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
