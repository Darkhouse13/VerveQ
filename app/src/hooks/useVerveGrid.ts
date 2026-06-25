/**
 * useVerveGrid — server-authoritative driver for the v2 VerveGrid stage.
 *
 * A faithful port of the live `VerveGridScreen` game loop onto a clean
 * view-model so the bespoke `GridStage` is presentation-only. Every decision
 * stays on the server and the backend is UNTOUCHED:
 *   - `verveGrid.startSession`   picks a curated board (football only)
 *   - `verveGrid.searchPlayers`  the player search (results rendered AS-IS)
 *   - `verveGrid.submitGuess`    validates correctness ONLY after lock-in
 *   - `verveGrid.penalizeTabSwitch` ends the run on tab switch (anti-cheat)
 *   - `verveGrid.getSession`     never returns the answer pool (validPlayerIds)
 *
 * Anti-leak: the answer set never reaches the client. `validAnswerCount` /
 * `rarityTier` / `points` are CELL-DIFFICULTY metadata (size of the answer
 * pool), NOT pick-share — and the hook only ever surfaces them for cells the
 * player has already correctly filled. Empty/missed cells expose nothing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useDifficulty, type Difficulty } from "@/lib/difficulty";

export const SUPPORTED_VERVE_GRID_SPORTS = new Set(["football"]);
export const GRID_SEARCH_MIN_CHARS = 3;
const START_SESSION_TIMEOUT_MS = 8000;
const TOTAL_CELLS = 9;

export type GridCellDifficulty = "rare" | "uncommon" | "common";

/** Sanitized per-cell view state. Never carries the cell's answer pool. */
export interface GridCellState {
  rowIdx: number;
  colIdx: number;
  /** Answer-pool size — CELL DIFFICULTY, not pick-share. Surfaced only once filled. */
  validAnswerCount?: number;
  rarityTier?: GridCellDifficulty;
  points?: number;
  guessedPlayerName?: string;
  /** undefined = untouched; true = correct lock-in; false = wrong lock-in. */
  correct?: boolean;
}

export interface GridAxis {
  type: string;
  key: string;
  label: string;
}

/** A correct pick, surfaced for the "your picks" log (your data only). */
export interface GridPickEntry {
  id: string;
  name: string;
  /** Where it landed: "<col> × <row>" — the criteria are already on the board. */
  label: string;
  rarityTier?: GridCellDifficulty;
  points?: number;
}

export interface GridSearchResult {
  externalId: string;
  name: string;
  photo?: string;
  position?: string;
  nationality?: string;
}

export interface GridStartupState {
  kind: "unsupported" | "start_failed";
  title: string;
  message: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error("VerveGrid startup timed out")),
      timeoutMs,
    );
    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function normalizeTier(tier?: string): GridCellDifficulty | undefined {
  if (tier === "rare" || tier === "uncommon" || tier === "common") return tier;
  return undefined;
}

export interface VerveGridViewModel {
  sport: string;
  isSupportedSport: boolean;
  loading: boolean;
  startupState: GridStartupState | null;

  rows: GridAxis[];
  cols: GridAxis[];
  cells: GridCellState[];

  remainingGuesses: number;
  /** Cells correctly filled. */
  correctCount: number;
  /** Untouched (still tappable) cells. */
  emptyCount: number;
  /** Sum of CELL-DIFFICULTY points over correctly filled cells. */
  points: number;
  totalCells: number;

  gameOver: boolean;
  allSolved: boolean;
  picks: GridPickEntry[];

  // Search sheet
  searchOpen: boolean;
  activeCellIndex: number | null;
  /** Criteria for the open cell: { colLabel, rowLabel }. Never an answer. */
  activeCriteria: { colLabel: string; rowLabel: string } | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: GridSearchResult[] | undefined;
  minChars: number;
  shakeCellIndex: number | null;
  submitting: boolean;

  // Difficulty
  difficulty: Difficulty;
  setDifficulty: (next: Difficulty) => void;

  // Actions
  startGame: () => void;
  openCell: (cellIndex: number) => void;
  closeSheet: () => void;
  selectPlayer: (player: { externalId: string; name: string }) => void;
}

export function useVerveGrid(sport: string): VerveGridViewModel {
  const { t } = useTranslation("play");
  const isSupportedSport = SUPPORTED_VERVE_GRID_SPORTS.has(sport);
  const [difficulty, setDifficulty] = useDifficulty("vervegrid");

  const startSessionMut = useMutation(api.verveGrid.startSession);
  const submitGuessMut = useMutation(api.verveGrid.submitGuess);
  const penalizeTabSwitchMut = useMutation(api.verveGrid.penalizeTabSwitch);

  const [sessionId, setSessionId] = useState<Id<"verveGridSessions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupState, setStartupState] = useState<GridStartupState | null>(null);

  const [rows, setRows] = useState<GridAxis[]>([]);
  const [cols, setCols] = useState<GridAxis[]>([]);
  const [cells, setCells] = useState<GridCellState[]>([]);
  const [remainingGuesses, setRemainingGuesses] = useState(TOTAL_CELLS);
  const [correctCount, setCorrectCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [allSolved, setAllSolved] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [shakeCellIndex, setShakeCellIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  // The player search — rendered AS-IS. The backend owns what it returns.
  const rawResults = useQuery(
    api.verveGrid.searchPlayers,
    debouncedQuery.length >= GRID_SEARCH_MIN_CHARS && sessionId && activeCellIndex !== null
      ? { queryText: debouncedQuery, sport, sessionId, cellIndex: activeCellIndex }
      : "skip",
  );
  const searchResults = rawResults as GridSearchResult[] | undefined;

  const startGame = useCallback(async () => {
    if (!isSupportedSport) {
      setStartupState({
        kind: "unsupported",
        title: t("verveGrid.unsupportedTitle"),
        message: t("verveGrid.unsupportedMessage"),
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setStartupState(null);
    try {
      const result = await withTimeout(
        startSessionMut({ sport, difficulty }),
        START_SESSION_TIMEOUT_MS,
      );
      setSessionId(result.sessionId);
      setRows(result.rows as GridAxis[]);
      setCols(result.cols as GridAxis[]);
      setCells(
        (result.cells as GridCellState[]).map((cell) => ({
          ...cell,
          rarityTier: normalizeTier(cell.rarityTier),
        })),
      );
      setRemainingGuesses(result.remainingGuesses);
      setCorrectCount(0);
      setGameOver(false);
      setAllSolved(false);
      setSearchOpen(false);
      setActiveCellIndex(null);
      setSearchQuery("");
    } catch (err) {
      console.error("Failed to start grid session:", err);
      setSessionId(null);
      setRows([]);
      setCols([]);
      setCells([]);
      setStartupState({
        kind: "start_failed",
        title: t("verveGrid.startFailedTitle"),
        message: t("verveGrid.startFailedMessage"),
      });
    } finally {
      setLoading(false);
    }
  }, [isSupportedSport, startSessionMut, sport, difficulty, t]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  useAntiCheat(
    useCallback(() => {
      if (!sessionId || gameOver || loading || startupState) return;
      penalizeTabSwitchMut({ sessionId }).then((res) => {
        if (res.penalized) {
          setGameOver(true);
          setAllSolved(false);
          setCorrectCount(res.correctCount);
          toast.error(t("verveGrid.tabSwitchEnded"));
        }
      });
    }, [sessionId, gameOver, loading, startupState, penalizeTabSwitchMut, t]),
    { warningMessage: t("verveGrid.tabSwitchWarning") },
  );

  const openCell = useCallback(
    (cellIndex: number) => {
      if (gameOver || cells[cellIndex]?.correct !== undefined) return;
      setActiveCellIndex(cellIndex);
      setSearchQuery("");
      setDebouncedQuery("");
      setSearchOpen(true);
    },
    [gameOver, cells],
  );

  const closeSheet = useCallback(() => {
    setSearchOpen(false);
    setActiveCellIndex(null);
  }, []);

  const activeCellRef = useRef(activeCellIndex);
  activeCellRef.current = activeCellIndex;

  const selectPlayer = useCallback(
    async (player: { externalId: string; name: string }) => {
      const cellIndex = activeCellRef.current;
      if (!sessionId || cellIndex === null || submitting) return;
      setSubmitting(true);
      setSearchOpen(false);
      try {
        const result = await submitGuessMut({
          sessionId,
          cellIndex,
          playerExternalId: player.externalId,
          playerName: player.name,
        });

        if (result.alreadyUsed) {
          setShakeCellIndex(cellIndex);
          setTimeout(() => setShakeCellIndex(null), 600);
          toast.warning(t("verveGrid.alreadyUsed"));
          // Re-open so the player can pick a different name for this cell.
          setSearchOpen(true);
          return;
        }

        setCells((prev) => {
          const next = [...prev];
          next[cellIndex] = {
            ...next[cellIndex],
            guessedPlayerName: player.name,
            correct: result.correct,
          };
          return next;
        });
        setRemainingGuesses(result.remainingGuesses);
        if ("correctCount" in result && typeof result.correctCount === "number") {
          setCorrectCount(result.correctCount);
        }

        if (!result.correct) {
          setShakeCellIndex(cellIndex);
          setTimeout(() => setShakeCellIndex(null), 600);
          toast.error(t("verveGrid.notAMatch"));
        }

        if ("gameOver" in result && result.gameOver) {
          setGameOver(true);
          setAllSolved("allSolved" in result ? !!result.allSolved : false);
        }
        setActiveCellIndex(null);
      } catch (err) {
        console.error("Guess error:", err);
        toast.error(t("verveGrid.submitFailed"));
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, submitting, submitGuessMut, t],
  );

  const filledCount = useMemo(
    () => cells.filter((c) => c.correct !== undefined).length,
    [cells],
  );
  const emptyCount = TOTAL_CELLS - filledCount;

  const points = useMemo(
    () =>
      cells.reduce((sum, c) => (c.correct === true ? sum + (c.points ?? 0) : sum), 0),
    [cells],
  );

  const picks = useMemo<GridPickEntry[]>(() => {
    return cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.correct === true && cell.guessedPlayerName)
      .map(({ cell, index }) => {
        const col = cols[cell.colIdx];
        const row = rows[cell.rowIdx];
        const colLabel = col?.label ?? "";
        const rowLabel = row?.label ?? "";
        return {
          id: `cell-${index}`,
          name: cell.guessedPlayerName as string,
          label: [colLabel, rowLabel].filter(Boolean).join(" × "),
          rarityTier: cell.rarityTier,
          points: cell.points,
        };
      });
  }, [cells, cols, rows]);

  const activeCriteria = useMemo(() => {
    if (activeCellIndex === null) return null;
    const cell = cells[activeCellIndex];
    if (!cell) return null;
    return {
      colLabel: cols[cell.colIdx]?.label ?? "",
      rowLabel: rows[cell.rowIdx]?.label ?? "",
    };
  }, [activeCellIndex, cells, cols, rows]);

  return {
    sport,
    isSupportedSport,
    loading,
    startupState,
    rows,
    cols,
    cells,
    remainingGuesses,
    correctCount,
    emptyCount,
    points,
    totalCells: TOTAL_CELLS,
    gameOver,
    allSolved,
    picks,
    searchOpen,
    activeCellIndex,
    activeCriteria,
    searchQuery,
    setSearchQuery,
    searchResults,
    minChars: GRID_SEARCH_MIN_CHARS,
    shakeCellIndex,
    submitting,
    difficulty,
    setDifficulty,
    startGame,
    openCell,
    closeSheet,
    selectPlayer,
  };
}
