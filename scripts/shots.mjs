// 用 CDP 驱动无头 Chrome：先向 localStorage 注入示例日报数据，再逐页截图
// 用法: node scripts/shots.mjs <baseUrl> <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] || "http://127.0.0.1:7100/";
const outDir = process.argv[3] || "../_shots";
const DEBUG = 9223;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${DEBUG}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await sleep(500);
  }
  throw new Error("no chrome target");
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let seq = 0;
const pending = new Map();
const events = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method) {
    events.push(msg.method);
  }
};

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function navigate(url) {
  events.length = 0;
  await send("Page.navigate", { url });
  for (let i = 0; i < 40; i++) {
    if (events.includes("Page.loadEventFired")) break;
    await sleep(250);
  }
  await sleep(900); // 等 React 渲染与字体
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  console.log("shot:", name);
}

const report = (date, mul) => ({
  date,
  storeName: "铜陵UU台球俱乐部",
  revenue: { table: Math.round(4200 * mul), product: Math.round(2100 * mul), coach: Math.round(1500 * mul), other: Math.round(850 * mul), remark: "" },
  quickRevenue: "",
  table: { openCount: Math.round(96 * mul), openMinutes: Math.round(8256 * mul), salableMinutes: 14400, peakHours: "19:00-22:00", emptyHours: "14:00-16:00" },
  products: [
    { name: "百岁山矿泉水", category: "酒水饮料", saleQty: 96, saleAmount: 479.7, saleCost: 171.87, giftQty: 4, damageQty: 0, lostQty: 0 },
    { name: "东方树叶", category: "酒水饮料", saleQty: 48, saleAmount: 383.86, saleCost: 169.52, giftQty: 0, damageQty: 0, lostQty: 0 },
    { name: "东鹏特饮", category: "酒水饮料", saleQty: 44, saleAmount: 351.98, saleCost: 155.77, giftQty: 0, damageQty: 0, lostQty: 0 },
    { name: "红牛", category: "酒水饮料", saleQty: 32, saleAmount: 320, saleCost: 150.67, giftQty: 2, damageQty: 0, lostQty: 0 },
    { name: "扑克牌", category: "其他", saleQty: 18, saleAmount: 90, saleCost: 22.14, giftQty: 0, damageQty: 1, lostQty: 0 },
  ],
  lowStockItems: "康师傅拌面、菊花茶",
  member: { newMembers: 5, rechargeAmount: 2000, rechargeGiftAmount: 300, consumeAmount: 3600 },
  groupon: [
    { platform: "抖音", verifyCount: 8, verifyAmount: 450, newCustomerCount: 6 },
    { platform: "美团", verifyCount: 4, verifyAmount: 230, newCustomerCount: 2 },
  ],
  abnormal: [
    { type: "清台销单", count: 2, amount: 86, operator: "肖晓", remark: "客人中途离开" },
    { type: "改价改时长", count: 1, amount: 18, operator: "肖晓", remark: "" },
  ],
  reconciliation: { systemRevenue: Math.round(8650 * mul), actualRevenue: Math.round(8600 * mul) },
  done: "1. 完成会员活动复盘\n2. 完成库存盘点",
  notes: "1. 康师傅拌面补货\n2. 跟进昨日清台销单\n3. 抖音团购周末活动检查",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });

// 先打开一次，注入数据
await navigate(base);
await send("Runtime.evaluate", {
  expression: `localStorage.setItem("daily-report-app.reports.v1", ${JSON.stringify(JSON.stringify([report("2026-08-01", 0.82), report("2026-08-02", 0.94), report("2026-08-03", 1)]))}); "ok"`,
});

mkdirSync(outDir, { recursive: true });

await navigate(base);
await shot("entry");

for (const [name, hash] of [["import", "#import"], ["preview", "#preview"], ["history", "#history"], ["settings", "#settings"]]) {
  await navigate(`${base}${hash}`);
  await shot(name);
}

ws.close();
console.log("done");
process.exit(0);
