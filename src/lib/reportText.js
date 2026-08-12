import { directRevenue, reconcileMetrics, round2, toNumber, topProducts } from "./calc";
import { signedMoney } from "./format";

function money(v) {
  const num = round2(v);
  return num.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function lines(text) {
  return String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function numbered(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

export function buildWeChatText(report, metrics, settings, version = "shareholder") {
  const parts = [];
  const date = report.date || "";
  const dateLabel = date.length >= 10 ? `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : date;
  const store = report.storeName || settings.storeName || "UU台球俱乐部";

  parts.push(`【${store} · ${dateLabel}营收日报】`);
  parts.push("");
  parts.push(`今日总营收：¥${money(metrics.total)}`);
  if (metrics.periodMom !== null) {
    parts.push(`环比上期：${metrics.periodMom >= 0 ? "+" : ""}${metrics.periodMom.toFixed(1)}%`);
  }

  const breakdown = metrics.shares.filter((s) => s.key !== "quick");
  if (breakdown.some((s) => s.value > 0)) {
    parts.push(
      breakdown.map((s) => `${s.label} ¥${money(s.value)}`).join(" ｜ ")
    );
  }
  if (metrics.monthRate !== null) {
    parts.push(`本月累计 ¥${money(metrics.monthAccum)}，目标完成率 ${metrics.monthRate.toFixed(1)}%`);
  }
  parts.push("");

  parts.push("【台桌运营】");
  const openCount = report.table.openCount || 0;
  parts.push(`开台 ${openCount} 桌 ｜ 台时利用率 ${metrics.utilization.toFixed(1)}%`);
  parts.push("");

  parts.push("【商品与库存】");
  const hasProducts = report.products.some((p) => p.name);
  if (hasProducts) {
    parts.push(`商品销售 ¥${money(metrics.productTotal.saleAmount)} ｜ 毛利 ¥${money(metrics.grossProfit)}（${metrics.grossRate.toFixed(1)}%）`);
    const top = topProducts(report, 5).map((p) => p.name).join("、");
    if (top) parts.push(`今日 TOP 商品：${top}`);
    parts.push(
      `赠送 ${money(metrics.productTotal.giftQty)} 件 ｜ 损坏 ${money(metrics.productTotal.damageQty)} 件 ｜ 丢失 ${money(metrics.productTotal.lostQty)} 件`
    );
  } else {
    parts.push("今日未填写商品明细");
  }
  if (report.lowStockItems) parts.push(`库存预警：${report.lowStockItems}`);
  parts.push("");

  parts.push("【会员】");
  const rechargeNew = toNumber(report.member.newMemberRecharge);
  const rechargeOld = toNumber(report.member.existingMemberRecharge);
  const rechargeShow = rechargeNew + rechargeOld > 0 ? rechargeNew + rechargeOld : toNumber(report.member.rechargeAmount);
  parts.push(
    `新增会员 ${report.member.newMembers || 0} 人 ｜ 充值 ¥${money(rechargeShow)}（新会员 ¥${money(rechargeNew)} / 老会员 ¥${money(rechargeOld)}）`
  );
  parts.push(`充值赠送（礼金卡）¥${money(report.member.rechargeGiftAmount)}`);
  parts.push(`台费卡充值 ¥${money(report.member.tableCardRecharge)}`);
  parts.push(`会员消费占比 ${metrics.memberRate.toFixed(1)}%`);
  parts.push(
    `储值卡消费 ¥${money(report.member.consumeAmount)} ｜ 礼金卡消费 ¥${money(report.member.giftCardConsume)}`
  );
  parts.push("");
  parts.push("【团购】");
  parts.push(
    `核销 ${metrics.groupon.verifyCount} 单 / ¥${money(metrics.groupon.verifyAmount)}` +
      (metrics.groupon.refundCount > 0
        ? ` ｜ 退款 ${metrics.groupon.refundCount} 单 / ¥${money(metrics.groupon.refundAmount)}`
        : "") +
      (toNumber(metrics.settledAmount) || toNumber(metrics.pendingTotal)
        ? ` ｜ 结算到账 ¥${money(metrics.settledAmount)} ｜ 待收 ¥${money(metrics.pendingTotal)}`
        : "")
  );
  parts.push("");

  parts.push("【异常与对账】");
  parts.push(
    metrics.abnormal.count > 0
      ? `异常记录 ${metrics.abnormal.count} 笔 / ¥${money(metrics.abnormal.amount)}`
      : "异常记录：无"
  );
  if (version !== "staff") {
    const rm = reconcileMetrics(report, settings);
    const direct = directRevenue(report);
    parts.push("【对账结论】");
    parts.push(`总营收（经营收入）¥${money(metrics.total)}（商云宝营业额+团购核销净额）｜ 储值充值 ¥${money(report.member.rechargeAmount)}（预收款）`);
    parts.push(
      `现场实收 ¥${money(rm.actualReceived)} ｜ 应到账 ¥${money(rm.expectedRevenue)}（营业额+充值−储值卡消费−台费卡消费）｜ 差异 ${signedMoney(rm.diff)}（${rm.tier === "normal" ? "正常" : rm.tier === "explained" ? "已解释" : "待查"}）`
    );
    parts.push(`累计差额（同周期 ${metrics.reconcileCount} 份日报）¥${money(metrics.reconcileTotal)}`);
    if (report.reconciliation?.diffReason) {
      const note = report.reconciliation.diffNote ? `（${report.reconciliation.diffNote}）` : "";
      parts.push(`差异原因：${report.reconciliation.diffReason}${note}`);
    }
    if (report.reconciliation?.systemError) parts.push(`商云宝记录：${report.reconciliation.systemError}`);
  }
  parts.push("");

  parts.push("【昨日完成】");
  const done = lines(report.done);
  parts.push(done.length ? numbered(done) : "无");
  parts.push("");

  parts.push("【今日待办】");
  const todo = lines(report.notes);
  parts.push(todo.length ? numbered(todo) : "无");
  return parts.join("\n");
}
