import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import type { Icon } from "phosphor-react-native";
import { At } from "phosphor-react-native/src/icons/At";
import { Bell } from "phosphor-react-native/src/icons/Bell";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Clock } from "phosphor-react-native/src/icons/Clock";
import { EnvelopeSimple } from "phosphor-react-native/src/icons/EnvelopeSimple";
import { Fire } from "phosphor-react-native/src/icons/Fire";
import { Globe } from "phosphor-react-native/src/icons/Globe";
import { Info } from "phosphor-react-native/src/icons/Info";
import { SignIn } from "phosphor-react-native/src/icons/SignIn";
import { SignOut } from "phosphor-react-native/src/icons/SignOut";
import { SoccerBall } from "phosphor-react-native/src/icons/SoccerBall";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { Trash } from "phosphor-react-native/src/icons/Trash";
import { UserPlus } from "phosphor-react-native/src/icons/UserPlus";
import { Users } from "phosphor-react-native/src/icons/Users";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

const SUPPORT_EMAIL = "support@verveq.com";
const VERSION = "1.0.0";
// Notifications, language and Daily Quiz subject: hidden until push ships.
const SHOW_UNSHIPPED_SETTINGS = false as boolean;

// Local-only for now: push reminders aren't wired to the backend yet, and the
// app follows the phone's language until i18n lands. Kept in SecureStore (no extra native dep).
type Prefs = { language: "en" | "fr" | "es"; dailyOn: boolean; time: string; streakOn: boolean; duelsOn: boolean; roomsOn: boolean };
const DEFAULTS: Prefs = { language: "en", dailyOn: true, time: "09:00", streakOn: true, duelsOn: true, roomsOn: false };
const PREFS_KEY = "verveq.settings.v1";
const TIMES = ["08:00", "09:00", "12:00", "18:00", "20:00"];
const LANGS: { key: Prefs["language"]; label: string }[] = [
  { key: "en", label: "English" },
  { key: "fr", label: "Français" },
  { key: "es", label: "Español" },
];
const SUBJECTS = [
  { key: "football", label: "Football" },
  { key: "knowledge", label: "Knowledge" },
];

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  useEffect(() => {
    void SecureStore.getItemAsync(PREFS_KEY).then((raw) => {
      if (!raw) return;
      try {
        setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) });
      } catch {
        /* ignore a corrupt blob — defaults stand */
      }
    });
  }, []);
  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      void SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  return [prefs, update] as const;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
      <Eyebrow>{title}</Eyebrow>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function Row({
  icon: Ico,
  title,
  line,
  right,
  onPress,
  last,
  danger,
}: {
  icon?: Icon;
  title: string;
  line?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => ({
        minHeight: size.listRow,
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.lineSoft,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {Ico ? <Ico size={20} weight="bold" color={danger ? color.wrong : color.muted} /> : null}
      <View style={{ flex: 1, gap: space.xs }}>
        <Txt v="rowTitle" c={danger ? color.wrong : color.cream}>
          {title}
        </Txt>
        {line ? (
          <Txt v="caption" c={color.muted}>
            {line}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <CaretRight size={20} weight="bold" color={color.dim} /> : null)}
    </Pressable>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      hitSlop={8}
      onPress={() => {
        haptic.tap();
        onChange(!on);
      }}
      style={{ width: 52, height: 32, borderRadius: 16, padding: space.xs, backgroundColor: on ? color.lime : color.line, alignItems: on ? "flex-end" : "flex-start" }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: on ? color.ink : color.muted }} />
    </Pressable>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s, paddingHorizontal: space.l, paddingBottom: space.l }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.tap();
              onChange(o.key);
            }}
            style={{ height: size.pill, paddingHorizontal: space.l, borderRadius: size.pill / 2, justifyContent: "center", backgroundColor: on ? color.cream : color.surfaceHigh }}
          >
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 15, color: on ? color.ink : color.cream }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, runAuth } = useSession();
  const { signOut } = useAuthActions();
  const setSport = useMutation(api.users.setPreferredDailySport);
  const [prefs, update] = usePrefs();

  const username = typeof user?.username === "string" && /^[a-z0-9_]{3,24}$/.test(user.username) ? user.username : null;
  const isFull = !!user && user.isAnonymous !== true && !!username;
  const email = typeof user?.email === "string" ? user.email : null;
  const sport = (user as { preferredDailySport?: string } | null | undefined)?.preferredDailySport ?? "football";

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You can sign back in with your email any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void runAuth(() => signOut()).then(() => router.replace("/"));
        },
      },
    ]);

  // Deletes the account on the server at once (accountDeletion.ts): login,
  // name, email and game history. Then signs out locally.
  const deleteAccount = useMutation(api.accountDeletion.deleteMyAccount);
  const requestDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, your name and email, your ratings, streaks and game history. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            haptic.wrong();
            void deleteAccount({ confirm: "DELETE" })
              .then(async () => {
                await runAuth(() => signOut()).catch(() => undefined);
                router.replace("/");
                Alert.alert("Account deleted", "Your VerveQ account and its data have been deleted.");
              })
              .catch(() => {
                Alert.alert(
                  "Couldn't delete your account",
                  `Check your connection and try again. If it keeps failing, email ${SUPPORT_EMAIL}.`,
                );
              });
          },
        },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
        <Group title="Account">
          {isFull ? (
            <>
              <Row icon={At} title={`@${username}`} line={email ?? "Signed in"} />
              <Row icon={SignOut} title="Sign out" onPress={confirmSignOut} last />
            </>
          ) : (
            <>
              <Row
                icon={UserPlus}
                title={username ? "Create an account" : "Pick a name"}
                line={username ? `@${username} · playing as a guest` : "Playing as a guest"}
                onPress={() => router.push(username ? "/create-account" : "/pick-name")}
              />
              <Row icon={SignIn} title="I have an account" line="Sign in with your email" onPress={() => router.push("/sign-in")} last />
            </>
          )}
        </Group>

        {/* Notification and preference rows: hidden until push ships (nothing reads them yet). */}
        {SHOW_UNSHIPPED_SETTINGS ? (
        <Group title="Notifications">
          <Row icon={Bell} title="Daily games are ready" line="Once a day, only if you haven't played" right={<Switch label="Daily games are ready" on={prefs.dailyOn} onChange={(v) => update({ dailyOn: v })} />} />
          {prefs.dailyOn ? (
            <Row
              icon={Clock}
              title="Remind me at"
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reminder time ${prefs.time}, tap to change`}
                  onPress={() => {
                    haptic.tap();
                    update({ time: TIMES[(TIMES.indexOf(prefs.time) + 1) % TIMES.length]! });
                  }}
                  style={{ height: size.pill, paddingHorizontal: space.l, borderRadius: size.pill / 2, backgroundColor: color.surfaceHigh, justifyContent: "center" }}
                >
                  <Mono s={15}>{prefs.time}</Mono>
                </Pressable>
              }
            />
          ) : null}
          <Row icon={Fire} title="Streak at risk" line="One nudge in the evening" right={<Switch label="Streak at risk" on={prefs.streakOn} onChange={(v) => update({ streakOn: v })} />} />
          <Row icon={Sword} title="Duels and rivals" line="New duels, results, beaten scores" right={<Switch label="Duels and rivals" on={prefs.duelsOn} onChange={(v) => update({ duelsOn: v })} />} />
          <Row icon={Users} title="Live room invites" line="When a friend opens a room for you" right={<Switch label="Live room invites" on={prefs.roomsOn} onChange={(v) => update({ roomsOn: v })} />} last />
        </Group>
        ) : null}
        {SHOW_UNSHIPPED_SETTINGS ? (
        <Group title="Preferences">
          <Row icon={Globe} title="Language" />
          <Chips options={LANGS} value={prefs.language} onChange={(v) => update({ language: v })} />
          <View style={{ height: 1, backgroundColor: color.lineSoft }} />
          <Row icon={SoccerBall} title="Daily Quiz subject" />
          <Chips
            options={SUBJECTS}
            value={sport}
            onChange={(v) => {
              void setSport({ sport: v }).catch(() => Alert.alert("Couldn't save that", "Try again in a moment."));
            }}
          />
        </Group>
        ) : null}

        <Group title="Support">
          <Row icon={EnvelopeSimple} title="Contact support" line={SUPPORT_EMAIL} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
          <Row icon={Trash} title="Delete account" danger onPress={requestDelete} last />
        </Group>

        <Group title="About">
          <Row icon={Info} title="Rank badge art" line="game-icons.net (Lorc, Delapouite), CC BY 3.0" onPress={() => void Linking.openURL("https://game-icons.net")} />
          <Row title="Privacy" onPress={() => void Linking.openURL("https://verveq.com/privacy")} />
          <Row title="Terms" onPress={() => void Linking.openURL("https://verveq.com/terms")} last />
        </Group>

        <Mono s={11} c={color.dim} style={{ textAlign: "center", letterSpacing: 1.5 }}>{`VERVEQ ${VERSION}`}</Mono>
      </ScrollView>
    </View>
  );
}
