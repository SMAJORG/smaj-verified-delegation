param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CodexArguments
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env.local'

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Missing $envPath"
}

$keyLine = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -match '^\s*META_API_KEY\s*=' } |
    Select-Object -First 1

if ($null -eq $keyLine) {
    throw 'META_API_KEY is missing from .env.local'
}

$metaApiKey = ($keyLine -replace '^\s*META_API_KEY\s*=\s*', '').Trim().Trim('"').Trim("'")

if ([string]::IsNullOrWhiteSpace($metaApiKey)) {
    throw 'META_API_KEY is empty in .env.local'
}

$previousKey = [Environment]::GetEnvironmentVariable('META_API_KEY', 'Process')
$previousCodexHome = [Environment]::GetEnvironmentVariable('CODEX_HOME', 'Process')

try {
    $env:META_API_KEY = $metaApiKey
    $env:CODEX_HOME = Join-Path $env:USERPROFILE '.codex-meta'
    & codex @CodexArguments
    exit $LASTEXITCODE
}
finally {
    if ($null -eq $previousKey) {
        Remove-Item Env:META_API_KEY -ErrorAction SilentlyContinue
    }
    else {
        $env:META_API_KEY = $previousKey
    }

    if ($null -eq $previousCodexHome) {
        Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
    }
    else {
        $env:CODEX_HOME = $previousCodexHome
    }
}
