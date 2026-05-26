param(
  [string]$RepositoryName = "roro-fleet",
  [string]$Region = "eu-central-1",
  [string]$Profile = ""
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or is not on PATH."
  }
}

Require-Command git
Require-Command aws

$profileArgs = @()
if ($Profile.Trim()) {
  $profileArgs = @("--profile", $Profile)
}

$existing = aws codecommit get-repository `
  --repository-name $RepositoryName `
  --region $Region `
  @profileArgs `
  2>$null

if (-not $existing) {
  aws codecommit create-repository `
    --repository-name $RepositoryName `
    --repository-description "RORO Fleet application repository" `
    --region $Region `
    @profileArgs | Out-Host
}

$remoteUrl = "https://git-codecommit.$Region.amazonaws.com/v1/repos/$RepositoryName"
$hasOrigin = git remote get-url origin 2>$null

if ($hasOrigin) {
  git remote set-url origin $remoteUrl
} else {
  git remote add origin $remoteUrl
}

git branch -M main
git push -u origin main

Write-Host "Linked local repository to AWS CodeCommit: $remoteUrl"
