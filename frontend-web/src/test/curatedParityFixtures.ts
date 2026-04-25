import {
  type CuratedParityApplySession,
  type CuratedParityApprovalArtifact,
  type CuratedParityApprovedTarget,
  type CuratedParityConsumedApprovalRecord,
  type CuratedParityGuardEvaluationDependencies,
  type CuratedParityGuardOptions,
  type CuratedParityLocalConfig,
  type CuratedParitySafetyReport,
  type ConvexTarget,
} from "../../../scripts/curatedParityDeploymentSafety";
import type { CuratedParityTrustAnchorResult } from "../../../scripts/curatedParityTrustAnchor";

export type GuardDependencies = CuratedParityGuardEvaluationDependencies;

export type GuardDependencyOverrides = Partial<GuardDependencies>;

type ReportOverrides = Partial<CuratedParitySafetyReport>;

const BASE_APPROVED_TARGET: CuratedParityApprovedTarget = {
  deploymentName: "dev:verveq-local",
  convexUrl: "https://verveq-local.convex.cloud",
};

export const BASE_TARGET: ConvexTarget = {
  envPath: "C:\\repo\\frontend-web\\.env.local",
  deploymentName: BASE_APPROVED_TARGET.deploymentName,
  deploymentKind: "dev",
  deploymentSlug: "verveq-local",
  convexUrl: BASE_APPROVED_TARGET.convexUrl,
  convexSiteUrl: null,
  urlSlug: "verveq-local",
};

export const BASE_APPROVAL: CuratedParityApprovalArtifact = {
  version: 2,
  approvalId: "approval-1",
  scopeKey: "gameplay:curated-parity:v1",
  seedVersion: "seed-v1",
  approvedAt: "2026-04-09T00:00:00.000Z",
  expiresAt: "2026-04-09T00:15:00.000Z",
  ttlMinutes: 15,
  target: BASE_TARGET,
  actor: {
    username: "operator",
    hostname: "workstation",
    platform: "win32",
  },
  sourceConfigPath: "C:\\repo\\.ops\\curated-parity\\approved-targets.local.json",
  signature: "sig",
};

export const BASE_GUARD_OPTIONS = {
  scopeKey: BASE_APPROVAL.scopeKey,
  seedVersion: BASE_APPROVAL.seedVersion,
} as const;

export const BASE_APPLY_SESSION: CuratedParityApplySession = {
  version: 1,
  sessionId: "session-1",
  approvalId: BASE_APPROVAL.approvalId,
  scopeKey: BASE_APPROVAL.scopeKey,
  seedVersion: BASE_APPROVAL.seedVersion,
  startedAt: "2026-04-09T00:01:00.000Z",
  expiresAt: "2026-04-09T00:31:00.000Z",
  ttlMinutes: 30,
  target: BASE_TARGET,
  actor: {
    username: "operator",
    hostname: "workstation",
    platform: "win32",
  },
  operationHash: "op-hash",
  signature: "sig",
};

export const BASE_CONSUMED_APPROVAL: CuratedParityConsumedApprovalRecord = {
  approvalId: BASE_APPROVAL.approvalId,
  sessionId: BASE_APPLY_SESSION.sessionId,
  scopeKey: BASE_APPROVAL.scopeKey,
  seedVersion: BASE_APPROVAL.seedVersion,
  deploymentName: BASE_TARGET.deploymentName,
  convexUrl: BASE_TARGET.convexUrl,
  consumedAt: "2026-04-09T00:02:00.000Z",
  outcome: "succeeded",
};

const BASE_REPORT: CuratedParitySafetyReport = {
  commandMode: "status",
  target: BASE_TARGET,
  allowed: true,
  applyReady: false,
  safeguard: "guard",
  reasons: [],
  notes: [],
  localConfigPath: "C:\\repo\\.ops\\curated-parity\\approved-targets.local.json",
  localConfigLoaded: true,
  localAllowlistState: "matched",
  approvedTargets: [BASE_APPROVED_TARGET],
  matchedApprovedTarget: BASE_APPROVED_TARGET,
  malformedApprovedTargets: [],
  approvalPath: "C:\\repo\\.ops\\curated-parity\\destructive-approval.local.json",
  approvalArtifact: null,
  approvalArtifactState: "missing",
  approvalArtifactDetail: null,
  approvalHistoryPath: "C:\\repo\\.ops\\curated-parity\\approval-history.local.json",
  lastConsumedApproval: null,
  applySessionPath: "C:\\repo\\.ops\\curated-parity\\apply-session.local.json",
  applySession: null,
  applySessionState: "missing",
  applySessionDetail: null,
  ciDetected: false,
  legacyEnvApprovalDetected: [],
  platformDetected: "win32",
  trustAnchorBackend: "windows-dpapi-current-user",
  trustAnchorBackendAvailable: true,
  trustAnchorLocation:
    "C:\\Users\\operator\\AppData\\Local\\VerveQ\\curated-parity\\trust-anchor.current-user.dpapi",
  trustAnchorState: "available",
  trustAnchorDetail: null,
};

export function makeTarget(overrides: Partial<ConvexTarget> = {}): ConvexTarget {
  return {
    ...BASE_TARGET,
    ...overrides,
  };
}

export function makeMatchedAllowlistConfig(
  overrides: Partial<CuratedParityLocalConfig> = {},
): CuratedParityLocalConfig {
  return {
    version: 1,
    approvedTargets: overrides.approvedTargets ?? [BASE_APPROVED_TARGET],
    defaultApprovalTtlMinutes: overrides.defaultApprovalTtlMinutes,
    ...overrides,
  };
}

export function makeApprovalArtifact(
  overrides: Partial<CuratedParityApprovalArtifact> = {},
): CuratedParityApprovalArtifact {
  return {
    ...BASE_APPROVAL,
    ...overrides,
    target: overrides.target ?? BASE_APPROVAL.target,
    actor: overrides.actor ?? BASE_APPROVAL.actor,
  };
}

export function makeApplySession(
  overrides: Partial<CuratedParityApplySession> = {},
): CuratedParityApplySession {
  return {
    ...BASE_APPLY_SESSION,
    ...overrides,
    target: overrides.target ?? BASE_APPLY_SESSION.target,
    actor: overrides.actor ?? BASE_APPLY_SESSION.actor,
  };
}

export function makeConsumedApproval(
  overrides: Partial<CuratedParityConsumedApprovalRecord> = {},
): CuratedParityConsumedApprovalRecord {
  return {
    ...BASE_CONSUMED_APPROVAL,
    ...overrides,
  };
}

export function makeTrustAnchorResult(
  overrides: Partial<CuratedParityTrustAnchorResult> = {},
): CuratedParityTrustAnchorResult {
  return {
    platformDetected: "win32",
    backendSelected: "windows-dpapi-current-user",
    supported: true,
    location:
      "C:\\Users\\operator\\AppData\\Local\\VerveQ\\curated-parity\\trust-anchor.current-user.dpapi",
    detail: "Loaded trust anchor",
    backendAvailable: true,
    available: true,
    created: false,
    state: "available",
    secretBase64: "secret",
    ...overrides,
  };
}

export function makeParityReport(overrides: ReportOverrides = {}): CuratedParitySafetyReport {
  return {
    ...BASE_REPORT,
    ...overrides,
    target: overrides.target ?? BASE_REPORT.target,
    reasons: overrides.reasons ?? [...BASE_REPORT.reasons],
    notes: overrides.notes ?? [...BASE_REPORT.notes],
    approvedTargets: overrides.approvedTargets ?? [...BASE_REPORT.approvedTargets],
    malformedApprovedTargets:
      overrides.malformedApprovedTargets ?? [...BASE_REPORT.malformedApprovedTargets],
    legacyEnvApprovalDetected:
      overrides.legacyEnvApprovalDetected ?? [...BASE_REPORT.legacyEnvApprovalDetected],
    matchedApprovedTarget:
      overrides.matchedApprovedTarget === undefined
        ? BASE_REPORT.matchedApprovedTarget
        : overrides.matchedApprovedTarget,
  };
}

export function makeBlockedState(overrides: ReportOverrides = {}): CuratedParitySafetyReport {
  return makeParityReport({
    allowed: false,
    applyReady: false,
    ...overrides,
  });
}

export function makeReadyState(overrides: ReportOverrides = {}): CuratedParitySafetyReport {
  return makeParityReport({
    allowed: true,
    applyReady: true,
    approvalArtifactState: "valid",
    approvalArtifact: makeApprovalArtifact(),
    ...overrides,
  });
}

export function makeGuardDeps(overrides: GuardDependencyOverrides = {}): GuardDependencies {
  return {
    readEnvFile: () => ({}),
    loadLocalConfig: () => ({
      config: makeMatchedAllowlistConfig(),
      malformedEntries: [],
    }),
    isCiEnvironment: () => false,
    getTrustAnchorResult: () => makeTrustAnchorResult(),
    loadApprovalArtifact: () => ({
      artifact: null,
      detail: null,
    }),
    getApprovalStateForTarget: () => ({
      state: "valid",
      detail: "valid",
    }),
    loadApprovalHistory: () => ({
      version: 1,
      approvals: [],
    }),
    loadApplySession: () => ({
      session: null,
      detail: null,
    }),
    getApplySessionStateForTarget: () => ({
      state: "active",
      detail: "active",
    }),
    ...overrides,
  };
}

export function makeWin32SupportedTrustAnchor(): CuratedParityTrustAnchorResult {
  return makeTrustAnchorResult();
}

export function makeDarwinSupportedTrustAnchor(): CuratedParityTrustAnchorResult {
  return makeTrustAnchorResult({
    platformDetected: "darwin",
    backendSelected: "macos-keychain-generic-password",
    location: "keychain://verveq/curated-parity/current-user",
  });
}

export function makeLinuxFailClosedTrustAnchor(
  detail = "Linux intentionally fail-closed",
): CuratedParityTrustAnchorResult {
  return makeTrustAnchorResult({
    platformDetected: "linux",
    backendSelected: "linux-no-supported-backend",
    supported: false,
    backendAvailable: false,
    available: false,
    state: "unsupported",
    location: "none",
    detail,
    secretBase64: null,
  });
}

export function makeUnusableTrustAnchor(
  detail = "keychain backend unavailable",
): CuratedParityTrustAnchorResult {
  return makeTrustAnchorResult({
    state: "unusable",
    backendAvailable: false,
    available: false,
    detail,
    secretBase64: null,
  });
}

export function makeMissingAllowlistGuardDeps(): GuardDependencyOverrides {
  return {
    loadLocalConfig: () => ({
      config: null,
      malformedEntries: [],
    }),
  };
}

export function makeMalformedAllowlistGuardDeps(
  malformedEntries = ['"approvedTargets" must be an array'],
): GuardDependencyOverrides {
  return {
    loadLocalConfig: () => ({
      config: null,
      malformedEntries,
    }),
  };
}

export function makeUnmatchedAllowlistGuardDeps(): GuardDependencyOverrides {
  return {
    loadLocalConfig: () => ({
      config: makeMatchedAllowlistConfig({
        approvedTargets: [
          {
            deploymentName: "dev:other",
            convexUrl: "https://other.convex.cloud",
          },
        ],
      }),
      malformedEntries: [],
    }),
  };
}

export function makeValidApprovalGuardDeps(): GuardDependencyOverrides {
  return {
    loadApprovalArtifact: () => ({
      artifact: makeApprovalArtifact(),
      detail: null,
    }),
    getApprovalStateForTarget: () => ({
      state: "valid",
      detail: `Approval ${BASE_APPROVAL.approvalId} is valid`,
    }),
  };
}

export function makeConsumedApprovalGuardDeps(): GuardDependencyOverrides {
  return {
    loadApprovalHistory: () => ({
      version: 1,
      approvals: [makeConsumedApproval()],
    }),
  };
}

export function makeActiveApplySessionGuardDeps(): GuardDependencyOverrides {
  return {
    ...makeValidApprovalGuardDeps(),
    loadApplySession: () => ({
      session: makeApplySession(),
      detail: null,
    }),
    getApplySessionStateForTarget: () => ({
      state: "active",
      detail: "Apply session is active",
    }),
  };
}

export function makeUnsupportedLinuxGuardDeps(
  detail = "Linux intentionally fail-closed",
): GuardDependencyOverrides {
  return {
    getTrustAnchorResult: () => makeLinuxFailClosedTrustAnchor(detail),
  };
}

export function makeUnusableTrustAnchorGuardDeps(
  detail = "keychain backend unavailable",
): GuardDependencyOverrides {
  return {
    getTrustAnchorResult: () => makeUnusableTrustAnchor(detail),
  };
}

export function makeMissingAllowlistReport(
  overrides: ReportOverrides = {},
): CuratedParitySafetyReport {
  return makeParityReport({
    localAllowlistState: "missing",
    localConfigLoaded: false,
    matchedApprovedTarget: null,
    ...overrides,
  });
}

export function makeUnsupportedLinuxReport(
  overrides: ReportOverrides = {},
): CuratedParitySafetyReport {
  return makeParityReport({
    platformDetected: "linux",
    trustAnchorBackend: "linux-no-supported-backend",
    trustAnchorBackendAvailable: false,
    trustAnchorLocation: "none",
    trustAnchorState: "unsupported",
    trustAnchorDetail: "Linux fail-closed",
    ...overrides,
  });
}

export function makeActiveApplySessionReport(
  overrides: ReportOverrides = {},
): CuratedParitySafetyReport {
  return makeParityReport({
    applySessionState: "active",
    ...overrides,
  });
}

export function makeApprovalMissingReport(
  overrides: ReportOverrides = {},
): CuratedParitySafetyReport {
  return makeParityReport({
    approvalArtifactState: "missing",
    ...overrides,
  });
}
