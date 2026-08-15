import { aggregateDayReports } from "./aggregate.js";
import { reportMetrics, totalRevenue } from "./calc.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

function day(date, over = {}) {
  return {
    date,
    periodType: "day",
    endDate: date,
    revenue: { table: 100, product: 50, coach: 0, other: 0, remark: "" },
    quickRevenue: "",
    customerCount: 20,
    table: { openCount: 5, openMinutes: 300, salableMinutes: 14400, peakHours: "", emptyHours: "" },
    products: [
      { name: "红牛", saleQty: 10, saleAmount: 50, saleCost: 30, giftQty: 1, damageQty: 0, lostQty: 0 }
    ],
    member: {
      newMembers: 1,
      rechargeAmount: 500,
      tableCardRecharge: 0,
      rechargeGiftAmount: 20,
      consumeAmount: 100,
      giftCardConsume: 30,
      newMemberRecharge: 300,
      existingMemberRecharge: 200
    },
    groupon: [
      { platform: "美团", verifyCount: 2, verifyAmount: 60, newCustomerCount: 0, refundCount: 1, refundAmount: 10, settledAmount: 20 }
    ],
    abnormal: [{ type: "清台销单", count: 1, amount: 15, operator: "前台", remark: "" }],
    cashReceived: 500,
    reconciliation: { bankReceived: 200, cashDeposit: 100, diffReason: "", diffStatus: "", systemError: "", diffNote: "" },
    productQty: 10,
    productCost: 30,
    done: "",
    notes: "",
    ...over
  };
}

const d1 = day("2026-08-10");
const d2 = day("2026-08-11", {
  revenue: { table: 0, product: 0, coach: 0, other: 0, remark: "" },
  quickRevenue: 80,
  groupon: [],
  products: []
});

const agg = aggregateDayReports([d1, d2], "2026-08-10", "2026-08-11");
assert(agg.dayCount === 2 && agg.total === 280, "汇总总营收 = 200(分项150+团购净额50) + 80(快速) = 280");
assert(agg.patch.revenue.table === 100 && agg.patch.revenue.product === 50, "分项按天求和");
assert(agg.patch.revenue.other === 80, "只填总额的天并入「其他」");
assert(agg.patch.customerCount === 40 && agg.patch.table.openCount === 10, "客单与开台求和");
assert(agg.patch.table.salableMinutes === 28800, "可售时长求和");
assert(agg.patch.cashReceived === 1000 && agg.patch.reconciliation.bankReceived === 400, "现金与银行求和");
assert(agg.patch.reconciliation.cashDeposit === 200, "现金存入求和");
assert(agg.patch.member.rechargeAmount === 1000 && agg.patch.member.newMembers === 2, "会员数据求和");
assert(agg.patch.productQty === 20 && agg.patch.productCost === 60, "商品汇总字段求和");
assert(agg.patch.products.length === 1 && agg.patch.products[0].saleQty === 10, "商品明细按名称合并（d2 无商品明细）");
const g0 = agg.patch.groupon.find((g) => g.platform === "美团");
assert(g0 && g0.verifyAmount === 60 && g0.refundAmount === 10 && g0.settledAmount === 20, "团购按平台求和（含退款与结算）");
assert(agg.patch.abnormal.length === 1 && agg.patch.abnormal[0].count === 2, "异常按类型合并");
assert(agg.meta.dayCount === 2 && agg.meta.missingDates.length === 0, "两天全覆盖无缺失");

const missing = aggregateDayReports([d1], "2026-08-10", "2026-08-12");
assert(missing.meta.dayCount === 1 && missing.meta.missingDates.includes("2026-08-12"), "缺一天的日期被列出");

const none = aggregateDayReports([], "2026-08-10", "2026-08-11");
assert(none.patch === null && none.dayCount === 0, "无日报时返回空补丁");

// 自定义周期指标：环比取紧邻等长区间的日报实时汇总
const prevDays = [
  day("2026-08-08"),
  day("2026-08-09")
];
const customReport = {
  date: "2026-08-10",
  endDate: "2026-08-11",
  periodType: "custom",
  revenue: { table: 100, product: 50, coach: 0, other: 80, remark: "" },
  quickRevenue: "",
  customerCount: 40,
  table: { openCount: 10, openMinutes: 600, salableMinutes: 28800, peakHours: "", emptyHours: "" },
  products: agg.patch.products,
  member: agg.patch.member,
  groupon: agg.patch.groupon,
  abnormal: agg.patch.abnormal,
  cashReceived: 1000,
  productQty: 20,
  productCost: 60,
  reconciliation: agg.patch.reconciliation,
  done: "",
  notes: ""
};
const cm = reportMetrics(customReport, [...prevDays, d1, d2], {});
assert(cm.total === 280, "周期报告总营收 = 分项230 + 团购净额50 = 280");
assert(cm.periodMom === -30, "环比 = 280/400 - 1 = -30%（用前两天日报实时汇总）");
assert(cm.dailyAverage === 140, "日均 = 280 / 2 天");

const dayMetrics = reportMetrics(d2, [d1, d2], {});
assert(dayMetrics.total === totalRevenue(d2), "日报总额一致");

console.log("aggregate test done");
