# UU 经营报告

铜陵UU台球俱乐部经营报告工具：每天手动填入经营数据，自动生成日报；任意选择起止日期，一键从日报汇总生成周期报告。

## 功能

- **手动录入日报**：营收、台桌、团购、会员、现金对账、商品毛利、异常记录，全部手填，无外部依赖
- **资金口径营收**：总营收 = 现场营业额 + 团购核销净额（未提现）；储值充值单独列为预收款
- **对账**：实收 = 现金 + 农商卡到账 − 现金存入 − 团购结算到账，自动算差异、容差与累计差额
- **自由周期报告**：任意起止日期，点「从日报汇总」自动合计区间内日报（缺哪几天会提示），环比上期、同比、日均自动计算
- **导出**：PDF、Word、Excel、长图、微信文案
- **多端同步**：部署在服务器上，所有电脑用浏览器访问同一地址，数据实时同步

## 部署到服务器（GitHub Actions + SSH 自动空投）

整体流程：**本地改代码 push 到 GitHub → GitHub 先在云端跑测试构建 → 通过 SSH 登录服务器 → 服务器自动拉取最新代码、装依赖、构建、重启服务**。数据（`数据/`）与密码（`配置.json`）不会进 GitHub，始终留在服务器本地。

### 第 1 步：生成部署密钥（本机，已完成一次）

项目根目录 `deploy-keys/` 里已生成一对密钥：

- `deploy_key`（私钥）→ 放进 GitHub 的 Secrets
- `deploy_key.pub`（公钥）→ 拷到服务器上

> 若丢了可重新生成：`ssh-keygen -t ed25519 -f deploy-keys\deploy_key -N "" -C "uu-report-github-actions"`

### 第 2 步：GitHub 仓库添加 4 个 Secrets

仓库页面 → Settings → Secrets and variables → Actions → New repository secret：

| 名称 | 内容 |
| --- | --- |
| `SERVER_HOST` | 服务器的公网 IP 或域名 |
| `SERVER_PORT` | SSH 端口，默认 `22` |
| `SERVER_USER` | `deploy`（初始化脚本创建的账号） |
| `SSH_PRIVATE_KEY` | `deploy_key` 私钥文件的**完整内容**（含开头结尾的 ---- 行） |

### 第 3 步：服务器一次性初始化

服务器需要装好 [Node.js](https://nodejs.org)（18+）和 [git](https://git-scm.com)，然后把 `deploy_key.pub` 拷到服务器，右键 PowerShell「以管理员身份运行」：

```powershell
powershell -ExecutionPolicy Bypass -File D:\uu\uu-revenue-report\deploy\设置服务器.ps1 -PublicKeyFile D:\deploy_key.pub
```

脚本会自动完成：安装并启动 OpenSSH 服务 → 建 `deploy` 账号并写入公钥 → 从 GitHub 拉代码 → 安装依赖并构建 → 注册开机自启服务（计划任务 `uu-report`，部署时自动重启）。

> 安装目录默认 `D:\uu\uu-revenue-report`，若要改请同步修改 `.github/workflows/deploy.yml` 里的路径。

### 第 4 步：打通 SSH 端口

- **云服务器**：安全组放行 TCP 22（或你改的端口）
- **店内 Windows 主机**：路由器做端口映射（如公网 2222 → 内网 22），此时 Secrets 里 `SERVER_PORT` 填 `2222`
- 建议改一个非常规端口并把 sshd_config 里的 `PasswordAuthentication` 设为 `no`（只允许密钥登录）

### 第 5 步：日常更新

本地改完代码：`git add -A && git commit -m "说明" && git push` → GitHub Actions 自动跑测试构建 → SSH 空投到服务器，服务自动重启。也可在 Actions 页面点 `workflow_dispatch` 手动触发。

### 无公网 IP 的备选方案

若服务器没有公网 IP（GitHub 连不上它），改用「服务器定时拉取」：把 `deploy\deploy.ps1` 放进任务计划程序每 10 分钟跑一次即可，效果等同自动更新。

### 手动部署（不经过 GitHub）

```bash
npm install
npm run build        # 产出 dist/
node server.js       # 启动服务，默认端口 4173
```

## 配置

服务器项目目录旁可放 `配置.json`（参考 `配置.json.example`）：

```json
{
  "port": 4173,
  "dataDir": "./数据",
  "password": ""
}
```

- `password` 留空 = 局域网内免登录；填写后所有访问需先输入密码（浏览器记住登录 30 天）
- 数据保存在「数据」文件夹，每次保存自动备份最近 30 份到「数据/backup」
- 需要公网访问时，建议用 Caddy / Nginx 做 HTTPS 反向代理

### 迁移旧数据

旧版（exe 版）数据是 `数据/营收日报数据.json`，把整份 JSON 内容放进服务器的 `数据/营收日报数据.json` 即可；或在新软件「基础设置 → 导入全部数据」中导入旧的备份 JSON。

## 开发

```bash
npm install
npm run dev          # http://localhost:3000（API 自动代理到本机 4173 的 server.js）
npm test             # 对账 / 周期 / 汇总回归测试
npm run build        # 产出 dist/
```

## 数据与备份

- 数据存服务器端，浏览器端仅做本地缓存兜底（断网时仍可查看与编辑，恢复后自动合并上传）
- 多台电脑同时编辑时按报告更新时间合并，不会互相覆盖丢数据
- 「基础设置 → 导出全部数据」可随时下载完整 JSON 存档
