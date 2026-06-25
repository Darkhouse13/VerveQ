#!/usr/bin/env npx tsx

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const APPROVED_PATH = path.join(DATA_DIR, "verveGridApprovedIndex.json");
const TEAMS_PATH = path.join(DATA_DIR, "teams.json");
const OUTPUT_PATH = path.join(DATA_DIR, "verveGridBoards.json");

export type BoardDifficulty = "easy" | "intermediate" | "hard";

/**
 * Difficulty tiers restrict which TEAM axes may appear on a board so the player
 * only ever faces clubs they recognise (users complained the hard tier surfaces
 * obscure reserve/lower-division sides). Difficulty is derived purely from the
 * team axes; nationality/position axes are already limited to major nations and
 * the four outfield buckets, so they need no gating.
 *
 *  - easy:         every team axis is an elite, globally-famous club.
 *  - intermediate: every team axis is a top-5 European league side.
 *  - hard:         anything goes (the original, unrestricted behaviour).
 *
 * The tiers nest (elite ⊂ top-5 ⊂ all), so the runtime treats them as a ceiling
 * (intermediate also serves easy boards; hard serves everything).
 */
const TOP5_LEAGUE_IDS = new Set(["fb_39", "fb_140", "fb_135", "fb_78", "fb_61"]);

/**
 * The unmistakably-elite clubs of the big-5 leagues — the only teams an "easy"
 * board may use. Kept deliberately small and famous; widen here if easy yields
 * too few boards. (Team keys are API-Football ids from teams.json.)
 */
const ELITE_TEAM_KEYS = new Set([
  // Premier League
  "fb_team_33", // Manchester United
  "fb_team_50", // Manchester City
  "fb_team_40", // Liverpool
  "fb_team_42", // Arsenal
  "fb_team_49", // Chelsea
  "fb_team_47", // Tottenham
  // La Liga
  "fb_team_541", // Real Madrid
  "fb_team_529", // Barcelona
  "fb_team_530", // Atletico Madrid
  "fb_team_536", // Sevilla
  "fb_team_532", // Valencia
  // Serie A
  "fb_team_496", // Juventus
  "fb_team_489", // AC Milan
  "fb_team_505", // Inter
  "fb_team_492", // Napoli
  "fb_team_497", // AS Roma
  // Bundesliga
  "fb_team_157", // Bayern München
  "fb_team_165", // Borussia Dortmund
  "fb_team_168", // Bayer Leverkusen
  "fb_team_173", // RB Leipzig
  "fb_team_174", // FC Schalke 04
  // Ligue 1
  "fb_team_85", // Paris Saint Germain
  "fb_team_81", // Marseille
  "fb_team_80", // Lyon
  "fb_team_91", // Monaco
]);

/** team key -> primary leagueId, from teams.json (one league per team here). */
function loadTeamLeagueMap(): Map<string, string> {
  const teams = JSON.parse(fs.readFileSync(TEAMS_PATH, "utf8")) as Array<{
    id: string;
    leagueId?: string;
  }>;
  const map = new Map<string, string>();
  for (const team of teams) {
    if (!map.has(team.id) && team.leagueId) map.set(team.id, team.leagueId);
  }
  return map;
}

const TEAM_LEAGUE = loadTeamLeagueMap();

/** All team keys that belong to a top-5 European league (intermediate pool). */
const TOP5_TEAM_KEYS = new Set(
  [...TEAM_LEAGUE.entries()]
    .filter(([, leagueId]) => TOP5_LEAGUE_IDS.has(leagueId))
    .map(([key]) => key),
);

type GridCriterion = {
  type: string;
  key: string;
  label: string;
};

type ApprovedGridEntry = {
  id: string;
  sourceGridId: string;
  axisFamily: string;
  sport: "football";
  rowType: string;
  rowKey: string;
  rowLabel: string;
  colType: string;
  colKey: string;
  colLabel: string;
  playerIds: string[];
  difficulty: string;
};

type VerveGridBoard = {
  id: string;
  sport: "football";
  templateId: string;
  axisFamily: string;
  difficulty: BoardDifficulty;
  score: number;
  rows: GridCriterion[];
  cols: GridCriterion[];
  cells: Array<{
    rowIdx: number;
    colIdx: number;
    validPlayerIds: string[];
  }>;
};

/** Derive a board's true difficulty from its team axes (elite ⊂ top-5 ⊂ all). */
function classifyDifficulty(rows: GridCriterion[], cols: GridCriterion[]): BoardDifficulty {
  const teamKeys = [...rows, ...cols]
    .filter((axis) => axis.type === "team")
    .map((axis) => axis.key);
  if (teamKeys.every((key) => ELITE_TEAM_KEYS.has(key))) return "easy";
  if (teamKeys.every((key) => TOP5_TEAM_KEYS.has(key))) return "intermediate";
  return "hard";
}

/** Stable signature for dedup across difficulty passes (order-independent axes). */
function boardSignature(board: { rows: GridCriterion[]; cols: GridCriterion[] }): string {
  const rowIds = board.rows.map(axisId).sort().join("|");
  const colIds = board.cols.map(axisId).sort().join("|");
  return `${rowIds}__${colIds}`;
}

type BoardTemplate = {
  id: string;
  axisFamily: string;
  rowType: string;
  colType: string;
  minCellSize: number;
  maxCellSize: number;
  maxBoards: number;
};

const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "clubs-vs-nationalities",
    axisFamily: "teamxnationality",
    rowType: "team",
    colType: "nationality",
    minCellSize: 3,
    maxCellSize: 12,
    maxBoards: 270,
  },
  {
    id: "clubs-vs-positions",
    axisFamily: "teamxposition",
    rowType: "team",
    colType: "position",
    minCellSize: 3,
    maxCellSize: 18,
    maxBoards: 160,
  },
  {
    id: "clubs-vs-clubs",
    axisFamily: "teamxteam",
    rowType: "team",
    colType: "team",
    minCellSize: 3,
    maxCellSize: 10,
    maxBoards: 270,
  },
];

function axisId(criterion: GridCriterion): string {
  return `${criterion.type}:${criterion.key}`;
}

function gridCellKey(row: GridCriterion, col: GridCriterion): string {
  return `${axisId(row)}|${axisId(col)}`;
}

function scoreBoard(cellSizes: number[]): number {
  return Math.max(...cellSizes) * 100 + cellSizes.reduce((sum, size) => sum + size, 0);
}

function chooseColumnsForRows(
  rowTriplet: GridCriterion[],
  sharedCols: GridCriterion[],
  entryByKey: Map<string, ApprovedGridEntry>,
): { cols: GridCriterion[]; score: number } | null {
  const rankedCols = sharedCols
    .map((col) => {
      const cellSizes = rowTriplet.map((row) => {
        const entry = entryByKey.get(gridCellKey(row, col));
        return entry?.playerIds.length ?? Number.MAX_SAFE_INTEGER;
      });
      return {
        col,
        averageCellSize:
          cellSizes.reduce((sum, size) => sum + size, 0) / cellSizes.length,
      };
    })
    .sort((a, b) => {
      if (a.averageCellSize !== b.averageCellSize) {
        return a.averageCellSize - b.averageCellSize;
      }
      return a.col.label.localeCompare(b.col.label);
    });

  const bestCols = rankedCols.slice(0, 6).map((entry) => entry.col);
  if (bestCols.length < 3) {
    return null;
  }

  let bestSelection: { cols: GridCriterion[]; score: number } | null = null;
  for (let i = 0; i < bestCols.length - 2; i++) {
    for (let j = i + 1; j < bestCols.length - 1; j++) {
      for (let k = j + 1; k < bestCols.length; k++) {
        const cols = [bestCols[i], bestCols[j], bestCols[k]];
        const cellSizes = rowTriplet.flatMap((row) =>
          cols.map((col) => entryByKey.get(gridCellKey(row, col))!.playerIds.length),
        );
        const score = scoreBoard(cellSizes);
        if (bestSelection == null || score < bestSelection.score) {
          bestSelection = { cols, score };
        }
      }
    }
  }

  return bestSelection;
}

type BuildOptions = {
  /** When set, every team-typed axis key must be in this allowlist. */
  allowedTeams?: ReadonlySet<string> | null;
  /** Sort boards so the most-answerable (largest cells) survive the cap first. */
  preferLargerCells?: boolean;
  /** Prefix for the generated board ids (e.g. "easy_"); "" keeps the hard ids. */
  idPrefix?: string;
  /** Board signatures already emitted by an earlier pass — skip duplicates. */
  skipSignatures?: ReadonlySet<string> | null;
  difficulty: BoardDifficulty;
};

function buildBoardsForTemplate(
  entries: ApprovedGridEntry[],
  template: BoardTemplate,
  opts: BuildOptions,
): VerveGridBoard[] {
  const {
    allowedTeams = null,
    preferLargerCells = false,
    idPrefix = "",
    skipSignatures = null,
    difficulty,
  } = opts;
  const teamAxisAllowed = (type: string, key: string) =>
    allowedTeams === null || type !== "team" || allowedTeams.has(key);
  const eligibleEntries = entries.filter(
    (entry) =>
      entry.axisFamily === template.axisFamily &&
      entry.rowType === template.rowType &&
      entry.colType === template.colType &&
      entry.playerIds.length >= template.minCellSize &&
      entry.playerIds.length <= template.maxCellSize &&
      entry.rowLabel !== entry.colLabel &&
      teamAxisAllowed(entry.rowType, entry.rowKey) &&
      teamAxisAllowed(entry.colType, entry.colKey),
  );

  const rowMap = new Map<string, GridCriterion>();
  const rowToCols = new Map<string, Set<string>>();
  const colMap = new Map<string, GridCriterion>();
  const entryByKey = new Map<string, ApprovedGridEntry>();

  for (const entry of eligibleEntries) {
    const row: GridCriterion = {
      type: entry.rowType,
      key: entry.rowKey,
      label: entry.rowLabel,
    };
    const col: GridCriterion = {
      type: entry.colType,
      key: entry.colKey,
      label: entry.colLabel,
    };
    const rowId = axisId(row);
    const colId = axisId(col);
    rowMap.set(rowId, row);
    colMap.set(colId, col);
    if (!rowToCols.has(rowId)) {
      rowToCols.set(rowId, new Set());
    }
    rowToCols.get(rowId)!.add(colId);
    entryByKey.set(gridCellKey(row, col), entry);
  }

  let rows = Array.from(rowMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  // The triplet enumeration below is O(rows^3). The Wikidata-augmented index has
  // far more row axes than the original top-5-league snapshot, so cap to the most
  // "connected" rows (those sharing the most columns — i.e. the big clubs that
  // produce the best boards). Leaves the original small-row-count case untouched.
  const ROW_CAP = 250;
  if (rows.length > ROW_CAP) {
    rows = [...rows]
      .sort((a, b) => {
        const da = rowToCols.get(axisId(a))?.size ?? 0;
        const db = rowToCols.get(axisId(b))?.size ?? 0;
        return db - da || a.label.localeCompare(b.label);
      })
      .slice(0, ROW_CAP)
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  const seenBoards = new Set<string>();
  const candidateBoards: VerveGridBoard[] = [];

  for (let i = 0; i < rows.length - 2; i++) {
    for (let j = i + 1; j < rows.length - 1; j++) {
      for (let k = j + 1; k < rows.length; k++) {
        const rowTriplet = [rows[i], rows[j], rows[k]];
        const sharedColIds = Array.from(
          rowToCols.get(axisId(rowTriplet[0])) ?? new Set<string>(),
        ).filter(
          (colId) =>
            rowToCols.get(axisId(rowTriplet[1]))?.has(colId) &&
            rowToCols.get(axisId(rowTriplet[2]))?.has(colId),
        );

        if (sharedColIds.length < 3) {
          continue;
        }

        const sharedCols = sharedColIds
          .map((colId) => colMap.get(colId))
          .filter((col): col is GridCriterion => col !== undefined)
          .filter((col) => rowTriplet.every((row) => row.label !== col.label));

        if (sharedCols.length < 3) {
          continue;
        }

        const chosenCols = chooseColumnsForRows(rowTriplet, sharedCols, entryByKey);
        if (!chosenCols) {
          continue;
        }

        const boardKey = `${rowTriplet
          .map((row) => axisId(row))
          .sort()
          .join("|")}__${chosenCols.cols
          .map((col) => axisId(col))
          .sort()
          .join("|")}`;
        if (seenBoards.has(boardKey)) {
          continue;
        }
        seenBoards.add(boardKey);

        const cells = rowTriplet.flatMap((row, rowIdx) =>
          chosenCols.cols.map((col, colIdx) => ({
            rowIdx,
            colIdx,
            validPlayerIds: entryByKey.get(gridCellKey(row, col))!.playerIds,
          })),
        );

        candidateBoards.push({
          id: `verve_grid_board_${template.id}_${candidateBoards.length + 1}`,
          sport: "football",
          templateId: template.id,
          axisFamily: template.axisFamily,
          difficulty,
          score: chosenCols.score,
          rows: rowTriplet,
          cols: chosenCols.cols,
          cells,
        });
      }
    }
  }

  // Hard tier keeps the original ascending sort (smallest, rarest cells first);
  // easy prefers larger cells so the player has a forgiving pool to find.
  const ordered = candidateBoards.sort((a, b) =>
    preferLargerCells ? b.score - a.score : a.score - b.score,
  );
  const deduped = skipSignatures
    ? ordered.filter((board) => !skipSignatures.has(boardSignature(board)))
    : ordered;
  return deduped
    .slice(0, template.maxBoards)
    .map((board, index) => ({
      ...board,
      id: `verve_grid_board_${idPrefix}${template.id}_${index + 1}`,
    }));
}

function main() {
  if (!fs.existsSync(APPROVED_PATH)) {
    throw new Error(`Missing ${APPROVED_PATH}. Generate verveGridApprovedIndex first.`);
  }

  const approvedEntries = JSON.parse(
    fs.readFileSync(APPROVED_PATH, "utf8"),
  ) as ApprovedGridEntry[];
  const footballEntries = approvedEntries.filter((entry) => entry.sport === "football");

  // Hard tier: the original, unrestricted boards. Generated FIRST and with the
  // unchanged ("") id prefix so the live `verveGridBoards` ids stay byte-stable
  // (the additive reseed then only inserts the new easy/intermediate boards).
  const hardBoards = BOARD_TEMPLATES.flatMap((template) =>
    buildBoardsForTemplate(footballEntries, template, {
      difficulty: "hard",
    }),
  ).sort((a, b) => {
    if (a.templateId !== b.templateId) {
      return a.templateId.localeCompare(b.templateId);
    }
    return a.score - b.score;
  });

  // Easy + intermediate tiers are NEW boards (prefixed ids) that restrict the
  // team axes. They dedup against the hard signatures (and each other) so the
  // additive reseed never re-inserts a board already live as hard. Easy is built
  // before intermediate so the all-elite boards are claimed by the easy tier.
  const seenSignatures = new Set(hardBoards.map(boardSignature));

  const easyBoards = BOARD_TEMPLATES.flatMap((template) =>
    buildBoardsForTemplate(footballEntries, template, {
      allowedTeams: ELITE_TEAM_KEYS,
      preferLargerCells: true,
      idPrefix: "easy_",
      skipSignatures: seenSignatures,
      difficulty: "easy",
    }),
  );
  for (const board of easyBoards) seenSignatures.add(boardSignature(board));

  const intermediateBoards = BOARD_TEMPLATES.flatMap((template) =>
    buildBoardsForTemplate(footballEntries, template, {
      allowedTeams: TOP5_TEAM_KEYS,
      idPrefix: "inter_",
      skipSignatures: seenSignatures,
      difficulty: "intermediate",
    }),
  );

  // Re-derive the NEW boards' difficulty from their axes (an intermediate-pass
  // board that is in fact all-elite becomes easy). Hard-pass boards keep "hard"
  // to match the live, field-less rows the additive reseed leaves untouched.
  const newBoards = [...easyBoards, ...intermediateBoards].map((board) => ({
    ...board,
    difficulty: classifyDifficulty(board.rows, board.cols),
  }));

  const boards = [...hardBoards, ...newBoards];

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(boards, null, 2));

  const counts = boards.reduce<Record<string, number>>((acc, board) => {
    acc[board.templateId] = (acc[board.templateId] || 0) + 1;
    return acc;
  }, {});
  const byDifficulty = boards.reduce<Record<string, number>>((acc, board) => {
    acc[board.difficulty] = (acc[board.difficulty] || 0) + 1;
    return acc;
  }, {});
  console.log("By difficulty:", JSON.stringify(byDifficulty));

  console.log(
    `Built ${boards.length} VerveGrid boards -> ${path.relative(process.cwd(), OUTPUT_PATH)}`,
  );
  console.log(JSON.stringify(counts, null, 2));
}

main();
