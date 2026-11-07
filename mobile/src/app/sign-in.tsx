import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EMAIL_RE, Field, FormError, humanError, normalizeEmail } from "@/components/account/forms";
import { markWelcomeSeen } from "@/components/account/welcomeFlag";
import { GoogleButton, OrDivider } from "@/components/account/social";
import { AppBar, Button, Txt } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { color, font, space } from "@/theme/tokens";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithPassword } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function submit() {
    const e = normalizeEmail(email);
    setError(null);
    if (!EMAIL_RE.test(e)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      await signInWithPassword(e, password);
      markWelcomeSeen();
      router.dismissAll();
      router.replace("/");
    } catch (err) {
      setError(humanError(err, "Email or password is wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.ink }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <AppBar title="" onBack={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
        <View style={{ gap: space.s }}>
          <Txt v="h1Game">Welcome back</Txt>
          <Txt c={color.muted}>Sign in to pick up your streak, ranks and rivals.</Txt>
        </View>
        <GoogleButton />
        <OrDivider label="Or with email" />
        <View style={{ gap: space.l }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={emailError}
          />
          <View style={{ gap: space.s }}>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secure
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => void submit()}
            />
            <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void Linking.openURL("https://verveq.com/account")} style={{ alignSelf: "flex-end" }}>
              <Txt v="caption" c={color.lime} style={{ fontFamily: font.bold }}>
                Forgot password?
              </Txt>
            </Pressable>
          </View>
          <FormError message={error} />
        </View>
        <Button label={busy ? "Signing in…" : "Sign in"} disabled={busy} onPress={() => void submit()} />
        <View style={{ flexDirection: "row", justifyContent: "center", gap: space.xs }}>
          <Txt v="caption" c={color.muted}>
            New here?
          </Txt>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.replace("/create-account")}>
            <Txt v="caption" c={color.lime} style={{ fontFamily: font.bold }}>
              Create an account
            </Txt>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
