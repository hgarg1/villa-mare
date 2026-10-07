<#
  Converts the generated PNGs in assets/originals into web-ready JPEGs in assets/img
  (max 2400px wide, quality 82). Uses System.Drawing, so no Node/Python needed.

    powershell -File scripts/optimize-images.ps1
#>
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'assets/originals'
$dst  = Join-Path $root 'assets/img'
New-Item -ItemType Directory -Force $dst | Out-Null

$maxW = 2400
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)

# Writes <name>.jpg (full size, max 2400px) and <name>-800.jpg (small variant used in srcset on phones)
function Save-Resized($img, $width, $out) {
  $w = [Math]::Min($img.Width, $width)
  $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, 0, 0, $w, $h)
  $bmp.Save($out, $codec, $params)
  $g.Dispose(); $bmp.Dispose()
}

Get-ChildItem $src -Filter *.png | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    $out = Join-Path $dst ($_.BaseName + '.jpg')
    Save-Resized $img $maxW $out
    Save-Resized $img 800 (Join-Path $dst ($_.BaseName + '-800.jpg'))
    '{0,-30} {1,6:N0} KB -> {2,6:N0} KB (+800w {3,4:N0} KB)' -f $_.Name, ($_.Length / 1KB), ((Get-Item $out).Length / 1KB), ((Get-Item (Join-Path $dst ($_.BaseName + '-800.jpg'))).Length / 1KB)
  } finally { $img.Dispose() }
}
