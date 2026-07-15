# LandNote 프로젝트 폴더명 변경 스크립트
# Cursor/터미널에서 이 폴더(UPGROUND)를 모두 닫은 뒤 실행하세요.

$ErrorActionPreference = 'Stop'
$parent = Split-Path -Parent $PSScriptRoot
$source = Join-Path $parent 'UPGROUND'
$target = Join-Path $parent 'LandNote'

if (-not (Test-Path -LiteralPath $source)) {
  Write-Host 'UPGROUND 폴더가 없습니다. 이미 LandNote로 변경되었을 수 있습니다.'
  exit 0
}

if (Test-Path -LiteralPath $target) {
  Write-Host 'LandNote 폴더가 이미 존재합니다. 수동으로 확인해 주세요.'
  exit 1
}

Rename-Item -LiteralPath $source -NewName 'LandNote'
Write-Host "완료: $source -> $target"
Write-Host 'Cursor에서 File > Open Folder 로 LandNote 폴더를 다시 열어주세요.'
