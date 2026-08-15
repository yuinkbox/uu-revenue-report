#!/usr/bin/env bash
# ============================================================
# 服务器一次性初始化脚本（Linux，用 root 执行）
# 作用：建 deploy 账号并写入公钥、拉代码装依赖、注册 systemd
#       开机自启服务，让 GitHub Actions 以后能自动空投。
#
# 用法：sudo bash 设置服务器.sh /tmp/deploy_key.pub
# ============================================================
set -euo pipefail

PUBKEY_FILE="${1:?用法: sudo bash 设置服务器.sh /path/to/deploy_key.pub}"
REPO_URL="${REPO_URL:-https://github.com/yuinkbox/uu-revenue-report.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/uu-report}"
APP_PORT="${APP_PORT:-4173}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 执行（sudo bash 设置服务器.sh ...）"
  exit 1
fi

echo "[1/8] 检查依赖..."
command -v git >/dev/null 2>&1 || { echo "缺少 git，先安装：apt-get install -y git"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "缺少 Node.js 18+，先到 https://nodejs.org 安装"; exit 1; }
[ -f "$PUBKEY_FILE" ] || { echo "找不到公钥文件：$PUBKEY_FILE"; exit 1; }

echo "[2/8] 创建部署账号 $DEPLOY_USER ..."
id -u "$DEPLOY_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$DEPLOY_USER"

echo "[3/8] 写入公钥..."
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
PUBKEY="$(cat "$PUBKEY_FILE")"
grep -qxF "$PUBKEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" || echo "$PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"

echo "[4/8] 拉取代码到 $INSTALL_DIR ..."
mkdir -p "$(dirname "$INSTALL_DIR")"
if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch origin
  git -C "$INSTALL_DIR" reset --hard origin/main
else
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

echo "[5/8] 安装依赖并构建..."
cd "$INSTALL_DIR"
npm install
npm run build

echo "[6/8] 目录权限..."
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$INSTALL_DIR"

echo "[7/8] 注册 systemd 开机自启服务 uu-report ..."
cat > /etc/systemd/system/uu-report.service <<EOF
[Unit]
Description=UU 经营报告
After=network.target

[Service]
WorkingDirectory=$INSTALL_DIR
ExecStart=$(command -v node) $INSTALL_DIR/server.js --no-open
Restart=always
RestartSec=3
User=$DEPLOY_USER
Group=$DEPLOY_USER
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now uu-report

echo "[8/8] 授权 deploy 免密重启服务..."
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart uu-report, /bin/systemctl start uu-report, /bin/systemctl stop uu-report" > /etc/sudoers.d/uu-report
chmod 440 /etc/sudoers.d/uu-report

# 防火墙（若启用了 ufw）
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "$APP_PORT/tcp"
  echo "已放行端口 $APP_PORT"
fi

echo ""
echo "========================================================"
echo "服务器初始化完成！"
echo "1. 应用地址：http://<服务器IP>:$APP_PORT"
echo "2. 服务 uu-report 已开机自启（systemctl restart uu-report 可重启）"
echo "3. 确认 SSH 端口（默认22）可从公网访问：ss -lntp | grep sshd"
echo "   云服务器还要在安全组里放行该端口，GitHub 才能连进来"
echo "4. 回到 GitHub 仓库 Settings -> Secrets and variables -> Actions，添加 4 个 Secrets："
echo "   SERVER_HOST      服务器公网 IP 或域名"
echo "   SERVER_PORT      SSH 端口（默认 22）"
echo "   SERVER_USER      $DEPLOY_USER"
echo "   SSH_PRIVATE_KEY  deploy_key（私钥）完整内容"
echo "========================================================"
