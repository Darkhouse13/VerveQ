import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const WINDOWS_TRUST_ANCHOR_HELPER_PATH = path.resolve(
  REPO_ROOT,
  "scripts",
  "curatedParityTrustAnchor.ps1",
);
const WINDOWS_TRUST_ANCHOR_ROOT = path.resolve(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "VerveQ",
  "curated-parity",
);
const WINDOWS_TRUST_ANCHOR_LOCATION = path.resolve(
  WINDOWS_TRUST_ANCHOR_ROOT,
  "trust-anchor.current-user.dpapi",
);
const WINDOWS_TRUST_ANCHOR_ENTROPY = "VerveQ:curated-parity:trust-anchor:v1";

const MACOS_KEYCHAIN_SERVICE = "ai.factory.verveq.curated-parity";
const MACOS_KEYCHAIN_ACCOUNT = "current-user";
const MACOS_KEYCHAIN_LABEL = "VerveQ curated parity trust anchor";
const MACOS_TRUST_ANCHOR_LOCATION = `keychain item service=${MACOS_KEYCHAIN_SERVICE} account=${MACOS_KEYCHAIN_ACCOUNT}`;

export type CuratedParityTrustAnchorState =
  | "available"
  | "missing"
  | "unsupported"
  | "unusable";

export type CuratedParityTrustAnchorBackend =
  | "windows-dpapi-current-user"
  | "macos-keychain-generic-password"
  | "linux-no-supported-backend"
  | "unsupported-platform";

export type CuratedParityTrustAnchorDescriptor = {
  platformDetected: NodeJS.Platform;
  backendSelected: CuratedParityTrustAnchorBackend;
  supported: boolean;
  location: string;
  detail: string;
};

export type CuratedParityTrustAnchorResult = CuratedParityTrustAnchorDescriptor & {
  backendAvailable: boolean;
  available: boolean;
  created: boolean;
  state: CuratedParityTrustAnchorState;
  secretBase64: string | null;
};

type TrustAnchorAction = "read" | "ensure";

let cachedTrustAnchorResult: CuratedParityTrustAnchorResult | null = null;

function normalizeCommandDetail(stdout: string, stderr: string, fallback: string): string {
  return stderr.trim() || stdout.trim() || fallback;
}

function getUnsupportedDescriptor(platform: NodeJS.Platform): CuratedParityTrustAnchorDescriptor {
  if (platform === "linux") {
    return {
      platformDetected: platform,
      backendSelected: "linux-no-supported-backend",
      supported: false,
      location: "none",
      detail:
        "Linux is intentionally fail-closed for destructive curated parity in this repo. No supported non-repo-local trust-anchor backend exists here, so use a Windows or macOS local operator workspace instead of falling back to repo-local secrets.",
    };
  }

  return {
    platformDetected: platform,
    backendSelected: "unsupported-platform",
    supported: false,
    location: "none",
    detail: `Current platform "${platform}" does not have a supported non-repo-local curated parity trust-anchor backend in this repo. Use a Windows or macOS local operator workspace for destructive curated parity.`,
  };
}

export function describeCuratedParityTrustAnchorBackend(
  platform: NodeJS.Platform = process.platform,
): CuratedParityTrustAnchorDescriptor {
  switch (platform) {
    case "win32":
      return {
        platformDetected: platform,
        backendSelected: "windows-dpapi-current-user",
        supported: true,
        location: WINDOWS_TRUST_ANCHOR_LOCATION,
        detail: `Windows current-user DPAPI trust anchor at ${WINDOWS_TRUST_ANCHOR_LOCATION}`,
      };
    case "darwin":
      return {
        platformDetected: platform,
        backendSelected: "macos-keychain-generic-password",
        supported: true,
        location: MACOS_TRUST_ANCHOR_LOCATION,
        detail: `macOS Keychain generic password item ${MACOS_TRUST_ANCHOR_LOCATION}`,
      };
    default:
      return getUnsupportedDescriptor(platform);
  }
}

function buildResult(
  descriptor: CuratedParityTrustAnchorDescriptor,
  overrides: Partial<
    Pick<
      CuratedParityTrustAnchorResult,
      "backendAvailable" | "available" | "created" | "detail" | "secretBase64" | "state"
    >
  >,
): CuratedParityTrustAnchorResult {
  return {
    ...descriptor,
    backendAvailable: overrides.backendAvailable ?? descriptor.supported,
    available: overrides.available ?? false,
    created: overrides.created ?? false,
    detail: overrides.detail ?? descriptor.detail,
    secretBase64: overrides.secretBase64 ?? null,
    state: overrides.state ?? (descriptor.supported ? "unusable" : "unsupported"),
  };
}

function runWindowsTrustAnchor(action: TrustAnchorAction): CuratedParityTrustAnchorResult {
  const descriptor = describeCuratedParityTrustAnchorBackend("win32");

  if (!fs.existsSync(WINDOWS_TRUST_ANCHOR_HELPER_PATH)) {
    return buildResult(descriptor, {
      backendAvailable: false,
      detail: `Trust anchor helper is missing at ${path.relative(REPO_ROOT, WINDOWS_TRUST_ANCHOR_HELPER_PATH)}`,
      state: "unusable",
    });
  }

  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      WINDOWS_TRUST_ANCHOR_HELPER_PATH,
      "-Action",
      action,
      "-Path",
      WINDOWS_TRUST_ANCHOR_LOCATION,
      "-EntropyText",
      WINDOWS_TRUST_ANCHOR_ENTROPY,
    ],
    {
      encoding: "utf8",
      cwd: REPO_ROOT,
    },
  );

  if (result.error) {
    return buildResult(descriptor, {
      backendAvailable: false,
      detail: `Trust anchor helper failed to start: ${result.error.message}`,
      state: "unusable",
    });
  }

  if (result.status !== 0) {
    return buildResult(descriptor, {
      backendAvailable: true,
      detail: normalizeCommandDetail(
        result.stdout,
        result.stderr,
        `Trust anchor helper exited with code ${String(result.status)}`,
      ),
      state: "unusable",
    });
  }

  try {
    const parsed = JSON.parse(result.stdout.trim()) as Partial<CuratedParityTrustAnchorResult>;
    const available = parsed.available === true;
    const detail = typeof parsed.detail === "string" ? parsed.detail : descriptor.detail;
    return buildResult(descriptor, {
      backendAvailable: true,
      available,
      created: parsed.created === true,
      detail,
      secretBase64:
        typeof parsed.secretBase64 === "string" && parsed.secretBase64.trim()
          ? parsed.secretBase64
          : null,
      state: available ? "available" : detail.toLowerCase().includes("missing") ? "missing" : "unusable",
    });
  } catch (error) {
    return buildResult(descriptor, {
      backendAvailable: true,
      detail: `Trust anchor helper returned invalid JSON (${error instanceof Error ? error.message : String(error)})`,
      state: "unusable",
    });
  }
}

function readMacOsTrustAnchor(): CuratedParityTrustAnchorResult {
  const descriptor = describeCuratedParityTrustAnchorBackend("darwin");
  const result = spawnSync(
    "security",
    [
      "find-generic-password",
      "-a",
      MACOS_KEYCHAIN_ACCOUNT,
      "-s",
      MACOS_KEYCHAIN_SERVICE,
      "-w",
    ],
    {
      encoding: "utf8",
      cwd: REPO_ROOT,
    },
  );

  if (result.error) {
    return buildResult(descriptor, {
      backendAvailable: false,
      detail: `macOS Keychain CLI "security" is unavailable: ${result.error.message}`,
      state: "unusable",
    });
  }

  if (result.status !== 0) {
    const detail = normalizeCommandDetail(
      result.stdout,
      result.stderr,
      "macOS Keychain lookup failed",
    );
    const lowered = detail.toLowerCase();
    if (lowered.includes("could not be found") || lowered.includes("could not find")) {
      return buildResult(descriptor, {
        backendAvailable: true,
        detail: "Trust anchor keychain item is missing. Run the approve step to create it for the current local user.",
        state: "missing",
      });
    }

    return buildResult(descriptor, {
      backendAvailable: true,
      detail,
      state: "unusable",
    });
  }

  const secretBase64 = result.stdout.trim();
  if (!secretBase64) {
    return buildResult(descriptor, {
      backendAvailable: true,
      detail: "macOS Keychain trust anchor item was found but returned an empty secret.",
      state: "unusable",
    });
  }

  return buildResult(descriptor, {
    backendAvailable: true,
    available: true,
    detail: "Loaded macOS Keychain trust anchor.",
    secretBase64,
    state: "available",
  });
}

function ensureMacOsTrustAnchor(): CuratedParityTrustAnchorResult {
  const existing = readMacOsTrustAnchor();
  if (existing.available || existing.state !== "missing") {
    return existing;
  }

  const secretBase64 = crypto.randomBytes(32).toString("base64");
  const createResult = spawnSync(
    "security",
    [
      "add-generic-password",
      "-U",
      "-a",
      MACOS_KEYCHAIN_ACCOUNT,
      "-s",
      MACOS_KEYCHAIN_SERVICE,
      "-l",
      MACOS_KEYCHAIN_LABEL,
      "-w",
      secretBase64,
    ],
    {
      encoding: "utf8",
      cwd: REPO_ROOT,
    },
  );

  if (createResult.error) {
    return buildResult(describeCuratedParityTrustAnchorBackend("darwin"), {
      backendAvailable: false,
      detail: `macOS Keychain CLI "security" failed to create the trust anchor: ${createResult.error.message}`,
      state: "unusable",
    });
  }

  if (createResult.status !== 0) {
    return buildResult(describeCuratedParityTrustAnchorBackend("darwin"), {
      backendAvailable: true,
      detail: normalizeCommandDetail(
        createResult.stdout,
        createResult.stderr,
        "macOS Keychain trust anchor creation failed",
      ),
      state: "unusable",
    });
  }

  const loaded = readMacOsTrustAnchor();
  if (loaded.available) {
    return {
      ...loaded,
      created: true,
      detail: "Created and loaded macOS Keychain trust anchor.",
    };
  }

  return loaded;
}

function runCuratedParityTrustAnchor(
  platform: NodeJS.Platform,
  action: TrustAnchorAction,
): CuratedParityTrustAnchorResult {
  switch (platform) {
    case "win32":
      return runWindowsTrustAnchor(action);
    case "darwin":
      return action === "ensure" ? ensureMacOsTrustAnchor() : readMacOsTrustAnchor();
    default:
      return buildResult(describeCuratedParityTrustAnchorBackend(platform), {
        backendAvailable: false,
        state: "unsupported",
      });
  }
}

export function getCuratedParityTrustAnchorResult(options?: {
  ensure?: boolean;
  refresh?: boolean;
  platformOverride?: NodeJS.Platform;
}): CuratedParityTrustAnchorResult {
  const ensure = options?.ensure === true;
  const refresh = options?.refresh === true;
  const platform = options?.platformOverride ?? process.platform;
  const shouldCache = !options?.platformOverride;

  if (shouldCache && !refresh && cachedTrustAnchorResult) {
    if (!ensure || cachedTrustAnchorResult.available) {
      return cachedTrustAnchorResult;
    }
  }

  const result = runCuratedParityTrustAnchor(platform, ensure ? "ensure" : "read");
  if (shouldCache) {
    cachedTrustAnchorResult = result;
  }
  return result;
}
