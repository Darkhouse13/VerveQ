// Shared pieces for THE WEEKEND social screens (crews, draft, vote, court, sheet).
import { router } from "expo-router";
import { UserCircle } from "phosphor-react-native/src/icons/UserCircle";
import { WarningCircle } from "phosphor-react-native/src/icons/WarningCircle";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Card, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { color, font, radius, size, space } from "@/theme/tokens";

/** Scores show one decimal, ties rounded away from zero (convex/lib/fantasyScoring formatPoints). */
export function formatPoints(points: number): string {
  const scaled = points * 10;
  const magnitude = Math.round(Math.abs(scaled));
  const rounded = (scaled < 0 ? -magnitude : magnitude) / 10;
  return (rounded === 0 ? 0 : rounded).toFixed(1);
}

/** Chess-clock bank, m:ss. */
export function formatBank(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export const crewLink = (code: string) => `https://verveq.com/weekend/crew/${encodeURIComponent(code)}`;

export function shareCrew(code: string) {
  void Share.share({ message: `Join my Weekend crew on VerveQ.\n${crewLink(code)}` });
}

export const formatPrice = (amount: number) => `£${amount.toFixed(1)}m`;

const LEAGUE_NAMES: Record<number, string> = {
  39: "Premier League",
  140: "La Liga",
  135: "Serie A",
  78: "Bundesliga",
  61: "Ligue 1",
  88: "Eredivisie",
  94: "Liga Portugal",
  40: "Championship",
};
export const leagueName = (id: number) => LEAGUE_NAMES[id] ?? "another league";

export function errorText(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : "";
  // Convex wraps server errors: "[CONVEX M(...)] Server Error Uncaught Error: <message> at ..."
  const m = raw.match(/Uncaught (?:Convex)?Error:\s*([^\n]+?)(?:\s+at\s|\n|$)/);
  const msg = (m?.[1] ?? (raw.startsWith("[CONVEX") ? "" : raw)).trim();
  return msg.length > 0 && msg.length < 160 ? msg : fallback;
}

/** Server clock vs device clock (Arena/draft rooms send serverNow). */
export function useClockOffset(serverNow: number | null | undefined) {
  // Measured once per server snapshot: device clock minus server clock.
  return useMemo(() => (typeof serverNow === "number" ? deviceNow() - serverNow : 0), [serverNow]);
}
const deviceNow = () => Date.now();

export function useTick(ms = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Screen scaffold: app bar + scrolling body on the ink ground. */
export function WeekendScreen({
  title,
  eyebrow,
  onBack,
  right,
  children,
  footer,
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={title} eyebrow={eyebrow} onBack={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/weekend")))} right={right} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: footer ? space.l : insets.bottom + space.xxl, gap: space.xl }}
      >
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xl, gap: space.m }}>{footer}</View> : null}
    </View>
  );
}

export function Notice({ title, body, tone = "plain", children }: { title: string; body?: string; tone?: "plain" | "good" | "bad"; children?: ReactNode }) {
  const border = tone === "good" ? color.right : tone === "bad" ? color.wrong : color.lineSoft;
  const bg = tone === "good" ? color.rightBg : tone === "bad" ? color.wrongBg : color.surface;
  return (
    <Card style={{ borderColor: border, backgroundColor: bg, alignItems: "center", gap: space.s, paddingVertical: space.xl }}>
      <Txt v="rowTitle" center>
        {title}
      </Txt>
      {body ? (
        <Txt v="caption" c={color.muted} center>
          {body}
        </Txt>
      ) : null}
      {children}
    </Card>
  );
}

export function Loading() {
  return <Notice title="Loading…" />;
}

export function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: "row", gap: space.s, alignItems: "center" }}>
      <WarningCircle size={16} weight="fill" color={color.wrong} />
      <Txt v="caption" c={color.muted} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

export function Badge({ label, tone = "muted" }: { label: string; tone?: "muted" | "lime" | "good" | "bad" | "warn" }) {
  const c = { muted: color.muted, lime: color.lime, good: color.right, bad: color.wrong, warn: color.yellow }[tone];
  return (
    <View style={{ paddingHorizontal: space.s, paddingVertical: space.xs, borderRadius: radius.chip, borderWidth: 1, borderColor: c }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: size.eyebrow, letterSpacing: 1, color: c }}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string; mono?: boolean }) {
  const { label, mono, style, ...rest } = props;
  return (
    <View style={{ gap: space.s }}>
      {label ? (
        <Txt v="caption" c={color.muted}>
          {label}
        </Txt>
      ) : null}
      <TextInput maxFontSizeMultiplier={1.3}
        placeholderTextColor={color.dim}
        selectionColor={color.lime}
        {...rest}
        style={[
          {
            height: size.input,
            borderRadius: radius.input,
            borderWidth: 1.5,
            borderColor: color.line,
            backgroundColor: color.surface,
            paddingHorizontal: space.l,
            color: color.cream,
            fontFamily: mono ? font.mono : font.bold,
            fontSize: 17,
            letterSpacing: mono ? 4 : 0,
            textAlign: mono ? "center" : "left",
          },
          style,
        ]}
      />
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: space.xs, padding: space.xs, borderRadius: size.buttonSecondary / 2, backgroundColor: color.surface, borderWidth: 1, borderColor: color.lineSoft }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) {
                haptic.tap();
                onChange(o.value);
              }
            }}
            style={{ flex: 1, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: on ? color.cream : "transparent" }}
          >
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 15, color: on ? color.ink : color.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tappable list row (64px), used for crews, rooms, alerts. */
export function Row({
  title,
  line,
  right,
  onPress,
  last,
  style,
}: {
  title: ReactNode;
  line?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button"
      disabled={!onPress}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: size.listRow,
          paddingHorizontal: space.l,
          paddingVertical: space.m,
          flexDirection: "row",
          alignItems: "center",
          gap: space.m,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: color.lineSoft,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: space.xs, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Txt v="rowTitle" numberOfLines={1}>
            {title}
          </Txt>
        ) : (
          title
        )}
        {typeof line === "string" ? (
          <Txt v="caption" c={color.muted} numberOfLines={2}>
            {line}
          </Txt>
        ) : (
          line
        )}
      </View>
      {right}
    </Pressable>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>{children}</View>;
}

/** Bottom sheet modal on the ink ground. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={{
          maxHeight: "85%",
          backgroundColor: color.ink,
          borderTopLeftRadius: radius.hero,
          borderTopRightRadius: radius.hero,
          borderTopWidth: 1,
          borderColor: color.line,
          paddingHorizontal: space.gutter,
          paddingTop: space.xl,
          paddingBottom: insets.bottom + space.xl,
          gap: space.l,
        }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: color.line }} />
        <Txt v="cardTitle">{title}</Txt>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.m }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Crews, drafts and the court need a username (the web's UsernameOnlyRoute). */
export function useNeedsUsername() {
  const { ready, user } = useSession();
  return ready && !user?.username;
}

export function UsernameGate({ what }: { what: string }) {
  return (
    <Card hero style={{ alignItems: "center", gap: space.l }}>
      <UserCircle size={48} weight="regular" color={color.lime} />
      <View style={{ gap: space.s }}>
        <Txt v="cardTitle" center>
          Pick a name first
        </Txt>
        <Txt v="caption" c={color.muted} center>
          {`Your crew sees this name ${what}. No email, no password.`}
        </Txt>
      </View>
      <Button label="Pick a name" onPress={() => router.push("/pick-name")} style={{ alignSelf: "stretch" }} />
    </Card>
  );
}
