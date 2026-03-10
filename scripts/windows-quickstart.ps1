$ErrorActionPreference = 'Stop'

Write-Host "=== RentMove Windows Quickstart ===" -ForegroundColor Cyan

function Require-Command($name, $helpText) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $name. $helpText"
  }
}

Require-Command node "Install Node.js LTS from https://nodejs.org/"
Require-Command npm "Install Node.js LTS from https://nodejs.org/"
Require-Command psql "Install PostgreSQL and ensure psql is on PATH."

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

$envContent = Get-Content .env -Raw
if ($envContent -match 'DATABASE_URL=postgres://user:password@localhost:5432/rentmove') {
  $databaseUrl = Read-Host "Enter your PostgreSQL DATABASE_URL"
  if (-not $databaseUrl) { throw "DATABASE_URL is required." }
  (Get-Content .env) |
    ForEach-Object {
      if ($_ -match '^DATABASE_URL=') { "DATABASE_URL=$databaseUrl" } else { $_ }
    } | Set-Content .env
}

if ($envContent -match 'JWT_SECRET=change_me') {
  $jwtSecret = Read-Host "Enter JWT_SECRET (or press Enter for a local dev default)"
  if (-not $jwtSecret) { $jwtSecret = "dev-secret-change-me" }
  (Get-Content .env) |
    ForEach-Object {
      if ($_ -match '^JWT_SECRET=') { "JWT_SECRET=$jwtSecret" } else { $_ }
    } | Set-Content .env
}

$envVars = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $parts = $_ -split '=', 2
  $envVars[$parts[0].Trim()] = $parts[1].Trim()
}

if (-not $envVars.ContainsKey('DATABASE_URL') -or [string]::IsNullOrWhiteSpace($envVars['DATABASE_URL'])) {
  throw "DATABASE_URL missing in .env"
}

Write-Host "Installing npm dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Applying database schema..." -ForegroundColor Cyan
psql "$($envVars['DATABASE_URL'])" -f db/schema.sql

Write-Host "Starting server at http://localhost:3000 ..." -ForegroundColor Green
Start-Process "http://localhost:3000/index.html"
npm start
