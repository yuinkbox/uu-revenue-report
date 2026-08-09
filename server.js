import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const port = 4173;
const noOpen = process.argv.includes("--no-open");

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  let pathname = url.pathname;
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

  try {
    await sendFile(res, join(root, "index.html"));
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("构建产物缺失，请先运行 npm run build");
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
  const url = `http://127.0.0.1:${port}`;
  if (edge) {
    spawn(edge, ["--app=" + url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  }
}

server.listen(port, "127.0.0.1", () => {
  console.log(`营收日报已启动：http://127.0.0.1:${port}`);
  if (!noOpen) openBrowser();
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log("营收日报服务已在运行，直接打开窗口");
    if (!noOpen) openBrowser();
    process.exit(0);
    return;
  }
  console.error(err);
  process.exit(1);
});
