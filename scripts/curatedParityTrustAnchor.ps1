param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("read", "ensure")]
  [string]$Action,
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [Parameter(Mandatory = $true)]
  [string]$EntropyText
)

$ErrorActionPreference = "Stop"

try {
  Add-Type -AssemblyName System.Security | Out-Null
} catch {
}

function Write-JsonResult {
  param(
    [hashtable]$Payload
  )

  $Payload | ConvertTo-Json -Compress -Depth 5 | Write-Output
}

$anchorKind = "windows-dpapi-current-user"
$anchorDirectory = Split-Path -Parent $Path
$entropy = [System.Text.Encoding]::UTF8.GetBytes($EntropyText)

function Read-AnchorSecret {
  if (-not (Test-Path -LiteralPath $Path)) {
    return @{
      available = $false
      created = $false
      path = $Path
      kind = $anchorKind
      detail = "Trust anchor file is missing. Run the approve step to create it for the current local user."
      secretBase64 = $null
    }
  }

  $protectedSecretBase64 = [System.IO.File]::ReadAllText($Path).Trim()
  if ([string]::IsNullOrWhiteSpace($protectedSecretBase64)) {
    throw "Trust anchor file exists but is empty."
  }

  $protectedSecretBytes = [Convert]::FromBase64String($protectedSecretBase64)
  $secretBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
    $protectedSecretBytes,
    $entropy,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )

  return @{
    available = $true
    created = $false
    path = $Path
    kind = $anchorKind
    detail = "Loaded current-user DPAPI trust anchor."
    secretBase64 = [Convert]::ToBase64String($secretBytes)
  }
}

if ($Action -eq "ensure") {
  if (-not (Test-Path -LiteralPath $anchorDirectory)) {
    New-Item -ItemType Directory -Path $anchorDirectory -Force | Out-Null
  }

  if (-not (Test-Path -LiteralPath $Path)) {
    $secretBytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($secretBytes)
    $rng.Dispose()
    $protectedSecretBytes = [System.Security.Cryptography.ProtectedData]::Protect(
      $secretBytes,
      $entropy,
      [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )

    [System.IO.File]::WriteAllText($Path, [Convert]::ToBase64String($protectedSecretBytes))
    $result = Read-AnchorSecret
    $result.created = $true
    $result.detail = "Created and loaded current-user DPAPI trust anchor."
    Write-JsonResult -Payload $result
    exit 0
  }
}

$result = Read-AnchorSecret
Write-JsonResult -Payload $result
