<#
  Generates site photography (PNG originals; run optimize-images.ps1 afterwards)
  with the Codex CLI (image_generation tool).
  Reads scripts/images.json; skips images that already exist in assets/originals.

  Usage (from project root):
    powershell -File scripts/generate-images.ps1                       # all missing images, one at a time
    powershell -File scripts/generate-images.ps1 -Group suites,team    # only these groups
    powershell -File scripts/generate-images.ps1 -Parallel 3           # 3 Codex sessions at once
    powershell -File scripts/generate-images.ps1 -Only hero-dusk -Force
  Per-image Codex output goes to scripts/logs/<name>.log.
#>
param(
  [string[]]$Only,
  [string[]]$Group,
  [int]$Parallel = 1,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
# `powershell -File` passes "a,b" as ONE string, so split on commas ourselves
$Only  = @($Only  | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$Group = @($Group | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$root   = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'assets/originals'
$logDir = Join-Path $PSScriptRoot 'logs'
$manifest = Get-Content (Join-Path $PSScriptRoot 'images.json') -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force $outDir, $logDir | Out-Null

$todo = @()
foreach ($img in $manifest.images) {
  if ($Only  -and ($Only  -notcontains $img.name)) { continue }
  if ($Group -and ($Group -notcontains $img.group)) { continue }
  $target = Join-Path $outDir "$($img.name).png"
  if ((Test-Path $target) -and -not $Force) { Write-Host "skip  $($img.name) (exists)"; continue }
  $todo += $img
}

# One Codex session per image. Runs inside a job so several can run at once.
$worker = {
  param($root, $log, $prompt)
  $ErrorActionPreference = 'Continue'   # codex writes progress to stderr; PS 5.1 would treat it as an error
  $prompt | & codex exec --skip-git-repo-check --ephemeral -s workspace-write -C $root - 2>&1 | Out-File -Encoding utf8 $log
  $LASTEXITCODE
}

$jobs = @{}
$failed = @()
function Finish($job) {
  $name = $jobs[$job.Id]
  Receive-Job $job | Out-Null; Remove-Job $job
  $target = Join-Path $outDir "$name.png"
  if ((Test-Path $target) -and ((Get-Item $target).Length -gt 0)) { Write-Host "ok    $name" }
  else { Write-Host "FAIL  $name" -ForegroundColor Red; $script:failed += $name }
}

foreach ($img in $todo) {
  while (@($jobs.Keys | Where-Object { (Get-Job -Id $_ -ErrorAction SilentlyContinue).State -eq 'Running' }).Count -ge $Parallel) {
    Start-Sleep -Seconds 2
  }
  # collect any finished jobs
  Get-Job | Where-Object { $_.State -ne 'Running' -and $jobs.ContainsKey($_.Id) } | ForEach-Object { Finish $_; $jobs.Remove($_.Id) }

  $prompt = @"
Use your image generation tool to create ONE image.
Style: $($manifest.style)
Subject: $($img.prompt)
Aspect ratio: $($img.aspect).
When done, save the final image file to this exact path: assets/originals/$($img.name).png (relative to the working directory; copy it there if the tool saved it elsewhere). Reply with only the saved path.
"@
  Write-Host "gen   $($img.name) ..."
  $job = Start-Job -ScriptBlock $worker -ArgumentList $root, (Join-Path $logDir "$($img.name).log"), $prompt
  $jobs[$job.Id] = $img.name
}

while ($jobs.Count) {
  Wait-Job -Job (Get-Job | Where-Object { $jobs.ContainsKey($_.Id) }) -Any | Out-Null
  Get-Job | Where-Object { $_.State -ne 'Running' -and $jobs.ContainsKey($_.Id) } | ForEach-Object { Finish $_; $jobs.Remove($_.Id) }
}

if ($failed.Count) {
  Write-Host "`nFailed: $($failed -join ', ') (see scripts/logs)" -ForegroundColor Red
  exit 1
}
Write-Host "`nDone."
