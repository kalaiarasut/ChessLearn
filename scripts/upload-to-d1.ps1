$DB_NAME = "chessify-puzzles"
$CHUNKS_DIR = Join-Path $PSScriptRoot "..\puzzle-chunks"
$files = Get-ChildItem $CHUNKS_DIR -Filter "*.sql" | Sort-Object Name

$total = $files.Count
$i = 0

foreach ($file in $files) {
  $i++
  Write-Host "[$i/$total] Uploading $($file.Name)..." -NoNewline
  npx wrangler d1 execute $DB_NAME --remote --file=$($file.FullName) -y
  if ($LASTEXITCODE -ne 0) {
    Write-Host " FAILED. Retrying..."
    npx wrangler d1 execute $DB_NAME --remote --file=$($file.FullName) -y
    if ($LASTEXITCODE -ne 0) {
      Write-Host " FAILED again. Stopping script." -ForegroundColor Red
      exit 1
    }
  }
  Write-Host " OK"
}

Write-Host "All $total chunks uploaded successfully!"
