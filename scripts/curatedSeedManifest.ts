import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");

export const CURATED_PARITY_SCOPE = "curated-runtime-football";
export const CURATED_PARITY_SPORT = "football";

export type CuratedParityMode =
  | "curated-support"
  | "higher-lower"
  | "verve-grid"
  | "who-am-i";

export type CuratedParityTable =
  | "sportsPlayers"
  | "sportsTeams"
  | "higherLowerPools"
  | "higherLowerFacts"
  | "verveGridApprovedIndex"
  | "verveGridBoards"
  | "whoAmIApprovedClues";

type ManifestConfig = {
  tableName: CuratedParityTable;
  artifactFile: string;
  mode: CuratedParityMode;
};

export type CuratedSeedManifestEntry = {
  tableName: CuratedParityTable;
  mode: CuratedParityMode;
  sport: typeof CURATED_PARITY_SPORT;
  artifactPath: string;
  artifactHash: string;
  recordCount: number;
  records: Record<string, unknown>[];
};

export type CuratedSeedManifest = {
  scopeKey: typeof CURATED_PARITY_SCOPE;
  sport: typeof CURATED_PARITY_SPORT;
  generatedAt: string;
  seedVersion: string;
  tables: CuratedSeedManifestEntry[];
};

const MANIFEST_CONFIGS: ManifestConfig[] = [
  {
    tableName: "sportsPlayers",
    artifactFile: "players.json",
    mode: "curated-support",
  },
  {
    tableName: "sportsTeams",
    artifactFile: "teams.json",
    mode: "curated-support",
  },
  {
    tableName: "higherLowerPools",
    artifactFile: "higherLowerPools.json",
    mode: "higher-lower",
  },
  {
    tableName: "higherLowerFacts",
    artifactFile: "higherLowerFacts.json",
    mode: "higher-lower",
  },
  {
    tableName: "verveGridApprovedIndex",
    artifactFile: "verveGridApprovedIndex.json",
    mode: "verve-grid",
  },
  {
    tableName: "verveGridBoards",
    artifactFile: "verveGridBoards.json",
    mode: "verve-grid",
  },
  {
    tableName: "whoAmIApprovedClues",
    artifactFile: "whoAmIApprovedClues.json",
    mode: "who-am-i",
  },
];

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null) {
      out[key] = value;
    }
  }
  return out;
}

function mapSeedRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const { id, ...rest } = stripNulls(raw);
  return { externalId: id as string, ...rest };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([key, entry]) => [key, canonicalize(entry)]));
  }

  return value;
}

function sortRecords(records: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...records].sort((a, b) =>
    String(a.externalId ?? "").localeCompare(String(b.externalId ?? "")),
  );
}

function hashRecords(records: Record<string, unknown>[]): string {
  const canonicalRecords = sortRecords(records).map((record) => canonicalize(record));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalRecords))
    .digest("hex");
}

function loadJsonArray(fileName: string): Record<string, unknown>[] {
  const fullPath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing curated artifact: ${fullPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array artifact at ${fullPath}`);
  }

  return parsed as Record<string, unknown>[];
}

export function buildCuratedSeedManifest(): CuratedSeedManifest {
  const generatedAt = new Date().toISOString();
  const tables = MANIFEST_CONFIGS.map((config) => {
    const records = loadJsonArray(config.artifactFile)
      .filter((record) => record.sport === CURATED_PARITY_SPORT)
      .map(mapSeedRecord);
    const artifactPath = path.relative(
      REPO_ROOT,
      path.join(DATA_DIR, config.artifactFile),
    );

    if (records.length === 0) {
      throw new Error(`Curated artifact ${artifactPath} has no ${CURATED_PARITY_SPORT} rows`);
    }

    return {
      tableName: config.tableName,
      mode: config.mode,
      sport: CURATED_PARITY_SPORT,
      artifactPath,
      artifactHash: hashRecords(records),
      recordCount: records.length,
      records: sortRecords(records),
    } satisfies CuratedSeedManifestEntry;
  });

  const seedVersionHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        tables.map((table) => ({
          tableName: table.tableName,
          artifactHash: table.artifactHash,
          recordCount: table.recordCount,
        })),
      ),
    )
    .digest("hex")
    .slice(0, 12);

  return {
    scopeKey: CURATED_PARITY_SCOPE,
    sport: CURATED_PARITY_SPORT,
    generatedAt,
    seedVersion: `curated-football-${seedVersionHash}`,
    tables,
  };
}
