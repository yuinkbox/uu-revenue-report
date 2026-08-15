import { toNumber } from "./calc";

const REPORTS_KEY = "daily-report-app.reports.v1";
const SETTINGS_KEY = "daily-report-app.settings.v1";

export const defaultSettings = {
  storeName: "铜陵UU台球俱乐部",
  monthTarget: 120000,
  reconcileTolerance: 3,
  tableCount: 27,
  openHours: 16,
  salableMinutes: 27 * 16 * 60,
  safetyStockThreshold: 5,
  staff: ["肖晓", "前台手机", "卢德鹏", "徐彧"],
  abnormalTypes: ["清台销单", "改价改时长", "删除订单项", "大额赠送/折扣", "库存调整"],
  diffReasons: [
    "抹零/四舍五入",
    "到账时间差（次日到账）",
    "退款/撤销冲减",
    "拉卡拉提现手续费",
    "现金存入时间差",
    "团购平台结算延迟",
    "其他（见补充说明）"
  ],
  reportTitle: "UU台球俱乐部 · 经营报告",
  productCatalog: []
};

export function loadReports() {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? JSON.parse(raw).map(migrateReport) : [];
  } catch {
    return [];
  }
}

/** 旧数据迁移：旧周期类型归并为自定义周期，废弃字段剔除。 */
export function migrateReport(report) {
  if (!report || typeof report !== "object") return report;
  const oldRecon = report.reconciliation || {};
  const oldType = report.periodType || "day";
  const periodType = oldType === "day" ? "day" : "custom";
  return {
    ...report,
    periodType,
    endDate: report.endDate || report.date,
    periodTarget: report.periodTarget ?? "",
    status: report.status || "draft",
    cashReceived: report.cashReceived ?? 0,
    customerCount: report.customerCount ?? "",
    productCost: report.productCost ?? 0,
    productQty: report.productQty ?? 0,
    member: {
      ...(report.member || {}),
      giftCardConsume:
        (toNumber(report.member?.giftCardConsume) + toNumber(report.member?.tableCardConsume)) || 0,
      tableCardRecharge: report.member?.tableCardRecharge ?? 0,
      newMemberRecharge: report.member?.newMemberRecharge ?? 0,
      existingMemberRecharge: report.member?.existingMemberRecharge ?? 0
    },
    groupon: (report.groupon || []).map((g) => ({
      platform: g.platform,
      verifyCount: g.verifyCount ?? 0,
      verifyAmount: g.verifyAmount ?? 0,
      newCustomerCount: g.newCustomerCount ?? 0,
      refundCount: g.refundCount ?? 0,
      refundAmount: g.refundAmount ?? 0,
      settledAmount: g.settledAmount ?? 0
    })),
    reconciliation: {
      bankReceived: oldRecon.bankReceived ?? 0,
      cashDeposit: oldRecon.cashDeposit ?? 0,
      diffReason: oldRecon.diffReason ?? "",
      diffStatus: oldRecon.diffStatus ?? "",
      systemError: oldRecon.systemError ?? "",
      diffNote: oldRecon.diffNote ?? ""
    }
  };
}

export function saveReports(reports) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

/** 按 updatedAt 取新合并两份报告列表（多端同步冲突时用）。 */
export function mergeReportsByUpdatedAt(base, incoming) {
  const map = new Map();
  for (const r of base || []) {
    if (r && r.date) map.set(r.date, r);
  }
  for (const r of incoming || []) {
    if (!r || !r.date) continue;
    const cur = map.get(r.date);
    if (!cur || String(r.updatedAt || "") >= String(cur.updatedAt || "")) map.set(r.date, r);
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const settings = raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
    settings.storeName = "铜陵UU台球俱乐部";
    return settings;
  } catch {
    return { ...defaultSettings, storeName: "铜陵UU台球俱乐部" };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function todayString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function defaultReportDate() {
  const now = new Date();
  return now.getHours() < 12 ? yesterdayString() : todayString();
}

export function emptyReport(date, settings) {
  return {
    date,
    periodType: "day",
    endDate: date,
    periodTarget: "",
    storeName: "铜陵UU台球俱乐部",
    status: "draft",
    cashReceived: 0,
    customerCount: "",
    productCost: 0,
    productQty: 0,
    revenue: { table: 0, product: 0, coach: 0, other: 0, remark: "" },
    quickRevenue: "",
    table: {
      openCount: 0,
      openMinutes: 0,
      salableMinutes: settings.salableMinutes || 14400,
      peakHours: "",
      emptyHours: ""
    },
    products: [
      { name: "", category: "", saleQty: 0, saleAmount: 0, saleCost: 0, giftQty: 0, damageQty: 0, lostQty: 0 }
    ],
    lowStockItems: "",
    member: {
      newMembers: 0,
      rechargeAmount: 0,
      tableCardRecharge: 0,
      rechargeGiftAmount: 0,
      consumeAmount: 0,
      giftCardConsume: 0,
      newMemberRecharge: 0,
      existingMemberRecharge: 0
    },
    groupon: [
      {
        platform: "抖音",
        verifyCount: 0,
        verifyAmount: 0,
        newCustomerCount: 0,
        refundCount: 0,
        refundAmount: 0,
        settledAmount: 0
      },
      {
        platform: "美团",
        verifyCount: 0,
        verifyAmount: 0,
        newCustomerCount: 0,
        refundCount: 0,
        refundAmount: 0,
        settledAmount: 0
      }
    ],
    abnormal: [{ type: "清台销单", count: 0, amount: 0, operator: "", remark: "" }],
    reconciliation: {
      bankReceived: 0,
      cashDeposit: 0,
      diffReason: "",
      diffStatus: "",
      systemError: "",
      diffNote: ""
    },
    done: "",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
