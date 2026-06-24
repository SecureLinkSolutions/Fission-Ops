#Requires -Version 5.1
<#
.SYNOPSIS
    First-time deploy script for Fission Ops.
    Clones the repo, sets up .env, and starts all containers.
#>

$ErrorActionPreference = 'Stop'

$REPO_URL   = "https://github.com/securelinksolutions/fission-ops.git"
$BRANCH     = "claude/dazzling-bohr-cNZD3"
$DEPLOY_DIR = "$PSScriptRoot\Fission-Ops"

Write-Host ""
Write-Host "  ⚡ Fission Ops — Deploy" -ForegroundColor Cyan
Write-Host "  ───────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── Pre-flight checks ──────────────────────────────────────────────────────────
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "  ✗ git not found. Install from https://git-scm.com" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ git" -ForegroundColor Green

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "  ✗ Docker not found. Install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ docker" -ForegroundColor Green

try {
    docker info | Out-Null
} catch {
    Write-Host "  ✗ Docker Desktop is not running. Start it and try again." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Docker Desktop is running" -ForegroundColor Green
Write-Host ""

# ── Clone ──────────────────────────────────────────────────────────────────────
if (Test-Path $DEPLOY_DIR) {
    Write-Host "Directory '$DEPLOY_DIR' already exists." -ForegroundColor Yellow
    $choice = Read-Host "  Remove and re-clone? (y/N)"
    if ($choice -match '^[Yy]$') {
        Remove-Item -Recurse -Force $DEPLOY_DIR
    } else {
        Write-Host "Aborted. Run update.ps1 to update an existing install." -ForegroundColor DarkGray
        exit 0
    }
}

Write-Host "Cloning repository..." -ForegroundColor Yellow
git clone --branch $BRANCH --single-branch $REPO_URL $DEPLOY_DIR
Write-Host "  ✓ Cloned to $DEPLOY_DIR" -ForegroundColor Green
Write-Host ""

Set-Location $DEPLOY_DIR

# ── .env setup ────────────────────────────────────────────────────────────────
Write-Host "Configuring environment..." -ForegroundColor Yellow
Copy-Item ".env.example" ".env"

function RandomString([int]$len) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    -join ((1..$len) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

$jwtSecret     = RandomString 48
$licenseAdminKey = RandomString 32

# Patch .env with generated secrets
(Get-Content ".env") `
    -replace 'JWT_SECRET=.*',                  "JWT_SECRET=$jwtSecret" `
    -replace 'LICENSE_ADMIN_API_KEY=.*',       "LICENSE_ADMIN_API_KEY=$licenseAdminKey" |
    Set-Content ".env"

Write-Host "  ✓ .env created with auto-generated secrets" -ForegroundColor Green
Write-Host ""
Write-Host "  ┌─────────────────────────────────────────────────────┐" -ForegroundColor DarkYellow
Write-Host "  │  SAVE THESE — you will need them to manage licenses  │" -ForegroundColor DarkYellow
Write-Host "  ├─────────────────────────────────────────────────────┤" -ForegroundColor DarkYellow
Write-Host "  │  JWT_SECRET             : $jwtSecret" -ForegroundColor Yellow
Write-Host "  │  LICENSE_ADMIN_API_KEY  : $licenseAdminKey" -ForegroundColor Yellow
Write-Host "  └─────────────────────────────────────────────────────┘" -ForegroundColor DarkYellow
Write-Host ""

$editEnv = Read-Host "Open .env now to add optional API keys (SMTP, Anthropic, etc.)? (y/N)"
if ($editEnv -match '^[Yy]$') {
    Start-Process notepad ".env" -Wait
}

# ── Build & Start ──────────────────────────────────────────────────────────────
Write-Host "Building and starting containers (this takes a few minutes on first run)..." -ForegroundColor Yellow
docker compose up --build -d

Write-Host ""
Write-Host "  ✓ Fission Ops is running!" -ForegroundColor Green
Write-Host ""
Write-Host "  App              http://localhost:3000" -ForegroundColor Cyan
Write-Host "  License Admin    http://localhost:3002/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Demo accounts:" -ForegroundColor DarkGray
Write-Host "    analyst@fission.local     / analyst123   (Analyst)" -ForegroundColor DarkGray
Write-Host "    commander@fission.local   / analyst123   (Incident Commander)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To update in future: run update.ps1" -ForegroundColor DarkGray
Write-Host ""
