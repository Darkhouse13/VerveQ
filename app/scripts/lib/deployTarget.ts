import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "..", "..");

export const LIVE_CONFIRM_ENV = "CONFIRM_LIVE_DEPLOY";

export const KNOWN_LIVE_CONVEX_TARGETS = [
  {
    // 2026-07 migration: production moved from the dev-type deployment
    // admired-warthog-495 to the project's prod deployment; warthog is now
    // the dev/staging backend and is intentionally NOT guarded here.
    deploymentName: "different-lynx-153",
    hosts: ["verveq.com"],
  },
] as const;

export const CONVEX_TARGET_RESOLUTION_ORDER = [
  "1. Process env target variables: LEARN_SMOKE_CONVEX_URL, CONVEX_URL, VITE_CONVEX_URL, CONVEX_DEPLOYMENT. Empty values fail closed and never fall through.",
  "2. app/.env.local target variables, using the same keys, only when no process env target variable is present.",
  "3. If the selected source exposes multiple target variables, every non-empty value must resolve to the same deployment identity.",
] as const;

const DEFAULT_ENV_FILE_PATHS = [path.join(APP_DIR, ".env.local")];
const TARGET_ENV_KEYS = [
  "LEARN_SMOKE_CONVEX_URL",
  "CONVEX_URL",
  "VITE_CONVEX_URL",
  "CONVEX_DEPLOYMENT",
] as const;
const URL_ENV_KEYS = new Set<string>([
  "LEARN_SMOKE_CONVEX_URL",
  "CONVEX_URL",
  "VITE_CONVEX_URL",
]);
const KEY_PRIORITY = new Map<string, number>(
  TARGET_ENV_KEYS.map((key, index) => [key, index]),
);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type DeployTargetEnv = Record<string, string | undefined>;

export type ResolveConvexTargetOptions = {
  env?: DeployTargetEnv;
  envFilePaths?: string[];
};

export type GuardTargetOptions = ResolveConvexTargetOptions & {
  allowLive?: boolean;
};

export type ResolvedConvexTarget = {
  deploymentName: string | null;
  deploymentSpecifier: string | null;
  deploymentKind: string | null;
  convexUrl: string | null;
  host: string | null;
  source: string;
  sources: string[];
};

type TargetCandidate = {
  key: string;
  source: string;
  rawValue: string;
  deploymentName: string | null;
  deploymentSpecifier: string | null;
  deploymentKind: string | null;
  convexUrl: string | null;
  host: string | null;
  urlHost: string | null;
};

type CandidateGroup = {
  source: string;
  candidates: TargetCandidate[];
  emptyKeys: string[];
};

function stripInlineComment(rawValue: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < rawValue.length; index += 1) {
    const char = rawValue[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      if (index === 0 || /\s/.test(rawValue[index - 1])) {
        return rawValue.slice(0, index).trim();
      }
    }
  }

  return rawValue.trim();
}

function normalizeEnvValue(rawValue: string): string {
  const stripped = stripInlineComment(rawValue).trim();
  if (
    stripped.length >= 2 &&
    ((stripped.startsWith('"') && stripped.endsWith('"')) ||
      (stripped.startsWith("'") && stripped.endsWith("'")))
  ) {
    return stripped.slice(1, -1).trim();
  }
  return stripped;
}

function readEnvFile(envPath: string): DeployTargetEnv {
  const values: DeployTargetEnv = {};
  const content = readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = rawLine.slice(0, separatorIndex).trim();
    if (!key) continue;
    values[key] = normalizeEnvValue(rawLine.slice(separatorIndex + 1));
  }

  return values;
}

function hasOwnEnvValue(env: DeployTargetEnv, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(env, key);
}

function formatResolutionOrder(): string {
  return CONVEX_TARGET_RESOLUTION_ORDER.join(" ");
}

function deploymentNameFromHost(hostname: string): string | null {
  const lower = hostname.toLowerCase();
  if (LOCAL_HOSTS.has(lower)) return null;
  if (lower.endsWith(".convex.cloud") || lower.endsWith(".convex.site")) {
    return lower.split(".")[0] || null;
  }
  return null;
}

function parseDeploymentSpecifier(value: string): {
  deploymentName: string;
  deploymentKind: string | null;
} {
  const segments = value
    .split(":")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const deploymentName = segments[segments.length - 1];
  if (!deploymentName) {
    throw new Error(`Invalid CONVEX_DEPLOYMENT value "${value}".`);
  }
  return {
    deploymentName,
    deploymentKind: segments.length > 1 ? segments[0] : null,
  };
}

function parseTargetCandidate(
  key: string,
  value: string,
  source: string,
): TargetCandidate {
  const trimmed = value.trim();
  if (URL_ENV_KEYS.has(key)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch (error) {
      throw new Error(
        `Invalid Convex URL in ${source}.${key}: ${trimmed}${
          error instanceof Error ? ` (${error.message})` : ""
        }`,
      );
    }

    const host = parsed.hostname.toLowerCase();
    return {
      key,
      source,
      rawValue: trimmed,
      deploymentName: deploymentNameFromHost(host),
      deploymentSpecifier: null,
      deploymentKind: null,
      convexUrl: trimmed,
      host,
      urlHost: parsed.host.toLowerCase(),
    };
  }

  const { deploymentName, deploymentKind } = parseDeploymentSpecifier(trimmed);
  return {
    key,
    source,
    rawValue: trimmed,
    deploymentName,
    deploymentSpecifier: trimmed,
    deploymentKind,
    convexUrl: null,
    host: null,
    urlHost: null,
  };
}

function collectCandidates(env: DeployTargetEnv, source: string): CandidateGroup {
  const emptyKeys: string[] = [];
  const candidates: TargetCandidate[] = [];

  for (const key of TARGET_ENV_KEYS) {
    if (!hasOwnEnvValue(env, key)) continue;
    const value = env[key];
    if (!value || !value.trim()) {
      emptyKeys.push(key);
      continue;
    }
    candidates.push(parseTargetCandidate(key, value, source));
  }

  return { source, candidates, emptyKeys };
}

function candidateSource(candidate: TargetCandidate): string {
  return `${candidate.source}.${candidate.key}`;
}

function candidateDescription(candidate: TargetCandidate): string {
  const identity =
    candidate.deploymentName ??
    (candidate.host ? `host:${candidate.host}` : "unknown");
  return `${candidateSource(candidate)} -> ${identity}`;
}

function matchingLiveHost(host: string | null): string | null {
  if (!host) return null;
  const lower = host.toLowerCase();
  for (const target of KNOWN_LIVE_CONVEX_TARGETS) {
    const matchedHost = matchingHostForTarget(lower, target.hosts);
    if (matchedHost) return matchedHost;
  }
  return null;
}

function matchingHostForTarget(
  normalizedHost: string | null,
  knownHosts: readonly string[],
): string | null {
  if (!normalizedHost) return null;
  return (
    knownHosts.find((knownHost) => {
      const knownLower = knownHost.toLowerCase();
      return (
        normalizedHost === knownLower ||
        normalizedHost.endsWith(`.${knownLower}`)
      );
    }) ?? null
  );
}

function liveTargetForCandidate(candidate: TargetCandidate) {
  const deployment = candidate.deploymentName?.toLowerCase();
  return KNOWN_LIVE_CONVEX_TARGETS.find((target) => {
    if (deployment === target.deploymentName.toLowerCase()) return true;
    return Boolean(
      matchingHostForTarget(candidate.host?.toLowerCase() ?? null, target.hosts),
    );
  });
}

function liveTargetForResolved(target: ResolvedConvexTarget) {
  const deployment = target.deploymentName?.toLowerCase();
  return KNOWN_LIVE_CONVEX_TARGETS.find((knownTarget) => {
    if (deployment === knownTarget.deploymentName.toLowerCase()) return true;
    return Boolean(
      matchingHostForTarget(target.host?.toLowerCase() ?? null, knownTarget.hosts),
    );
  });
}

function candidateIdentity(candidate: TargetCandidate): string {
  if (candidate.deploymentName) {
    return `deployment:${candidate.deploymentName.toLowerCase()}`;
  }

  const liveTarget = liveTargetForCandidate(candidate);
  if (liveTarget) {
    return `deployment:${liveTarget.deploymentName.toLowerCase()}`;
  }

  if (candidate.urlHost) return `host:${candidate.urlHost}`;
  if (candidate.host) return `host:${candidate.host}`;
  return `unknown:${candidate.rawValue}`;
}

function candidatePriority(candidate: TargetCandidate): number {
  return KEY_PRIORITY.get(candidate.key) ?? TARGET_ENV_KEYS.length;
}

function resolveCandidateGroup(group: CandidateGroup): ResolvedConvexTarget {
  if (group.emptyKeys.length > 0) {
    throw new Error(
      `Convex target variable(s) were present but empty in ${group.source}: ${group.emptyKeys.join(
        ", ",
      )}. Refusing to fall through to another target source. Resolution order: ${formatResolutionOrder()}`,
    );
  }

  if (group.candidates.length === 0) {
    throw new Error(
      `Could not resolve a Convex target from ${group.source}. Resolution order: ${formatResolutionOrder()}`,
    );
  }

  const identities = new Map<string, TargetCandidate[]>();
  for (const candidate of group.candidates) {
    const identity = candidateIdentity(candidate);
    identities.set(identity, [...(identities.get(identity) ?? []), candidate]);
  }

  if (identities.size !== 1) {
    throw new Error(
      `Ambiguous Convex target resolution in ${group.source}: ${group.candidates
        .map(candidateDescription)
        .join("; ")}. Refusing to guess.`,
    );
  }

  const orderedCandidates = [...group.candidates].sort(
    (left, right) => candidatePriority(left) - candidatePriority(right),
  );
  const primary = orderedCandidates[0];
  const urlCandidate = orderedCandidates.find((candidate) => candidate.convexUrl);
  const deploymentCandidate = orderedCandidates.find(
    (candidate) => candidate.deploymentName,
  );
  const liveTarget = orderedCandidates
    .map(liveTargetForCandidate)
    .find(Boolean);

  return {
    deploymentName:
      deploymentCandidate?.deploymentName ?? liveTarget?.deploymentName ?? null,
    deploymentSpecifier: deploymentCandidate?.deploymentSpecifier ?? null,
    deploymentKind: deploymentCandidate?.deploymentKind ?? null,
    convexUrl: urlCandidate?.convexUrl ?? null,
    host: urlCandidate?.host ?? primary.host,
    source: group.source,
    sources: orderedCandidates.map(candidateSource),
  };
}

function sourceLabelForEnvFile(envFilePath: string): string {
  const relative = path.relative(APP_DIR, envFilePath).replace(/\\/g, "/");
  return relative.startsWith("..") ? envFilePath : `app/${relative}`;
}

export function resolveConvexTarget(
  options: ResolveConvexTargetOptions = {},
): ResolvedConvexTarget {
  const env = options.env ?? process.env;
  const processGroup = collectCandidates(env, "process.env");
  if (processGroup.emptyKeys.length > 0 || processGroup.candidates.length > 0) {
    return resolveCandidateGroup(processGroup);
  }

  const envFilePaths = options.envFilePaths ?? DEFAULT_ENV_FILE_PATHS;
  for (const envFilePath of envFilePaths) {
    if (!existsSync(envFilePath)) continue;
    const group = collectCandidates(
      readEnvFile(envFilePath),
      sourceLabelForEnvFile(envFilePath),
    );
    if (group.emptyKeys.length > 0 || group.candidates.length > 0) {
      return resolveCandidateGroup(group);
    }
  }

  const envFileList =
    envFilePaths.length > 0
      ? envFilePaths.map(sourceLabelForEnvFile).join(", ")
      : "(no env files configured)";
  throw new Error(
    `Could not resolve a Convex target. No process env target variable was set and no target was found in ${envFileList}. Refusing to guess. Resolution order: ${formatResolutionOrder()}`,
  );
}

function describeResolvedTarget(target: ResolvedConvexTarget): string {
  return [
    `deployment=${target.deploymentName ?? "(none)"}`,
    `url=${target.convexUrl ?? "(none)"}`,
    `host=${target.host ?? "(none)"}`,
    `source=${target.source}`,
    `vars=${target.sources.join(", ")}`,
  ].join("; ");
}

function liveMatchReason(target: ResolvedConvexTarget): string {
  const liveTarget = liveTargetForResolved(target);
  if (!liveTarget) return "no known live match";

  const reasons: string[] = [];
  if (
    target.deploymentName?.toLowerCase() ===
    liveTarget.deploymentName.toLowerCase()
  ) {
    reasons.push(`known live deployment ${liveTarget.deploymentName}`);
  }
  const host = matchingLiveHost(target.host);
  if (host) reasons.push(`known live host ${host}`);
  return reasons.join(" and ");
}

function liveBlockMessage(
  target: ResolvedConvexTarget,
  requiredConfirmation: string,
  detail: string,
): string {
  return [
    "Blocked live Convex target.",
    `Resolved target: ${describeResolvedTarget(target)}.`,
    `Reason: ${liveMatchReason(target)}.`,
    detail,
    `Intentional live use requires ${LIVE_CONFIRM_ENV}=${requiredConfirmation} exactly; generic booleans are refused.`,
  ].join(" ");
}

export function guardTarget(
  options: GuardTargetOptions = {},
): ResolvedConvexTarget {
  const target = resolveConvexTarget(options);
  const liveTarget = liveTargetForResolved(target);
  if (!liveTarget) return target;

  const requiredConfirmation = target.deploymentName ?? liveTarget.deploymentName;
  if (!options.allowLive) {
    throw new Error(
      liveBlockMessage(
        target,
        requiredConfirmation,
        "This caller did not opt in with guardTarget({ allowLive: true }).",
      ),
    );
  }

  const confirmation = (options.env ?? process.env)[LIVE_CONFIRM_ENV]?.trim();
  if (confirmation !== requiredConfirmation) {
    throw new Error(
      liveBlockMessage(
        target,
        requiredConfirmation,
        `${LIVE_CONFIRM_ENV} currently resolves to ${
          confirmation ? `"${confirmation}"` : "(unset)"
        }, which does not match the resolved live deployment.`,
      ),
    );
  }

  return target;
}
