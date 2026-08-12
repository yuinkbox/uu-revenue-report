import {
  averageCost,
  directRevenue,
  productSummary,
  reconcileDiagnostics,
  reconcileMetrics,
  reportMetrics,
  totalRevenue,
} from "./calc.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

// 8/2 真实案例：应到账 = 2236.66 + 1000 - 484.35 = 2752.31；实际 = 2754；差异 1.69（容差内）
const report = {
  revenue: { table: 728.55, product: 722.9, coach: 785.21, other: 0 },
  quickRevenue: "",
  member: { rechargeAmount: 1000, consumeAmount: 484.35 },
  cashReceived: 2754,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "", systemError: "" }
};

const m = reconcileMetrics(report, { reconcileTolerance: 3 });
assert(Math.abs(m.expectedRevenue - 2752.31) < 0.001, "应到账 = 营业额 + 充值 - 储值消费");
assert(Math.abs(m.actualReceived - 2754) < 0.001, "实际到账 = 现金 + 银行 - 存现");
assert(Math.abs(m.diff - 1.69) < 0.001, "差异 = 实际到账 - 应到账");
assert(m.tier === "normal", "容差内为 normal");

const bad = {
  revenue: { table: 1000, product: 0, coach: 0, other: 0 },
  quickRevenue: "",
  member: { rechargeAmount: 0, consumeAmount: 0 },
  cashReceived: 0,
  reconciliation: { bankReceived: 1200, cashDeposit: 0, diffReason: "", diffStatus: "", systemError: "" }
};
assert(reconcileMetrics(bad, { reconcileTolerance: 3 }).tier === "pending", "超容差且无原因 → pending");
bad.reconciliation.diffStatus = "explained";
assert(reconcileMetrics(bad, { reconcileTolerance: 3 }).tier === "explained", "超容差且已解释 → explained");

const empty = {
  revenue: { table: 0, product: 0, coach: 0, other: 0 },
  quickRevenue: "",
  member: { rechargeAmount: 0, consumeAmount: 0 },
  cashReceived: 0,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "", systemError: "" }
};
const em = reconcileMetrics(empty, {});
assert(em.expectedRevenue === 0 && em.actualReceived === 0 && em.diff === 0 && em.tier === "normal", "空数据差异为 0 且 normal");

const ac = averageCost({ productCost: 46.57, productQty: 26 });
assert(Math.abs(ac - 1.79) < 0.01, "成本价 = 商品成本 ÷ 销售数量");
assert(averageCost({ productCost: 0, productQty: 0 }) === null, "无数据时成本价为空");

const withGroupon = {
  date: "2026-08-08",
  revenue: { table: 100, product: 50, coach: 30, other: 0 },
  quickRevenue: "",
  table: { openCount: 0, openMinutes: 0, salableMinutes: 100, peakHours: "" },
  products: [],
  member: { rechargeAmount: 100, consumeAmount: 50 },
  abnormal: [],
  cashReceived: 0,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "" },
  groupon: [
    { platform: "美团", verifyCount: 2, verifyAmount: 20 },
    { platform: "抖音", verifyCount: 1, verifyAmount: 10 }
  ]
};
assert(totalRevenue(withGroupon) === 210, "总营收 = 直营分项 + 团购核销金额（100+50+30+20+10）");
assert(directRevenue(withGroupon) === 180, "商云宝营业额不含团购核销");
const rmG = reconcileMetrics(withGroupon, { reconcileTolerance: 3 });
assert(rmG.expectedRevenue === 230, "应到账 = 营业额 + 充值 − 储值卡消费（不含团购；本用例礼金卡消费为 0）");
const sharesG = reportMetrics(withGroupon, [], {}).shares;
assert(sharesG.some((s) => s.key === "groupon" && s.value === 30), "收入结构含团购核销项");

const quickOnly = {
  date: "2026-08-08",
  revenue: { table: 0, product: 0, coach: 0, other: 0 },
  quickRevenue: 300,
  table: { openCount: 0, openMinutes: 0, salableMinutes: 100, peakHours: "" },
  products: [],
  member: { rechargeAmount: 0, consumeAmount: 0 },
  abnormal: [],
  cashReceived: 0,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "" },
  groupon: [{ platform: "美团", verifyCount: 1, verifyAmount: 30 }]
};
assert(totalRevenue(quickOnly) === 300, "只填总额时以用户填的总数为准，不再叠加团购");

const moneyBased = {
  date: "2026-08-08",
  revenue: { table: 100, product: 50, coach: 30, other: 0 },
  quickRevenue: "",
  table: { openCount: 0, openMinutes: 0, salableMinutes: 100, peakHours: "" },
  products: [],
  abnormal: [],
  member: { rechargeAmount: 0, consumeAmount: 0 },
  cashReceived: 500,
  reconciliation: { bankReceived: 1000, cashDeposit: 200, diffReason: "", diffStatus: "" },
  groupon: [{ platform: "美团", verifyCount: 1, verifyAmount: 300 }]
};
assert(totalRevenue(moneyBased) === 480, "总营收（经营收入）= 商云宝营业额 + 团购核销净额，不含现金/银行（180+300）");
const refundNet = {
  ...withGroupon,
  groupon: [{ platform: "美团", verifyCount: 2, verifyAmount: 100, refundCount: 1, refundAmount: 30 }]
};
assert(totalRevenue(refundNet) === 250, "团购按净额计入营收（180+100-30=250）");

const rechargeOnly = {
  date: "2026-08-09",
  periodType: "day",
  revenue: { table: 100, product: 0, coach: 0, other: 0 },
  quickRevenue: "",
  table: { openCount: 0, openMinutes: 0, salableMinutes: 100, peakHours: "" },
  products: [],
  abnormal: [],
  member: { rechargeAmount: 1000, consumeAmount: 0 },
  groupon: [{ platform: "美团", verifyCount: 1, verifyAmount: 50 }],
  cashReceived: 0,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "" }
};
assert(totalRevenue(rechargeOnly) === 150, "经营收入不含储值充值（100+50，充值1000为预收款）");

const threeCards = {
  date: "2026-08-08",
  revenue: { table: 1000, product: 0, coach: 0, other: 0 },
  quickRevenue: "",
  table: { openCount: 0, openMinutes: 0, salableMinutes: 100, peakHours: "" },
  products: [],
  abnormal: [],
  groupon: [],
  member: {
    rechargeAmount: 500,
    consumeAmount: 200,
    giftCardConsume: 150
  },
  cashReceived: 0,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "" }
};
assert(
  reconcileMetrics(threeCards, { reconcileTolerance: 3 }).expectedRevenue === 1150,
  "礼金卡/台费卡消费参与对账：1000+500-200-150=1150"
);
const withTableRecharge = {
  ...threeCards,
  member: { ...threeCards.member, tableCardRecharge: 100 }
};
assert(
  reconcileMetrics(withTableRecharge, { reconcileTolerance: 3 }).expectedRevenue === 1250,
  "台费卡充值计入应到账：1000+500+100-200-150=1250"
);

// 8/11 真实案例：应到账 = 2530.38 + 3000 - 983.55 - 72.03 = 4474.8 = 商云宝流水
const real0811 = {
  date: "2026-08-11",
  revenue: { table: 453.31, product: 800.76, coach: 1276.31, other: 0 },
  quickRevenue: "",
  table: { openCount: 0, openMinutes: 0, salableMinutes: 100, peakHours: "" },
  products: [],
  abnormal: [],
  member: {
    rechargeAmount: 3000,
    tableCardRecharge: 0,
    consumeAmount: 983.55,
    giftCardConsume: 72.03
  },
  cashReceived: 4474.8,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "" },
  groupon: []
};
const rm811 = reconcileMetrics(real0811, { reconcileTolerance: 3 });
assert(Math.abs(rm811.expectedRevenue - 4474.8) < 0.001, "8/11 应到账 = 营业额+充值−储值消费−台费卡消费 = 4474.8");
assert(Math.abs(rm811.actualReceived - 4474.8) < 0.001, "8/11 实收 = 4474.8");
assert(Math.abs(rm811.diff) < 0.001 && rm811.tier === "normal", "8/11 差异为 0");

// 累计差额：8/10 少 11.2、8/11 多 11.2 → 累计为 0（到账时间差特征）
const user0811 = {
  ...real0811,
  cashReceived: 70,
  reconciliation: { bankReceived: 4416, cashDeposit: 0, diffReason: "", diffStatus: "" }
};
const prev0810 = {
  ...user0811,
  date: "2026-08-10",
  cashReceived: 60,
  reconciliation: { bankReceived: 4403.6, cashDeposit: 0, diffReason: "", diffStatus: "" }
};
assert(reconcileMetrics(user0811, { reconcileTolerance: 3 }).diff === 11.2, "8/11 用户数据差额 = +11.2");
const mTot = reportMetrics(user0811, [prev0810], {});
assert(mTot.reconcileCount === 2 && Math.abs(mTot.reconcileTotal) < 0.001, "累计差额 = 8/10(-11.2) + 8/11(+11.2) = 0");
const diag = reconcileDiagnostics(user0811, mTot, {});
assert(diag.some((l) => l.includes("到账时间差")), "累计差额接近 0 时提示到账时间差");

const mOne = reportMetrics(user0811, [], {});
assert(mOne.reconcileTotal === 11.2 && mOne.reconcileCount === 1, "单日累计差额 = 当日差异");
assert(reconcileDiagnostics(user0811, mOne, {}).length === 0, "只有一份日报时不提示累计差额");

// 团购结算到账：核销当天未到账，实收剔除结算款；待收 = 核销净额 − 结算
const withSettled = {
  ...withGroupon,
  groupon: [
    { platform: "美团", verifyCount: 2, verifyAmount: 20, settledAmount: 8 },
    { platform: "抖音", verifyCount: 1, verifyAmount: 10, settledAmount: 2 }
  ],
  cashReceived: 100,
  reconciliation: { bankReceived: 200, cashDeposit: 0, diffReason: "", diffStatus: "" }
};
const rmS = reconcileMetrics(withSettled, { reconcileTolerance: 3 });
assert(rmS.actualReceived === 290, "实收剔除团购结算：100+200-10=290");
const mS = reportMetrics(withSettled, [], {});
assert(mS.settledAmount === 10 && mS.pendingToday === 20 && mS.pendingTotal === 20, "团购结算 10、待收 20");
assert(totalRevenue(withSettled) === 210, "结算到账不影响经营收入");

const prodReport = {
  date: "2026-08-08",
  revenue: { table: 0, product: 130, coach: 0, other: 0 },
  quickRevenue: "",
  table: { openCount: 0, openMinutes: 0, salableMinutes: 100, peakHours: "" },
  products: [
    { name: "百岁山矿泉水", saleQty: 26, saleAmount: 130, saleCost: 46.57 },
    { name: "东鹏特饮", saleQty: 9, saleAmount: 72, saleCost: 31.87 }
  ],
  abnormal: [],
  groupon: [],
  member: { rechargeAmount: 0, consumeAmount: 0 },
  cashReceived: 0,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "" }
};
const ps = productSummary(prodReport);
assert(ps.amount === 202 && ps.cost === 78.44 && Math.abs(ps.profit - 123.56) < 0.01, "商品总成本/总利润自动计算");
assert(Math.abs(ps.rate - 61.17) < 0.01, "毛利率自动计算");
const psFallback = productSummary({ productCost: 50, productQty: 10, revenue: { product: 100 } });
assert(psFallback.amount === 100 && psFallback.cost === 50 && psFallback.rate === 50, "无明细时用汇总字段计算");
const psProfit = productSummary({
  date: "2026-08-08",
  revenue: { product: 0 },
  products: [
    { name: "a", saleQty: 120, saleAmount: 599.81, profit: 384.94 },
    { name: "b", saleQty: 38, saleAmount: 303.94, profit: 169.38 }
  ]
});
assert(
  psProfit.cost === 349.43 && psProfit.profit === 554.32,
  "无成本列时用销售额-毛利推算成本"
);
const psManual = productSummary({ productCost: 0, productQty: 0, revenue: { product: 100 } });
assert(psManual.amount === 100 && psManual.cost === 0 && psManual.unknown === true && psManual.rate === null, "未填成本时毛利与毛利率未知");
const psKnown = productSummary({ productCost: 40, productQty: 0, revenue: { product: 100 } });
assert(psKnown.unknown === false && psKnown.rate === 60, "填成本后毛利率=60%");

const dayPrev = {
  date: "2026-08-07",
  periodType: "day",
  revenue: { table: 100, product: 0, coach: 0, other: 0 },
  quickRevenue: "",
  table: { openCount: 0, openMinutes: 0, salableMinutes: 100, peakHours: "" },
  products: [],
  abnormal: [],
  groupon: [],
  member: { rechargeAmount: 0, consumeAmount: 0 },
  cashReceived: 0,
  reconciliation: { bankReceived: 0, cashDeposit: 0, diffReason: "", diffStatus: "" }
};
const dayCur = {
  ...dayPrev,
  date: "2026-08-08",
  revenue: { table: 120, product: 0, coach: 0, other: 0 }
};
const dm = reportMetrics(dayCur, [dayPrev, dayCur], {});
assert(dm.periodMom === 20, "日报环比上期 = 对比昨日（120/100-1=20%）");

console.log("reconcile test done");
