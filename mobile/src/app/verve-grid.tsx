import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Info } from "phosphor-react-native/src/icons/Info";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchSheet, type PickedPlayer } from "@/components/grid/SearchSheet";
import { AppBar, Button, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";
import type { Id } from "@convex/_generated/dataModel";
import { useGuardedLeave } from "@/lib/guardLeave";

const TOTAL_GUESSES = 9; // server: MAX_GUESSES

type Axis = { type: string; key: string; label: string };
type Cell = {
  rowIdx: number;
  colIdx: number;
  points: number;
  rarityTier: string;
  guessedPlayerName?: string;
  correct?: boolean;
};
type Board = {
  sessionId: Id<"verveGridSessions">;
  difficulty: string;
  rows: Axis[];
  cols: Axis[];
  cells: Cell[];
  remainingGuesses: number;
  correctCount: number;
  guesses: boolean[];
  over: boolean;
  left?: boolean;
};

const DIFFICULTIES = ["easy", "intermediate", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
const DIFF_LABEL: Record<string, string> = { easy: "Easy", intermediate: "Medium", hard: "Hard" };
const AXIS_LABEL: Record<string, string> = { club: "Clubs", team: "Clubs", nation: "Nations", nationality: "Nations", country: "Nations", league: "Leagues" };
const axisName = (t?: string) => (t ? (AXIS_LABEL[t] ?? `${t[0]!.toUpperCase()}${t.slice(1)}s`) : "");
const RARITY: Record<string, string> = { rare: "RARE", uncommon: "UNCOMMON", common: "COMMON" };

function cellAt(cells: Cell[], r: number, c: number) {
  return cells.findIndex((x) => x.rowIdx === r && x.colIdx === c);
}

export default function VerveGridScreen() {
  const insets = useSafeAreaInsets();
  const { ready } = useSession();
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: Difficulty = DIFFICULTIES.includes(params.difficulty as Difficulty) ? (params.difficulty as Difficulty) : "intermediate";

  const start = useMutation(api.verveGrid.startSession);
  const submit = useMutation(api.verveGrid.submitGuess);
  const penalize = useMutation(api.verveGrid.penalizeTabSwitch);

  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const boardRef = useRef<Board | null>(null);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  const started = useRef(false);

  const fetchGame = useCallback(async () => {
    try {
      const r = await start({ sport: "football", difficulty });
      setBoard({
        sessionId: r.sessionId,
        difficulty: r.difficulty,
        rows: r.rows,
        cols: r.cols,
        cells: r.cells.map((c) => ({ rowIdx: c.rowIdx, colIdx: c.colIdx, points: c.points, rarityTier: c.rarityTier })),
        remainingGuesses: r.remainingGuesses,
        correctCount: r.correctCount,
        guesses: [],
        over: false,
      });
    } catch {
      setError("We couldn't load a grid right now. Try again.");
    }
  }, [start, difficulty]);

  /** "New grid" / "Try again": clear the screen, then deal a fresh board. */
  const newGame = useCallback(() => {
    setError(null);
    setNotice(null);
    setBoard(null);
    void fetchGame();
  }, [fetchGame]);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void fetchGame();
  }, [ready, fetchGame]);

  // Back / X mid-grid: confirm, then the same penalty as leaving the app.
  useGuardedLeave(!!board && !board.over, () => {
    if (board) void penalize({ sessionId: board.sessionId }).catch(() => {});
  });

  // Leaving the app ends the grid, as switching tabs does on the web.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      const b = boardRef.current;
      if (st === "active" || !b || b.over) return;
      setActive(null);
      setBoard({ ...b, over: true, left: true });
      void penalize({ sessionId: b.sessionId }).catch(() => {});
    });
    return () => sub.remove();
  }, [penalize]);

  async function onPick(p: PickedPlayer) {
    const b = board;
    if (!b || active === null || submitting) return;
    setSubmitting(true);
    try {
      const res = await submit({ sessionId: b.sessionId, cellIndex: active, playerExternalId: p.externalId, playerName: p.name });
      if (res.alreadyUsed) {
        setNotice(`${p.name} is already on your grid — pick someone else.`);
        setActive(null);
        return;
      }
      if (res.correct) haptic.right();
      else haptic.wrong();
      const cells = b.cells.map((c, i) => (i === active ? { ...c, guessedPlayerName: p.name, correct: res.correct } : c));
      setBoard({
        ...b,
        cells,
        remainingGuesses: res.remainingGuesses,
        correctCount: res.correctCount ?? b.correctCount,
        guesses: [...b.guesses, res.correct],
        over: res.gameOver === true,
      });
      setNotice(null);
      setActive(null);
    } catch {
      setNotice("That pick didn't go through — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!board) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="VerveGrid" onBack={() => router.back()} close />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
          {error ? (
            <>
              <Txt c={color.muted} center>
                {error}
              </Txt>
              <Button variant="secondary" label="Try again" icon={ArrowClockwise} onPress={newGame} />
            </>
          ) : (
            <ActivityIndicator color={color.lime} />
          )}
        </View>
      </View>
    );
  }

  const missed = board.guesses.filter((g) => !g).length;
  const points = board.cells.reduce((sum, c) => sum + (c.correct ? c.points : 0), 0);
  const activeCell = active !== null ? board.cells[active] : null;
  const eyebrow = `${axisName(board.rows[0]?.type)} × ${axisName(board.cols[0]?.type)} · ${DIFF_LABEL[board.difficulty] ?? board.difficulty}`;

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title="VerveGrid"
        eyebrow={eyebrow}
        onBack={() => router.back()}
        close
        right={
          <View style={{ alignItems: "center", gap: space.xs }} accessibilityLabel={`${board.remainingGuesses} guesses left`}>
            <Mono s={17} style={{ lineHeight: 18 }}>
              {board.remainingGuesses}
            </Mono>
            <Mono s={11} c={color.dim} style={{ letterSpacing: 1.5, lineHeight: 12 }}>
              LEFT
            </Mono>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}>
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.s }}>
          <Txt v="cardTitle">Find a player who played for both</Txt>
          <Txt v="caption" c={color.muted}>
            One guess per square. 9 guesses in all.
          </Txt>
        </View>

        {/* Grid: 80px row labels + 3 equal columns, 8px gaps (mockup VerveGrid). */}
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.s }}>
          <View style={{ flexDirection: "row", gap: space.s }}>
            <View style={{ width: 80 }} />
            {board.cols.map((c) => (
              <View key={c.key} style={{ flex: 1, height: 48, alignItems: "center", justifyContent: "center" }}>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 13, lineHeight: 16, color: color.cream, textAlign: "center" }}>
                  {c.label}
                </Text>
              </View>
            ))}
          </View>
          {board.rows.map((row, r) => (
            <View key={row.key} style={{ flexDirection: "row", gap: space.s }}>
              <View style={{ width: 80, height: 88, justifyContent: "center" }}>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={3} style={{ fontFamily: font.bold, fontSize: 13, lineHeight: 16, color: color.cream }}>
                  {row.label}
                </Text>
              </View>
              {board.cols.map((col, c) => {
                const idx = cellAt(board.cells, r, c);
                const cell = board.cells[idx];
                if (!cell) return <View key={col.key} style={{ flex: 1 }} />;
                const answered = cell.correct !== undefined;
                const selected = active === idx;
                const playable = !answered && !board.over;
                return (
                  <Pressable
                    key={col.key}
                    accessibilityRole="button"
                    accessibilityLabel={
                      answered
                        ? `${row.label} and ${col.label}: ${cell.correct ? cell.guessedPlayerName : "missed"}`
                        : `${row.label} and ${col.label}: tap to pick`
                    }
                    disabled={!playable}
                    onPress={() => {
                      haptic.tap();
                      setNotice(null);
                      setActive(idx);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: 88,
                      borderRadius: radius.tile,
                      borderWidth: answered || selected ? 2 : 1.5,
                      borderColor: answered ? (cell.correct ? color.right : color.wrong) : selected ? color.lime : color.line,
                      backgroundColor: answered ? (cell.correct ? color.rightBg : color.wrongBg) : color.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: space.xs,
                      paddingHorizontal: space.s,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    {answered ? (
                      cell.correct ? (
                        <>
                          <CheckCircle size={20} weight="fill" color={color.right} />
                          <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 13, lineHeight: 16, color: color.cream, textAlign: "center" }}>
                            {cell.guessedPlayerName}
                          </Text>
                          <Mono s={9} c={color.muted} style={{ letterSpacing: 1 }}>
                            {RARITY[cell.rarityTier] ?? ""}
                          </Mono>
                        </>
                      ) : (
                        <>
                          <XCircle size={20} weight="fill" color={color.wrong} />
                          <Mono s={11} c={color.wrong} style={{ letterSpacing: 1.2 }}>
                            MISSED
                          </Mono>
                        </>
                      )
                    ) : board.over ? null : (
                      <Plus size={20} weight="bold" color={selected ? color.lime : color.dim} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Guesses */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.gutter, paddingTop: space.xl }}>
          <View style={{ flexDirection: "row", gap: space.xs }} accessibilityLabel={`${board.guesses.length} of ${TOTAL_GUESSES} guesses used`}>
            {Array.from({ length: TOTAL_GUESSES }, (_, i) => {
              const g = board.guesses[i];
              return (
                <View
                  key={i}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: g === undefined ? "transparent" : g ? color.right : color.wrong,
                    borderWidth: g === undefined ? 2 : 0,
                    borderColor: color.hiddenLine,
                  }}
                />
              );
            })}
          </View>
          <Mono s={13} c={color.muted}>{`${board.correctCount} right · ${missed} missed`}</Mono>
        </View>

        {notice ? (
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.m }}>
            <Txt v="caption" c={color.muted}>
              {notice}
            </Txt>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        {board.over ? (
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.m }}>
            <View style={{ alignItems: "center", gap: space.s, paddingBottom: space.s }}>
              <Eyebrow>{board.left ? "Grid ended — you left the app" : board.correctCount === 9 ? "Full grid" : "Grid over"}</Eyebrow>
              <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.mono, fontSize: 56, lineHeight: 64, color: color.cream }}>
                {board.correctCount}
                <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 32, color: color.dim }}>/9</Text>
              </Text>
              <Txt c={color.muted}>{`${points} point${points === 1 ? "" : "s"} · rarer squares score more`}</Txt>
            </View>
            <Button label="New grid" icon={ArrowClockwise} onPress={newGame} />
            <Button variant="secondary" label="Back to Play" onPress={() => router.back()} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s, paddingHorizontal: space.gutter, paddingTop: space.l }}>
            <Info size={16} weight="bold" color={color.dim} />
            <Txt v="caption" c={color.dim}>
              Missed squares stay hidden — no answers revealed.
            </Txt>
          </View>
        )}
      </ScrollView>

      <SearchSheet
        key={active ?? "closed"}
        open={activeCell !== null && !board.over}
        onClose={() => setActive(null)}
        onPick={(p) => void onPick(p)}
        sessionId={board.sessionId}
        cellIndex={active}
        rowLabel={activeCell ? (board.rows[activeCell.rowIdx]?.label ?? "") : ""}
        colLabel={activeCell ? (board.cols[activeCell.colIdx]?.label ?? "") : ""}
        guessesLeft={board.remainingGuesses}
        submitting={submitting}
      />
    </View>
  );
}
