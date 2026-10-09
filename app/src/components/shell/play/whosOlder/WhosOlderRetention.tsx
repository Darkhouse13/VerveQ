/**
 * WHO'S OLDER? retention loop — the result-card pieces that give a player a
 * reason (streak), a reminder (email) and a rival (challenge) to come back
 * tomorrow. Server rules: convex/lib/whosOlderRetention.ts.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useUtcMidnightCountdown } from "@/hooks/useUtcMidnightCountdown";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslation } from "react-i18next";
import { BellRing, Flame, Mail, Swords } from "lucide-react";
import { NeoButton } from "@/components/neo/NeoButton";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { api } from "../../../../../convex/_generated/api";

export function StreakBlock({ current, best }: { current: number; best: number }) {
  const { t } = useTranslation("play");
  const time = useUtcMidnightCountdown();
  return (
    <div
      data-testid="whos-older-streak"
      className="neo-border border-black neo-shadow rounded-lg bg-black text-center px-4 py-4"
    >
      <p className="inline-flex items-center gap-2 font-heading font-black text-2xl uppercase text-accent">
        <Flame size={24} strokeWidth={3} className="animate-pulse" />
        {t("whosOlder.streakTitle", { count: current })}
      </p>
      <p className="mt-1.5 text-sm text-foreground/90">
        {t("whosOlder.streakNext", { time, next: current + 1 })}
      </p>
      {best > current && (
        <p className="mt-1 font-mono text-[10.5px] uppercase text-muted-foreground">
          {t("whosOlder.streakBest", { count: best })}
        </p>
      )}
    </div>
  );
}

type ReminderState = { state: "none" | "pending" | "on"; email: string | null };

function errorCode(err: unknown): string | null {
  if (err instanceof ConvexError && typeof err.data === "object" && err.data && "code" in err.data) {
    return String((err.data as { code: unknown }).code);
  }
  return null;
}

export function ReminderCard({ reminder }: { reminder: ReminderState }) {
  const { t } = useTranslation("play");
  const subscribe = useMutation(api.whosOlderReminders.subscribe);
  const turnOff = useMutation(api.whosOlderReminders.unsubscribeMine);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || reminder.state !== "none") return;
    shown.current = true;
    track("whos_older_reminder_shown");
  }, [reminder.state]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await subscribe({ email, timeZone });
      track("whos_older_reminder_subscribed", { state: res.state });
    } catch (err) {
      const code = errorCode(err);
      setError(
        code === "invalid_email"
          ? t("whosOlder.reminderInvalid")
          : code === "rate_limited"
            ? t("whosOlder.reminderRateLimited")
            : t("whosOlder.reminderFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (reminder.state === "pending" || reminder.state === "on") {
    return (
      <div
        data-testid={`whos-older-reminder-${reminder.state}`}
        className="neo-border border-black rounded-lg bg-foreground text-background px-4 py-3 flex items-center gap-3"
      >
        {reminder.state === "on" ? <BellRing size={20} className="shrink-0" /> : <Mail size={20} className="shrink-0" />}
        <p className="text-sm leading-snug flex-1">
          {reminder.state === "on"
            ? t("whosOlder.reminderOn", { email: reminder.email })
            : t("whosOlder.reminderPending", { email: reminder.email })}
        </p>
        {reminder.state === "on" && (
          <button
            type="button"
            className="shrink-0 font-mono text-[11px] uppercase underline opacity-70"
            onClick={() => {
              void turnOff({});
              track("whos_older_reminder_turned_off");
            }}
          >
            {t("whosOlder.reminderOff")}
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      data-testid="whos-older-reminder-form"
      className="neo-border border-black neo-shadow rounded-lg bg-yellow text-yellow-foreground px-4 py-4"
    >
      <p className="font-heading font-black text-lg uppercase leading-tight">{t("whosOlder.reminderTitle")}</p>
      <p className="text-sm mt-1 leading-snug">{t("whosOlder.reminderBody")}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("whosOlder.reminderPlaceholder")}
          aria-label={t("whosOlder.reminderPlaceholder")}
          className="min-w-0 flex-1 rounded-md border-[3px] border-black bg-white text-black px-3 py-2 text-base"
        />
        <NeoButton type="submit" variant="primary" size="md" disabled={busy || !email}>
          {t("whosOlder.reminderCta")}
        </NeoButton>
      </div>
      {error && <p className="mt-2 text-sm font-bold text-destructive">{error}</p>}
      <p className="mt-2 text-[11px] opacity-80">{t("whosOlder.reminderPrivacy")}</p>
    </form>
  );
}

type ChallengeSummary = {
  challengeId: string;
  edition: number;
  score: number;
  total: number;
  results: Array<{ name: string | null; score: number; total: number; beatYou: boolean; tie: boolean }>;
};

export function ChallengeResults({ challenges }: { challenges: ChallengeSummary[] }) {
  const { t } = useTranslation("play");
  if (challenges.length === 0) return null;
  return (
    <div data-testid="whos-older-challenge-results" className="neo-border border-black rounded-lg bg-card px-4 py-3">
      <p className="inline-flex items-center gap-2 font-heading font-black uppercase text-sm">
        <Swords size={16} /> {t("whosOlder.challengeResultsTitle")}
      </p>
      <ul className="mt-2 space-y-1.5">
        {challenges.flatMap((c) =>
          c.results.map((r, i) => (
            <li key={`${c.challengeId}-${i}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-mono text-[10.5px] text-muted-foreground mr-1.5">#{c.edition}</span>
                <span className="font-bold">{r.name ?? t("whosOlder.aFriend")}</span>{" "}
                {r.score}/{r.total}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full border-2 border-black px-2 py-0.5 text-[11px] font-bold uppercase",
                  r.tie ? "bg-yellow text-yellow-foreground" : r.beatYou ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground",
                )}
              >
                {r.tie ? t("whosOlder.challengeTieShort") : r.beatYou ? t("whosOlder.challengeBeatYou") : t("whosOlder.challengeYouWon")}
              </span>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}

export type ChallengeInfo = {
  fromName: string | null;
  edition: number;
  score: number;
  total: number;
};

export function ChallengeBanner({ challenge }: { challenge: ChallengeInfo }) {
  const { t } = useTranslation("play");
  return (
    <div
      data-testid="whos-older-challenge-banner"
      className="shrink-0 mb-2 rounded-lg border-[3px] border-black bg-hot-pink text-white px-3 py-1.5 text-center text-sm font-bold shadow-[3px_3px_0_0_#000]"
    >
      <Swords size={14} className="inline mr-1.5 -mt-0.5" />
      {t("whosOlder.challengeBanner", {
        name: challenge.fromName ?? t("whosOlder.aFriend"),
        score: challenge.score,
        total: challenge.total,
        n: challenge.edition,
      })}
    </div>
  );
}

export function HeadToHead({
  challenge,
  myScore,
  verdict,
}: {
  challenge: ChallengeInfo;
  myScore: number;
  verdict: "won" | "lost" | "tie";
}) {
  const { t } = useTranslation("play");
  const name = challenge.fromName ?? t("whosOlder.aFriend");
  return (
    <div
      data-testid="whos-older-head-to-head"
      className={cn(
        "neo-border border-black neo-shadow-lg rounded-lg text-center px-4 py-4",
        verdict === "won" ? "bg-accent text-accent-foreground" : verdict === "lost" ? "bg-hot-pink text-white" : "bg-yellow text-yellow-foreground",
      )}
    >
      <p className="font-heading font-black text-xl uppercase">
        {verdict === "won"
          ? t("whosOlder.challengeWon", { name })
          : verdict === "lost"
            ? t("whosOlder.challengeLost", { name })
            : t("whosOlder.challengeTie", { name })}
      </p>
      <p className="mt-2 font-heading font-black text-4xl tabular-nums">
        {myScore} <span className="opacity-60 text-2xl">–</span> {challenge.score}
      </p>
      <p className="mt-1 font-mono text-[11px] uppercase opacity-80">
        {t("whosOlder.you")} · {name}
      </p>
    </div>
  );
}
