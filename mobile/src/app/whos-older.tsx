import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { Info } from "phosphor-react-native/src/icons/Info";
import { TextAa } from "phosphor-react-native/src/icons/TextAa";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DailyTwinShell, type PlayProps } from "@/components/daily/DailyTwinShell";
import { useLeaveForfeit } from "@/components/daily/useLeaveForfeit";
import { AppBar, Button, Card, Mono, ProgressSegments, Tag, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, modeAccent, radius, space } from "@/theme/tokens";
import { guardParams, isConvexId, optional } from "@/lib/params";

type Start = Awaited<ReturnType<ReturnType<typeof useMutation<typeof api.whosOlder.startDaily>>>>;
type OlderView = Start["session"];
type Reveal = OlderView["history"][number];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export function gapText(days: number) {
  if (days >= 365) {
    const y = Math.round(days / 365);
    return `${y} year${y === 1 ? "" : "s"}`;
  }
  if (days >= 30) {
    const m = Math.round(days / 30);
    return `${m} month${m === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

const fmtDob = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const surname = (name: string) => name.split(" ").slice(-1)[0];

function PlayerCard({ name, dob, state, onPress }: { name: string; dob?: string; state: "idle" | "pending" | "older" | "younger"; onPress?: () => void }) {
  const older = state === "older";
  const pending = state === "pending";
  const younger = state === "younger";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 192,
        borderRadius: radius.hero,
        borderWidth: older || pending ? 2 : 1.5,
        borderColor: older ? color.right : pending ? color.lime : younger ? color.lineSoft : color.line,
        backgroundColor: older ? color.rightBg : younger ? color.surfaceLow : color.surface,
        alignItems: "center",
        justifyContent: "center",
        gap: space.m,
        paddingHorizontal: space.gutter,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {older ? (
        <View style={{ position: "absolute", top: space.l, right: space.l }}>
          <Tag label="Older" tone="solid" c={color.right} />
        </View>
      ) : null}
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: younger ? color.line : color.blue, alignItems: "center", justifyContent: "center" }}>
        <Txt v="h1Game" c={younger ? color.muted : color.ink}>
          {initials(name)}
        </Txt>
      </View>
      <Txt v="h1Game" c={younger ? color.muted : color.cream} center numberOfLines={1}>
        {name}
      </Txt>
      {dob ? <Mono s={15} c={younger ? color.muted : color.cream}>{fmtDob(dob)}</Mono> : null}
    </Pressable>
  );
}

function OlderPlay({ view, setView, onDone }: PlayProps<OlderView>) {
  const insets = useSafeAreaInsets();
  const guess = useMutation(api.whosOlder.guess);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(pick: "a" | "b" | "timeout") {
    if (view.status !== "active" || busy) return;
    // Instant feedback: the tapped card lights up and the phone ticks before the server answers.
    if (pick !== "timeout") {
      haptic.tap();
      setPicked(pick);
    }
    setBusy(true);
    setError(null);
    try {
      const res = await guess({ sessionId: view.sessionId, roundIndex: view.roundIndex, pick });
      if (res.applied && res.reveal) {
        if (res.reveal.correct) haptic.right();
        else haptic.wrong();
        setReveal(res.reveal);
      }
      setView(res.session);
    } catch {
      setError("That answer didn't go through — try again");
    } finally {
      setBusy(false);
      setPicked(null);
    }
  }

  useLeaveForfeit(view.status === "active" && !reveal && !busy, () => void submit("timeout"));

  const endless = view.kind === "endless";
  const total = view.totalRounds ?? 10;
  const segs: ("right" | "wrong" | "current")[] = view.history.map((h) => (h.correct ? "right" : "wrong"));
  const states = reveal || view.status !== "active" ? segs : [...segs, "current" as const];
  const roundNo = Math.min(view.roundIndex + (reveal ? 0 : 1), total);
  const finished = view.status === "completed";

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title="Who's Older?"
        eyebrow={endless ? "Endless" : view.kind === "challenge" ? `Challenge · #${view.edition}` : `Daily #${view.edition}`}
        onBack={() => router.back()}
        close
        right={
          endless ? (
            <Mono s={15}>{`${view.score}`}</Mono>
          ) : (
            <Mono s={15}>
              {roundNo}
              <Mono s={15} c={color.dim}>{`/${total}`}</Mono>
            </Mono>
          )
        }
      />
      {!endless ? (
        <View style={{ marginTop: space.s }}>
          <ProgressSegments states={states} total={total} />
        </View>
      ) : null}

      <View style={{ alignItems: "center", gap: space.s, paddingHorizontal: space.gutter, paddingTop: space.xxl, paddingBottom: space.xl }}>
        {reveal ? (
          <>
            <Tag label={reveal.correct ? "Correct" : "Wrong"} tone="solid" c={reveal.correct ? color.right : color.wrong} />
            <Txt v="h1Game" center>
              {`${surname((reveal.older === "a" ? reveal.a : reveal.b).name)} is ${gapText(reveal.gapDays)} older`}
            </Txt>
          </>
        ) : (
          <Txt v="h1Game" center>
            Tap the older player
          </Txt>
        )}
      </View>

      <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
        {reveal ? (
          <>
            <PlayerCard name={reveal.a.name} dob={reveal.a.dob} state={reveal.older === "a" ? "older" : "younger"} />
            <PlayerCard name={reveal.b.name} dob={reveal.b.dob} state={reveal.older === "b" ? "older" : "younger"} />
          </>
        ) : view.pending ? (
          <>
            <PlayerCard name={view.pending.a.name} state={picked === "a" ? "pending" : "idle"} onPress={() => void submit("a")} />
            <PlayerCard name={view.pending.b.name} state={picked === "b" ? "pending" : "idle"} onPress={() => void submit("b")} />
          </>
        ) : null}
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
        {reveal ? (
          <>
            <Button
              label={finished ? (endless ? "See your run" : "See result") : "Next"}
              icon={ArrowRight}
              iconRight
              onPress={() => {
                setReveal(null);
                if (finished) onDone();
              }}
            />
            <Txt v="micro" c={color.dim} center style={{ fontFamily: font.medium }}>
              Birth dates from Wikidata, checked against Wikipedia
            </Txt>
          </>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.s }}>
            <Info size={16} weight="bold" color={color.dim} />
            <Txt v="caption" c={color.dim}>
              Leaving the app ends this round
            </Txt>
          </View>
        )}
        {error ? (
          <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center" }}>
            <XCircle size={16} weight="fill" color={color.wrong} />
            <Txt v="caption" c={color.muted}>
              {error}
            </Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function LastMiss({ view }: { view: OlderView }) {
  const r = view.history[view.history.length - 1];
  if (!r) return null;
  const older = r.older === "a" ? r.a : r.b;
  const younger = r.older === "a" ? r.b : r.a;
  return (
    <Card hero style={{ gap: space.m }}>
      {[older, younger].map((p, i) => (
        <View key={p.name} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt v="rowTitle" c={i === 0 ? color.cream : color.muted}>
            {p.name}
          </Txt>
          <Mono s={13} c={i === 0 ? color.cream : color.muted}>
            {fmtDob(p.dob)}
          </Mono>
        </View>
      ))}
      <Txt v="caption" c={color.muted}>{`${surname(older.name)} is ${gapText(r.gapDays)} older than ${surname(younger.name)}`}</Txt>
    </Card>
  );
}

function WhosOlderScreen() {
  const params = useLocalSearchParams<{ mode?: string; c?: string }>();
  const { ready } = useSession();
  const today = useQuery(api.whosOlder.getToday, ready ? {} : "skip");
  const letters = useQuery(api.missingLetters.getToday, ready ? {} : "skip");
  const challenge = useQuery(api.whosOlder.getChallenge, ready && params.c ? { challengeId: params.c } : "skip");
  const startDaily = useMutation(api.whosOlder.startDaily);
  const startEndless = useMutation(api.whosOlder.startEndless);
  const startChallenge = useMutation(api.whosOlder.startChallenge);
  const createChallenge = useMutation(api.whosOlder.createChallenge);
  const record = useMutation(api.whosOlder.recordChallengeResult);

  const lettersDone = letters?.daily?.status === "completed";

  return (
    <DailyTwinShell<OlderView>
      game="older"
      title="Who's Older?"
      accent={modeAccent.whosOlder}
      mode={params.mode === "endless" ? "endless" : "daily"}
      challengeId={params.c}
      today={today}
      challenge={challenge}
      landingLine="Same 10 pairs. Tap the older player each time."
      next={
        lettersDone
          ? null
          : { title: "Missing Letters", edition: letters?.edition, line: "Name the player. 10 a day.", accent: modeAccent.missingLetters, icon: TextAa, href: "/missing-letters" }
      }
      startDaily={async () => (await startDaily({})).session}
      startEndless={async () => (await startEndless({})).session}
      startChallenge={async (id) => (await startChallenge({ challengeId: id as never })).session}
      createChallenge={async (sessionId) => (await createChallenge({ sessionId: sessionId as never })).challengeId}
      recordChallengeResult={(challengeId, sessionId) => record({ challengeId: challengeId as never, sessionId: sessionId as never })}
      renderPlay={(p) => <OlderPlay {...p} />}
      renderLastMiss={(v) => <LastMiss view={v} />}
    />
  );
}

export default guardParams(WhosOlderScreen, { c: optional(isConvexId) });
