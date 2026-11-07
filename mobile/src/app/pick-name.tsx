import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormError, USERNAME_RE, humanError, normalizeUsername } from "@/components/account/forms";
import { AppBar, Button, Eyebrow, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Claim a username for the current session: a guest keeps playing without email (claimUsernameOnly). */
export default function PickNameScreen() {
  const insets = useSafeAreaInsets();
  const { user, ready, ensureGuest } = useSession();
  const claim = useMutation(api.users.claimUsernameOnly);
  const ensureProfile = useMutation(api.users.ensureProfile);

  const [raw, setRaw] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = normalizeUsername(raw);
  const valid = raw.length > 0 && USERNAME_RE.test(name);
  const checking = useDebounced(valid ? name : "", 350);
  const taken = useQuery(api.users.getByUsername, checking ? { username: checking } : "skip");
  const availability: "idle" | "checking" | "free" | "taken" =
    !valid ? "idle" : checking !== name || taken === undefined ? "checking" : taken && taken._id !== user?._id ? "taken" : "free";

  const suggestions = useMemo(() => {
    const base = (name.length >= 3 ? name : "player").slice(0, 18);
    return [`${base}_fc`, `${base}_iq`, `${base}_${new Date().getUTCFullYear() % 100}`];
  }, [name]);

  async function submit() {
    if (!valid || availability === "taken") return;
    setBusy(true);
    setError(null);
    try {
      if (!ready && !(await ensureGuest())) throw new Error("Could not start a guest session. Check your connection.");
      if (user?.isAnonymous === false) await ensureProfile({ username: name, isGuest: false });
      else await claim({ username: name });
      haptic.right();
      router.back();
    } catch (err) {
      setError(humanError(err, "Couldn't save that name. Try another."));
    } finally {
      setBusy(false);
    }
  }

  const status =
    availability === "free" ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
        <CheckCircle size={16} weight="fill" color={color.right} />
        <Txt v="caption" c={color.right}>
          Available
        </Txt>
      </View>
    ) : availability === "taken" ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
        <XCircle size={16} weight="fill" color={color.wrong} />
        <Txt v="caption" c={color.wrong}>
          Taken
        </Txt>
      </View>
    ) : availability === "checking" ? (
      <Txt v="caption" c={color.dim}>
        Checking…
      </Txt>
    ) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.ink }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <AppBar title="" onBack={() => router.back()} close />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
        <View style={{ gap: space.s }}>
          <Txt v="h1Game">Put your name on it</Txt>
          <Txt c={color.muted}>{"Friends see who sent the challenge, and it's your name in duels and live rooms. No email, no password."}</Txt>
        </View>

        <View style={{ gap: space.s }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.cream }}>Username</Text>
            {status}
          </View>
          <View
            style={{
              height: size.input,
              borderRadius: radius.input,
              borderWidth: 1.5,
              borderColor: availability === "taken" ? color.wrong : focused ? color.lime : color.line,
              backgroundColor: color.surface,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: space.l,
              gap: space.xs,
            }}
          >
            <Text style={{ fontFamily: font.mono, fontSize: 17, color: color.dim }}>@</Text>
            <TextInput
              accessibilityLabel="Username"
              value={raw}
              onChangeText={(v) => setRaw(v.toLowerCase().replace(/\s/g, ""))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              maxLength={24}
              placeholder="your_name"
              placeholderTextColor={color.dim}
              onSubmitEditing={() => void submit()}
              style={{ flex: 1, fontFamily: font.bold, fontSize: 17, color: color.cream, paddingVertical: 0 }}
            />
          </View>
          <Txt v="caption" c={color.dim}>
            3–24 characters: lowercase letters, numbers, underscores.
          </Txt>
        </View>

        <View style={{ gap: space.m }}>
          <Eyebrow>Or try</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
            {suggestions.map((sug) => (
              <Pressable
                key={sug}
                accessibilityRole="button"
                onPress={() => {
                  haptic.tap();
                  setRaw(sug);
                }}
                style={{ height: size.pill, paddingHorizontal: space.l, borderRadius: size.pill / 2, backgroundColor: color.surfaceHigh, justifyContent: "center" }}
              >
                <Text style={{ fontFamily: font.mono, fontSize: 13, color: color.cream }}>{`@${sug}`}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <FormError message={error} />
        <View style={{ gap: space.m }}>
          <Button label={busy ? "Saving…" : "Pick this name"} disabled={busy || !valid || availability === "taken"} onPress={() => void submit()} />
          <Button variant="ghost" label="Skip" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
