# Regenerate composer.lock after adding packages to backend/composer.json.
# Requires Docker Desktop running.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$backend = Join-Path $PSScriptRoot ".." "backend" | Resolve-Path

docker run --rm `
  -v "${backend}:/app" `
  -w /app `
  composer:2 `
  update league/flysystem-aws-s3-v3 --with-all-dependencies --no-interaction --no-scripts

Write-Host "Updated: $backend\composer.lock"
