import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  contentQaSummary,
  validateContentBatch,
  type ContentQaOptions,
  type ContentQuestionSeed,
  type ImageReference,
} from "../convex/lib/contentQa";

type CliArgs = {
  batchPath?: string;
  existingChecksumsPath?: string;
  nearDuplicateThreshold?: number;
  answerOveruseLimit?: number;
  publicRoot: string;
  help: boolean;
};

function usage() {
  return [
    "Usage: npm run content:qa -- <batch.(json|ts|js)> [options]",
    "",
    "Options:",
    "  --existing-checksums <file>  JSON/TS/TXT list of existing checksums or rows with checksum fields.",
    "  --near-threshold <number>    Prompt near-duplicate threshold, default 0.92.",
    "  --answer-overuse <number>    Warn when one answer appears more than N times per category, default 3.",
    "  --public-root <dir>          Local public root for absolute imageUrl refs, default ./public.",
  ].join("\n");
}

function parseNumberFlag(name: string, value: string | undefined) {
  if (value === undefined) throw new Error(`${name} requires a value.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }
  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    publicRoot: path.resolve(process.cwd(), "public"),
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--existing-checksums") {
      args.existingChecksumsPath = argv[++index];
      if (!args.existingChecksumsPath) {
        throw new Error("--existing-checksums requires a file path.");
      }
      continue;
    }
    if (arg === "--near-threshold") {
      args.nearDuplicateThreshold = parseNumberFlag(arg, argv[++index]);
      continue;
    }
    if (arg === "--answer-overuse") {
      args.answerOveruseLimit = parseNumberFlag(arg, argv[++index]);
      continue;
    }
    if (arg === "--public-root") {
      const value = argv[++index];
      if (!value) throw new Error("--public-root requires a directory path.");
      args.publicRoot = path.resolve(value);
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (args.batchPath) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }
    args.batchPath = arg;
  }

  return args;
}

function exportedBatch(moduleValue: Record<string, unknown>) {
  return (
    moduleValue.default ??
    moduleValue.questions ??
    moduleValue.batch ??
    moduleValue.contentQuestions
  );
}

async function loadJsonOrModule(filePath: string) {
  const absolutePath = path.resolve(filePath);
  const extension = path.extname(absolutePath).toLowerCase();
  const text = () => readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, "");
  if (extension === ".json") {
    return JSON.parse(text()) as unknown;
  }
  if (extension === ".txt") {
    return text()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const imported = (await import(pathToFileURL(absolutePath).href)) as Record<
    string,
    unknown
  >;
  return exportedBatch(imported);
}

function checksumList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string" && entry.trim()) return [entry.trim()];
      if (
        typeof entry === "object" &&
        entry !== null &&
        "checksum" in entry &&
        typeof entry.checksum === "string" &&
        entry.checksum.trim()
      ) {
        return [entry.checksum.trim()];
      }
      return [];
    });
  }
  if (typeof value === "object" && value !== null) {
    const maybeChecksums =
      "checksums" in value
        ? value.checksums
        : "existingChecksums" in value
          ? value.existingChecksums
          : undefined;
    return checksumList(maybeChecksums);
  }
  return [];
}

function looksRemote(value: string) {
  return /^https?:\/\//i.test(value);
}

function resolveImageUrl(
  imageUrl: string,
  batchPath: string,
  publicRoot: string,
) {
  if (looksRemote(imageUrl)) return null;
  if (path.isAbsolute(imageUrl) && !imageUrl.startsWith("/")) return imageUrl;
  if (imageUrl.startsWith("/")) {
    return path.join(publicRoot, imageUrl.slice(1));
  }
  if (imageUrl.startsWith("./") || imageUrl.startsWith("../")) {
    return path.resolve(path.dirname(path.resolve(batchPath)), imageUrl);
  }
  return path.resolve(publicRoot, imageUrl);
}

function makeImageReferenceExists(
  batchPath: string,
  publicRoot: string,
): NonNullable<ContentQaOptions["imageReferenceExists"]> {
  return (ref: ImageReference, _question: ContentQuestionSeed) => {
    if (ref.field === "imageId") return ref.value.trim().length > 0;
    const resolved = resolveImageUrl(ref.value, batchPath, publicRoot);
    return resolved === null ? true : existsSync(resolved);
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.batchPath) {
    throw new Error("Missing batch path.\n" + usage());
  }

  const rawBatch = await loadJsonOrModule(args.batchPath);
  const existingChecksums = args.existingChecksumsPath
    ? checksumList(await loadJsonOrModule(args.existingChecksumsPath))
    : [];
  const report = validateContentBatch(rawBatch, {
    existingChecksums,
    nearDuplicateThreshold: args.nearDuplicateThreshold,
    answerOveruseLimit: args.answerOveruseLimit,
    imageReferenceExists: makeImageReferenceExists(args.batchPath, args.publicRoot),
  });

  console.log(JSON.stringify(report, null, 2));
  console.error(contentQaSummary(report));
  process.exitCode = report.ok ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
