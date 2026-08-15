# ============================================================
# 服务器一次性初始化脚本（在服务器上以【管理员身份】运行）
# 作用：装好 OpenSSH、建部署账号、写入公钥、拉取代码、
#       注册开机自启服务，让 GitHub Actions 以后能自动空投。
#
# 用法示例（把 deploy_key.pub 拷到服务器后）：
#   powershell -ExecutionPolicy Bypass -File .\设置服务器.ps1 -PublicKeyFile D:\deploy_key.pub
# ============================================================
param(
    [Parameter(Mandatory = $true)][string]$PublicKeyFile,   # 本机生成的 deploy_key.pub（公钥）路径
    [string]$RepoUrl = "https://github.com/yuinkbox/uu-revenue-report.git",
    [string]$InstallDir = "D:\uu\uu-revenue-report",
    [int]$AppPort = 4173,
    [string]$DeployUser = "deploy"
)
$ErrorActionPreference = "Stop"

function Test-Admin {
    $p = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "请右键 PowerShell 选择「以管理员身份运行」后再执行本脚本"
    }
}
Test-Admin

# ---------- 0. 环境检查 ----------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "服务器未安装 git，请先到 https://git-scm.com 安装（默认选项即可）" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "服务器未安装 Node.js，请先到 https://nodejs.org 安装 18 以上版本" }
if (-not (Test-Path $PublicKeyFile)) { throw "找不到公钥文件：$PublicKeyFile（请先把 deploy_key.pub 拷到服务器）" }

# ---------- 1. OpenSSH 服务 ----------
Write-Host "[1/7] 安装并启动 OpenSSH 服务..."
$cap = Get-WindowsCapability -Online -Name "OpenSSH.Server*" -ErrorAction SilentlyContinue
if ($cap -and $cap.State -ne "Installed") {
    Add-WindowsCapability -Online -Name $cap.Name | Out-Null
}
Set-Service -Name sshd -StartupType Automatic
Start-Service -Name sshd
if (-not (Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -DisplayName "OpenSSH Server (sshd)" `
        -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
}

# ---------- 2. 部署账号 ----------
Write-Host "[2/7] 创建部署账号 $DeployUser ..."
if (-not (Get-LocalUser -Name $DeployUser -ErrorAction SilentlyContinue)) {
    $pwd = ConvertTo-SecureString -String ([Guid]::NewGuid().ToString("N") + "!Aa1") -AsPlainText -Force
    New-LocalUser -Name $DeployUser -Password $pwd -PasswordNeverExpires `
        -Description "GitHub Actions 自动部署账号" | Out-Null
}
Add-LocalGroupMember -Group "Administrators" -Member $DeployUser -ErrorAction SilentlyContinue

# ---------- 3. 写入公钥 ----------
Write-Host "[3/7] 配置 SSH 公钥登录..."
$pub = (Get-Content $PublicKeyFile -Raw).Trim()
$sshdCfg = "C:\ProgramData\ssh\sshd_config"
$cfgContent = Get-Content $sshdCfg -Raw -ErrorAction SilentlyContinue

# 管理员账号的公钥文件（Windows OpenSSH 特殊规则）
$adminKeys = "C:\ProgramData\ssh\administrators_authorized_keys"
if ($cfgContent -notmatch "administrators_authorized_keys") {
    Add-Content $sshdCfg "`nMatch Group administrators`n       AuthorizedKeysFile __PROGRAMDATA__/ssh/administrators_authorized_keys"
    $cfgContent = Get-Content $sshdCfg -Raw
}
if (-not (Test-Path $adminKeys)) { New-Item -ItemType File -Path $adminKeys -Force | Out-Null }
if (-not ((Get-Content $adminKeys -Raw) -like "*$pub*")) { Add-Content $adminKeys $pub }
icacls $adminKeys /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F" | Out-Null

# 保险起见也写入普通用户位置
$userHome = (Get-LocalUser -Name $DeployUser).ProfileImagePath
if ($userHome -and $userHome -like "*:\*") {
    $userKeysDir = Join-Path $userHome ".ssh"
    if (-not (Test-Path $userKeysDir)) { New-Item -ItemType Directory -Path $userKeysDir -Force | Out-Null }
    $userKeys = Join-Path $userKeysDir "authorized_keys"
    if (-not (Test-Path $userKeys) -or -not ((Get-Content $userKeys -Raw) -like "*$pub*")) {
        Add-Content $userKeys $pub
        icacls $userKeys /inheritance:r /grant "${DeployUser}:F" /grant "Administrators:F" /grant "SYSTEM:F" | Out-Null
    }
}
Restart-Service sshd

# ---------- 4. 拉取代码 ----------
Write-Host "[4/7] 拉取代码到 $InstallDir ..."
$root = Split-Path $InstallDir -Parent
if (-not (Test-Path $root)) { New-Item -ItemType Directory -Path $root -Force | Out-Null }
if (Test-Path (Join-Path $InstallDir ".git")) {
    git -C $InstallDir fetch origin
    git -C $InstallDir reset --hard origin/main
} else {
    git clone $RepoUrl $InstallDir
    if ($LASTEXITCODE -ne 0) { throw "git clone 失败，请检查仓库地址与服务器网络" }
}

# ---------- 5. 依赖与构建 ----------
Write-Host "[5/7] 安装依赖并构建..."
Push-Location $InstallDir
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build 失败" }
Pop-Location

# ---------- 6. 目录权限 ----------
Write-Host "[6/7] 配置目录权限..."
icacls $InstallDir /grant "${DeployUser}:(OI)(CI)M" /T | Out-Null

# ---------- 7. 注册开机自启服务 ----------
Write-Host "[7/7] 注册开机自启服务 uu-report ..."
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "server.js --no-open" -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "uu-report" -Action $action -Trigger $trigger -Settings $settings `
    -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName "uu-report"

Write-Host ""
Write-Host "========================================================"
Write-Host "服务器初始化完成！"
Write-Host "1. 应用地址：http://服务器IP:$AppPort"
Write-Host "2. 服务已注册为计划任务 uu-report（开机自启，部署时自动重启）"
Write-Host "3. 回到 GitHub 仓库 Settings -> Secrets and variables -> Actions，添加四个 Secrets："
Write-Host "   SERVER_HOST     服务器的公网 IP 或域名"
Write-Host "   SERVER_PORT     SSH 端口（默认 22）"
Write-Host "   SERVER_USER     $DeployUser"
Write-Host "   SSH_PRIVATE_KEY deploy_key（私钥）的完整内容"
Write-Host "4. 确保路由器/云防火墙把 SSH 端口映射到这台服务器"
Write-Host "5. 以后本地 push 代码，GitHub Actions 就会自动部署到这里"
Write-Host "========================================================"
