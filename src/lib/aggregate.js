import { round2, toNumber, totalRevenue } from "./calc";
import { eachDate } from "./period";
import { todayString } from "./store";

function breakdownOf(r) {
  return (
    toNumber(r?.revenue?.table) +
    toNumber(r?.revenue?.product) +
    toNumber(r?.revenue?.coach) +
    toNumber(r?.revenue?.other)
  );
}

function pickDayReports(reports, start, end) {
  const byDate = new Map();
  for (const r of reports || []) {
    if ((r.periodType || "day") !== "day") continue;
    if (!r.date || r.date < start || r.date > end) continue;
    const cur = byDate.get(r.date);
    if (!cur || String(r.updatedAt || "") >= String(cur.updatedAt || "")) byDate.set(r.date, r);
  }
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function sumOf(list, fn) {
  return round2(list.reduce((s, d) => s + fn(d), 0));
}

function mergeProducts(days) {
  const map = new Map();
  for (const d of days) {
    for (const p of d.products || []) {
      if (!p || !String(p.name || "").trim()) continue;
      const name = String(p.name).trim();
      const cur = map.get(name) || {
        name,
        category: "",
        saleQty: 0,
        saleAmount: 0,
        saleCost: 0,
        giftQty: 0,
        damageQty: 0,
        lostQty: 0
      };
      cur.category = cur.category || String(p.category || "").trim();
      cur.saleQty = round2(cur.saleQty + toNumber(p.saleQty));
      cur.saleAmount = round2(cur.saleAmount + toNumber(p.saleAmount));
      cur.saleCost = round2(cur.saleCost + toNumber(p.saleCost));
      cur.giftQty = round2(cur.giftQty + toNumber(p.giftQty));
      cur.damageQty = round2(cur.damageQty + toNumber(p.damageQty));
      cur.lostQty = round2(cur.lostQty + toNumber(p.lostQty));
      map.set(name, cur);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.saleAmount - a.saleAmount);
}

function mergeGroupon(days) {
  const map = new Map();
  for (const d of days) {
    for (const g of d.groupon || []) {
      if (!g || !g.platform) continue;
      const cur = map.get(g.platform) || {
        platform: g.platform,
        verifyCount: 0,
        verifyAmount: 0,
        newCustomerCount: 0,
        refundCount: 0,
        refundAmount: 0,
        settledAmount: 0
      };
      cur.verifyCount = round2(cur.verifyCount + toNumber(g.verifyCount));
      cur.verifyAmount = round2(cur.verifyAmount + toNumber(g.verifyAmount));
      cur.newCustomerCount = round2(cur.newCustomerCount + toNumber(g.newCustomerCount));
      cur.refundCount = round2(cur.refundCount + toNumber(g.refundCount));
      cur.refundAmount = round2(cur.refundAmount + toNumber(g.refundAmount));
      cur.settledAmount = round2(cur.settledAmount + toNumber(g.settledAmount));
      map.set(g.platform, cur);
    }
  }
  return Array.from(map.values());
}

function mergeAbnormal(days) {
  const map = new Map();
  for (const d of days) {
    for (const a of d.abnormal || []) {
      if (!a || !String(a.type || "").trim()) continue;
      const type = String(a.type).trim();
      const cur = map.get(type) || { type, count: 0, amount: 0, operator: "", remark: "" };
      cur.count = round2(cur.count + toNumber(a.count));
      cur.amount = round2(cur.amount + toNumber(a.amount));
      const join = (base, extra) => {
        const ex = String(extra || "").trim();
        if (!ex) return base;
        return base ? `${base}、${ex}` : ex;
      };
      cur.operator = join(cur.operator, a.operator);
      cur.remark = join(cur.remark, a.remark);
      map.set(type, cur);
    }
  }
  return Array.from(map.values());
}

function joinText(days, key) {
  const set = new Set();
  for (const d of days) {
    const t = String(d?.table?.[key] || "").trim();
    if (t) set.add(t);
  }
  return Array.from(set).join("、");
}

/**
 * 把区间内的日报汇总成一份周期报告补丁。
 * 返回 { patch, meta, total, dayCount, days }。
 * - patch：可合并到当前报告的数据；
 * - meta：覆盖天数与缺失日期（截至今天）；
 * - total：区间日报营收合计（用于环比/同比对照）。
 */
export function aggregateDayReports(reports, start, end) {
  const days = pickDayReports(reports, start, end);
  const dayDates = new Set(days.map((d) => d.date));
  const today = todayString();
  const missingDates = eachDate(start, end).filter((d) => !dayDates.has(d) && d <= today);
  const rangeDays = Math.max(1, eachDate(start, end).length);

  if (!days.length) {
    return {
      patch: null,
      meta: { dayCount: 0, rangeDays, missingDates, generatedAt: new Date().toISOString() },
      total: 0,
      dayCount: 0,
      days
    };
  }

  const quickOnlyDays = days.filter(
    (d) => breakdownOf(d) === 0 && toNumber(d.quickRevenue) > 0
  );
  const quickFold = sumOf(quickOnlyDays, (d) => totalRevenue(d));

  const revenue = {
    table: sumOf(days, (d) => toNumber(d.revenue?.table)),
    product: sumOf(days, (d) => toNumber(d.revenue?.product)),
    coach: sumOf(days, (d) => toNumber(d.revenue?.coach)),
    other: round2(sumOf(days, (d) => toNumber(d.revenue?.other)) + quickFold),
    remark: ""
  };

  const member = {
    newMembers: sumOf(days, (d) => toNumber(d.member?.newMembers)),
    rechargeAmount: sumOf(days, (d) => toNumber(d.member?.rechargeAmount)),
    tableCardRecharge: sumOf(days, (d) => toNumber(d.member?.tableCardRecharge)),
    rechargeGiftAmount: sumOf(days, (d) => toNumber(d.member?.rechargeGiftAmount)),
    consumeAmount: sumOf(days, (d) => toNumber(d.member?.consumeAmount)),
    giftCardConsume: sumOf(days, (d) => toNumber(d.member?.giftCardConsume)),
    newMemberRecharge: sumOf(days, (d) => toNumber(d.member?.newMemberRecharge)),
    existingMemberRecharge: sumOf(days, (d) => toNumber(d.member?.existingMemberRecharge))
  };

  const groupon = mergeGroupon(days);
  if (!groupon.length) {
    groupon.push(
      { platform: "抖音", verifyCount: 0, verifyAmount: 0, newCustomerCount: 0, refundCount: 0, refundAmount: 0, settledAmount: 0 },
      { platform: "美团", verifyCount: 0, verifyAmount: 0, newCustomerCount: 0, refundCount: 0, refundAmount: 0, settledAmount: 0 }
    );
  }

  const products = mergeProducts(days);
  const abnormal = mergeAbnormal(days);
  const total = sumOf(days, (d) => totalRevenue(d));

  const patch = {
    quickRevenue: sumOf(days, (d) => toNumber(d.quickRevenue)),
    customerCount: sumOf(days, (d) => toNumber(d.customerCount)),
    revenue,
    table: {
      openCount: sumOf(days, (d) => toNumber(d.table?.openCount)),
      openMinutes: sumOf(days, (d) => toNumber(d.table?.openMinutes)),
      salableMinutes: sumOf(days, (d) => toNumber(d.table?.salableMinutes) || 14400),
      peakHours: joinText(days, "peakHours"),
      emptyHours: joinText(days, "emptyHours")
    },
    member,
    groupon,
    products,
    abnormal,
    productQty: sumOf(days, (d) => toNumber(d.productQty)),
    productCost: sumOf(days, (d) => toNumber(d.productCost)),
    cashReceived: sumOf(days, (d) => toNumber(d.cashReceived)),
    reconciliation: {
      bankReceived: sumOf(days, (d) => toNumber(d.reconciliation?.bankReceived)),
      cashDeposit: sumOf(days, (d) => toNumber(d.reconciliation?.cashDeposit)),
      diffReason: "",
      diffStatus: "",
      systemError: "",
      diffNote: ""
    }
  };

  const meta = { dayCount: days.length, rangeDays, missingDates, generatedAt: new Date().toISOString() };
  return { patch, meta, total, dayCount: days.length, days };
}
