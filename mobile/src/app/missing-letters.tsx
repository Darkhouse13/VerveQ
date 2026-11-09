import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Backspace } from "phosphor-react-native/src/icons/Backspace";
import { Check } from "phosphor-react-native/src/icons/Check";
import { MapPin } from "phosphor-react-native/src/icons/MapPin";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DailyTwinShell, type PlayProps } from "@/components/daily/DailyTwinShell";
import { useLeaveForfeit } from "@/components/daily/useLeaveForfeit";
import { AppBar, Button, Card, Mono, ProgressSegments, Tag, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, modeAccent, radius, space } from "@/theme/tokens";
import { guardParams, isConvexId, optional } from "@/lib/params";

type Start = Awaited<ReturnType<ReturnType<typeof useMutation<typeof api.missingLetters.startDaily>>>>;
type LettersView = Start["session"];
type Reveal = LettersView["history"][number];

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const REVEAL_HOLD_MS = { right: 1900, wrong: 3000 }; // same beat as the web

type Tile = { char: string | null; index: number };

/** Split the board into words so long names wrap on spaces, never mid-word. */
function words(chars: (string | null)[]): Tile[][] {
  const out: Tile[][] = [[]];
  chars.forEach((c, i) => {
    if (c === " ") out.push([]);
    else out[out.length - 1]!.push({ char: c, index: i });
  });
  return out.filter((w) => w.length);
}

function Board({
  chars,
  tileState,
  onTilePress,
}: {
  chars: (string | null)[];
  tileState: (index: number) => { letter: string; kind: "fixed" | "blank" | "typed" | "focus" | "right" | "wrong" };
  onTilePress?: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const ws = words(chars);
  const longest = Math.max(...ws.map((w) => w.length));
  const avail = width - space.gutter * 2;
  const tile = Math.min(36, Math.floor((avail - (longest - 1) * space.xs) / longest));
  return (
    <View style={{ gap: space.s, alignItems: "center" }}>
      {ws.map((w, wi) => (
        <View key={wi} style={{ flexDirection: "row", gap: space.xs }}>
          {w.map(({ index }) => {
            const t = tileState(index);
            const bg =
              t.kind === "fixed" ? color.cream : t.kind === "right" ? color.right : t.kind === "wrong" ? color.wrong : color.surface;
            const border = t.kind === "focus" ? color.pink : t.kind === "blank" || t.kind === "typed" ? color.line : bg;
            const fg = t.kind === "fixed" || t.kind === "right" || t.kind === "wrong" ? color.ink : color.cream;
            return (
              <Pressable accessibilityRole="button"
                key={index}
                disabled={!onTilePress || t.kind === "fixed"}
                onPress={() => onTilePress?.(index)}
                style={{
                  width: tile,
                  height: Math.round(tile * 1.25),
                  borderRadius: radius.chip,
                  backgroundColor: bg,
                  borderWidth: 2,
                  borderColor: border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: Math.round(tile * 0.55), color: fg }}>{t.letter}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Keyboard({ onKey, onBack }: { onKey: (k: string) => void; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const key = Math.floor((width - space.gutter * 2 - 9 * space.xs) / 10);
  const k = (label: string, onPress: () => void, w = key, a11y?: string) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: w,
        height: 48,
        borderRadius: radius.chip,
        backgroundColor: pressed ? color.line : color.surfaceHigh,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      {label === "⌫" ? <Backspace size={20} weight="bold" color={color.cream} /> : <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: 17, color: color.cream }}>{label}</Text>}
    </Pressable>
  );
  return (
    <View style={{ gap: space.s, alignItems: "center" }}>
      {KEY_ROWS.map((row, ri) => (
        <View key={row} style={{ flexDirection: "row", gap: space.xs }}>
          {[...row].map((c) => k(c, () => onKey(c)))}
          {ri === 2 ? k("⌫", onBack, key * 1.5 + space.xs, "Delete") : null}
        </View>
      ))}
    </View>
  );
}

function RoundInput({
  tiles,
  busy,
  error,
  onCheck,
  onGiveUp,
}: {
  tiles: (string | null)[];
  busy: boolean;
  error: string | null;
  onCheck: (letters: string) => void;
  onGiveUp: () => void;
}) {
  const insets = useSafeAreaInsets();
  const blanks = useMemo(() => tiles.flatMap((c, i) => (c === null ? [i] : [])), [tiles]);
  const [typed, setTyped] = useState<(string | null)[]>(() => blanks.map(() => null));
  const [focus, setFocus] = useState(0);
  const filled = typed.length === blanks.length && typed.every(Boolean);

  const onKey = (c: string) => {
    const next = [...typed];
    next[focus] = c;
    setTyped(next);
    let f = focus + 1;
    while (f < blanks.length && next[f]) f++;
    setFocus(f < blanks.length ? f : Math.min(focus + 1, blanks.length - 1));
  };
  const onBack = () => {
    const next = [...typed];
    if (next[focus]) next[focus] = null;
    else if (focus > 0) {
      next[focus - 1] = null;
      setFocus(focus - 1);
    }
    setTyped(next);
  };
  const tileState = (i: number) => {
    const c = tiles[i];
    if (c !== null && c !== undefined) return { letter: c, kind: "fixed" as const };
    const bi = blanks.indexOf(i);
    const t = typed[bi];
    return { letter: t ?? "", kind: bi === focus ? ("focus" as const) : t ? ("typed" as const) : ("blank" as const) };
  };

  return (
    <>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl }}>
        <Board chars={tiles} tileState={tileState} onTilePress={(i) => setFocus(blanks.indexOf(i))} />
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space.l, gap: space.l }}>
        <Txt v="caption" c={color.dim} center>
          One try per board — fill every blank, then check.
        </Txt>
        <Keyboard onKey={onKey} onBack={onBack} />
        <View style={{ flexDirection: "row", gap: space.m }}>
          <Button variant="secondary" label="Give up" style={{ flex: 1 }} onPress={onGiveUp} />
          <Button label={busy ? "Checking…" : "Check"} icon={busy ? undefined : Check} style={{ flex: 2 }} disabled={!filled || busy} onPress={() => onCheck(typed.join(""))} />
        </View>
        {error ? (
          <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center" }}>
            <XCircle size={16} weight="fill" color={color.wrong} />
            <Txt v="caption" c={color.muted}>
              {error}
            </Txt>
          </View>
        ) : null}
      </View>
    </>
  );
}

function LettersPlay({ view, setView, onDone }: PlayProps<LettersView>) {
  const guess = useMutation(api.missingLetters.guess);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finished = view.status === "completed";

  const advance = () => {
    setReveal(null);
    if (finished) onDone();
  };
  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });
  // A reveal holds for a beat, then deals the next board (tap skips it).
  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => advanceRef.current(), reveal.correct ? REVEAL_HOLD_MS.right : REVEAL_HOLD_MS.wrong);
    return () => clearTimeout(t);
  }, [reveal]);

  async function submit(answer: { letters: string } | { forfeit: "skip" | "timeout" }) {
    if (view.status !== "active" || busy || reveal) return;
    setBusy(true);
    setError(null);
    try {
      const res = await guess({ sessionId: view.sessionId, roundIndex: view.roundIndex, ...answer });
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
    }
  }

  useLeaveForfeit(view.status === "active" && !reveal && !busy, () => void submit({ forfeit: "timeout" }));

  const endless = view.kind === "endless";
  const total = view.totalRounds ?? 10;
  const segs: ("right" | "wrong" | "current")[] = view.history.map((h) => (h.correct ? "right" : "wrong"));
  const states = reveal || view.status !== "active" ? segs : [...segs, "current" as const];
  const roundNo = Math.min(view.roundIndex + (reveal ? 0 : 1), total);
  const tier = reveal?.tier ?? view.pending?.tier ?? "easy";
  const nation = reveal?.nation ?? view.pending?.nation ?? "";

  const revealChars = reveal ? [...reveal.name.toUpperCase()] : [];
  const hiddenSet = new Set(reveal?.hidden ?? []);
  const revealState = (i: number) => {
    const letter = revealChars[i] ?? "";
    if (!hiddenSet.has(i)) return { letter, kind: "fixed" as const };
    return { letter, kind: reveal!.correct ? ("right" as const) : ("wrong" as const) };
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title="Missing Letters"
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

      <View style={{ alignItems: "center", gap: space.m, paddingHorizontal: space.gutter, paddingTop: space.xl }}>
        {reveal ? (
          <Tag label={reveal.correct ? "Correct" : reveal.forfeit ? "Skipped" : "Wrong"} tone="solid" c={reveal.correct ? color.right : color.wrong} />
        ) : (
          <Tag label={tier} c={color.pink} />
        )}
        <Txt v="h1Game" center>
          {reveal ? reveal.name : "Name him"}
        </Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.s, paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.pill, backgroundColor: color.surface }}>
          <MapPin size={16} weight="fill" color={color.pink} />
          <Txt v="caption" c={color.cream}>
            {nation}
          </Txt>
        </View>
      </View>

      {reveal ? (
        <Pressable onPress={advance} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel="Continue">
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl }}>
            <Board chars={revealChars} tileState={revealState} />
          </View>
          <View style={{ flex: 1 }} />
          <Txt v="caption" c={color.dim} center style={{ paddingBottom: space.xxl }}>
            Tap to continue
          </Txt>
        </Pressable>
      ) : view.pending ? (
        <RoundInput
          key={`${view.sessionId}:${view.roundIndex}`}
          tiles={view.pending.tiles}
          busy={busy}
          error={error}
          onCheck={(letters) => void submit({ letters })}
          onGiveUp={() => void submit({ forfeit: "skip" })}
        />
      ) : null}
    </View>
  );
}

function LastMiss({ view }: { view: LettersView }) {
  const r = view.history[view.history.length - 1];
  if (!r) return null;
  return (
    <Card hero style={{ gap: space.s }}>
      <Txt v="cardTitle">{r.name}</Txt>
      <Txt v="caption" c={color.muted}>{`${r.nation} · ${r.tier}`}</Txt>
    </Card>
  );
}

function MissingLettersScreen() {
  const params = useLocalSearchParams<{ mode?: string; c?: string }>();
  const { ready } = useSession();
  const today = useQuery(api.missingLetters.getToday, ready ? {} : "skip");
  const older = useQuery(api.whosOlder.getToday, ready ? {} : "skip");
  const challenge = useQuery(api.missingLetters.getChallenge, ready && params.c ? { challengeId: params.c } : "skip");
  const startDaily = useMutation(api.missingLetters.startDaily);
  const startEndless = useMutation(api.missingLetters.startEndless);
  const startChallenge = useMutation(api.missingLetters.startChallenge);
  const createChallenge = useMutation(api.missingLetters.createChallenge);
  const record = useMutation(api.missingLetters.recordChallengeResult);

  const olderDone = older?.daily?.status === "completed";

  return (
    <DailyTwinShell<LettersView>
      game="letters"
      title="Missing Letters"
      accent={modeAccent.missingLetters}
      mode={params.mode === "endless" ? "endless" : "daily"}
      challengeId={params.c}
      today={today}
      challenge={challenge}
      landingLine="Same 10 names. Fill in the missing letters."
      next={
        olderDone
          ? null
          : { title: "Who's Older?", edition: older?.edition, line: "Tap the older player. 10 a day.", accent: modeAccent.whosOlder, icon: UsersThree, href: "/whos-older" }
      }
      startDaily={async () => (await startDaily({})).session}
      startEndless={async () => (await startEndless({})).session}
      startChallenge={async (id) => (await startChallenge({ challengeId: id as never })).session}
      createChallenge={async (sessionId) => (await createChallenge({ sessionId: sessionId as never })).challengeId}
      recordChallengeResult={(challengeId, sessionId) => record({ challengeId: challengeId as never, sessionId: sessionId as never })}
      renderPlay={(p) => <LettersPlay {...p} />}
      renderLastMiss={(v) => <LastMiss view={v} />}
    />
  );
}

export default guardParams(MissingLettersScreen, { c: optional(isConvexId) });
