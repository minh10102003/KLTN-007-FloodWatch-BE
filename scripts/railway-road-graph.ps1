# Chạy migration / import road graph với biến môi trường từ Railway (DATABASE_URL, ...).
# Yêu cầu: đã `railway login` và `railway link` đúng project + environment.
# Dùng service có DATABASE_URL (thường là PostGIS), hoặc thêm: railway run -s <TênService> npm run ...
#
# Ví dụ:
#   .\scripts\railway-road-graph.ps1 migrate
#   .\scripts\railway-road-graph.ps1 import
#   .\scripts\railway-road-graph.ps1 import -GeojsonPath ".\data\roads.geojson"

param(
    [Parameter(Position = 0)]
    [ValidateSet('migrate', 'import', 'both')]
    [string] $Action = 'both',

    [string] $GeojsonPath = ''
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not $GeojsonPath) {
    $GeojsonPath = Join-Path (Get-Location) 'data' 'roads.geojson'
}

function Invoke-RailwayNpm {
    param([string[]] $NpmArgs)
    & railway run npm @NpmArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($Action -eq 'migrate' -or $Action -eq 'both') {
    Write-Host '>>> railway run npm run migrate:road-graph' -ForegroundColor Cyan
    Invoke-RailwayNpm @('run', 'migrate:road-graph')
}

if ($Action -eq 'import' -or $Action -eq 'both') {
    if (-not (Test-Path -LiteralPath $GeojsonPath)) {
        Write-Error "Không thấy file GeoJSON: $GeojsonPath"
    }
    $file = (Resolve-Path -LiteralPath $GeojsonPath).Path
    Write-Host ">>> railway run npm run import:road-graph -- --file `"$file`" --clear-existing" -ForegroundColor Cyan
    Invoke-RailwayNpm @('run', 'import:road-graph', '--', '--file', $file, '--clear-existing')
}

Write-Host 'Done.' -ForegroundColor Green
