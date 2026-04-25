import { describe, expect, it } from "vitest";
import {
  classifyCuratedParityStatus,
  evaluateCuratedParityDestructiveGuard,
  getCuratedParityNextSteps,
  type CuratedParitySafetyReport,
} from "../../../scripts/curatedParityDeploymentSafety";
import { describeCuratedParityTrustAnchorBackend } from "../../../scripts/curatedParityTrustAnchor";
import {
  BASE_APPLY_SESSION,
  BASE_APPROVAL,
  BASE_GUARD_OPTIONS,
  BASE_TARGET,
  makeActiveApplySessionGuardDeps,
  makeActiveApplySessionReport,
  makeApprovalMissingReport,
  makeBlockedState,
  makeConsumedApprovalGuardDeps,
  makeGuardDeps,
  makeMalformedAllowlistGuardDeps,
  makeMissingAllowlistGuardDeps,
  makeMissingAllowlistReport,
  makeParityReport,
  makeReadyState,
  makeUnmatchedAllowlistGuardDeps,
  makeUnusableTrustAnchorGuardDeps,
  makeUnsupportedLinuxGuardDeps,
  makeUnsupportedLinuxReport,
  makeValidApprovalGuardDeps,
  type GuardDependencies,
} from "./curatedParityFixtures";

function expectSnippets(value: string, snippets: string[]): void {
  for (const snippet of snippets) {
    expect(value).toContain(snippet);
  }
}

describe("curated parity guard-state assembly", () => {
  const cases: Array<{
    name: string;
    commandMode: "status" | "inspect" | "approve" | "apply";
    dependencies?: GuardDependencies;
    expected: {
      localAllowlistState: CuratedParitySafetyReport["localAllowlistState"];
      approvalArtifactState: CuratedParitySafetyReport["approvalArtifactState"];
      applySessionState: CuratedParitySafetyReport["applySessionState"];
      trustAnchorState: CuratedParitySafetyReport["trustAnchorState"];
      allowed: boolean;
      applyReady: boolean;
      statusCode: string;
      reasonIncludes?: string[];
      nextStepIncludes?: string[];
    };
  }> = [
    {
      name: "blocked by default",
      commandMode: "apply",
      dependencies: makeGuardDeps(makeMissingAllowlistGuardDeps()),
      expected: {
        localAllowlistState: "missing",
        approvalArtifactState: "missing",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: false,
        applyReady: false,
        statusCode: "missing-local-allowlist",
        reasonIncludes: ["Missing local allowlist"],
      },
    },
    {
      name: "missing local allowlist",
      commandMode: "status",
      dependencies: makeGuardDeps(makeMissingAllowlistGuardDeps()),
      expected: {
        localAllowlistState: "missing",
        approvalArtifactState: "missing",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: true,
        applyReady: false,
        statusCode: "missing-local-allowlist",
      },
    },
    {
      name: "malformed local allowlist",
      commandMode: "status",
      dependencies: makeGuardDeps(makeMalformedAllowlistGuardDeps()),
      expected: {
        localAllowlistState: "malformed",
        approvalArtifactState: "missing",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: true,
        applyReady: false,
        statusCode: "malformed-local-allowlist",
      },
    },
    {
      name: "unmatched local allowlist",
      commandMode: "status",
      dependencies: makeGuardDeps(makeUnmatchedAllowlistGuardDeps()),
      expected: {
        localAllowlistState: "unmatched",
        approvalArtifactState: "missing",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: true,
        applyReady: false,
        statusCode: "target-not-allowlisted",
      },
    },
    {
      name: "unsupported platform",
      commandMode: "apply",
      dependencies: makeGuardDeps({
        ...makeUnsupportedLinuxGuardDeps(),
        ...makeValidApprovalGuardDeps(),
      }),
      expected: {
        localAllowlistState: "matched",
        approvalArtifactState: "valid",
        applySessionState: "missing",
        trustAnchorState: "unsupported",
        allowed: false,
        applyReady: false,
        statusCode: "unsupported-platform",
        nextStepIncludes: ["Unsupported platform", "Linux remains intentionally fail-closed"],
      },
    },
    {
      name: "trust anchor unavailable",
      commandMode: "apply",
      dependencies: makeGuardDeps({
        ...makeUnusableTrustAnchorGuardDeps(),
        ...makeValidApprovalGuardDeps(),
      }),
      expected: {
        localAllowlistState: "matched",
        approvalArtifactState: "valid",
        applySessionState: "missing",
        trustAnchorState: "unusable",
        allowed: false,
        applyReady: false,
        statusCode: "trust-anchor-unavailable",
      },
    },
    {
      name: "trust anchor available but no valid approval",
      commandMode: "apply",
      dependencies: makeGuardDeps(),
      expected: {
        localAllowlistState: "matched",
        approvalArtifactState: "missing",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: false,
        applyReady: false,
        statusCode: "no-valid-approval",
        reasonIncludes: ["A valid unconsumed approval artifact is required"],
      },
    },
    {
      name: "approval valid and ready",
      commandMode: "status",
      dependencies: makeGuardDeps(makeValidApprovalGuardDeps()),
      expected: {
        localAllowlistState: "matched",
        approvalArtifactState: "valid",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: true,
        applyReady: true,
        statusCode: "approval-valid-and-ready",
      },
    },
    {
      name: "approval consumed",
      commandMode: "status",
      dependencies: makeGuardDeps(makeConsumedApprovalGuardDeps()),
      expected: {
        localAllowlistState: "matched",
        approvalArtifactState: "consumed",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: true,
        applyReady: false,
        statusCode: "approval-consumed",
      },
    },
    {
      name: "active apply session present",
      commandMode: "apply",
      dependencies: makeGuardDeps(makeActiveApplySessionGuardDeps()),
      expected: {
        localAllowlistState: "matched",
        approvalArtifactState: "valid",
        applySessionState: "active",
        trustAnchorState: "available",
        allowed: false,
        applyReady: false,
        statusCode: "active-apply-session-present",
        reasonIncludes: ["An active apply session already exists"],
      },
    },
    {
      name: "apply allowed",
      commandMode: "apply",
      dependencies: makeGuardDeps(makeValidApprovalGuardDeps()),
      expected: {
        localAllowlistState: "matched",
        approvalArtifactState: "valid",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: true,
        applyReady: true,
        statusCode: "ready-to-apply",
      },
    },
    {
      name: "apply blocked",
      commandMode: "apply",
      dependencies: makeGuardDeps({
        ...makeValidApprovalGuardDeps(),
        getApprovalStateForTarget: () => ({
          state: "invalid",
          detail: "Payload signature did not verify",
        }),
      }),
      expected: {
        localAllowlistState: "matched",
        approvalArtifactState: "invalid",
        applySessionState: "missing",
        trustAnchorState: "available",
        allowed: false,
        applyReady: false,
        statusCode: "no-valid-approval",
      },
    },
  ];

  for (const entry of cases) {
    it(entry.name, () => {
      const report = evaluateCuratedParityDestructiveGuard(
        BASE_TARGET,
        { commandMode: entry.commandMode, ...BASE_GUARD_OPTIONS },
        entry.dependencies,
      );

      expect(report.localAllowlistState).toBe(entry.expected.localAllowlistState);
      expect(report.approvalArtifactState).toBe(entry.expected.approvalArtifactState);
      expect(report.applySessionState).toBe(entry.expected.applySessionState);
      expect(report.trustAnchorState).toBe(entry.expected.trustAnchorState);
      expect(report.allowed).toBe(entry.expected.allowed);
      expect(report.applyReady).toBe(entry.expected.applyReady);

      const status = classifyCuratedParityStatus(report);
      expect(status.statusCode).toBe(entry.expected.statusCode);

      const nextSteps = getCuratedParityNextSteps(report).join("\n");
      if (entry.expected.reasonIncludes) {
        expectSnippets(report.reasons.join("\n"), entry.expected.reasonIncludes);
      }
      if (entry.expected.nextStepIncludes) {
        expectSnippets(nextSteps, entry.expected.nextStepIncludes);
      }
    });
  }

  it("passes target and manifest scope inputs into approval/session state evaluators", () => {
    const seen: Array<{ source: "approval" | "session"; scopeKey: string; seedVersion: string }> =
      [];
    const report = evaluateCuratedParityDestructiveGuard(
      BASE_TARGET,
      { commandMode: "apply", ...BASE_GUARD_OPTIONS },
      makeGuardDeps({
        ...makeValidApprovalGuardDeps(),
        loadApplySession: () => ({
          session: BASE_APPLY_SESSION,
          detail: null,
        }),
        getApprovalStateForTarget: (_artifact, _target, scopeKey, seedVersion) => {
          seen.push({ source: "approval", scopeKey, seedVersion });
          return { state: "valid", detail: "valid" };
        },
        getApplySessionStateForTarget: (_session, _target, scopeKey, seedVersion) => {
          seen.push({ source: "session", scopeKey, seedVersion });
          return { state: "active", detail: "active" };
        },
      }),
    );

    expect(report.approvalArtifactState).toBe("valid");
    expect(report.applySessionState).toBe("active");
    expect(seen).toEqual([
      { source: "approval", scopeKey: BASE_GUARD_OPTIONS.scopeKey, seedVersion: BASE_GUARD_OPTIONS.seedVersion },
      { source: "session", scopeKey: BASE_GUARD_OPTIONS.scopeKey, seedVersion: BASE_GUARD_OPTIONS.seedVersion },
    ]);
  });
});

describe("curated parity status classification contract", () => {
  const cases: Array<{
    name: string;
    report: CuratedParitySafetyReport;
    expected: {
      statusSummary: "READY" | "ALLOWED" | "BLOCKED";
      statusCode: string;
      detailIncludes: string;
    };
  }> = [
    {
      name: "blocked by default fallback",
      report: makeBlockedState({
        commandMode: "apply",
        approvalArtifactState: "valid",
        approvalArtifact: BASE_APPROVAL,
        reasons: ["guard condition blocked"],
      }),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "guard-blocked",
        detailIncludes: "destructive guard is still blocking",
      },
    },
    {
      name: "missing local allowlist",
      report: makeMissingAllowlistReport(),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "missing-local-allowlist",
        detailIncludes: "fail-closed by default",
      },
    },
    {
      name: "malformed local allowlist",
      report: makeBlockedState({
        localAllowlistState: "malformed",
        matchedApprovedTarget: null,
      }),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "malformed-local-allowlist",
        detailIncludes: "could not be trusted",
      },
    },
    {
      name: "unmatched local allowlist",
      report: makeBlockedState({
        localAllowlistState: "unmatched",
        matchedApprovedTarget: null,
      }),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "target-not-allowlisted",
        detailIncludes: "exact deployment+URL pair is not approved",
      },
    },
    {
      name: "trust anchor unavailable",
      report: makeBlockedState({
        trustAnchorState: "unusable",
        trustAnchorDetail: "keychain backend unavailable",
      }),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "trust-anchor-unavailable",
        detailIncludes: "keychain backend unavailable",
      },
    },
    {
      name: "unsupported platform",
      report: makeUnsupportedLinuxReport(),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "unsupported-platform",
        detailIncludes: "Linux fail-closed",
      },
    },
    {
      name: "no valid approval",
      report: makeApprovalMissingReport(),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "no-valid-approval",
        detailIncludes: "no current valid single-use approval artifact",
      },
    },
    {
      name: "approval valid and ready (apply session missing)",
      report: makeReadyState({
        commandMode: "status",
        applySessionState: "missing",
      }),
      expected: {
        statusSummary: "READY",
        statusCode: "approval-valid-and-ready",
        detailIncludes: "Single-use approval is valid",
      },
    },
    {
      name: "approval consumed",
      report: makeBlockedState({
        approvalArtifactState: "consumed",
      }),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "approval-consumed",
        detailIncludes: "already consumed",
      },
    },
    {
      name: "active apply session present",
      report: makeActiveApplySessionReport(),
      expected: {
        statusSummary: "BLOCKED",
        statusCode: "active-apply-session-present",
        detailIncludes: "already active",
      },
    },
    {
      name: "approve preflight allowed",
      report: makeParityReport({
        commandMode: "approve",
        allowed: true,
        approvalArtifactState: "missing",
      }),
      expected: {
        statusSummary: "ALLOWED",
        statusCode: "ready-to-approve",
        detailIncludes: "fresh single-use approval artifact",
      },
    },
    {
      name: "apply preflight allowed",
      report: makeReadyState({
        commandMode: "apply",
        allowed: true,
      }),
      expected: {
        statusSummary: "ALLOWED",
        statusCode: "ready-to-apply",
        detailIncludes: "guard requirements are satisfied",
      },
    },
  ];

  for (const entry of cases) {
    it(entry.name, () => {
      const actual = classifyCuratedParityStatus(entry.report);
      expect(actual.statusSummary).toBe(entry.expected.statusSummary);
      expect(actual.statusCode).toBe(entry.expected.statusCode);
      expect(actual.statusDetail).toContain(entry.expected.detailIncludes);
    });
  }
});

describe("curated parity next-step guidance contract", () => {
  const cases: Array<{
    name: string;
    report: CuratedParitySafetyReport;
    expectedSnippets: string[];
  }> = [
    {
      name: "allowlist missing guidance",
      report: makeMissingAllowlistReport(),
      expectedSnippets: [
        "Create or fix",
        "gameplay:curated-parity:status",
        "gameplay:curated-parity:approve",
      ],
    },
    {
      name: "active apply session guidance",
      report: makeActiveApplySessionReport(),
      expectedSnippets: ["already active", "Do not approve or re-run apply"],
    },
    {
      name: "unsupported linux guidance",
      report: makeUnsupportedLinuxReport({ trustAnchorDetail: null }),
      expectedSnippets: ["Unsupported platform", "Linux remains intentionally fail-closed"],
    },
    {
      name: "trust anchor missing guidance",
      report: makeBlockedState({
        trustAnchorState: "missing",
      }),
      expectedSnippets: ["Run approve to create the trust anchor"],
    },
    {
      name: "trust anchor unusable guidance",
      report: makeBlockedState({
        trustAnchorState: "unusable",
      }),
      expectedSnippets: ["Fix access to the", "safe readiness check after fixing it"],
    },
    {
      name: "no valid approval guidance",
      report: makeApprovalMissingReport(),
      expectedSnippets: [
        "Create a fresh single-use approval artifact",
        "gameplay:curated-parity:inspect",
      ],
    },
    {
      name: "approval consumed guidance",
      report: makeBlockedState({
        approvalArtifactState: "consumed",
      }),
      expectedSnippets: ["already consumed", "fresh single-use approval"],
    },
    {
      name: "approval ready guidance",
      report: makeReadyState(),
      expectedSnippets: ["Destructive apply is armed exactly once", "Approval expires at"],
    },
    {
      name: "ci refusal guidance for apply/approve",
      report: makeBlockedState({
        commandMode: "apply",
        ciDetected: true,
      }),
      expectedSnippets: ["instead of CI", "Safe local self-check"],
    },
  ];

  for (const entry of cases) {
    it(entry.name, () => {
      const lines = getCuratedParityNextSteps(entry.report);
      expect(lines.length).toBeGreaterThan(0);
      expectSnippets(lines.join("\n"), entry.expectedSnippets);
    });
  }

  it("includes a local allowlist template when requested", () => {
    const lines = getCuratedParityNextSteps(
      makeMissingAllowlistReport(),
      { includeLocalConfigTemplate: true },
    );
    const joined = lines.join("\n");
    expect(joined).toContain("Example allowlist entry");
    expect(joined).toContain("\"approvedTargets\"");
  });
});

describe("platform trust-anchor capability contract", () => {
  it("marks win32 as supported", () => {
    const descriptor = describeCuratedParityTrustAnchorBackend("win32");
    expect(descriptor.supported).toBe(true);
    expect(descriptor.backendSelected).toBe("windows-dpapi-current-user");
  });

  it("marks darwin as supported", () => {
    const descriptor = describeCuratedParityTrustAnchorBackend("darwin");
    expect(descriptor.supported).toBe(true);
    expect(descriptor.backendSelected).toBe("macos-keychain-generic-password");
  });

  it("marks linux as intentionally fail-closed", () => {
    const descriptor = describeCuratedParityTrustAnchorBackend("linux");
    expect(descriptor.supported).toBe(false);
    expect(descriptor.backendSelected).toBe("linux-no-supported-backend");
    expect(descriptor.detail).toContain("intentionally fail-closed");
  });
});
