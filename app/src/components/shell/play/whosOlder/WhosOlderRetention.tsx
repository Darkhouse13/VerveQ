/**
 * The DAILY GAMES' retention loop — the result-card pieces that give a player
 * a reason (streak), a reminder (email) and a rival (challenge) to come back
 * tomorrow. Shared by Who's Older? (the default) and Missing Letters via the
 * `game` prop, which picks the copy namespace, test ids and analytics events.
 * Server rules: convex/lib/whosOlderRetention.ts + convex/lib/dailyGames.ts.
 *
 * Since VerveQ ONE P2.2 these sit on the shared ResultScreen
 * (components/shell/play/result): the streak is a quiet line under the hero,
 * the reminder one link in the bottom line, and nothing here is lime — the
 * screen's one lime button is Share.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useUtcMidnightCountdown } from "@/hooks/useUtcMidnightCountdown";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslation } from "react-i18next";
import { BellRing, Flame, Mail, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { api } from "../../../../../convex/_generated/api";

export type DailyGame = "older" | "letters";

/** Per game: i18n namespace key, test-id prefix and analytics event names. */
const GAME_UI = {
  older: {
    ns: "whosOlder",
    tid: "whos-older",
    events: {
      reminderShown: "whos_older_reminder_shown",
      reminderSubscribed: "whos_older_reminder_subscribed",
      reminderTurnedOff: "whos_older_reminder_turned_off",
    },
  },
  letters: {
    ns: "missingLetters",
    tid: "missing-letters",
    events: {
      reminderShown: "missing_letters_reminder_shown",
      reminderSubscribed: "missing_letters_reminder_subscribed",
      reminderTurnedOff: "missing_letters_reminder_turned_off",
    },
  },
} as const;

/**
 * The streak line under the result hero: a quiet two-liner, not a card — the
 * flame in the mode's accent, the count, and when the next game unlocks.
 */
export function StreakBlock({ current, best, game = "older" }: { current: number; best: number; game?: DailyGame }) {
  const { t } = useTranslation("play");
  const { ns, tid } = GAME_UI[game];
  const time = useUtcMidnightCountdown();
  return (
    <div data-testid={`${tid}-streak`} className="flex flex-col items-center gap-0.5 py-1 text-center">
      <p className="inline-flex items-center gap-1.5 font-heading font-bold text-title-sm">
        <Flame size={20} strokeWidth={2.5} className="text-mode-accent" aria-hidden="true" />
        {t(`${ns}.streakTitle`, { count: current })}
      </p>
      <p className="text-body-sm text-muted-foreground">
        {t(`${ns}.streakNext`, { time, next: current + 1 })}
        {best > current && <> · {t(`${ns}.streakBest`, { count: best })}</>}
      </p>
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

/**
 * `collapsed` (the result screens since RETURN_LOOP, 2026-10-16): with no
 * reminder yet the form starts as one quiet link, and `*_reminder_shown`
 * fires only once that link is opened into the form. Pending / on are one
 * line of status text.
 */
export function ReminderCard({
  reminder,
  game = "older",
  collapsed = false,
}: {
  reminder: ReminderState;
  game?: DailyGame;
  collapsed?: boolean;
}) {
  const { t } = useTranslation("play");
  const { ns, tid, events } = GAME_UI[game];
  // Who's Older's calls stay exactly as they were: no `game` means "older".
  const gameArg = game === "letters" ? { game } : {};
  const subscribe = useMutation(api.whosOlderReminders.subscribe);
  const turnOff = useMutation(api.whosOlderReminders.unsubscribeMine);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!collapsed);

  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || reminder.state !== "none" || !expanded) return;
    shown.current = true;
    track(events.reminderShown);
  }, [reminder.state, events, expanded]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await subscribe({ email, timeZone, ...gameArg });
      track(events.reminderSubscribed, { state: res.state });
    } catch (err) {
      const code = errorCode(err);
      setError(
        code === "invalid_email"
          ? t(`${ns}.reminderInvalid`)
          : code === "rate_limited"
            ? t(`${ns}.reminderRateLimited`)
            : t(`${ns}.reminderFailed`),
      );
    } finally {
      setBusy(false);
    }
  };

  if (reminder.state === "pending" || reminder.state === "on") {
    return (
      <p
        data-testid={`${tid}-reminder-${reminder.state}`}
        className="inline-flex flex-wrap items-center justify-center gap-x-2 text-center text-body-sm text-muted-foreground"
      >
        {reminder.state === "on" ? (
          <BellRing size={16} className="shrink-0" aria-hidden="true" />
        ) : (
          <Mail size={16} className="shrink-0" aria-hidden="true" />
        )}
        <span>
          {reminder.state === "on"
            ? t(`${ns}.reminderOn`, { email: reminder.email })
            : t(`${ns}.reminderPending`, { email: reminder.email })}
        </span>
        {reminder.state === "on" && (
          <Button
            variant="ghost"
            size="sm"
            className="px-2 font-body font-normal text-muted-foreground underline underline-offset-4"
            onClick={() => {
              void turnOff(gameArg);
              track(events.reminderTurnedOff);
            }}
          >
            {t(`${ns}.reminderOff`)}
          </Button>
        )}
      </p>
    );
  }

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        data-testid={`${tid}-reminder-expand`}
        onClick={() => setExpanded(true)}
        className="px-2 font-body font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        <Mail size={16} className="shrink-0" aria-hidden="true" />
        {t("dailyShare.reminderCollapsed")}
      </Button>
    );
  }

  return (
    <Card elevation="flat" className="w-full basis-full text-left" data-testid={`${tid}-reminder-form`}>
      <form onSubmit={submit}>
        <p className="font-heading font-bold text-title-sm">{t(`${ns}.reminderTitle`)}</p>
        <p className="mt-1 text-body-sm text-muted-foreground">{t(`${ns}.reminderBody`)}</p>
        <div className="mt-3 flex gap-2">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t(`${ns}.reminderPlaceholder`)}
            aria-label={t(`${ns}.reminderPlaceholder`)}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="secondary" disabled={!email} loading={busy}>
            {t(`${ns}.reminderCta`)}
          </Button>
        </div>
        {error && <p className="mt-2 text-body-sm font-bold text-verdict-wrong">{error}</p>}
        <p className="mt-2 text-meta text-muted-foreground">{t(`${ns}.reminderPrivacy`)}</p>
      </form>
    </Card>
  );
}

type ChallengeSummary = {
  challengeId: string;
  edition: number;
  score: number;
  total: number;
  results: Array<{ name: string | null; score: number; total: number; beatYou: boolean; tie: boolean }>;
};

export function ChallengeResults({ challenges, game = "older" }: { challenges: ChallengeSummary[]; game?: DailyGame }) {
  const { t } = useTranslation("play");
  const { ns, tid } = GAME_UI[game];
  if (challenges.length === 0) return null;
  return (
    <Card elevation="flat" padding="sm" data-testid={`${tid}-challenge-results`}>
      <p className="inline-flex items-center gap-2 font-heading font-bold text-body-sm">
        <Swords size={16} className="text-mode-accent" aria-hidden="true" /> {t(`${ns}.challengeResultsTitle`)}
      </p>
      <ul className="mt-2 space-y-1.5">
        {challenges.flatMap((c) =>
          c.results.map((r, i) => (
            <li key={`${c.challengeId}-${i}`} className="flex items-center justify-between gap-2 text-body-sm">
              <span className="min-w-0 truncate">
                <span className="mr-1.5 font-mono text-eyebrow text-muted-foreground">#{c.edition}</span>
                <span className="font-bold">{r.name ?? t(`${ns}.aFriend`)}</span>{" "}
                {r.score}/{r.total}
              </span>
              <Badge tone={r.tie ? "neutral" : r.beatYou ? "wrong" : "right"} className="shrink-0">
                {r.tie ? t(`${ns}.challengeTieShort`) : r.beatYou ? t(`${ns}.challengeBeatYou`) : t(`${ns}.challengeYouWon`)}
              </Badge>
            </li>
          )),
        )}
      </ul>
    </Card>
  );
}

export type ChallengeInfo = {
  fromName: string | null;
  edition: number;
  score: number;
  total: number;
};

export function ChallengeBanner({ challenge, game = "older" }: { challenge: ChallengeInfo; game?: DailyGame }) {
  const { t } = useTranslation("play");
  const { ns, tid } = GAME_UI[game];
  return (
    <div
      data-testid={`${tid}-challenge-banner`}
      className="mb-2 shrink-0 rounded-lg bg-card px-3 py-1.5 text-center text-body-sm font-bold neo-border"
    >
      <Swords size={14} className="-mt-0.5 mr-1.5 inline text-mode-accent" aria-hidden="true" />
      {t(`${ns}.challengeBanner`, {
        name: challenge.fromName ?? t(`${ns}.aFriend`),
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
  game = "older",
}: {
  challenge: ChallengeInfo;
  myScore: number;
  verdict: "won" | "lost" | "tie";
  game?: DailyGame;
}) {
  const { t } = useTranslation("play");
  const { ns, tid } = GAME_UI[game];
  const name = challenge.fromName ?? t(`${ns}.aFriend`);
  return (
    <Card
      elevation="lifted"
      data-testid={`${tid}-head-to-head`}
      className={cn(
        "text-center",
        verdict === "won" && "!border-verdict-right",
        verdict === "lost" && "!border-verdict-wrong",
      )}
    >
      <p className="font-heading font-bold text-title">
        {verdict === "won"
          ? t(`${ns}.challengeWon`, { name })
          : verdict === "lost"
            ? t(`${ns}.challengeLost`, { name })
            : t(`${ns}.challengeTie`, { name })}
      </p>
      <p className="mt-2 font-mono font-bold text-display tabular-nums">
        {myScore} <span className="text-muted-foreground">–</span> {challenge.score}
      </p>
      <p className="mt-1 font-mono text-eyebrow uppercase text-muted-foreground">
        {t(`${ns}.you`)} · {name}
      </p>
    </Card>
  );
}
