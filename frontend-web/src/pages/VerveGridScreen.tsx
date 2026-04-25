import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ArrowLeft, Search, X, Check, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SUPPORTED_VERVE_GRID_SPORTS = new Set(["football"]);
const START_SESSION_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("VerveGrid startup timed out"));
      }, timeoutMs);
    }),
  ]);
}

interface CellState {
  rowIdx: number;
  colIdx: number;
  guessedPlayerName?: string;
  correct?: boolean;
}

export default function VerveGridScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const isSupportedSport = SUPPORTED_VERVE_GRID_SPORTS.has(sport);

  const startSessionMut = useMutation(api.verveGrid.startSession);
  const submitGuessMut = useMutation(api.verveGrid.submitGuess);

  const [sessionId, setSessionId] = useState<Id<"verveGridSessions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ type: string; key: string; label: string }[]>([]);
  const [cols, setCols] = useState<{ type: string; key: string; label: string }[]>([]);
  const [cells, setCells] = useState<CellState[]>([]);
  const [remainingGuesses, setRemainingGuesses] = useState(9);
  const [correctCount, setCorrectCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [allSolved, setAllSolved] = useState(false);
  const [startupState, setStartupState] = useState<{
    kind: "unsupported" | "start_failed";
    title: string;
    message: string;
  } | null>(null);

  // Search modal state
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [shakeCell, setShakeCell] = useState<number | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const searchResults = useQuery(
    api.verveGrid.searchPlayers,
    debouncedQuery.length >= 2 && sessionId && activeCellIndex !== null
      ? {
          queryText: debouncedQuery,
          sport,
          sessionId,
          cellIndex: activeCellIndex,
        }
      : "skip",
  );

  const startGame = useCallback(async () => {
    if (!isSupportedSport) {
      setStartupState({
        kind: "unsupported",
        title: "Football Only For Now",
        message:
          "VerveGrid is currently available for football only. Pick football to load a curated grid.",
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setStartupState(null);
    try {
      const result = await withTimeout(
        startSessionMut({ sport }),
        START_SESSION_TIMEOUT_MS,
      );
      setSessionId(result.sessionId);
      setRows(result.rows);
      setCols(result.cols);
      setCells(
        Array.from({ length: 9 }, (_, i) => ({
          rowIdx: Math.floor(i / 3),
          colIdx: i % 3,
        })),
      );
      setRemainingGuesses(result.remainingGuesses);
      setCorrectCount(0);
      setGameOver(false);
      setAllSolved(false);
      setStartupState(null);
    } catch (err) {
      console.error("Failed to start grid session:", err);
      setSessionId(null);
      setRows([]);
      setCols([]);
      setCells([]);
      setStartupState({
        kind: "start_failed",
        title: "Couldn't Start A Grid",
        message:
          "VerveGrid couldn't load right now. Try again, or go back and retry from sport select.",
      });
    } finally {
      setLoading(false);
    }
  }, [isSupportedSport, startSessionMut, sport]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  const openSearch = (cellIndex: number) => {
    if (gameOver || cells[cellIndex]?.correct) return;
    setActiveCellIndex(cellIndex);
    setSearchQuery("");
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handlePlayerSelect = async (player: {
    externalId: string;
    name: string;
  }) => {
    if (!sessionId || activeCellIndex === null) return;
    setSearchOpen(false);

    try {
      const result = await submitGuessMut({
        sessionId,
        cellIndex: activeCellIndex,
        playerExternalId: player.externalId,
        playerName: player.name,
      });

      if (result.alreadyUsed) {
        setShakeCell(activeCellIndex);
        setTimeout(() => setShakeCell(null), 600);
        return;
      }

      const newCells = [...cells];
      newCells[activeCellIndex] = {
        ...newCells[activeCellIndex],
        guessedPlayerName: player.name,
        correct: result.correct,
      };
      setCells(newCells);
      setRemainingGuesses(result.remainingGuesses);
      setCorrectCount(result.correctCount);

      if (!result.correct) {
        setShakeCell(activeCellIndex);
        setTimeout(() => setShakeCell(null), 600);
      }

      if (result.gameOver) {
        setGameOver(true);
        setAllSolved(result.allSolved);
      }
    } catch (err) {
      console.error("Guess error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading text-lg animate-pulse">Building your grid...</p>
      </div>
    );
  }

  if (startupState) {
    return (
      <div className="min-h-screen bg-background px-4 py-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate("/home")}
            className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed transition-all"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <NeoCard color="primary" shadow="lg" className="w-full max-w-md text-center py-8 px-5">
            <p className="font-heading font-bold text-2xl">{startupState.title}</p>
            <p className="text-sm text-muted-foreground mt-3">{startupState.message}</p>

            <div className="grid grid-cols-1 gap-3 mt-6">
              {startupState.kind === "unsupported" ? (
                <>
                  <NeoButton
                    variant="primary"
                    size="lg"
                    onClick={() => navigate("/verve-grid?sport=football")}
                  >
                    Play Football
                  </NeoButton>
                  <NeoButton
                    variant="secondary"
                    size="lg"
                    onClick={() => navigate("/sport-select?mode=verve-grid")}
                  >
                    Back To Sport Select
                  </NeoButton>
                </>
              ) : (
                <>
                  <NeoButton variant="primary" size="lg" onClick={startGame}>
                    Try Again
                  </NeoButton>
                  <NeoButton
                    variant="secondary"
                    size="lg"
                    onClick={() => navigate("/sport-select?mode=verve-grid")}
                  >
                    Back To Sport Select
                  </NeoButton>
                </>
              )}
            </div>
          </NeoCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate("/home")}
          className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed transition-all"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-2">
          <NeoBadge color="accent" size="md">
            {correctCount}/9
          </NeoBadge>
          <NeoBadge color="primary" size="md">
            {remainingGuesses} left
          </NeoBadge>
        </div>
      </div>

      <h2 className="font-heading font-bold text-lg text-center mb-1">VerveGrid</h2>
      <p className="text-[10px] text-muted-foreground text-center mb-4">
        Curated football boards
      </p>

      {/* 4x4 Grid: 1 header row + 1 header col + 3x3 cells */}
      <div className="grid grid-cols-4 gap-1.5">
        {/* Top-left empty corner */}
        <div />

        {/* Column headers */}
        {cols.map((col, ci) => (
          <div
            key={`col-${ci}`}
            className="neo-border rounded-lg bg-electric-blue text-electric-blue-foreground p-2 text-center"
          >
            <p className="font-heading font-bold text-[10px] leading-tight uppercase truncate">
              {col.label}
            </p>
          </div>
        ))}

        {/* Row headers + cells */}
        {rows.map((row, ri) => (
          <>
            {/* Row header */}
            <div
              key={`row-${ri}`}
              className="neo-border rounded-lg bg-hot-pink text-hot-pink-foreground p-2 flex items-center justify-center"
            >
              <p className="font-heading font-bold text-[10px] leading-tight uppercase text-center truncate">
                {row.label}
              </p>
            </div>

            {/* 3 cells in this row */}
            {cols.map((_, ci) => {
              const cellIdx = ri * 3 + ci;
              const cell = cells[cellIdx];
              const isSolved = cell?.correct === true;
              const isWrong = cell?.correct === false;
              const isShaking = shakeCell === cellIdx;

              return (
                <div
                  key={`cell-${ri}-${ci}`}
                  className={`neo-border rounded-lg min-h-[72px] flex items-center justify-center p-1.5 cursor-pointer transition-all ${
                    isShaking ? "animate-shake-horizontal" : ""
                  } ${
                    isSolved
                      ? "bg-success text-success-foreground"
                      : isWrong
                        ? "bg-muted"
                        : "bg-background hover:bg-muted/50"
                  }`}
                  onClick={() => !isSolved && !gameOver && openSearch(cellIdx)}
                >
                  {isSolved ? (
                    <div className="text-center">
                      <Check size={16} className="mx-auto mb-0.5" />
                      <p className="font-body text-[9px] leading-tight">
                        {cell.guessedPlayerName}
                      </p>
                    </div>
                  ) : isWrong ? (
                    <div className="text-center">
                      <XCircle size={14} className="mx-auto mb-0.5 text-destructive" />
                      <p className="font-body text-[9px] leading-tight text-muted-foreground">
                        {cell.guessedPlayerName}
                      </p>
                    </div>
                  ) : (
                    <Search size={16} className="text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>

      {/* Game over */}
      {gameOver && (
        <div className="mt-6 space-y-3 animate-slide-up">
          <NeoCard
            color={allSolved ? "success" : "primary"}
            className="text-center py-4"
          >
            <p className="font-heading font-bold text-xl">
              {allSolved ? "Perfect Grid!" : "Game Over!"}
            </p>
            <p className="font-mono font-bold text-3xl mt-1">{correctCount}/9</p>
          </NeoCard>
          <div className="grid grid-cols-2 gap-3">
            <NeoButton variant="primary" size="lg" onClick={startGame}>
              New Grid
            </NeoButton>
            <NeoButton variant="secondary" size="lg" onClick={() => navigate("/home")}>
              Home
            </NeoButton>
          </div>
        </div>
      )}

      {/* Search modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold">
              Search Player
            </DialogTitle>
          </DialogHeader>

          <NeoInput
            ref={searchInputRef}
            placeholder="Type a player name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="max-h-60 overflow-y-auto mt-2 space-y-1">
            {searchResults?.map((player) => (
              <div
                key={player.externalId}
                className="neo-border rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => handlePlayerSelect(player)}
              >
                {player.photo && (
                  <img
                    src={player.photo}
                    alt={player.name}
                    className="w-8 h-8 rounded-full neo-border object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-sm truncate">
                    {player.name}
                  </p>
                  {(player.nationality || player.position) && (
                    <p className="text-xs text-muted-foreground">
                      {[player.nationality, player.position].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {debouncedQuery.length >= 2 && searchResults?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No players found
              </p>
            )}
            {debouncedQuery.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Type at least 2 characters
              </p>
            )}
          </div>

          <NeoButton
            variant="secondary"
            size="sm"
            onClick={() => setSearchOpen(false)}
            className="mt-2"
          >
            <X size={14} className="mr-1" />
            Cancel
          </NeoButton>
        </DialogContent>
      </Dialog>
    </div>
  );
}
