import { useMutation, useQuery } from "convex/react";
import { MagnifyingGlass } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { Star } from "phosphor-react-native/src/icons/Star";
import { X } from "phosphor-react-native/src/icons/X";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Mono, Txt, haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

import { leagueName, matchesName, serverMessage } from "./data";

/** Bottom sheet: ink scrim + a 24-radius surface from the bottom edge. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Lifts the sheet over the keyboard (search inputs live in sheets). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <View
        style={{
          maxHeight: "88%",
          backgroundColor: color.surface,
          borderTopLeftRadius: radius.hero,
          borderTopRightRadius: radius.hero,
          paddingTop: space.m,
          paddingBottom: insets.bottom + space.xl,
        }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: color.line }} />
        {title ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: space.m }}>
            <Txt v="cardTitle">{title}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
              <X size={24} weight="regular" color={color.muted} />
            </Pressable>
          </View>
        ) : null}
        {children}
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Two-way pill toggle (Squad | Ledger, Gameweek | Season). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: space.xs, padding: space.xs, backgroundColor: color.surface, borderRadius: 24, borderWidth: 1, borderColor: color.lineSoft }}>
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
            <Txt v="body" c={on ? color.ink : color.muted} style={{ fontFamily: font.bold }}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AvailabilityTag({ status }: { status: "out" | "doubtful" }) {
  const c = status === "out" ? color.wrong : color.yellow;
  return (
    <View style={{ paddingHorizontal: space.s, paddingVertical: space.xs, borderRadius: radius.chip, borderWidth: 1, borderColor: c }}>
      <Mono s={10} c={c}>
        {status === "out" ? "OUT" : "DOUBT"}
      </Mono>
    </View>
  );
}

export function Empty({ title, line, action }: { title: string; line?: string; action?: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: space.gutter, paddingVertical: space.xxl, gap: space.m, alignItems: "center" }}>
      <Txt v="cardTitle" center>
        {title}
      </Txt>
      {line ? (
        <Txt c={color.muted} center>
          {line}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

/**
 * Favorite club chooser. Owner ruling: 4 players from your favorite club
 * (3 from any other) and the choice is PERMANENT — so it asks once more.
 */
export function FavoriteClubSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fav = useQuery(api.fantasySquads.getFavoriteClub, open ? {} : "skip");
  const setFav = useMutation(api.fantasySquads.setFavoriteClub);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const clubs = useMemo(
    () => (fav?.clubs ?? []).filter((c) => matchesName(c.name, q)).sort((a, b) => a.name.localeCompare(b.name)),
    [fav, q],
  );

  const choose = (clubId: string, name: string) => {
    Alert.alert(`Make ${name} your favorite club?`, "You can pick 4 of their players instead of 3. This is set for good and can't be changed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: `Choose ${name}`,
        onPress: async () => {
          setBusy(true);
          try {
            await setFav({ clubId });
            haptic.right();
            onClose();
          } catch (e) {
            Alert.alert("Couldn't save", serverMessage(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Favorite club">
      <View style={{ paddingHorizontal: space.gutter, gap: space.m, paddingBottom: space.m }}>
        <Txt v="caption" c={color.muted}>
          4 players from your favorite club, 3 from any other. Set for good.
        </Txt>
        <View style={{ height: size.input, borderRadius: radius.input, backgroundColor: color.ink, borderWidth: 1.5, borderColor: color.line, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l }}>
          <MagnifyingGlass size={20} weight="bold" color={color.muted} />
          <TextInput maxFontSizeMultiplier={1.3}
            value={q}
            onChangeText={setQ}
            placeholder="Search clubs"
            placeholderTextColor={color.dim}
            style={{ flex: 1, color: color.cream, fontFamily: font.bold, fontSize: 17 }}
            accessibilityLabel="Search clubs"
          />
        </View>
      </View>
      <FlatList
        data={clubs}
        keyExtractor={(c) => c.clubId}
        style={{ maxHeight: 420 }}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button"
            disabled={busy}
            onPress={() => choose(item.clubId, item.name)}
            style={({ pressed }) => ({ minHeight: size.listRow, paddingHorizontal: space.gutter, flexDirection: "row", alignItems: "center", gap: space.m, opacity: pressed ? 0.7 : 1 })}
          >
            <Star size={20} weight="regular" color={color.muted} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Txt v="rowTitle">{item.name}</Txt>
              <Txt v="caption" c={color.muted}>
                {leagueName(item.leagueId)}
              </Txt>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          fav === undefined ? undefined : (
            <View style={{ padding: space.gutter }}>
              <Txt c={color.muted}>No club matches that search.</Txt>
            </View>
          )
        }
      />
      {fav && fav.signedIn === false ? (
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.m }}>
          <Button variant="secondary" label="Close" onPress={onClose} />
        </View>
      ) : null}
    </Sheet>
  );
}

/** Wall clock for kickoff/lock display; ticks every 30 s. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
