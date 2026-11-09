import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Ranking } from "phosphor-react-native/src/icons/Ranking";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { UserCircle } from "phosphor-react-native/src/icons/UserCircle";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EMAIL_RE, Field, FormError, USERNAME_RE, humanError, normalizeEmail, normalizeUsername, passwordProblem } from "@/components/account/forms";
import { GoogleButton, OrDivider } from "@/components/account/social";
import { AppBar, Button, Card, Mono, Txt } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";

const UNLOCKS = [
  { icon: Ranking, text: "Ranked Quiz and Survival, and a place in Ranks" },
  { icon: Sword, text: "Your record against every rival" },
  { icon: UserCircle, text: "Sign in on a new phone and keep your streak" },
];

/**
 * Upgrade the current guest to a full account WITHOUT a new identity — the web's
 * flow (AuthContext.upgradeAccount): the server links email + password to the
 * same user doc, so streaks, games and username carry over. A guest without a
 * username claims one first (upgradeUsernameOnly requires it).
 */
export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, ready, ensureGuest } = useSession();
  const claim = useMutation(api.users.claimUsernameOnly);
  const upgrade = useMutation(api.users.upgradeUsernameOnly);
  const profile = useQuery(api.profile.get, user?._id ? { userId: user._id } : "skip");

  const existingName = typeof user?.username === "string" && USERNAME_RE.test(user.username) ? user.username : null;
  const isFull = !!user && user.isAnonymous !== true && !!existingName;

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ username?: string; email?: string; password?: string }>({});

  async function submit() {
    setError(null);
    const name = normalizeUsername(username);
    const e = normalizeEmail(email);
    const errs: typeof fieldErr = {};
    if (!existingName && !USERNAME_RE.test(name)) errs.username = "3–24 characters: lowercase letters, numbers, underscores.";
    if (!EMAIL_RE.test(e)) errs.email = "Enter a valid email address.";
    const pw = passwordProblem(password);
    if (pw) errs.password = pw;
    setFieldErr(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      if (!ready && !(await ensureGuest())) throw new Error("Could not start a guest session. Check your connection.");
      if (!existingName) await claim({ username: name });
      await upgrade({ email: e, password });
      router.back();
    } catch (err) {
      setError(humanError(err, "Couldn't create your account. Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (isFull) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="" onBack={() => router.back()} close />
        <View style={{ padding: space.gutter, gap: space.l }}>
          <Txt v="h1Game">{`You're signed in as @${existingName}`}</Txt>
          <Button label="Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const streak = profile?.stats.currentStreak ?? 0;
  const games = profile?.totalPlays ?? 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.ink }} behavior="padding">
      <AppBar
        title=""
        onBack={() => router.back()}
        close
        right={
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.replace("/sign-in")}>
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 15, color: color.lime }}>Sign in</Text>
          </Pressable>
        }
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
        <View style={{ gap: space.s }}>
          <Txt v="h1Game">Save your progress</Txt>
          <Txt c={color.muted}>{"Everything you've played stays with you, on any phone."}</Txt>
        </View>

        {existingName || games > 0 ? (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.lime, alignItems: "center", justifyContent: "center" }}>
              <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 20, color: color.ink }}>{(existingName ?? "?").slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: space.xs }}>
              <Txt v="rowTitle">{existingName ? `@${existingName}` : "Your guest progress"}</Txt>
              <Mono s={11} c={color.muted}>{`${streak}-DAY STREAK · ${games} GAMES`}</Mono>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
              <CheckCircle size={16} weight="fill" color={color.right} />
              <Mono s={11} c={color.right}>
                KEPT
              </Mono>
            </View>
          </Card>
        ) : null}

        <View style={{ gap: space.m }}>
          {UNLOCKS.map(({ icon: Ico, text }) => (
            <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.tile, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" }}>
                <Ico size={20} weight="bold" color={color.lime} />
              </View>
              <Txt style={{ flex: 1 }}>{text}</Txt>
            </View>
          ))}
        </View>

        <GoogleButton />
        <OrDivider label="Or with email" />

        <View style={{ gap: space.l }}>
          {!existingName ? (
            <Field
              label="Username"
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ""))}
              placeholder="your_name"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              error={fieldErr.username}
            />
          ) : null}
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" error={fieldErr.email} />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="8+ characters" secure autoCapitalize="none" autoComplete="new-password" error={fieldErr.password} />
          <FormError message={error} />
        </View>
        <Button label={busy ? "Creating account…" : "Create account"} disabled={busy} onPress={() => void submit()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
