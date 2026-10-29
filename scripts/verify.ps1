$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    throw "루트 .venv가 없습니다. README의 백엔드 설치 단계를 먼저 실행하세요."
}

Push-Location (Join-Path $ProjectRoot "backend")
try {
    & $Python -m pytest -q
} finally {
    Pop-Location
}

Push-Location (Join-Path $ProjectRoot "frontend")
try {
    npm test -- --run
    npm run build
} finally {
    Pop-Location
}
