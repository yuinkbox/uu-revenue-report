# ============================================================
# 服务器自动部署脚本（由 GitHub Actions 通过 SSH 调用）
# 步骤：拉取最新代码 -> 安装依赖 -> 构建 -> 重启服务
# 服务器上不要手动改代码，一切以 GitHub 为准。
# ============================================================
$ErrorActionPreference = "Stop"

# 项目根目录 = 本脚本所在目录的上一级
$installDir = Split-Path -Parent $PSScriptRoot
Set-Location $installDir

Write-Host "[1/4] 拉取最新代码..."
git fetch origin
git reset --hard origin/main
if ($LASTEXITCODE -ne 0) { throw "git 拉取失败" }

Write-Host "[2/4] 安装依赖..."
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }

Write-Host "[3/4] 构建前端..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build 失败" }

Write-Host "[4/4] 重启服务..."

# 端口优先读「配置.json」
$port = 4173
$cfgPath = Join-Path $installDir "配置.json"
if (Test-Path $cfgPath) {
    try {
        $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
        if ($cfg.port) { $port = [int]$cfg.port }
    } catch { }
}

Stop-ScheduledTask -TaskName "uu-report" -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName "uu-report"

Write-Host "部署完成，服务已在端口 $port 重启"
