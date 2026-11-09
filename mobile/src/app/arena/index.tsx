import { useMutation } from "convex/react";
import { router, type Href } from "expo-router";
import { CaretDown } from "phosphor-react-native/src/icons/CaretDown";
import { CaretUp } from "phosphor-react-native/src/icons/CaretUp";
import { Check } from "phosphor-react-native/src/icons/Check";
import { Minus } from "phosphor-react-native/src/icons/Minus";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { UserCircle } from "phosphor-react-native/src/icons/UserCircle";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ARENA_DEFAULT_SUBJECTS,
  ARENA_DEFAULTS,
  ARENA_LIMITS,
  ARENA_MODES,
  ARENA_SUBJECTS,
  buildCategories,
  errorText,
  normalizeCode,
  type ArenaMode,
} from "@/components/arena/shared";
import { AppBar, Button, Card, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const btn = (Icon: typeof Plus, next: number, disabled: boolean, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onChange(next);
      }}
      style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.surfaceHigh, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}
    >
      <Icon size={20} weight="bold" color={color.cream} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, gap: space.s }}>
      <Eyebrow>{label}</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, padding: space.xs }}>
        {btn(Minus, value - 1, value <= min, `Fewer ${label.toLowerCase()}`)}
        <Mono s={20}>{value}</Mono>
        {btn(Plus, value + 1, value >= max, `More ${label.toLowerCase()}`)}
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        height: 40,
        paddingHorizontal: space.m,
        borderRadius: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        backgroundColor: on ? color.cream : color.surface,
        borderWidth: 1,
        borderColor: on ? color.cream : color.line,
      }}
    >
      {on ? <Check size={16} weight="bold" color={color.ink} /> : null}
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 15, color: on ? color.ink : color.cream }}>{label}</Text>
    </Pressable>
  );
}

export default function ArenaCreateScreen() {
  const insets = useSafeAreaInsets();
  const { ready, user } = useSession();
  const create = useMutation(api.challengeArenas.create);
  const join = useMutation(api.challengeArenas.join);

  const [code, setCode] = useState("");
  const [mode, setMode] = useState<ArenaMode>("1v1");
  const [rounds, setRounds] = useState(ARENA_DEFAULTS.rounds);
  const [perRound, setPerRound] = useState(ARENA_DEFAULTS.perRound);
  const [subjects, setSubjects] = useState<string[]>(ARENA_DEFAULT_SUBJECTS);
  const [allSubjects, setAllSubjects] = useState(false);
  const [busy, setBusy] = useState<"join" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasName = !!user?.username;
  const total = rounds * perRound;
  const overTotal = total > ARENA_LIMITS.maxTotal;
  const categories = buildCategories(subjects, rounds);
  const minutes = Math.max(1, Math.round((total * 13 + rounds * 8) / 60));
  const modeLine = ARENA_MODES.find((m) => m.key === mode)?.line ?? "";
  const shown = allSubjects ? ARENA_SUBJECTS : ARENA_SUBJECTS.slice(0, 5);

  const toggleSubject = (key: string) => {
    setSubjects((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      if (cur.length >= rounds) return cur; // one subject per round at most
      return [...cur, key];
    });
  };
  const changeRounds = (n: number) => {
    setRounds(n);
    setSubjects((cur) => cur.slice(0, n));
  };

  async function onJoin() {
    const c = normalizeCode(code);
    if (c.length !== 6 || busy) return;
    setBusy("join");
    setError(null);
    try {
      const res = await join({ code: c });
      router.replace(`/arena/${res.code}` as Href);
    } catch (e) {
      setError(errorText(e, "Couldn't join that room"));
    } finally {
      setBusy(null);
    }
  }

  async function onCreate() {
    if (busy || categories.length === 0 || overTotal) return;
    setBusy("create");
    setError(null);
    try {
      const custom = rounds !== ARENA_DEFAULTS.rounds || perRound !== ARENA_DEFAULTS.perRound || subjects.join() !== ARENA_DEFAULT_SUBJECTS.join();
      const res = await create(custom ? { mode, rounds, perRound, categories } : { mode });
      router.replace(`/arena/${res.code}` as Href);
    } catch (e) {
      setError(errorText(e, "Couldn't create the room"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.ink }} behavior="padding">
      <AppBar title="Live room" eyebrow="Create or join" onBack={() => router.back()} />
      {!hasName && ready ? (
        <View style={{ flex: 1, paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.xl }}>
          <Card hero style={{ gap: space.l, alignItems: "flex-start" }}>
            <UserCircle size={40} weight="regular" color={color.cream} />
            <View style={{ gap: space.s }}>
              <Txt v="cardTitle">Pick a name to play live</Txt>
              <Txt c={color.muted}>Your friends see it in the room and on the scoreboard. No email, no password.</Txt>
            </View>
            <Button label="Pick a name" style={{ alignSelf: "stretch" }} onPress={() => router.push("/pick-name" as Href)} />
          </Card>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xxl }}>
          {/* Join */}
          <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
            <Txt v="cardTitle">Got a code?</Txt>
            <View style={{ flexDirection: "row", gap: space.m }}>
              <TextInput maxFontSizeMultiplier={1.3}
                accessibilityLabel="Room code"
                value={code}
                onChangeText={(t) => setCode(normalizeCode(t))}
                placeholder="K7QM2X"
                placeholderTextColor={color.dim}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={onJoin}
                style={{
                  flex: 1,
                  height: size.input,
                  borderRadius: radius.input,
                  borderWidth: 1.5,
                  borderColor: code.length === 6 ? color.lime : color.line,
                  backgroundColor: color.surface,
                  paddingHorizontal: space.l,
                  fontFamily: font.mono,
                  fontSize: 20,
                  letterSpacing: 4,
                  color: color.cream,
                }}
              />
              <Button label={busy === "join" ? "Joining…" : "Join"} disabled={normalizeCode(code).length !== 6 || !!busy} onPress={onJoin} style={{ paddingHorizontal: space.xl }} />
            </View>
            <Txt v="caption" c={color.dim}>
              6 letters and numbers. Invite links open the room directly.
            </Txt>
          </View>

          {/* Create */}
          <View style={{ paddingHorizontal: space.gutter, gap: space.xl }}>
            <Eyebrow>Or start one</Eyebrow>

            <View style={{ gap: space.m }}>
              <Eyebrow>Players</Eyebrow>
              <View style={{ flexDirection: "row", gap: space.s }}>
                {ARENA_MODES.map((m) => {
                  const on = m.key === mode;
                  return (
                    <Pressable
                      key={m.key}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        haptic.tap();
                        setMode(m.key);
                      }}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: radius.tile,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: on ? color.lime : color.surface,
                        borderWidth: 1,
                        borderColor: on ? color.lime : color.line,
                      }}
                    >
                      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: 15, color: on ? color.ink : color.cream }}>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Txt v="caption" c={color.muted}>
                {modeLine}
              </Txt>
            </View>

            <View style={{ flexDirection: "row", gap: space.m }}>
              <Stepper label="Rounds" value={rounds} min={ARENA_LIMITS.minRounds} max={ARENA_LIMITS.maxRounds} onChange={changeRounds} />
              <Stepper label="Questions / round" value={perRound} min={ARENA_LIMITS.minPerRound} max={ARENA_LIMITS.maxPerRound} onChange={setPerRound} />
            </View>

            <View style={{ gap: space.m }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Eyebrow>Subjects · one per round</Eyebrow>
                <Mono s={12} c={color.muted}>{`${subjects.length}/${rounds}`}</Mono>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
                {shown.map((sub) => (
                  <Chip key={sub.key} label={sub.label} on={subjects.includes(sub.key)} onPress={() => toggleSubject(sub.key)} />
                ))}
                <Pressable
                  hitSlop={8}
                  accessibilityRole="button"
                  onPress={() => setAllSubjects((v) => !v)}
                  style={{ height: 40, paddingHorizontal: space.m, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: space.xs, borderWidth: 1, borderColor: color.line, borderStyle: "dashed" }}
                >
                  {allSubjects ? <CaretUp size={16} weight="bold" color={color.muted} /> : <CaretDown size={16} weight="bold" color={color.muted} />}
                  <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 15, color: color.muted }}>{allSubjects ? "Fewer" : `${ARENA_SUBJECTS.length - 5} more`}</Text>
                </Pressable>
              </View>
              {subjects.length < rounds && subjects.length > 0 ? (
                <Txt v="caption" c={color.dim}>
                  Your subjects repeat to fill all {rounds} rounds.
                </Txt>
              ) : null}
            </View>

            <View style={{ gap: space.m }}>
              <Txt v="caption" c={overTotal || subjects.length === 0 ? color.wrong : color.muted} center>
                {subjects.length === 0
                  ? "Pick at least one subject"
                  : overTotal
                    ? `That's ${total} questions. The max is ${ARENA_LIMITS.maxTotal}.`
                    : `${total} questions · about ${minutes} minutes`}
              </Txt>
              <Button label={busy === "create" ? "Creating…" : "Create room"} disabled={!!busy || subjects.length === 0 || overTotal || !ready} onPress={onCreate} />
            </View>
          </View>

          {error ? (
            <Txt v="caption" c={color.wrong} center style={{ paddingHorizontal: space.gutter }}>
              {error}
            </Txt>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
