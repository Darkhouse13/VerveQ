import { useQuery } from "convex/react";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { Info } from "phosphor-react-native/src/icons/Info";
import { MagnifyingGlass } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { X } from "phosphor-react-native/src/icons/X";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Mono, Txt, haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";
import type { Id } from "@convex/_generated/dataModel";

const MIN_CHARS = 2; // server: MIN_QUERY_LENGTH
const DEBOUNCE_MS = 300;

export type PickedPlayer = { externalId: string; name: string };

/**
 * "Fill this square" sheet (mockup VerveGridSearch). Searches the FULL roster —
 * results never hint at the answer; the server decides only on lock-in.
 */
export function SearchSheet({
  open,
  onClose,
  onPick,
  sessionId,
  cellIndex,
  rowLabel,
  colLabel,
  guessesLeft,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: PickedPlayer) => void;
  sessionId: Id<"verveGridSessions">;
  cellIndex: number | null;
  rowLabel: string;
  colLabel: string;
  guessesLeft: number;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  // The row just tapped stays lit (spinner) until the server grades the pick.
  const [pickedId, setPickedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const results = useQuery(
    api.verveGrid.searchPlayers,
    open && cellIndex !== null && query.length >= MIN_CHARS ? { queryText: query, sport: "football", sessionId, cellIndex } : "skip",
  );
  const searching = query.length >= MIN_CHARS && results === undefined;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ height: insets.top + space.x4 + space.x4, backgroundColor: "rgba(0,0,0,0.6)" }} />
        <View
          accessibilityViewIsModal
          style={{
            flex: 1,
            backgroundColor: "#1A1A1A",
            borderTopLeftRadius: radius.hero,
            borderTopRightRadius: radius.hero,
            borderTopWidth: 1,
            borderColor: color.line,
            paddingTop: space.m,
            paddingHorizontal: space.gutter,
          }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#3A3A3A" }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.l }}>
            <Txt v="cardTitle">Fill this square</Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#262626", alignItems: "center", justifyContent: "center" }}
            >
              <X size={24} weight="regular" color={color.cream} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s, paddingTop: space.m }}>
            <View style={{ flexShrink: 1, paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.chip, backgroundColor: color.surfaceHigh }}>
              <Txt numberOfLines={1} style={{ fontFamily: font.bold }}>
                {rowLabel}
              </Txt>
            </View>
            <Mono c={color.dim}>×</Mono>
            <View style={{ flexShrink: 1, paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.chip, backgroundColor: color.surfaceHigh }}>
              <Txt numberOfLines={1} style={{ fontFamily: font.bold }}>
                {colLabel}
              </Txt>
            </View>
            <View style={{ flex: 1 }} />
            <Mono s={12} c={color.muted}>{`${guessesLeft} left`}</Mono>
          </View>

          <View
            style={{
              marginTop: space.xl,
              height: size.input,
              borderRadius: radius.input,
              borderWidth: 2,
              borderColor: color.lime,
              backgroundColor: color.ink,
              flexDirection: "row",
              alignItems: "center",
              gap: space.m,
              paddingHorizontal: space.l,
            }}
          >
            <MagnifyingGlass size={20} weight="bold" color={color.muted} />
            <TextInput
              accessibilityLabel="Search any player"
              autoFocus
              value={text}
              onChangeText={setText}
              placeholder="Search any player"
              placeholderTextColor={color.dim}
              autoCorrect={false}
              autoCapitalize="words"
              cursorColor={color.lime}
              selectionColor={color.lime}
              style={{ flex: 1, height: size.input, color: color.cream, fontFamily: font.bold, fontSize: 17 }}
            />
            {searching || submitting ? <ActivityIndicator color={color.lime} /> : null}
          </View>

          <FlatList
            style={{ marginTop: space.m, flexGrow: 0 }}
            keyboardShouldPersistTaps="handled"
            data={results ?? []}
            keyExtractor={(p) => p.externalId}
            ListEmptyComponent={
              query.length >= MIN_CHARS && results ? (
                <Txt v="caption" c={color.dim} style={{ paddingVertical: space.l }}>
                  No players match that name.
                </Txt>
              ) : undefined
            }
            renderItem={({ item, index }) => (
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => {
                  haptic.tap();
                  setPickedId(item.externalId);
                  onPick({ externalId: item.externalId, name: item.name });
                }}
                style={({ pressed }) => ({
                  minHeight: size.listRow,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: space.m,
                  paddingVertical: space.m,
                  borderBottomWidth: index === (results?.length ?? 0) - 1 ? 0 : 1,
                  borderBottomColor: color.lineSoft,
                  opacity: pressed || (submitting && pickedId !== item.externalId) ? 0.7 : 1,
                })}
              >
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 17, color: color.cream }}>
                    {item.name}
                  </Text>
                  {item.nationality || item.position ? (
                    <Txt v="caption" c={color.muted}>
                      {[item.nationality, item.position].filter(Boolean).join(" · ")}
                    </Txt>
                  ) : null}
                </View>
                {submitting && pickedId === item.externalId ? <ActivityIndicator color={color.lime} /> : <ArrowRight size={20} weight="bold" color={color.muted} />}
              </Pressable>
            )}
          />

          <View style={{ flex: 1 }} />
          <View
            style={{
              flexDirection: "row",
              gap: space.m,
              alignItems: "flex-start",
              padding: space.l,
              marginBottom: insets.bottom + space.xxl,
              borderRadius: radius.input,
              backgroundColor: "#222222",
            }}
          >
            <Info size={20} weight="fill" color={color.yellow} />
            <Txt v="caption" c={color.muted} style={{ flex: 1 }}>
              Pick any player who fits both. You only learn if it counts — and how rare it is —{" "}
              <Text style={{ fontFamily: font.bold, color: color.cream }}>after you lock it in.</Text>
            </Txt>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
