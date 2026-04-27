import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  getCuratedParityTrustAnchorResult,
  type CuratedParityTrustAnchorResult,
  type CuratedParityTrustAnchorState,
} from "./curatedParityTrustAnchor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

export const FRONTEND_ENV_PATH = path.resolve(REPO_ROOT, "app", ".env.local");
export const CURATED_PARITY_LOCAL_OPS_DIR = path.resolve(REPO_ROOT, ".ops", "curated-parity");
export const CURATED_PARITY_LOCAL_CONFIG_PATH = path.resolve(
  CURATED_PARITY_LOCAL_OPS_DIR,
  "approved-targets.local.json",
);
export const CURATED_PARITY_APPROVAL_ARTIFACT_PATH = path.resolve(
  CURATED_PARITY_LOCAL_OPS_DIR,
  "destructive-approval.local.json",
);
export const CURATED_PARITY_APPLY_SESSION_PATH = path.resolve(
  CURATED_PARITY_LOCAL_OPS_DIR,
  "apply-session.local.json",
);
export const CURATED_PARITY_APPROVAL_HISTORY_PATH = path.resolve(
  CURATED_PARITY_LOCAL_OPS_DIR,
  "approval-history.local.json",
);
export const CURATED_PARITY_APPLY_OPERATION_ENV = "CURATED_PARITY_APPLY_OPERATION_ID";
export const CURATED_PARITY_APPROVAL_TTL_MINUTES_DEFAULT = 15;
export const CURATED_PARITY_APPLY_SESSION_TTL_MINUTES_DEFAULT = 30;
export const CURATED_PARITY_APPROVED_TARGETS_ENV = "CURATED_PARITY_APPROVED_TARGETS";
export const CURATED_PARITY_APPLY_CONFIRM_ENV = "CURATED_PARITY_APPLY_CONFIRM";

const ALLOWED_DESTRUCTIVE_DEPLOYMENT_KINDS = new Set(["dev", "preview"]);
const CURATED_PARITY_LOCAL_CONFIG_VERSION = 1;
const CURATED_PARITY_APPROVAL_ARTIFACT_VERSION = 2;
const CURATED_PARITY_APPLY_SESSION_VERSION = 1;
const CURATED_PARITY_APPROVAL_HISTORY_VERSION = 1;

export type ConvexTarget = {
  envPath: string;
  deploymentName: string;
  deploymentKind: string;
  deploymentSlug: string;
  convexUrl: string;
  convexSiteUrl: string | null;
  urlSlug: string;
};

export type CuratedParityApprovedTarget = {
  deploymentName: string;
  convexUrl: string;
  note?: string;
};

export type CuratedParityCommandMode = "status" | "inspect" | "approve" | "apply";

export type CuratedParityLocalConfig = {
  version: number;
  approvedTargets: CuratedParityApprovedTarget[];
  defaultApprovalTtlMinutes?: number;
};

type CuratedParityActor = {
  username: string | null;
  hostname: string | null;
  platform: NodeJS.Platform;
};

type SignedPayload<T> = T & { signature: string };

type CuratedParityApprovalArtifactBody = {
  version: number;
  approvalId: string;
  scopeKey: string;
  seedVersion: string;
  approvedAt: string;
  expiresAt: string;
  ttlMinutes: number;
  target: ConvexTarget;
  actor: CuratedParityActor;
  sourceConfigPath: string;
};

export type CuratedParityApprovalArtifact = SignedPayload<CuratedParityApprovalArtifactBody>;

type CuratedParityApplySessionBody = {
  version: number;
  sessionId: string;
  approvalId: string;
  scopeKey: string;
  seedVersion: string;
  startedAt: string;
  expiresAt: string;
  ttlMinutes: number;
  target: ConvexTarget;
  actor: CuratedParityActor;
  operationHash: string;
};

export type CuratedParityApplySession = SignedPayload<CuratedParityApplySessionBody>;

export type CuratedParityConsumedApprovalRecord = {
  approvalId: string;
  sessionId: string;
  scopeKey: string;
  seedVersion: string;
  deploymentName: string;
  convexUrl: string;
  consumedAt: string;
  outcome: "started" | "succeeded" | "failed";
  finalizedAt?: string;
};

type CuratedParityApprovalHistory = {
  version: number;
  approvals: CuratedParityConsumedApprovalRecord[];
};

export type CuratedParityApprovalArtifactState =
  | "not-required"
  | "missing"
  | "valid"
  | "expired"
  | "mismatch"
  | "invalid"
  | "consumed";

export type CuratedParityApplySessionState =
  | "missing"
  | "active"
  | "expired"
  | "invalid";

export type CuratedParityLocalAllowlistState =
  | "missing"
  | "malformed"
  | "matched"
  | "unmatched";

export type CuratedParitySafetyReport = {
  commandMode: CuratedParityCommandMode;
  target: ConvexTarget;
  allowed: boolean;
  applyReady: boolean;
  safeguard: string;
  reasons: string[];
  notes: string[];
  localConfigPath: string;
  localConfigLoaded: boolean;
  localAllowlistState: CuratedParityLocalAllowlistState;
  approvedTargets: CuratedParityApprovedTarget[];
  matchedApprovedTarget: CuratedParityApprovedTarget | null;
  malformedApprovedTargets: string[];
  approvalPath: string;
  approvalArtifact: CuratedParityApprovalArtifact | null;
  approvalArtifactState: CuratedParityApprovalArtifactState;
  approvalArtifactDetail: string | null;
  approvalHistoryPath: string;
  lastConsumedApproval: CuratedParityConsumedApprovalRecord | null;
  applySessionPath: string;
  applySession: CuratedParityApplySession | null;
  applySessionState: CuratedParityApplySessionState;
  applySessionDetail: string | null;
  ciDetected: boolean;
  legacyEnvApprovalDetected: string[];
  platformDetected: NodeJS.Platform;
  trustAnchorBackend: string;
  trustAnchorBackendAvailable: boolean;
  trustAnchorLocation: string;
  trustAnchorState: CuratedParityTrustAnchorState;
  trustAnchorDetail: string | null;
};

export type CuratedParityApplySessionValidationResult = {
  allowed: boolean;
  reasons: string[];
  session: CuratedParityApplySession | null;
};

export type CuratedParityGuardOptions = {
  commandMode: CuratedParityCommandMode;
  scopeKey: string;
  seedVersion: string;
};

/**
 * Stable testing seam: Exported for deterministic guard tests in curatedParityFixtures.ts.
 * This type surface is intentionally narrow to reduce fragile inference in the fixture layer.
 */
export type CuratedParityGuardEvaluationDependencies = {
  readEnvFile?: (envPath: string) => Record<string, string>;
  loadLocalConfig?: () => {
    config: CuratedParityLocalConfig | null;
    malformedEntries: string[];
  };
  isCiEnvironment?: () => boolean;
  getTrustAnchorResult?: (options?: {
    refresh?: boolean;
  }) => CuratedParityTrustAnchorResult;
  loadApprovalArtifact?: () => {
    artifact: CuratedParityApprovalArtifact | null;
    detail: string | null;
  };
  getApprovalStateForTarget?: (
    artifact: CuratedParityApprovalArtifact,
    target: ConvexTarget,
    scopeKey: string,
    seedVersion: string,
  ) => { state: CuratedParityApprovalArtifactState; detail: string | null };
  loadApprovalHistory?: () => CuratedParityApprovalHistory;
  loadApplySession?: () => {
    session: CuratedParityApplySession | null;
    detail: string | null;
  };
  getApplySessionStateForTarget?: (
    session: CuratedParityApplySession,
    target: ConvexTarget,
    scopeKey: string,
    seedVersion: string,
  ) => { state: CuratedParityApplySessionState; detail: string | null };
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

function readEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath} — run 'npx convex dev' in app first`);
  }

  const values: Record<string, string> = {};
  const content = fs.readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const value = normalizeEnvValue(rawLine.slice(separatorIndex + 1));
    if (key) {
      values[key] = value;
    }
  }

  return values;
}

function getRequiredEnvValue(
  envValues: Record<string, string>,
  key: string,
  missingMessage: string,
): string {
  const value = envValues[key]?.trim();
  if (!value) {
    throw new Error(missingMessage);
  }
  return value;
}

function parseUrlSlug(convexUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(convexUrl);
  } catch (error) {
    throw new Error(
      `Invalid VITE_CONVEX_URL in app/.env.local: ${convexUrl}${
        error instanceof Error ? ` (${error.message})` : ""
      }`,
    );
  }

  return parsed.hostname.split(".")[0] ?? "";
}

function parseDeploymentName(deploymentName: string): {
  deploymentKind: string;
  deploymentSlug: string;
} {
  const segments = deploymentName
    .split(":")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    throw new Error(
      `CONVEX_DEPLOYMENT must look like "dev:<name>" or "preview:<name>", got "${deploymentName}"`,
    );
  }

  return {
    deploymentKind: segments[0],
    deploymentSlug: segments[segments.length - 1],
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function signPayload(secret: string, payload: Record<string, unknown>): string {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}

function computeOperationHash(secret: string, operationId: string): string {
  return crypto.createHmac("sha256", secret).update(operationId).digest("hex");
}

function ensureLocalOpsDir(): void {
  fs.mkdirSync(CURATED_PARITY_LOCAL_OPS_DIR, { recursive: true });
}

function writeJsonFile(filePath: string, value: unknown): void {
  ensureLocalOpsDir();
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function removeFileIfExists(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.unlinkSync(filePath);
  return true;
}

function tryReadJsonFile(filePath: string): {
  value: unknown | null;
  error: string | null;
} {
  if (!fs.existsSync(filePath)) {
    return { value: null, error: null };
  }

  try {
    return {
      value: JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown,
      error: null,
    };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function parseLocalApprovedTargets(
  value: unknown,
): { targets: CuratedParityApprovedTarget[]; malformedEntries: string[] } {
  if (!Array.isArray(value)) {
    return {
      targets: [],
      malformedEntries: ['"approvedTargets" must be an array'],
    };
  }

  const targets: CuratedParityApprovedTarget[] = [];
  const malformedEntries: string[] = [];

  for (const [index, entry] of value.entries()) {
    if (!isObjectRecord(entry)) {
      malformedEntries.push(`approvedTargets[${index}] must be an object`);
      continue;
    }

    const deploymentName =
      typeof entry.deploymentName === "string" ? entry.deploymentName.trim() : "";
    const convexUrl = typeof entry.convexUrl === "string" ? entry.convexUrl.trim() : "";
    const note = typeof entry.note === "string" ? entry.note.trim() : undefined;

    if (!deploymentName || !convexUrl) {
      malformedEntries.push(
        `approvedTargets[${index}] must include non-empty deploymentName and convexUrl`,
      );
      continue;
    }

    targets.push({ deploymentName, convexUrl, note });
  }

  return { targets, malformedEntries };
}

function loadLocalConfig(): {
  config: CuratedParityLocalConfig | null;
  malformedEntries: string[];
} {
  const parsed = tryReadJsonFile(CURATED_PARITY_LOCAL_CONFIG_PATH);
  if (parsed.error) {
    return {
      config: null,
      malformedEntries: [`Local ops config is not valid JSON (${parsed.error})`],
    };
  }

  if (!parsed.value) {
    return { config: null, malformedEntries: [] };
  }

  if (!isObjectRecord(parsed.value)) {
    return {
      config: null,
      malformedEntries: ["Local ops config must be a JSON object"],
    };
  }

  const version =
    typeof parsed.value.version === "number"
      ? parsed.value.version
      : CURATED_PARITY_LOCAL_CONFIG_VERSION;
  if (version !== CURATED_PARITY_LOCAL_CONFIG_VERSION) {
    return {
      config: null,
      malformedEntries: [
        `Unsupported local ops config version "${String(parsed.value.version)}"; expected ${CURATED_PARITY_LOCAL_CONFIG_VERSION}`,
      ],
    };
  }

  const { targets, malformedEntries } = parseLocalApprovedTargets(parsed.value.approvedTargets);
  const defaultApprovalTtlMinutes =
    typeof parsed.value.defaultApprovalTtlMinutes === "number"
      ? parsed.value.defaultApprovalTtlMinutes
      : undefined;

  return {
    config: {
      version,
      approvedTargets: targets,
      defaultApprovalTtlMinutes,
    },
    malformedEntries,
  };
}

function getSafeUsername(): string | null {
  try {
    return os.userInfo().username;
  } catch {
    return process.env.USERNAME?.trim() || process.env.USER?.trim() || null;
  }
}

function getSafeHostname(): string | null {
  try {
    return os.hostname();
  } catch {
    return process.env.COMPUTERNAME?.trim() || process.env.HOSTNAME?.trim() || null;
  }
}

function getLocalActor(): CuratedParityActor {
  return {
    username: getSafeUsername(),
    hostname: getSafeHostname(),
    platform: process.platform,
  };
}

function verifySignedPayload<T extends Record<string, unknown>>(
  value: unknown,
  expectedVersion: number,
): { payload: SignedPayload<T> | null; detail: string | null } {
  if (!isObjectRecord(value)) {
    return { payload: null, detail: "Payload must be a JSON object" };
  }

  if (value.version !== expectedVersion) {
    return {
      payload: null,
      detail: `Unsupported payload version "${String(value.version)}"`,
    };
  }

  if (typeof value.signature !== "string" || !value.signature.trim()) {
    return { payload: null, detail: 'Payload is missing a non-empty "signature"' };
  }

  const trustAnchor = getCuratedParityTrustAnchorResult();
  if (!trustAnchor.secretBase64) {
    return {
      payload: null,
      detail:
        trustAnchor.detail ||
        `Curated parity trust anchor is unavailable at ${trustAnchor.location}`,
    };
  }

  const { signature, ...unsigned } = value;
  const expectedSignature = signPayload(trustAnchor.secretBase64, unsigned);
  if (signature !== expectedSignature) {
    return { payload: null, detail: "Payload signature did not verify" };
  }

  return { payload: value as SignedPayload<T>, detail: null };
}

function loadApprovalHistory(): CuratedParityApprovalHistory {
  const parsed = tryReadJsonFile(CURATED_PARITY_APPROVAL_HISTORY_PATH);
  if (parsed.error || !parsed.value || !isObjectRecord(parsed.value)) {
    return {
      version: CURATED_PARITY_APPROVAL_HISTORY_VERSION,
      approvals: [],
    };
  }

  const approvals: CuratedParityConsumedApprovalRecord[] = Array.isArray(parsed.value.approvals)
    ? parsed.value.approvals.filter(isObjectRecord).map((entry) => ({
        approvalId: typeof entry.approvalId === "string" ? entry.approvalId : "",
        sessionId: typeof entry.sessionId === "string" ? entry.sessionId : "",
        scopeKey: typeof entry.scopeKey === "string" ? entry.scopeKey : "",
        seedVersion: typeof entry.seedVersion === "string" ? entry.seedVersion : "",
        deploymentName: typeof entry.deploymentName === "string" ? entry.deploymentName : "",
        convexUrl: typeof entry.convexUrl === "string" ? entry.convexUrl : "",
        consumedAt: typeof entry.consumedAt === "string" ? entry.consumedAt : "",
        outcome:
          entry.outcome === "started" || entry.outcome === "succeeded" || entry.outcome === "failed"
            ? entry.outcome
            : "failed",
        finalizedAt: typeof entry.finalizedAt === "string" ? entry.finalizedAt : undefined,
      }))
    : [];

  return {
    version: CURATED_PARITY_APPROVAL_HISTORY_VERSION,
    approvals: approvals.filter((entry) => entry.approvalId),
  };
}

function writeApprovalHistory(history: CuratedParityApprovalHistory): void {
  writeJsonFile(CURATED_PARITY_APPROVAL_HISTORY_PATH, history);
}

function getConsumedApprovalById(
  history: CuratedParityApprovalHistory,
  approvalId: string,
): CuratedParityConsumedApprovalRecord | null {
  return history.approvals.find((entry) => entry.approvalId === approvalId) ?? null;
}

function getLatestConsumedApprovalForCurrentTarget(
  history: CuratedParityApprovalHistory,
  target: ConvexTarget,
  scopeKey: string,
  seedVersion: string,
): CuratedParityConsumedApprovalRecord | null {
  const matches = history.approvals
    .filter(
      (entry) =>
        entry.scopeKey === scopeKey &&
        entry.seedVersion === seedVersion &&
        entry.deploymentName === target.deploymentName &&
        entry.convexUrl === target.convexUrl,
    )
    .sort((left, right) => right.consumedAt.localeCompare(left.consumedAt));

  return matches[0] ?? null;
}

function appendConsumedApproval(record: CuratedParityConsumedApprovalRecord): void {
  const history = loadApprovalHistory();
  history.approvals = history.approvals.filter((entry) => entry.approvalId !== record.approvalId);
  history.approvals.push(record);
  writeApprovalHistory(history);
}

function finalizeConsumedApproval(approvalId: string, outcome: "succeeded" | "failed"): void {
  const history = loadApprovalHistory();
  const existing = history.approvals.find((entry) => entry.approvalId === approvalId);
  if (!existing) {
    return;
  }

  existing.outcome = outcome;
  existing.finalizedAt = new Date().toISOString();
  writeApprovalHistory(history);
}

function parseApprovalArtifact(
  value: unknown,
): { artifact: CuratedParityApprovalArtifact | null; detail: string | null } {
  const result = verifySignedPayload<CuratedParityApprovalArtifactBody>(
    value,
    CURATED_PARITY_APPROVAL_ARTIFACT_VERSION,
  );
  return {
    artifact: result.payload,
    detail: result.detail,
  };
}

function loadApprovalArtifact(): {
  artifact: CuratedParityApprovalArtifact | null;
  detail: string | null;
} {
  const parsed = tryReadJsonFile(CURATED_PARITY_APPROVAL_ARTIFACT_PATH);
  if (parsed.error) {
    return {
      artifact: null,
      detail: `Approval artifact is not valid JSON (${parsed.error})`,
    };
  }

  if (!parsed.value) {
    return { artifact: null, detail: null };
  }

  return parseApprovalArtifact(parsed.value);
}

function parseApplySession(
  value: unknown,
): { session: CuratedParityApplySession | null; detail: string | null } {
  const result = verifySignedPayload<CuratedParityApplySessionBody>(
    value,
    CURATED_PARITY_APPLY_SESSION_VERSION,
  );
  return {
    session: result.payload,
    detail: result.detail,
  };
}

function loadApplySession(): {
  session: CuratedParityApplySession | null;
  detail: string | null;
} {
  const parsed = tryReadJsonFile(CURATED_PARITY_APPLY_SESSION_PATH);
  if (parsed.error) {
    return {
      session: null,
      detail: `Apply session is not valid JSON (${parsed.error})`,
    };
  }

  if (!parsed.value) {
    return { session: null, detail: null };
  }

  return parseApplySession(parsed.value);
}

function isCiEnvironment(): boolean {
  return (
    process.env.CI?.trim() === "true" ||
    process.env.GITHUB_ACTIONS?.trim() === "true" ||
    process.env.BUILDKITE?.trim() === "true" ||
    process.env.TF_BUILD?.trim() === "True"
  );
}

function sameTargetIdentity(
  left: Pick<ConvexTarget, "deploymentName" | "convexUrl" | "deploymentKind" | "urlSlug">,
  right: Pick<ConvexTarget, "deploymentName" | "convexUrl" | "deploymentKind" | "urlSlug">,
): boolean {
  return (
    left.deploymentName === right.deploymentName &&
    left.convexUrl === right.convexUrl &&
    left.deploymentKind === right.deploymentKind &&
    left.urlSlug === right.urlSlug
  );
}

function getApprovalStateForTarget(
  artifact: CuratedParityApprovalArtifact,
  target: ConvexTarget,
  scopeKey: string,
  seedVersion: string,
): { state: CuratedParityApprovalArtifactState; detail: string | null } {
  const history = loadApprovalHistory();
  const consumed = getConsumedApprovalById(history, artifact.approvalId);
  if (consumed) {
    removeFileIfExists(CURATED_PARITY_APPROVAL_ARTIFACT_PATH);
    return {
      state: "consumed",
      detail: `Approval ${artifact.approvalId} was already consumed at ${consumed.consumedAt} (${consumed.outcome})`,
    };
  }

  const expiresAt = Date.parse(artifact.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    removeFileIfExists(CURATED_PARITY_APPROVAL_ARTIFACT_PATH);
    return {
      state: "invalid",
      detail: `Approval artifact had invalid expiresAt "${artifact.expiresAt}" and was deleted`,
    };
  }

  if (Date.now() >= expiresAt) {
    removeFileIfExists(CURATED_PARITY_APPROVAL_ARTIFACT_PATH);
    return {
      state: "expired",
      detail: `Approval expired at ${artifact.expiresAt} and was deleted`,
    };
  }

  if (!sameTargetIdentity(artifact.target, target)) {
    removeFileIfExists(CURATED_PARITY_APPROVAL_ARTIFACT_PATH);
    return {
      state: "mismatch",
      detail: "Approval artifact targeted a different deployment and was deleted",
    };
  }

  if (artifact.scopeKey !== scopeKey || artifact.seedVersion !== seedVersion) {
    removeFileIfExists(CURATED_PARITY_APPROVAL_ARTIFACT_PATH);
    return {
      state: "mismatch",
      detail:
        "Approval artifact did not match the current curated parity scope or manifest seed version and was deleted",
    };
  }

  return {
    state: "valid",
    detail: `Approval ${artifact.approvalId} is valid until ${artifact.expiresAt}`,
  };
}

function getApplySessionStateForTarget(
  session: CuratedParityApplySession,
  target: ConvexTarget,
  scopeKey: string,
  seedVersion: string,
): { state: CuratedParityApplySessionState; detail: string | null } {
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    removeFileIfExists(CURATED_PARITY_APPLY_SESSION_PATH);
    return {
      state: "invalid",
      detail: `Apply session had invalid expiresAt "${session.expiresAt}" and was deleted`,
    };
  }

  if (Date.now() >= expiresAt) {
    removeFileIfExists(CURATED_PARITY_APPLY_SESSION_PATH);
    return {
      state: "expired",
      detail: `Apply session expired at ${session.expiresAt} and was deleted`,
    };
  }

  if (
    !sameTargetIdentity(session.target, target) ||
    session.scopeKey !== scopeKey ||
    session.seedVersion !== seedVersion
  ) {
    removeFileIfExists(CURATED_PARITY_APPLY_SESSION_PATH);
    return {
      state: "invalid",
      detail: "Stale apply session did not match the current target or manifest and was deleted",
    };
  }

  return {
    state: "active",
    detail: `Apply session ${session.sessionId} is active until ${session.expiresAt}`,
  };
}

export function resolveConvexTarget(): ConvexTarget {
  const envValues = readEnvFile(FRONTEND_ENV_PATH);
  const convexUrl = getRequiredEnvValue(
    envValues,
    "VITE_CONVEX_URL",
    "VITE_CONVEX_URL not found in app/.env.local",
  );
  const deploymentName = getRequiredEnvValue(
    envValues,
    "CONVEX_DEPLOYMENT",
    "CONVEX_DEPLOYMENT not found in app/.env.local",
  );
  const { deploymentKind, deploymentSlug } = parseDeploymentName(deploymentName);
  const urlSlug = parseUrlSlug(convexUrl);

  return {
    envPath: FRONTEND_ENV_PATH,
    deploymentName,
    deploymentKind,
    deploymentSlug,
    convexUrl,
    convexSiteUrl: envValues.VITE_CONVEX_SITE_URL?.trim() || null,
    urlSlug,
  };
}

export function buildCuratedParityLocalConfigTemplate(
  target: ConvexTarget,
): CuratedParityLocalConfig {
  return {
    version: CURATED_PARITY_LOCAL_CONFIG_VERSION,
    approvedTargets: [
      {
        deploymentName: target.deploymentName,
        convexUrl: target.convexUrl,
        note: "Replace or remove this example entry so only deliberate dev/preview targets remain approved",
      },
    ],
    defaultApprovalTtlMinutes: CURATED_PARITY_APPROVAL_TTL_MINUTES_DEFAULT,
  };
}

export function evaluateCuratedParityDestructiveGuard(
  target: ConvexTarget,
  options: CuratedParityGuardOptions,
  dependencies: CuratedParityGuardEvaluationDependencies = {},
): CuratedParitySafetyReport {
  const readEnv = dependencies.readEnvFile ?? readEnvFile;
  const readLocalConfig = dependencies.loadLocalConfig ?? loadLocalConfig;
  const detectCi = dependencies.isCiEnvironment ?? isCiEnvironment;
  const readTrustAnchor = dependencies.getTrustAnchorResult ?? getCuratedParityTrustAnchorResult;
  const readApprovalArtifact = dependencies.loadApprovalArtifact ?? loadApprovalArtifact;
  const evaluateApprovalState =
    dependencies.getApprovalStateForTarget ?? getApprovalStateForTarget;
  const readApprovalHistory = dependencies.loadApprovalHistory ?? loadApprovalHistory;
  const readApplySession = dependencies.loadApplySession ?? loadApplySession;
  const evaluateApplySessionState =
    dependencies.getApplySessionStateForTarget ?? getApplySessionStateForTarget;
  const safeguard =
    "fail-closed exact deployment+URL local allowlist, platform-specific non-repo-local trust anchor, signed short-lived approval artifacts, one-time-use consumed approval history, in-memory apply operation token, and CI refusal by default";
  const reasons: string[] = [];
  const notes: string[] = [];
  const envValues = readEnv(FRONTEND_ENV_PATH);
  const legacyEnvApprovalDetected = [
    ...new Set(
      [CURATED_PARITY_APPROVED_TARGETS_ENV, CURATED_PARITY_APPLY_CONFIRM_ENV].filter((key) => {
        const processValue = process.env[key]?.trim();
        const fileValue = envValues[key]?.trim();
        return Boolean(processValue || fileValue);
      }),
    ),
  ];

  if (legacyEnvApprovalDetected.length > 0) {
    notes.push(
      `Legacy env approval variables are ignored by the current local ops workflow: ${legacyEnvApprovalDetected.join(", ")}.`,
    );
  }

  if (!ALLOWED_DESTRUCTIVE_DEPLOYMENT_KINDS.has(target.deploymentKind)) {
    reasons.push(
      `Deployment kind "${target.deploymentKind}" is blocked. Destructive curated parity only allows exact approved dev/preview deployments.`,
    );
  }

  if (target.deploymentKind === "dev" && target.deploymentSlug !== target.urlSlug) {
    reasons.push(
      `app/.env.local is inconsistent: CONVEX_DEPLOYMENT resolves to slug "${target.deploymentSlug}" but VITE_CONVEX_URL resolves to "${target.urlSlug}".`,
    );
  } else if (target.deploymentSlug !== target.urlSlug) {
    notes.push(
      `Deployment slug "${target.deploymentSlug}" and URL slug "${target.urlSlug}" differ, so approval falls back to the exact deployment+URL allowlist pair.`,
    );
  }

  const { config: localConfig, malformedEntries } = readLocalConfig();
  const approvedTargets = localConfig?.approvedTargets ?? [];
  const matchedApprovedTarget =
    approvedTargets.find(
      (approvedTarget) =>
        approvedTarget.deploymentName === target.deploymentName &&
        approvedTarget.convexUrl === target.convexUrl,
    ) ?? null;
  const localAllowlistState: CuratedParityLocalAllowlistState = !localConfig
    ? malformedEntries.length > 0
      ? "malformed"
      : "missing"
    : malformedEntries.length > 0
      ? "malformed"
      : matchedApprovedTarget
        ? "matched"
        : "unmatched";

  if (localAllowlistState === "missing") {
    reasons.push(
      `Missing local allowlist at ${path.relative(REPO_ROOT, CURATED_PARITY_LOCAL_CONFIG_PATH)}. Create it deliberately to allow exact approved dev/preview targets.`,
    );
  } else if (localAllowlistState === "malformed") {
    reasons.push(`Local allowlist is malformed: ${malformedEntries.join(", ")}.`);
  } else if (localAllowlistState === "unmatched") {
    reasons.push(
      `Current target ${target.deploymentName} | ${target.convexUrl} is not present in ${path.relative(REPO_ROOT, CURATED_PARITY_LOCAL_CONFIG_PATH)}.`,
    );
  }

  const ciDetected = detectCi();
  if (ciDetected) {
    notes.push("CI environment detected.");
  }

  const trustAnchor = readTrustAnchor({ refresh: true });
  const trustAnchorState = trustAnchor.state;
  if (trustAnchorState === "missing") {
    notes.push(
      `Curated parity trust anchor is not initialized yet at ${trustAnchor.location}. The approve step will create it using the ${trustAnchor.backendSelected} backend for this local user.`,
    );
  } else if (trustAnchorState === "unsupported" || trustAnchorState === "unusable") {
    notes.push(trustAnchor.detail || "Curated parity trust anchor is unavailable.");
  }

  const approvalArtifactLoad = readApprovalArtifact();
  let approvalArtifact = approvalArtifactLoad.artifact;
  let approvalArtifactState: CuratedParityApprovalArtifactState = "missing";
  let approvalArtifactDetail = approvalArtifactLoad.detail;

  if (approvalArtifactLoad.detail) {
    approvalArtifactState = "invalid";
  } else if (approvalArtifact) {
    const approvalState = evaluateApprovalState(
      approvalArtifact,
      target,
      options.scopeKey,
      options.seedVersion,
    );
    approvalArtifactState = approvalState.state;
    approvalArtifactDetail = approvalState.detail;
    if (approvalState.state !== "valid") {
      approvalArtifact = null;
    }
  } else {
    const latestConsumedApproval = getLatestConsumedApprovalForCurrentTarget(
      readApprovalHistory(),
      target,
      options.scopeKey,
      options.seedVersion,
    );
    if (latestConsumedApproval) {
      approvalArtifactState = "consumed";
      approvalArtifactDetail = `Last matching approval ${latestConsumedApproval.approvalId} was already consumed at ${latestConsumedApproval.consumedAt} (${latestConsumedApproval.outcome})`;
    }
  }

  const applySessionLoad = readApplySession();
  let applySession = applySessionLoad.session;
  let applySessionState: CuratedParityApplySessionState = "missing";
  let applySessionDetail = applySessionLoad.detail;

  if (applySessionLoad.detail) {
    applySessionState = "invalid";
    applySession = null;
  } else if (applySession) {
    const state = evaluateApplySessionState(
      applySession,
      target,
      options.scopeKey,
      options.seedVersion,
    );
    applySessionState = state.state;
    applySessionDetail = state.detail;
    if (state.state !== "active") {
      applySession = null;
    }
  }

  if (applySessionState === "active") {
    reasons.push(
      `An active apply session already exists at ${path.relative(REPO_ROOT, CURATED_PARITY_APPLY_SESSION_PATH)}. Wait for it to finish or let it expire before approving/applying again.`,
    );
  }

  const baseReady = reasons.length === 0;
  const applyReady =
    baseReady &&
    !ciDetected &&
    trustAnchorState === "available" &&
    approvalArtifactState === "valid" &&
    applySessionState === "missing";

  let allowed = false;
  switch (options.commandMode) {
    case "status":
    case "inspect":
      allowed = true;
      if (trustAnchorState !== "available") {
        reasons.push(
          trustAnchorState === "missing"
            ? `Curated parity trust anchor is not initialized yet at ${trustAnchor.location}. Run approve to create it using the ${trustAnchor.backendSelected} backend.`
            : trustAnchor.detail ||
                "Curated parity trust anchor is unavailable, so inspect cannot mark destructive parity as ready.",
        );
      }
      break;
    case "approve":
      allowed = baseReady && !ciDetected;
      if (trustAnchorState === "unsupported" || trustAnchorState === "unusable") {
        reasons.push(
          trustAnchor.detail ||
            "Curated parity trust anchor is unavailable, so a signed approval cannot be created.",
        );
        allowed = false;
      }
      if (ciDetected) {
        reasons.push(
          "Destructive curated parity approval cannot be generated in CI. Run the approve step from a local/dev operator workspace.",
        );
      }
      break;
    case "apply":
      allowed = applyReady;
      if (ciDetected) {
        reasons.push(
          "Destructive curated parity apply is blocked in CI. Use the local ops approval flow from a local/dev workspace.",
        );
      }
      if (trustAnchorState !== "available") {
        reasons.push(
          trustAnchor.detail ||
            "Curated parity trust anchor is unavailable, so approval/session signatures cannot be validated safely.",
        );
      }
      if (approvalArtifactState !== "valid") {
        reasons.push(
          `A valid unconsumed approval artifact is required at ${path.relative(REPO_ROOT, CURATED_PARITY_APPROVAL_ARTIFACT_PATH)}.`,
        );
      }
      break;
  }

  return {
    commandMode: options.commandMode,
    target,
    allowed,
    applyReady,
    safeguard,
    reasons,
    notes,
    localConfigPath: CURATED_PARITY_LOCAL_CONFIG_PATH,
    localConfigLoaded: Boolean(localConfig),
    localAllowlistState,
    approvedTargets,
    matchedApprovedTarget,
    malformedApprovedTargets: malformedEntries,
    approvalPath: CURATED_PARITY_APPROVAL_ARTIFACT_PATH,
    approvalArtifact,
    approvalArtifactState,
    approvalArtifactDetail,
    approvalHistoryPath: CURATED_PARITY_APPROVAL_HISTORY_PATH,
    lastConsumedApproval: getLatestConsumedApprovalForCurrentTarget(
      readApprovalHistory(),
      target,
      options.scopeKey,
      options.seedVersion,
    ),
    applySessionPath: CURATED_PARITY_APPLY_SESSION_PATH,
    applySession,
    applySessionState,
    applySessionDetail,
    ciDetected,
    legacyEnvApprovalDetected,
    platformDetected: trustAnchor.platformDetected,
    trustAnchorBackend: trustAnchor.backendSelected,
    trustAnchorBackendAvailable: trustAnchor.backendAvailable,
    trustAnchorLocation: trustAnchor.location,
    trustAnchorState,
    trustAnchorDetail: trustAnchor.detail,
  };
}

export function createCuratedParityApprovalArtifact(options: {
  target: ConvexTarget;
  scopeKey: string;
  seedVersion: string;
}): CuratedParityApprovalArtifact {
  const { config } = loadLocalConfig();
  const ttlMinutes = Math.max(
    1,
    Math.floor(config?.defaultApprovalTtlMinutes ?? CURATED_PARITY_APPROVAL_TTL_MINUTES_DEFAULT),
  );
  const trustAnchor = getCuratedParityTrustAnchorResult({ ensure: true, refresh: true });
  if (!trustAnchor.secretBase64) {
    throw new Error(
      trustAnchor.detail ||
        `Curated parity trust anchor is unavailable at ${trustAnchor.location}; approval cannot be signed.`,
    );
  }
  const approvedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  const artifactBody: CuratedParityApprovalArtifactBody = {
    version: CURATED_PARITY_APPROVAL_ARTIFACT_VERSION,
    approvalId: crypto.randomUUID(),
    scopeKey: options.scopeKey,
    seedVersion: options.seedVersion,
    approvedAt,
    expiresAt,
    ttlMinutes,
    target: options.target,
    actor: getLocalActor(),
    sourceConfigPath: CURATED_PARITY_LOCAL_CONFIG_PATH,
  };

  const artifact: CuratedParityApprovalArtifact = {
    ...artifactBody,
    signature: signPayload(trustAnchor.secretBase64, artifactBody),
  };

  writeJsonFile(CURATED_PARITY_APPROVAL_ARTIFACT_PATH, artifact);
  return artifact;
}

export function clearCuratedParityApprovalArtifact(): boolean {
  return removeFileIfExists(CURATED_PARITY_APPROVAL_ARTIFACT_PATH);
}

export function startCuratedParityApplySession(options: {
  target: ConvexTarget;
  scopeKey: string;
  seedVersion: string;
  approvalArtifact: CuratedParityApprovalArtifact;
}): {
  session: CuratedParityApplySession;
  operationId: string;
} {
  const trustAnchor = getCuratedParityTrustAnchorResult({ refresh: true });
  if (!trustAnchor.secretBase64) {
    throw new Error(
      trustAnchor.detail ||
        `Curated parity trust anchor is unavailable at ${trustAnchor.location}; apply session cannot be signed.`,
    );
  }
  const operationId = crypto.randomUUID();
  const sessionBody: CuratedParityApplySessionBody = {
    version: CURATED_PARITY_APPLY_SESSION_VERSION,
    sessionId: crypto.randomUUID(),
    approvalId: options.approvalArtifact.approvalId,
    scopeKey: options.scopeKey,
    seedVersion: options.seedVersion,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + CURATED_PARITY_APPLY_SESSION_TTL_MINUTES_DEFAULT * 60_000,
    ).toISOString(),
    ttlMinutes: CURATED_PARITY_APPLY_SESSION_TTL_MINUTES_DEFAULT,
    target: options.target,
    actor: getLocalActor(),
    operationHash: computeOperationHash(trustAnchor.secretBase64, operationId),
  };

  const session: CuratedParityApplySession = {
    ...sessionBody,
    signature: signPayload(trustAnchor.secretBase64, sessionBody),
  };

  appendConsumedApproval({
    approvalId: options.approvalArtifact.approvalId,
    sessionId: session.sessionId,
    scopeKey: options.scopeKey,
    seedVersion: options.seedVersion,
    deploymentName: options.target.deploymentName,
    convexUrl: options.target.convexUrl,
    consumedAt: session.startedAt,
    outcome: "started",
  });

  writeJsonFile(CURATED_PARITY_APPLY_SESSION_PATH, session);
  removeFileIfExists(CURATED_PARITY_APPROVAL_ARTIFACT_PATH);

  return { session, operationId };
}

export function finishCuratedParityApplySession(options: {
  approvalId: string;
  sessionId: string;
  outcome: "succeeded" | "failed";
}): void {
  finalizeConsumedApproval(options.approvalId, options.outcome);

  const applySessionLoad = loadApplySession();
  if (applySessionLoad.session && applySessionLoad.session.sessionId === options.sessionId) {
    removeFileIfExists(CURATED_PARITY_APPLY_SESSION_PATH);
  }
}

export function validateCuratedParityApplySession(
  target: ConvexTarget,
  options: {
    scopeKey: string;
    seedVersion: string;
    operationId: string | null;
  },
): CuratedParityApplySessionValidationResult {
  const reasons: string[] = [];

  if (!options.operationId) {
    reasons.push(
      `Missing ${CURATED_PARITY_APPLY_OPERATION_ENV}. Do not run seedSportsDatabase.ts --replace directly; destructive parity table reseeds must stay inside the wrapper-owned approved apply session.`,
    );
    return { allowed: false, reasons, session: null };
  }

  const sessionLoad = loadApplySession();
  if (sessionLoad.detail) {
    reasons.push(sessionLoad.detail);
    return { allowed: false, reasons, session: null };
  }

  if (!sessionLoad.session) {
    reasons.push(
      `Missing active apply session at ${path.relative(REPO_ROOT, CURATED_PARITY_APPLY_SESSION_PATH)}. Direct destructive seed entry points stay blocked unless runCuratedParityWorkflow.ts has already opened the matching apply session.`,
    );
    return { allowed: false, reasons, session: null };
  }

  const session = sessionLoad.session;
  const state = getApplySessionStateForTarget(
    session,
    target,
    options.scopeKey,
    options.seedVersion,
  );

  if (state.state !== "active") {
    reasons.push(state.detail || "Apply session is not active");
    return { allowed: false, reasons, session: null };
  }

  const trustAnchor = getCuratedParityTrustAnchorResult({ refresh: true });
  if (!trustAnchor.secretBase64) {
    reasons.push(
      trustAnchor.detail ||
        `Curated parity trust anchor is unavailable at ${trustAnchor.location}.`,
    );
    return { allowed: false, reasons, session: null };
  }

  if (
    computeOperationHash(trustAnchor.secretBase64, options.operationId) !== session.operationHash
  ) {
    reasons.push(
      "Apply operation token did not match the active session. Direct destructive seed entry points only accept the wrapper-owned in-memory operation token.",
    );
    return { allowed: false, reasons, session: null };
  }

  return { allowed: true, reasons: [], session };
}

export type CuratedParityStatusClassification = {
  statusSummary: "READY" | "ALLOWED" | "BLOCKED";
  statusCode: string;
  statusDetail: string;
};

function getCuratedParityModeLabel(commandMode: CuratedParityCommandMode): string {
  switch (commandMode) {
    case "status":
      return "curated parity status self-check";
    case "inspect":
      return "curated parity inspect preflight";
    case "approve":
      return "curated parity approve preflight";
    case "apply":
      return "curated parity apply preflight";
  }
}

export function classifyCuratedParityStatus(
  report: CuratedParitySafetyReport,
): CuratedParityStatusClassification {
  if ((report.commandMode === "status" || report.commandMode === "inspect") && report.applyReady) {
    return {
      statusSummary: "READY",
      statusCode: "approval-valid-and-ready",
      statusDetail:
        "Single-use approval is valid for one destructive apply on this exact target and current curated manifest.",
    };
  }

  if (report.commandMode === "approve" && report.allowed) {
    return {
      statusSummary: "ALLOWED",
      statusCode: "ready-to-approve",
      statusDetail:
        "This exact target is locally allowlisted, so a fresh single-use approval artifact may be created.",
    };
  }

  if (report.commandMode === "apply" && report.allowed) {
    return {
      statusSummary: "ALLOWED",
      statusCode: "ready-to-apply",
      statusDetail:
        "All destructive guard requirements are satisfied for one curated football parity apply on this exact target.",
    };
  }

  if (report.applySessionState === "active") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "active-apply-session-present",
      statusDetail:
        "A destructive apply session is already active, so approve/apply stays blocked until it finishes or expires.",
    };
  }

  if (report.ciDetected && report.commandMode !== "status" && report.commandMode !== "inspect") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "ci-blocked",
      statusDetail:
        "Destructive curated parity approval/apply must run from a local operator workspace, not CI.",
    };
  }

  if (report.trustAnchorState === "unsupported") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "unsupported-platform",
      statusDetail:
        report.trustAnchorDetail ||
        "The current platform has no supported destructive curated parity trust-anchor backend.",
    };
  }

  if (report.trustAnchorState === "unusable") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "trust-anchor-unavailable",
      statusDetail:
        report.trustAnchorDetail ||
        "The selected destructive curated parity trust-anchor backend is currently unavailable.",
    };
  }

  if (report.localAllowlistState === "missing") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "missing-local-allowlist",
      statusDetail:
        "Destructive curated parity is fail-closed by default until this exact deployment+URL pair is added to the gitignored local allowlist.",
    };
  }

  if (report.localAllowlistState === "malformed") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "malformed-local-allowlist",
      statusDetail:
        "The gitignored local allowlist file could not be trusted, so destructive curated parity remains blocked.",
    };
  }

  if (report.localAllowlistState === "unmatched") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "target-not-allowlisted",
      statusDetail:
        "The local allowlist exists, but this exact deployment+URL pair is not approved for destructive curated parity.",
    };
  }

  if (report.trustAnchorState === "missing") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "trust-anchor-missing",
      statusDetail:
        "This platform is supported, but the current local user has no trust anchor yet. The approve step will create it.",
    };
  }

  if (report.approvalArtifactState === "consumed") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "approval-consumed",
      statusDetail:
        "The last matching approval was already consumed. Replay stays blocked until a fresh single-use approval is created.",
    };
  }

  if (report.approvalArtifactState !== "valid") {
    return {
      statusSummary: "BLOCKED",
      statusCode: "no-valid-approval",
      statusDetail:
        "Trust anchor is available, but there is no current valid single-use approval artifact for this exact target and manifest.",
    };
  }

  return {
    statusSummary: "BLOCKED",
    statusCode: "guard-blocked",
    statusDetail: "The destructive guard is still blocking this workflow before any clear-and-reseed step.",
  };
}

export function getCuratedParityNextSteps(
  report: CuratedParitySafetyReport,
  options?: {
    includeLocalConfigTemplate?: boolean;
  },
): string[] {
  const lines: string[] = [];
  const statusCommand = "cd app && npm run gameplay:curated-parity:status";
  const inspectCommand = "cd app && npm run gameplay:curated-parity:inspect";
  const approveCommand = "cd app && npm run gameplay:curated-parity:approve";
  const applyCommand = "cd app && npm run gameplay:curated-parity";
  const localAllowlistPath = path.relative(REPO_ROOT, report.localConfigPath);

  if (
    report.localAllowlistState === "missing" ||
    report.localAllowlistState === "malformed" ||
    report.localAllowlistState === "unmatched"
  ) {
    lines.push(
      `[next] Create or fix ${localAllowlistPath} so it contains this exact deployment+URL pair.`,
    );
    if (options?.includeLocalConfigTemplate) {
      lines.push("\n[next] Example allowlist entry for the currently resolved target:");
      lines.push(JSON.stringify(buildCuratedParityLocalConfigTemplate(report.target), null, 2));
    }
    lines.push(`[next] Re-run the safe readiness check: ${statusCommand}`);
    lines.push(`[next] Then create a fresh single-use approval: ${approveCommand}`);
    return lines;
  }

  if (report.applySessionState === "active") {
    lines.push(
      `[next] An apply session is already active at ${path.relative(REPO_ROOT, report.applySessionPath)}.`,
    );
    lines.push("[next] Do not approve or re-run apply until that session finishes or expires.");
    return lines;
  }

  if (report.ciDetected && report.commandMode !== "status" && report.commandMode !== "inspect") {
    lines.push(
      "[next] Re-run the destructive approve/apply flow from a local operator workspace instead of CI.",
    );
    lines.push(`[next] Safe local self-check: ${statusCommand}`);
    return lines;
  }

  if (report.trustAnchorState === "unsupported") {
    lines.push(`[next] Unsupported platform for destructive curated parity: ${report.platformDetected}.`);
    lines.push(
      "[next] Use a Windows local operator workspace (DPAPI) or macOS local operator workspace (Keychain). Linux remains intentionally fail-closed for destructive approve/apply.",
    );
    return lines;
  }

  if (report.trustAnchorState === "unusable") {
    lines.push(
      `[next] Fix access to the ${report.trustAnchorBackend} trust anchor for the current local user: ${report.trustAnchorLocation}`,
    );
    lines.push(`[next] Re-run the safe readiness check after fixing it: ${statusCommand}`);
    return lines;
  }

  if (report.trustAnchorState === "missing") {
    lines.push(
      `[next] Run approve to create the trust anchor for the current local user and write a fresh single-use approval: ${approveCommand}`,
    );
    return lines;
  }

  if (report.approvalArtifactState === "consumed") {
    lines.push(
      `[next] The last matching approval was already consumed. Create a fresh single-use approval: ${approveCommand}`,
    );
    return lines;
  }

  if (report.applyReady) {
    lines.push(`[next] Destructive apply is armed exactly once. Run: ${applyCommand}`);
    if (report.approvalArtifact?.expiresAt) {
      lines.push(`[next] Approval expires at ${report.approvalArtifact.expiresAt}`);
    }
    return lines;
  }

  if (report.approvalArtifactState !== "valid") {
    lines.push(`[next] Create a fresh single-use approval artifact: ${approveCommand}`);
    lines.push(`[next] Need the current curated table manifest before approving? Run: ${inspectCommand}`);
    return lines;
  }

  lines.push(`[next] Safe readiness check: ${statusCommand}`);
  return lines;
}

export function printCuratedParityNextSteps(
  report: CuratedParitySafetyReport,
  options?: {
    includeLocalConfigTemplate?: boolean;
  },
): void {
  for (const line of getCuratedParityNextSteps(report, options)) {
    console.log(line);
  }
}

export function printResolvedConvexTarget(
  target: ConvexTarget,
  options?: {
    label?: string;
    safetyNote?: string;
  },
): void {
  if (options?.label) {
    console.log(`[target] ${options.label}`);
  }
  console.log(`[deployment] ${target.deploymentName}`);
  console.log(`[deploymentKind] ${target.deploymentKind}`);
  console.log(`[convexUrl] ${target.convexUrl}`);
  console.log(`[urlSlug] ${target.urlSlug}`);
  console.log(`[config] ${path.relative(REPO_ROOT, target.envPath)}`);
  if (options?.safetyNote) {
    console.log(`[safety] ${options.safetyNote}`);
  }
}

export function printCuratedParitySafetyReport(report: CuratedParitySafetyReport): void {
  const summary = classifyCuratedParityStatus(report);

  printResolvedConvexTarget(report.target, {
    label: getCuratedParityModeLabel(report.commandMode),
    safetyNote: report.safeguard,
  });

  console.log(`[statusSummary] ${summary.statusSummary}`);
  console.log(`[statusCode] ${summary.statusCode}`);
  console.log(`[statusDetail] ${summary.statusDetail}`);
  console.log("[defaultSafety] fail-closed");

  console.log(`[localAllowlist] ${path.relative(REPO_ROOT, report.localConfigPath)}`);
  console.log(`[localAllowlistStatus] ${report.localAllowlistState}`);
  console.log(`[platformDetected] ${report.platformDetected}`);
  console.log(`[trustAnchorBackend] ${report.trustAnchorBackend}`);
  console.log(
    `[trustAnchorBackendStatus] ${report.trustAnchorBackendAvailable ? "available" : "unavailable"}`,
  );
  console.log(`[trustAnchor] ${report.trustAnchorLocation}`);
  console.log(`[trustAnchorStatus] ${report.trustAnchorState}`);
  if (report.trustAnchorDetail) {
    console.log(`[trustAnchorDetail] ${report.trustAnchorDetail}`);
  }

  if (report.matchedApprovedTarget) {
    console.log(
      `[localAllowlistMatch] matched ${report.matchedApprovedTarget.deploymentName} | ${report.matchedApprovedTarget.convexUrl}`,
    );
  } else {
    console.log("[localAllowlistMatch] no exact approved deployment+URL match found");
  }

  console.log(`[approvalArtifact] ${path.relative(REPO_ROOT, report.approvalPath)}`);
  console.log(`[approvalArtifactStatus] ${report.approvalArtifactState}`);
  if (report.approvalArtifactDetail) {
    console.log(`[approvalArtifactDetail] ${report.approvalArtifactDetail}`);
  }

  console.log(`[applySession] ${path.relative(REPO_ROOT, report.applySessionPath)}`);
  console.log(`[applySessionStatus] ${report.applySessionState}`);
  if (report.applySessionDetail) {
    console.log(`[applySessionDetail] ${report.applySessionDetail}`);
  }

  if (report.lastConsumedApproval) {
    console.log(`[approvalHistory] ${path.relative(REPO_ROOT, report.approvalHistoryPath)}`);
    console.log(
      `[lastConsumedApproval] ${report.lastConsumedApproval.approvalId} (${report.lastConsumedApproval.outcome}) @ ${report.lastConsumedApproval.consumedAt}`,
    );
  }

  if (report.ciDetected) {
    console.log("[environment] CI detected");
  }

  for (const note of report.notes) {
    console.log(`[note] ${note}`);
  }

  if (report.commandMode === "status" || report.commandMode === "inspect") {
    console.log(
      report.applyReady
        ? "[decision] READY — destructive curated parity is currently authorized for one apply session on this exact target and manifest."
        : "[decision] BLOCKED — destructive curated parity would stop before any clear-and-reseed action on this target.",
    );
  } else if (report.allowed) {
    console.log(
      report.commandMode === "approve"
        ? "[decision] ALLOWED — a new single-use approval artifact may be created for this exact target."
        : "[decision] ALLOWED — destructive curated parity may clear and reseed the scoped football tables on this target.",
    );
  } else {
    console.log(
      report.commandMode === "approve"
        ? "[decision] BLOCKED — a new single-use approval artifact was not created."
        : "[decision] BLOCKED — destructive curated parity stopped before any clear-and-reseed action.",
    );
  }

  for (const reason of report.reasons) {
    console.log(`[blocked] ${reason}`);
  }
}

export function getCuratedParityBlockedMessage(): string {
  return "Curated parity safety guard blocked this destructive run before any clear-and-reseed step. Review the blocked reasons and next-step guidance above.";
}
