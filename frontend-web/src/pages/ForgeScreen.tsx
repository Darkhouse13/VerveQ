import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { BottomNav } from "@/components/neo/BottomNav";
import { ImageDropzone } from "@/components/ImageDropzone";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import {
  ArrowLeft,
  Lock,
  Hammer,
  ThumbsUp,
  ThumbsDown,
  Send,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

type Tab = "submit" | "review" | "submissions";

const SPORTS = [
  { name: "football", emoji: "\u26BD" },
  { name: "tennis", emoji: "\uD83C\uDFBE" },
  { name: "basketball", emoji: "\uD83C\uDFC0" },
];

const DIFFICULTIES = ["easy", "intermediate", "hard"] as const;

export default function ForgeScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("submit");

  const access = useQuery(api.forge.canAccess);

  if (access === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">
          Loading The Forge...
        </p>
      </div>
    );
  }

  if (!access.allowed) {
    return <ForgeLockScreen currentElo={access.currentElo} />;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "submit", label: "Submit" },
    { key: "review", label: "Review" },
    { key: "submissions", label: "My Submissions" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => navigate(-1)} className="cursor-pointer">
          <ArrowLeft size={24} strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-2">
          <Hammer size={24} strokeWidth={2.5} className="text-primary" />
          <h1 className="font-heading font-bold text-xl">THE FORGE</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`neo-border rounded-full px-3 py-1 text-xs uppercase font-heading font-bold transition-all cursor-pointer ${
              activeTab === t.key
                ? "bg-primary text-primary-foreground neo-shadow"
                : "bg-background text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-5">
        {activeTab === "submit" && (
          <SubmitTab onSuccess={() => setActiveTab("submissions")} />
        )}
        {activeTab === "review" && <ReviewTab />}
        {activeTab === "submissions" && <MySubmissionsTab />}
      </div>

      <BottomNav />
    </div>
  );
}

// ── Lock Screen ──

function ForgeLockScreen({ currentElo }: { currentElo: number }) {
  const navigate = useNavigate();
  const progress = Math.min((currentElo / 1500) * 100, 100);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <NeoCard shadow="lg" className="w-full text-center">
        <div className="neo-border rounded-full w-16 h-16 flex items-center justify-center bg-muted mx-auto mb-4">
          <Lock size={32} strokeWidth={2.5} />
        </div>
        <h2 className="font-heading font-bold text-2xl mb-2">
          THE FORGE IS LOCKED
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Reach <span className="font-bold text-primary">Gold Tier (1500 ELO)</span> in
          any sport to unlock The Forge and create questions for the community.
        </p>

        <div className="mb-2">
          <p className="font-mono font-bold text-3xl">{currentElo}</p>
          <p className="text-xs text-muted-foreground uppercase">Current ELO</p>
        </div>

        <div className="neo-border rounded-full h-3 bg-muted mb-1">
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mb-5">
          {Math.max(1500 - currentElo, 0)} ELO to go
        </p>

        <NeoButton variant="secondary" size="full" onClick={() => navigate(-1)}>
          Go Back
        </NeoButton>
      </NeoCard>
    </div>
  );
}

// ── Submit Tab ──

function SubmitTab({ onSuccess }: { onSuccess: () => void }) {
  const [sport, setSport] = useState(SPORTS[0].name);
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
    if (!questionText.trim()) return toast.error("Question is required");
    if (!category.trim()) return toast.error("Category is required");
    if (options.some((o) => !o.trim())) return toast.error("All 4 options are required");

    const uniqueOptions = new Set(options.map((o) => o.trim().toLowerCase()));
    if (uniqueOptions.size !== 4) return toast.error("All options must be unique");

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
      toast.success("Question submitted for review!");
      // Reset form
      setQuestionText("");
      setCategory("");
      setOptions(["", "", "", ""]);
      setCorrectIdx(0);
      setExplanation("");
      setImageId(null);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sport */}
      <div>
        <p className="font-heading font-bold text-xs uppercase mb-2">Sport</p>
        <div className="flex gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.name}
              onClick={() => setSport(s.name)}
              className={`neo-border rounded-full px-3 py-1.5 text-xs uppercase font-heading font-bold cursor-pointer transition-all ${
                sport === s.name
                  ? "bg-primary text-primary-foreground neo-shadow"
                  : "bg-background text-foreground"
              }`}
            >
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="font-heading font-bold text-xs uppercase mb-2">Category</p>
        <NeoInput
          placeholder="e.g. Transfers, World Cup, Grand Slams..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      {/* Difficulty */}
      <div>
        <p className="font-heading font-bold text-xs uppercase mb-2">Difficulty</p>
        <div className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`neo-border rounded-full px-3 py-1.5 text-xs uppercase font-heading font-bold cursor-pointer transition-all ${
                difficulty === d
                  ? "bg-primary text-primary-foreground neo-shadow"
                  : "bg-background text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Question */}
      <div>
        <p className="font-heading font-bold text-xs uppercase mb-2">Question</p>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Type your trivia question..."
          rows={3}
          className="neo-border neo-shadow rounded-lg px-4 py-3 font-body text-base bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full transition-all resize-none"
        />
      </div>

      {/* Options */}
      <div>
        <p className="font-heading font-bold text-xs uppercase mb-2">
          Answers (tap to mark correct)
        </p>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button
                onClick={() => setCorrectIdx(idx)}
                className={`neo-border rounded-full w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                  correctIdx === idx
                    ? "bg-success text-success-foreground"
                    : "bg-background text-foreground"
                }`}
              >
                {correctIdx === idx ? (
                  <CheckCircle size={16} strokeWidth={3} />
                ) : (
                  <span className="font-heading font-bold text-xs">
                    {["A", "B", "C", "D"][idx]}
                  </span>
                )}
              </button>
              <NeoInput
                placeholder={`Option ${["A", "B", "C", "D"][idx]}`}
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Explanation */}
      <div>
        <p className="font-heading font-bold text-xs uppercase mb-2">
          Explanation (optional)
        </p>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Why is this the correct answer?"
          rows={2}
          className="neo-border neo-shadow rounded-lg px-4 py-3 font-body text-base bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full transition-all resize-none"
        />
      </div>

      {/* Image Upload */}
      <div>
        <p className="font-heading font-bold text-xs uppercase mb-2">
          Image (optional)
        </p>
        <ImageDropzone
          imageId={imageId}
          onUpload={setImageId}
          onRemove={() => setImageId(null)}
        />
      </div>

      {/* Submit */}
      <NeoButton
        variant="primary"
        size="full"
        onClick={handleSubmit}
        disabled={submitting}
      >
        <Send size={18} strokeWidth={2.5} />
        {submitting ? "Submitting..." : "Submit Question"}
      </NeoButton>
    </div>
  );
}

// ── Review Tab ──

function ReviewTab() {
  const queue = useQuery(api.forge.getReviewQueue, { limit: 20 });
  const voteMut = useMutation(api.forge.vote);
  const [voting, setVoting] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const handleVote = async (
    submissionId: Id<"questionSubmissions">,
    vote: "approve" | "reject",
  ) => {
    setVoting(submissionId);
    try {
      const res = await voteMut({ submissionId, vote });
      if (res.newStatus === "approved") {
        toast.success("Question approved and added to the pool!");
      } else if (res.newStatus === "rejected") {
        toast("Question rejected and archived.");
      } else {
        toast.success(`Vote recorded (${vote})`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setVoting(null);
    }
  };

  if (queue === undefined) {
    return (
      <p className="font-heading font-bold text-sm animate-pulse text-center py-10">
        Loading review queue...
      </p>
    );
  }

  if (queue.length === 0) {
    return (
      <NeoCard className="text-center py-10">
        <p className="font-heading font-bold text-sm">
          No questions to review right now
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Check back later for new submissions
        </p>
      </NeoCard>
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((s) => (
        <NeoCard key={s._id} shadow="lg" className="space-y-3">
          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            <NeoBadge color="primary" size="sm">
              {s.sport}
            </NeoBadge>
            <NeoBadge color="blue" size="sm">
              {s.category}
            </NeoBadge>
            <NeoBadge color="accent" size="sm" rotated>
              {s.difficulty}
            </NeoBadge>
          </div>

          {/* Image */}
          {s.imageUrl && (
            <QuestionImage
              imageUrl={s.imageUrl}
              onZoom={() => setZoomImage(s.imageUrl)}
            />
          )}

          {/* Question */}
          <p className="font-heading font-bold text-lg leading-tight">
            {s.question}
          </p>

          {/* Options */}
          <div className="space-y-1.5">
            {s.options.map((opt, idx) => (
              <div
                key={idx}
                className={`neo-border rounded-lg px-3 py-2 text-sm font-body ${
                  opt === s.correctAnswer
                    ? "bg-success/10 border-success"
                    : "bg-muted/30"
                }`}
              >
                <span className="font-heading font-bold text-xs mr-2">
                  {["A", "B", "C", "D"][idx]}
                </span>
                {opt}
                {opt === s.correctAnswer && (
                  <CheckCircle
                    size={14}
                    strokeWidth={3}
                    className="inline ml-2 text-success"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Explanation */}
          {s.explanation && (
            <p className="text-xs text-muted-foreground italic">
              {s.explanation}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>by @{s.authorUsername}</span>
            <span className="font-mono font-bold">
              Score: {s.netVotes > 0 ? "+" : ""}
              {s.netVotes}
            </span>
          </div>

          {/* Vote Buttons */}
          {s.userVote ? (
            <div className="flex gap-2">
              <NeoButton
                variant={s.userVote === "approve" ? "success" : "secondary"}
                size="full"
                disabled
              >
                <ThumbsUp size={18} strokeWidth={2.5} />
                APPROVE
              </NeoButton>
              <NeoButton
                variant={s.userVote === "reject" ? "danger" : "secondary"}
                size="full"
                disabled
              >
                <ThumbsDown size={18} strokeWidth={2.5} />
                REJECT
              </NeoButton>
            </div>
          ) : (
            <div className="flex gap-2">
              <NeoButton
                variant="success"
                size="full"
                disabled={voting === s._id}
                onClick={() => handleVote(s._id, "approve")}
              >
                <ThumbsUp size={18} strokeWidth={2.5} />
                APPROVE
              </NeoButton>
              <NeoButton
                variant="danger"
                size="full"
                disabled={voting === s._id}
                onClick={() => handleVote(s._id, "reject")}
              >
                <ThumbsDown size={18} strokeWidth={2.5} />
                REJECT
              </NeoButton>
            </div>
          )}
        </NeoCard>
      ))}

      {zoomImage && (
        <ImageZoomModal
          imageUrl={zoomImage}
          open={!!zoomImage}
          onClose={() => setZoomImage(null)}
        />
      )}
    </div>
  );
}

// ── My Submissions Tab ──

function MySubmissionsTab() {
  const submissions = useQuery(api.forge.getMySubmissions);

  if (submissions === undefined) {
    return (
      <p className="font-heading font-bold text-sm animate-pulse text-center py-10">
        Loading submissions...
      </p>
    );
  }

  if (submissions.length === 0) {
    return (
      <NeoCard className="text-center py-10">
        <p className="font-heading font-bold text-sm">
          You haven't submitted any questions yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Switch to the Submit tab to create your first question
        </p>
      </NeoCard>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <NeoBadge color="primary" size="sm">
            <Clock size={10} strokeWidth={3} className="inline mr-1" />
            PENDING
          </NeoBadge>
        );
      case "approved":
        return (
          <NeoBadge color="success" size="sm">
            <CheckCircle size={10} strokeWidth={3} className="inline mr-1" />
            APPROVED
          </NeoBadge>
        );
      case "rejected":
        return (
          <NeoBadge color="destructive" size="sm">
            <XCircle size={10} strokeWidth={3} className="inline mr-1" />
            REJECTED
          </NeoBadge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {submissions.map((s) => (
        <NeoCard key={s._id}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex gap-1.5 flex-wrap">
              <NeoBadge color="blue" size="sm">
                {s.sport}
              </NeoBadge>
              {statusBadge(s.status)}
            </div>
            <span className="font-mono font-bold text-xs shrink-0">
              {s.netVotes > 0 ? "+" : ""}
              {s.netVotes} votes
            </span>
          </div>
          <p className="font-heading font-bold text-sm leading-tight">
            {s.question}
          </p>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-1.5">
            <span>{s.approveCount} approvals</span>
            <span>{s.rejectCount} rejections</span>
          </div>
        </NeoCard>
      ))}
    </div>
  );
}
