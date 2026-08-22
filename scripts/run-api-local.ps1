[CmdletBinding()]
param(
    [string]$EnvFile = "apps/api/.env.local"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$resolvedEnvFile = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    $EnvFile
} else {
    Join-Path $repositoryRoot $EnvFile
}

if (-not (Test-Path -LiteralPath $resolvedEnvFile -PathType Leaf)) {
    throw "Environment file not found: $resolvedEnvFile. Copy apps/api/.env.local.example to apps/api/.env.local first."
}

foreach ($line in Get-Content -LiteralPath $resolvedEnvFile -Encoding utf8) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
        continue
    }
    if ($trimmed -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        throw "Invalid environment entry in ${resolvedEnvFile}: $line"
    }
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
}

$go = Get-Command go -ErrorAction SilentlyContinue
if (-not $go) {
    $fallback = "C:\Program Files\Go\bin\go.exe"
    if (-not (Test-Path -LiteralPath $fallback -PathType Leaf)) {
        throw "Go was not found on PATH or at $fallback"
    }
    $goExecutable = $fallback
} else {
    $goExecutable = $go.Source
}

Push-Location (Join-Path $repositoryRoot "apps/api")
try {
    & $goExecutable run ./cmd/api
    if ($LASTEXITCODE -ne 0) {
        throw "Go API exited with code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
