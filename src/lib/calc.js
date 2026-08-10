import { findReportForRange, lastYearRange, previousPeriodRange } from "./period";

export function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function totalRevenue(report) {
  if (!report) return 0;
  const grouponAmount = (report.groupon || []).reduce(
    (sum, g) => sum + toNumber(g.verifyAmount) - toNumber(g.refundAmount),
    0,
  );
  const breakdown =
    toNumber(report.revenue.table) +
    toNumber(report.revenue.product) +
    toNumber(report.revenue.coach) +
    toNumber(report.revenue.other);
  if (breakdown > 0) {
    // 经营收入 = 商云宝营业额 + 团购核销净额（未提现）
    return round2(breakdown + grouponAmount);
  }
  // 只填总额时以用户填的总数为准
  return toNumber(report.quickRevenue);
}

/** 商云宝直营营业额（不含团购核销）。 */
export function directRevenue(report) {
  if (!report) return 0;
  const breakdown =
    toNumber(report.revenue.table) +
    toNumber(report.revenue.product) +
    toNumber(report.revenue.coach) +
    toNumber(report.revenue.other);
  if (breakdown > 0) return round2(breakdown);
  return toNumber(report.quickRevenue);
}

export function percent(part, total) {
  if (!total) return 0;
  return (toNumber(part) / total) * 100;
}

export function formatPercent(value, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function round2(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

export function reconcileMetrics(report, settings) {
  const expectedRevenue = round2(
    directRevenue(report) +
      toNumber(report.member?.rechargeAmount) -
      toNumber(report.member?.consumeAmount)
  );
  const actualReceived = round2(
    toNumber(report.cashReceived) +
      toNumber(report.reconciliation?.bankReceived) -
      toNumber(report.reconciliation?.cashDeposit)
  );
  const diff = round2(actualReceived - expectedRevenue);
  const tolerance = toNumber(settings?.reconcileTolerance) || 3;
  let tier = "normal";
  if (Math.abs(diff) > tolerance) {
    tier = report.reconciliation?.diffStatus === "explained" ? "explained" : "pending";
  }
  return { expectedRevenue, actualReceived, diff, tier };
}

export function averageTicket(report) {
  const count = toNumber(report?.customerCount);
  return count > 0 ? round2(totalRevenue(report) / count) : null;
}

export function averageCost(report) {
  const qty = toNumber(report?.productQty);
  const cost = toNumber(report?.productCost);
  return qty > 0 ? round2(cost / qty) : null;
}

export function productSummary(report) {
  const products = (report?.products || []).filter((p) => p.name);
  if (products.length) {
    const qty = products.reduce((s, p) => s + toNumber(p.saleQty), 0);
    const amount = round2(products.reduce((s, p) => s + toNumber(p.saleAmount), 0));
    const cost = round2(
      products.reduce(
        (s, p) => s + (toNumber(p.saleCost) || Math.max(0, toNumber(p.saleAmount) - toNumber(p.profit))),
        0,
      ),
    );
    const profit = round2(amount - cost);
    const unknown = amount > 0 && cost === 0;
    return { qty, amount, cost, profit, rate: unknown ? null : amount ? (profit / amount) * 100 : 0, unknown };
  }
  const amount = toNumber(report?.revenue?.product);
  const cost = toNumber(report?.productCost);
  const qty = toNumber(report?.productQty);
  const profit = round2(amount - cost);
  const unknown = amount > 0 && cost === 0;
  return { qty, amount, cost, profit, rate: unknown ? null : amount ? (profit / amount) * 100 : 0, unknown };
}

export function topProducts(report, limit = 5) {
  return (report.products || [])
    .filter((p) => p.name)
    .sort((a, b) => toNumber(b.saleAmount) - toNumber(a.saleAmount))
    .slice(0, limit);
}

export function reportMetrics(report, reports, settings) {
  const total = totalRevenue(report);
  const revenue = report.revenue;
  const periodType = report.periodType || "day";
  const prevRange = previousPeriodRange(periodType, report.date);
  const prevPeriodReport = findReportForRange(reports, periodType, prevRange.start, prevRange.end);
  const periodMom = prevPeriodReport
    ? percent(total - totalRevenue(prevPeriodReport), totalRevenue(prevPeriodReport))
    : null;
  const lyRange = lastYearRange(periodType, report.date);
  const lyPeriodReport = findReportForRange(reports, periodType, lyRange.start, lyRange.end);
  const periodYoy = lyPeriodReport
    ? percent(total - totalRevenue(lyPeriodReport), totalRevenue(lyPeriodReport))
    : null;
  const prevReports = reports
    .filter((r) => r.date < report.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const prevReport = prevReports[0];
  const prevTotal = prevReport ? totalRevenue(prevReport) : null;
  const mom = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : null;

  const month = report.date.slice(0, 7);
  const monthReports = reports.filter((r) => r.date.startsWith(month));
  const monthAccum = monthReports.reduce((sum, r) => sum + totalRevenue(r), 0);
  const monthTarget = toNumber(settings.monthTarget);
  const monthRate = monthTarget ? (monthAccum / monthTarget) * 100 : null;

  const openMinutes = toNumber(report.table.openMinutes);
  const salableMinutes = toNumber(report.table.salableMinutes);
  const utilization = salableMinutes ? (openMinutes / salableMinutes) * 100 : 0;

  const productTotal = report.products.reduce(
    (acc, p) => {
      acc.saleQty += toNumber(p.saleQty);
      acc.saleAmount += toNumber(p.saleAmount);
      acc.saleCost += toNumber(p.saleCost);
      acc.giftQty += toNumber(p.giftQty);
      acc.damageQty += toNumber(p.damageQty);
      acc.lostQty += toNumber(p.lostQty);
      return acc;
    },
    { saleQty: 0, saleAmount: 0, saleCost: 0, giftQty: 0, damageQty: 0, lostQty: 0 }
  );
  const grossProfit = round2(productTotal.saleAmount - productTotal.saleCost);
  const grossRate = productTotal.saleAmount ? (grossProfit / productTotal.saleAmount) * 100 : 0;

  const memberConsume = toNumber(report.member.consumeAmount) + toNumber(report.member.giftCardConsume);
  const memberRate = total ? (memberConsume / total) * 100 : 0;

  const groupon = report.groupon.reduce(
    (acc, g) => {
      acc.verifyCount += toNumber(g.verifyCount);
      acc.verifyAmount += toNumber(g.verifyAmount);
      acc.newCustomerCount += toNumber(g.newCustomerCount);
      acc.refundCount += toNumber(g.refundCount);
      acc.refundAmount += toNumber(g.refundAmount);
      return acc;
    },
    { verifyCount: 0, verifyAmount: 0, newCustomerCount: 0, refundCount: 0, refundAmount: 0 }
  );

  const abnormal = report.abnormal.reduce(
    (acc, a) => {
      acc.count += toNumber(a.count);
      acc.amount += toNumber(a.amount);
      return acc;
    },
    { count: 0, amount: 0 }
  );

  const systemRevenue = report.reconciliation.systemRevenue === null || report.reconciliation.systemRevenue === "" ? null : toNumber(report.reconciliation.systemRevenue);
  const actualRevenue = report.reconciliation.actualRevenue === null || report.reconciliation.actualRevenue === "" ? null : toNumber(report.reconciliation.actualRevenue);
  const diff = systemRevenue !== null && actualRevenue !== null ? round2(systemRevenue - actualRevenue) : null;

  const breakdownTotal =
    toNumber(revenue.table) +
    toNumber(revenue.product) +
    toNumber(revenue.coach) +
    toNumber(revenue.other);
  const shareItems = breakdownTotal > 0
    ? [
        { key: "table", label: "现场直开台费", value: toNumber(revenue.table) },
        { key: "product", label: "商品", value: toNumber(revenue.product) },
        { key: "coach", label: "助教费", value: toNumber(revenue.coach) },
        { key: "other", label: "其他", value: toNumber(revenue.other) }
      ]
    : [{ key: "quick", label: "快速营收", value: total }];
  const grouponNet = round2(groupon.verifyAmount - groupon.refundAmount);
  if (breakdownTotal > 0 && grouponNet > 0) {
    shareItems.push({ key: "groupon", label: "团购核销", value: grouponNet });
  }
  const shares = shareItems.map((item) => ({ ...item, rate: percent(item.value, total) }));

  return {
    total,
    periodMom,
    periodYoy,
    shares,
    mom,
    prevTotal,
    monthAccum,
    monthRate,
    utilization,
    productTotal,
    grossProfit,
    grossRate,
    memberRate,
    groupon,
    abnormal,
    diff,
    systemRevenue,
    actualRevenue
  };
}
