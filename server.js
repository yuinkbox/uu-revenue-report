import http from "node:http";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat, writeFile, mkdir, copyFile, readdir, unlink, rename } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const BASE = dirname(fileURLToPath(import.meta.url));
const root = join(BASE, "dist");
const CONFIG_PATH = join(BASE, "配置.json");
const BACKUP_KEEP = 30;

// ---------- 配置 ----------
const defaults = { port: 4173, dataDir: "./数据", password: "" };
let config = { ...defaults };
try {
  let raw = await readFile(CONFIG_PATH, "utf-8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // 记事本保存的 UTF-8 BOM
  config = { ...defaults, ...JSON.parse(raw) };
} catch (err) {
  console.log(`配置.json 未找到或格式不正确，使用默认配置（${err.message}）`);
}
const PORT = Number(config.port) || 4173;
const DATA_DIR = resolve(BASE, String(config.dataDir || "./数据"));
const DATA_FILE = join(DATA_DIR, "营收日报数据.json");
const BACKUP_DIR = join(DATA_DIR, "backup");
const PASSWORD = String(config.password || "").trim();
const AUTH_ENABLED = PASSWORD.length > 0;
const noOpen = process.argv.includes("--no-open");

// ---------- 会话 ----------
const SESSION_TTL = 30 * 24 * 3600 * 1000;
const sessions = new Map(); // token -> expiresAt

function issueSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function sessionValid(token) {
  if (!token || !sessions.has(token)) return false;
  if (sessions.get(token) < Date.now()) {
    sessions.delete(token);
    return false;
  }
  sessions.set(token, Date.now() + SESSION_TTL); // 滑动续期
  return true;
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isAuthed(req) {
  if (!AUTH_ENABLED) return true;
  return sessionValid(parseCookies(req).uu_token);
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- 数据存储 ----------
let store = { reports: [], settings: null, version: 0, updatedAt: "" };

async function loadStore() {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.reports)) {
      store = {
        reports: data.reports,
        settings: data.settings && typeof data.settings === "object" ? data.settings : null,
        version: Number(data.version) || 0,
        updatedAt: data.updatedAt || ""
      };
      console.log(`已载入数据：${store.reports.length} 份报告（${DATA_FILE}）`);
    }
  } catch {
    console.log("数据文件不存在或无法解析，从空库开始");
  }
}

async function rotateBackups() {
  try {
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith(".json"));
    if (files.length <= BACKUP_KEEP) return;
    const sorted = files.sort();
    for (const f of sorted.slice(0, files.length - BACKUP_KEEP)) {
      await unlink(join(BACKUP_DIR, f)).catch(() => {});
    }
  } catch {
    // 忽略备份轮转失败
  }
}

async function persistStore() {
  await mkdir(DATA_DIR, { recursive: true });
  const payload = JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2);
  const tmp = DATA_FILE + ".tmp";
  await writeFile(tmp, payload, "utf-8");
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    if (existsSync(DATA_FILE)) {
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      await copyFile(DATA_FILE, join(BACKUP_DIR, `营收日报数据-${stamp}.json`));
    }
  } catch {
    // 备份失败不阻断保存
  }
  await rename(tmp, DATA_FILE);
  await rotateBackups();
}

// ---------- 静态服务 ----------
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

function safePath(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // keep original
  }
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return join(root, relative);
}

async function sendFile(res, filePath) {
  const data = await readFile(filePath);
  res.writeHead(200, { "Content-Type": mime[extname(filePath).toLowerCase()] || "application/octet-stream" });
  res.end(data);
}

async function sendIndex(res) {
  try {
    await sendFile(res, join(root, "index.html"));
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("构建产物缺失，请先运行 npm run build");
  }
}

// ---------- 登录页 ----------
const LOGIN_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>登录 · UU 经营报告</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f4f5f7; font-family:system-ui,"Microsoft YaHei",sans-serif; }
  .card { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:32px; width:320px; box-shadow:0 10px 30px rgba(0,0,0,.06); }
  h1 { font-size:18px; margin:0 0 4px; }
  p { font-size:12px; color:#6b7280; margin:0 0 20px; }
  input { width:100%; box-sizing:border-box; height:38px; border:1px solid #d1d5db; border-radius:8px; padding:0 12px; font-size:14px; }
  button { width:100%; height:38px; margin-top:12px; border:0; border-radius:8px; background:#111827; color:#fff; font-size:14px; cursor:pointer; }
  button:hover { background:#1f2937; }
  .err { margin-top:12px; font-size:12px; color:#dc2626; display:none; }
</style>
</head>
<body>
<form class="card" id="form">
  <h1>UU 经营报告</h1>
  <p>请输入访问密码</p>
  <input type="password" id="pw" autocomplete="current-password" placeholder="密码" autofocus />
  <button type="submit">进入系统</button>
  <div class="err" id="err">密码不正确</div>
</form>
<script>
  const form = document.getElementById("form");
  const err = document.getElementById("err");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.style.display = "none";
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: document.getElementById("pw").value })
      });
      if (res.ok) {
        const next = new URLSearchParams(location.search).get("next") || "/";
        location.href = next.startsWith("/") ? next : "/";
      } else {
        err.style.display = "block";
      }
    } catch {
      err.style.display = "block";
    }
  });
</script>
</body>
</html>`;

// ---------- API ----------
function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/login" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    if (AUTH_ENABLED && safeEqual(body.password, PASSWORD)) {
      const token = issueSession();
      res.writeHead(200, {
        "Set-Cookie": `uu_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`,
        "Content-Type": "application/json; charset=utf-8"
      });
      res.end('{"ok":true}');
    } else {
      json(res, 401, { error: "密码不正确" });
    }
    return true;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const token = parseCookies(req).uu_token;
    if (token) sessions.delete(token);
    res.writeHead(200, {
      "Set-Cookie": "uu_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
      "Content-Type": "application/json; charset=utf-8"
    });
    res.end('{"ok":true}');
    return true;
  }

  if (!isAuthed(req)) {
    json(res, 401, { error: "unauthorized" });
    return true;
  }

  if (pathname === "/api/data" && req.method === "GET") {
    json(res, 200, store);
    return true;
  }

  if (pathname === "/api/data" && req.method === "PUT") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: "请求体不是合法 JSON" });
      return true;
    }
    if (!body || !Array.isArray(body.reports) || typeof body.version !== "number") {
      json(res, 400, { error: "数据格式不正确" });
      return true;
    }
    if (body.version !== store.version) {
      json(res, 409, store); // 冲突：返回服务器当前数据让客户端合并
      return true;
    }
    store = {
      reports: body.reports,
      settings: body.settings && typeof body.settings === "object" ? body.settings : null,
      version: store.version + 1,
      updatedAt: new Date().toISOString()
    };
    try {
      await persistStore();
    } catch (err) {
      console.error("保存失败：", err);
      json(res, 500, { error: "保存失败" });
      return true;
    }
    json(res, 200, { version: store.version });
    return true;
  }

  json(res, 404, { error: "not found" });
  return true;
}

// ---------- 主服务 ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    let pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    if (AUTH_ENABLED && !isAuthed(req)) {
      if (pathname === "/login") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(LOGIN_PAGE);
        return;
      }
      res.writeHead(302, { Location: "/login?next=" + encodeURIComponent(pathname + url.search) });
      res.end();
      return;
    }

    if (pathname === "/login") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    if (pathname === "/") pathname = "/index.html";
    const filePath = safePath(pathname);
    try {
      const info = await stat(filePath);
      if (info.isFile()) {
        await sendFile(res, filePath);
        return;
      }
    } catch {
      // fall through to SPA fallback
    }
    await sendIndex(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("服务器内部错误");
    } else {
      res.end();
    }
  }
});

function openBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  const edge = candidates.find((p) => existsSync(p));
  const url = `http://127.0.0.1:${PORT}`;
  if (edge) {
    spawn(edge, ["--app=" + url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  }
}

await loadStore();

server.listen(PORT, () => {
  console.log(`UU 经营报告服务已启动：http://127.0.0.1:${PORT}（局域网请用本机 IP 访问）`);
  console.log(`数据目录：${DATA_DIR}${AUTH_ENABLED ? "" : "（未设置访问密码，局域网内可自由访问）"}`);
  if (!noOpen) openBrowser();
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用，请修改「配置.json」里的 port 或先停止旧服务`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
