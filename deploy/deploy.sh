#!/usr/bin/env bash
# ============================================================
# 服务器自动部署脚本（Linux，由 GitHub Actions 通过 SSH 调用）
# 步骤：拉取最新代码 -> 安装依赖 -> 构建 -> 重启服务
# 服务器上不要手动改代码，一切以 GitHub 为准。
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[1/4] 拉取最新代码..."
git fetch origin
git reset --hard origin/main

echo "[2/4] 安装依赖..."
npm install

echo "[3/4] 构建前端..."
npm run build

echo "[4/4] 重启服务..."
sudo -n systemctl restart uu-report 2>/dev/null || systemctl restart uu-report

echo "部署完成"
