#!/usr/bin/env npx tsx

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const APPROVED_PATH = path.join(DATA_DIR, "verveGridApprovedIndex.json");
const OUTPUT_PATH = path.join(DATA_DIR, "verveGridBoards.json");

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
  score: number;
  rows: GridCriterion[];
  cols: GridCriterion[];
  cells: Array<{
    rowIdx: number;
    colIdx: number;
    validPlayerIds: string[];
  }>;
};

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
    maxBoards: 72,
  },
  {
    id: "clubs-vs-positions",
    axisFamily: "teamxposition",
    rowType: "team",
    colType: "position",
    minCellSize: 3,
    maxCellSize: 18,
    maxBoards: 48,
  },
  {
    id: "clubs-vs-clubs",
    axisFamily: "teamxteam",
    rowType: "team",
    colType: "team",
    minCellSize: 3,
    maxCellSize: 10,
    maxBoards: 72,
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

function buildBoardsForTemplate(
  entries: ApprovedGridEntry[],
  template: BoardTemplate,
): VerveGridBoard[] {
  const eligibleEntries = entries.filter(
    (entry) =>
      entry.axisFamily === template.axisFamily &&
      entry.rowType === template.rowType &&
      entry.colType === template.colType &&
      entry.playerIds.length >= template.minCellSize &&
      entry.playerIds.length <= template.maxCellSize &&
      entry.rowLabel !== entry.colLabel,
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

  const rows = Array.from(rowMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
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
          score: chosenCols.score,
          rows: rowTriplet,
          cols: chosenCols.cols,
          cells,
        });
      }
    }
  }

  return candidateBoards
    .sort((a, b) => a.score - b.score)
    .slice(0, template.maxBoards)
    .map((board, index) => ({
      ...board,
      id: `verve_grid_board_${template.id}_${index + 1}`,
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

  const boards = BOARD_TEMPLATES.flatMap((template) =>
    buildBoardsForTemplate(footballEntries, template),
  ).sort((a, b) => {
    if (a.templateId !== b.templateId) {
      return a.templateId.localeCompare(b.templateId);
    }
    return a.score - b.score;
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(boards, null, 2));

  const counts = boards.reduce<Record<string, number>>((acc, board) => {
    acc[board.templateId] = (acc[board.templateId] || 0) + 1;
    return acc;
  }, {});

  console.log(
    `Built ${boards.length} VerveGrid boards -> ${path.relative(process.cwd(), OUTPUT_PATH)}`,
  );
  console.log(JSON.stringify(counts, null, 2));
}

main();
