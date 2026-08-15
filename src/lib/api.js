/**
 * 服务器数据同步客户端。
 * 由 server.js 提供 /api/data（GET 读取、PUT 保存）。
 * PUT 使用乐观并发：带上 baseVersion，服务器版本不一致时返回 409 和当前数据，由调用方合并后重试。
 */

export function isServerMode() {
  return typeof window !== "undefined" && /^https?:$/.test(window.location.protocol);
}

export async function fetchServerData() {
  const res = await fetch("/api/data", { cache: "no-store" });
  if (res.status === 401) {
    window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.hash);
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {{reports: unknown[], settings: unknown, version: number}} payload
 * @returns {Promise<{version?: number} | {conflict: true, server: {reports: unknown[], settings: unknown, version: number}}>}
 */
export async function pushServerData(payload) {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (res.status === 401) {
    window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.hash);
    throw new Error("unauthorized");
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 409 && body && Array.isArray(body.reports)) {
    return { conflict: true, server: body };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return body;
}
