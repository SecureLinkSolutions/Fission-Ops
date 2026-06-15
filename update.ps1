#Requires -Version 5.1
<#
.SYNOPSIS
    Update script for Fission Ops.
    Pulls the latest code and rebuilds only changed containers.
#>

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "  ⚡ Fission Ops — Update" -ForegroundColor Cyan
Write-Host "  ───────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── Must run from the repo directory ──────────────────────────────────────────
if (-not (Test-Path ".env") -or -not (Test-Path "docker-compose.yml")) {
    Write-Host "Run this script from your Fission-Ops install directory." -ForegroundColor Red
    Write-Host "Example:  cd 'C:\...\Fission-Ops'  then  .\update.ps1" -ForegroundColor DarkGray
    exit 1
}

# ── Docker check ──────────────────────────────────────────────────────────────
try {
    docker info | Out-Null
} catch {
    Write-Host "✗ Docker Desktop is not running. Start it and try again." -ForegroundColor Red
    exit 1
}

# ── Pull latest code ──────────────────────────────────────────────────────────
Write-Host "Pulling latest code..." -ForegroundColor Yellow
$before = git rev-parse HEAD
git pull
$after = git rev-parse HEAD

if ($before -eq $after) {
    Write-Host "  Already up to date." -ForegroundColor Green
    $force = Read-Host "  Force rebuild anyway? (y/N)"
    if ($force -notmatch '^[Yy]$') {
        Write-Host "Nothing to do." -ForegroundColor DarkGray
        exit 0
    }
} else {
    Write-Host "  OK Updated from $($before.Substring(0,7)) to $($after.Substring(0,7))" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Changes:" -ForegroundColor DarkGray
    git log --oneline "$before..$after"
    Write-Host ""
}

# ── Rebuild & restart ─────────────────────────────────────────────────────────
Write-Host "Rebuilding changed containers..." -ForegroundColor Yellow
docker compose up --build -d

Write-Host ""
Write-Host "  ✓ Update complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  App              http://localhost:3000" -ForegroundColor Cyan
Write-Host "  License Admin    http://localhost:3002/admin" -ForegroundColor Cyan
Write-Host ""

# Show any containers that aren't healthy
$unhealthy = docker compose ps --format json 2>$null |
    ConvertFrom-Json -ErrorAction SilentlyContinue |
    Where-Object { $_.Health -eq 'unhealthy' }

if ($unhealthy) {
    Write-Host "  ⚠ Unhealthy containers:" -ForegroundColor Yellow
    $unhealthy | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Yellow }
    Write-Host "  Run: docker compose logs <service-name>" -ForegroundColor DarkGray
    Write-Host ""
}
