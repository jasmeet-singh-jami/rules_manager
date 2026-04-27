$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Building frontend..."
Set-Location "$root\frontend"
npm run build
if (-not $?) { Write-Error "Frontend build failed"; exit 1 }

Set-Location $root

$zip = "$root\polycloud_rules_manager_deploy.zip"
Write-Host "Creating deployment ZIP..."
Remove-Item -Force $zip -ErrorAction SilentlyContinue

# Collect backend files, excluding venv and __pycache__
$backendFiles = Get-ChildItem -Path "$root\backend" -Recurse -File |
    Where-Object { $_.FullName -notmatch '\\venv\\' -and $_.FullName -notmatch '\\__pycache__\\' }

$distFiles = Get-ChildItem -Path "$root\frontend\dist" -Recurse -File

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)

foreach ($file in $backendFiles) {
    $entryName = "backend\" + $file.FullName.Substring("$root\backend\".Length)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName) | Out-Null
}
foreach ($file in $distFiles) {
    $entryName = "frontend\dist\" + $file.FullName.Substring("$root\frontend\dist\".Length)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName) | Out-Null
}

# Include deployment instructions at archive root
$deployTxt = "$root\Deployment.txt"
if (Test-Path $deployTxt) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $deployTxt, "Deployment.txt") | Out-Null
}

$archive.Dispose()
$stream.Dispose()

Write-Host "Done: $zip"
