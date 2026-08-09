import * as XLSX from "xlsx";
import { round2, toNumber } from "./calc";

function cleanKey(key) {
  return String(key).replace(/\s+/g, "").trim();
}

function cleanHeaders(row) {
  return Object.keys(row).map(cleanKey);
}

const HEADER_HINTS = [
  "商品名称",
  "总营业额",
  "台桌营业额",
  "商品营业额",
  "教练营业额",
  "充值金额",
  "赠送金额",
  "归属平台",
  "售价",
  "变动类型",
  "子类型",
  "销售金额",
  "销售数量",
  "开台次数",
  "日期",
  "开始时间",
  "结束时间",
  "团购券",
  "操作时间",
  "支付时间",
  "变动时间",
  "变动金额",
  "会员卡类型",
  "礼金卡类型",
  "会员卡实扣金额",
  "会员卡应扣金额",
  "出库总数",
  "入库总数",
  "商品毛利润"
];

function headerScore(row) {
  let score = 0;
  for (const cell of row) {
    const text = cleanKey(cell);
    if (!text) continue;
    if (HEADER_HINTS.some((hint) => text.includes(hint) || hint.includes(text))) score += 1;
  }
  return score;
}

function parseRows(rawRows) {
  const nonEmpty = rawRows.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [] };

  let headerIndex = 0;
  let bestScore = -1;
  const limit = Math.min(3, nonEmpty.length);
  for (let i = 0; i < limit; i += 1) {
    const score = headerScore(nonEmpty[i]);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }

  let headerRow = nonEmpty[headerIndex].map((cell) => cleanKey(cell));
  for (let i = headerIndex - 1; i >= 0; i -= 1) {
    const previous = nonEmpty[i];
    headerRow = headerRow.map((cell, index) => cell || (previous[index] !== undefined ? cleanKey(previous[index]) : ""));
  }
  const headers = headerRow.filter(Boolean);
  const rows = [];
  for (let i = headerIndex + 1; i < nonEmpty.length; i += 1) {
    const source = nonEmpty[i];
    const obj = {};
    headerRow.forEach((header, index) => {
      if (header) obj[header] = source[index] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows };
}

function firstValue(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return undefined;
}

function numberValue(row, names) {
  const value = firstValue(row, names);
  if (value === undefined) return 0;
  return toNumber(String(value).replace(/%/g, "").replace(/,/g, ""));
}

function dateMatches(cell, target) {
  if (!target) return true;
  const text = String(cell || "").trim();
  const targetDate = target.slice(0, 10);
  if (text.startsWith(targetDate) || targetDate.startsWith(text.slice(0, 10))) return true;

  const parts = text.replace(/[年月]/g, "-").split(/[-/.\s:]/).filter(Boolean).map(Number);
  const targetParts = targetDate.split("-").map(Number);
  if (parts.length >= 3 && targetParts.length === 3) {
    let year = parts[0] > 12 ? parts[0] : parts[2];
    let month = parts[0] > 12 ? parts[1] : parts[0];
    let day = parts[0] > 12 ? parts[2] : parts[1];
    if (year < 100) year += 2000;
    return year === targetParts[0] && month === targetParts[1] && day === targetParts[2];
  }
  return false;
}

function pickRow(rows, targetDate, dateKeys) {
  for (const row of rows) {
    for (const key of dateKeys) {
      if (row[key] !== undefined && dateMatches(row[key], targetDate)) {
        return row;
      }
    }
  }
  return null;
}

function detectTemplate(headers) {
  const joined = headers.join("|");
  if (
    headers.includes("总营业额") &&
    (headers.includes("开台次数") || headers.includes("台桌总订单时长"))
  ) {
    return "comprehensive";
  }
  if (
    headers.includes("总营业额") &&
    headers.includes("客单总数") &&
    (headers.includes("台桌营业额") || headers.includes("商品营业额"))
  ) {
    return "business";
  }
  if (
    headers.includes("归属平台") &&
    headers.includes("售价") &&
    (headers.includes("操作时间") || headers.includes("核销时间"))
  ) {
    return "groupon";
  }
  if (
    headers.includes("充值金额") &&
    headers.includes("赠送金额") &&
    (headers.includes("支付时间") || headers.includes("会员名字"))
  ) {
    return "member";
  }
  if (
    headers.some((h) => h.includes("变动类型")) &&
    headers.some((h) => h.includes("会员卡类型")) &&
    headers.some((h) => h.includes("变动金额"))
  ) {
    return "memberCardChange";
  }
  if (
    headers.some((h) => h.includes("变动类型")) &&
    headers.some((h) => h.includes("礼金卡类型")) &&
    headers.some((h) => h.includes("变动金额"))
  ) {
    return "giftCardChange";
  }
  if (headers.some((h) => h.includes("会员卡实扣金额")) || headers.some((h) => h.includes("会员卡应扣金额"))) {
    return "memberCardConsume";
  }
  if (headers.includes("变动类型") && headers.includes("子类型")) {
    return "inventoryChange";
  }
  if (
    headers.includes("商品名称") &&
    (headers.includes("销售金额") || headers.includes("营业额") || headers.includes("净销售额")) &&
    (headers.includes("销售成本") || headers.includes("净销售成本") || headers.includes("商品毛利润") || headers.includes("出库总数"))
  ) {
    return "productComprehensive";
  }
  return "unknown";
}

export async function readWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  return { sheetName: firstSheet, rawRows };
}

function extractDateValue(row) {
  const keys = ["日期", "开始时间", "操作时间", "消费时间", "支付时间", "核销时间", "变动时间"];
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return String(row[key]).trim();
  }
  return "";
}

function normalizeDate(text) {
  const t = String(text || "").trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let year = +m[3];
    if (year < 100) year += 2000;
    return `${year}-${String(+m[1]).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;
  }
  m = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  return "";
}

function isDailyRow(row) {
  const s = normalizeDate(String(firstValue(row, ["开始时间"]) || "").trim());
  const e = normalizeDate(String(firstValue(row, ["结束时间"]) || "").trim());
  if (!s || !e) return true;
  return (Date.parse(e) - Date.parse(s)) / 86400000 <= 1;
}

function inRange(dateStr, startDate, endDate) {
  return dateStr && dateStr >= startDate && dateStr <= endDate;
}

/**
 * 周报汇总：把一周的商云宝报表按日聚合。
 * 返回 { days, groupon, member, products, messages }。
 */
export async function summarizeWeeklyFiles(files, startDate, endDate) {
  const days = new Map();
  const groupon = {
    美团: { verifyCount: 0, verifyAmount: 0, refundCount: 0, refundAmount: 0 },
    抖音: { verifyCount: 0, verifyAmount: 0, refundCount: 0, refundAmount: 0 }
  };
  const member = {
    rechargeAmount: 0,
    rechargeGiftAmount: 0,
    consumeAmount: 0,
    tableCardConsume: 0,
    giftCardConsume: 0,
    consumeCount: 0
  };
  const products = new Map();
  const messages = [];

  const emptyDay = () => ({
    date: "",
    total: 0,
    table: 0,
    product: 0,
    coach: 0,
    customerCount: 0,
    openCount: 0,
    openMinutes: 0,
    meituan: 0,
    douyin: 0,
    consume: 0
  });

  for (const file of files) {
    let workbook;
    try {
      workbook = await readWorkbook(file);
    } catch {
      messages.push({ ok: false, text: `${file.name} 读取失败` });
      continue;
    }
    const { rawRows } = workbook;
    const { headers, rows } = parseRows(rawRows);
    const template = detectTemplate(headers);

    if (template === "business") {
      for (const row of rows) {
        const label = String(firstValue(row, ["店铺名称", "日期"]) || "").trim();
        if (label === "合计" || label === "总计") continue;
        if (!isDailyRow(row)) continue;
        const date = normalizeDate(extractDateValue(row));
        if (!inRange(date, startDate, endDate)) continue;
        const d = days.get(date) || emptyDay();
        d.date = date;
        d.total = round2(d.total + numberValue(row, ["总营业额"]));
        d.table = round2(d.table + numberValue(row, ["台桌营业额"]));
        d.product = round2(d.product + numberValue(row, ["商品营业额"]));
        d.coach = round2(d.coach + numberValue(row, ["教练营业额"]));
        d.customerCount += numberValue(row, ["客单总数"]);
        d.openCount += numberValue(row, ["台桌订单数", "开台次数"]);
        d.openMinutes = round2(d.openMinutes + numberValue(row, ["平均客单时长"]) * numberValue(row, ["台桌订单数"]));
        d.meituan = round2(d.meituan + numberValue(row, ["美团团购"]));
        d.douyin = round2(d.douyin + numberValue(row, ["抖音团购"]));
        d.consume = round2(d.consume + numberValue(row, ["储值卡支付金额"]));
        days.set(date, d);
      }
    } else if (
      template === "member" ||
      template === "memberCardChange" ||
      template === "giftCardChange" ||
      template === "memberCardConsume"
    ) {
      const kindMap = {
        member: "member",
        memberCardChange: "memberCard",
        giftCardChange: "giftCard",
        memberCardConsume: "memberCardConsume"
      };
      const agg = memberFromChangeRows(rows, startDate, endDate, kindMap[template]);
      member.rechargeAmount = round2(member.rechargeAmount + agg.rechargeAmount);
      member.rechargeGiftAmount = round2(member.rechargeGiftAmount + agg.rechargeGiftAmount);
      member.consumeAmount = round2(member.consumeAmount + agg.consumeAmount);
      member.tableCardConsume = round2(member.tableCardConsume + agg.tableCardConsume);
      member.giftCardConsume = round2(member.giftCardConsume + agg.giftCardConsume);
      member.consumeCount += agg.consumeCount;
    } else if (template === "productComprehensive") {
      const hasDateColumn = headers.some((h) => /日期|时间/.test(String(h)));
      for (const row of rows) {
        const date = normalizeDate(extractDateValue(row));
        if (hasDateColumn && !inRange(date, startDate, endDate)) continue;
        const name = String(firstValue(row, ["商品名称"]) || "").trim();
        if (!name || name === "合计" || name === "总计") continue;
        const item = products.get(name) || { name, saleQty: 0, saleAmount: 0, profit: 0 };
        item.saleQty += numberValue(row, ["净销售量", "销售数量"]);
        const saleAmount = numberValue(row, ["营业额", "净销售额", "销售金额", "净销售金额"]);
        item.saleAmount = round2(item.saleAmount + saleAmount);
        const cost = numberValue(row, ["净销售成本", "销售成本"]);
        const profit = numberValue(row, ["经营毛利润", "商品毛利润"]) || (cost ? Math.max(0, saleAmount - cost) : 0);
        item.profit = round2(item.profit + profit);
        products.set(name, item);
      }
    } else if (template === "groupon") {
      for (const row of rows) {
        const date = normalizeDate(extractDateValue(row));
        if (!inRange(date, startDate, endDate)) continue;
        const platform = String(firstValue(row, ["归属平台"]) || "").trim();
        if (platform !== "美团" && platform !== "抖音") continue;
        const type = String(firstValue(row, ["核销类型"]) || "").trim();
        const settle = numberValue(row, ["结算金额"]);
        const amount = settle || numberValue(row, ["售价"]);
        const isRefund = (type && type !== "核销") || amount < 0;
        if (isRefund) {
          groupon[platform].refundCount += 1;
          groupon[platform].refundAmount = round2(groupon[platform].refundAmount + Math.abs(amount));
        } else {
          groupon[platform].verifyCount += 1;
          groupon[platform].verifyAmount = round2(groupon[platform].verifyAmount + amount);
        }
      }
    } else {
      messages.push({ ok: false, text: `${file.name} 不是周报需要的报表，已跳过` });
    }
  }

  const dayList = Array.from(days.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  const allProducts = Array.from(products.values());
  const productTotals = allProducts.reduce(
    (acc, p) => {
      acc.qty += p.saleQty;
      acc.amount = round2(acc.amount + p.saleAmount);
      acc.cost = round2(acc.cost + Math.max(0, p.saleAmount - p.profit));
      acc.profit = round2(acc.profit + p.profit);
      return acc;
    },
    { qty: 0, amount: 0, cost: 0, profit: 0 }
  );
  const productList = allProducts.sort((a, b) => b.saleAmount - a.saleAmount);

  return {
    days: dayList,
    groupon,
    member,
    products: productList,
    productTotals,
    messages,
    summary: {
      total: round2(dayList.reduce((s, d) => s + d.total, 0)),
      openCount: dayList.reduce((s, d) => s + d.openCount, 0),
      customerCount: dayList.reduce((s, d) => s + d.customerCount, 0)
    }
  };
}

export async function importTaikeduoExcel(file, targetDate = "", options = {}) {
  const { sheetName, rawRows } = await readWorkbook(file);
  const { headers, rows } = parseRows(rawRows);
  if (!rows.length) {
    return { ok: false, message: "Excel 文件没有数据行", template: "unknown" };
  }

  const template = detectTemplate(headers);

  if (template === "productComprehensive") return importProductReport(rows, targetDate);
  if (template === "inventoryChange") return importInventoryChange(rows, targetDate);
  if (template === "comprehensive") return importComprehensive(rows, targetDate, options);
  if (template === "business") return importBusiness(rows, targetDate, options);
  if (template === "member") return importMemberDeposit(rows, targetDate);
  if (template === "memberCardChange") return importMemberCardChange(rows, targetDate);
  if (template === "giftCardChange") return importGiftCardChange(rows, targetDate);
  if (template === "memberCardConsume") return importMemberCardConsume(rows, targetDate);
  if (template === "groupon") return importGroupon(rows, targetDate, options);

  return {
    ok: false,
    message: `未能识别表格类型。检测到表头：${headers.slice(0, 12).join("、")}`,
    template,
    headers
  };
}

function importProductReport(rows, targetDate) {
  const map = new Map();
  let matchedRows = 0;

  for (const row of rows) {
    const name = firstValue(row, ["商品名称"]);
    if (!name) continue;
    const cleanName = String(name).trim();
    if (cleanName === "合计" || cleanName === "总计") continue;
    const item = map.get(String(name).trim()) || {
      name: String(name).trim(),
      category: String(firstValue(row, ["商品分类"]) || "").trim(),
      saleQty: 0,
      saleAmount: 0,
      saleCost: 0,
      giftQty: 0,
      damageQty: 0,
      lostQty: 0
    };
    item.saleQty = round2(item.saleQty + numberValue(row, ["净销售量", "销售数量"]));
    item.saleAmount = round2(item.saleAmount + numberValue(row, ["营业额", "净销售额", "销售金额", "净销售金额"]));
    let saleCost = numberValue(row, ["净销售成本", "销售成本"]);
    if (!saleCost) {
      const saleAmount = numberValue(row, ["营业额", "净销售额", "销售金额", "净销售金额"]);
      const profit = numberValue(row, ["商品毛利润"]);
      if (profit) saleCost = Math.max(0, saleAmount - profit);
    }
    item.saleCost = round2(item.saleCost + saleCost);
    item.giftQty = round2(item.giftQty + numberValue(row, ["净赠送数量", "赠送数量"]));
    item.damageQty = round2(item.damageQty + numberValue(row, ["损坏数量"]));
    item.lostQty = round2(item.lostQty + numberValue(row, ["丢失数量"]));
    map.set(item.name, item);
    matchedRows += 1;
  }

  const products = Array.from(map.values()).sort((a, b) => b.saleAmount - a.saleAmount);

  if (!products.length) {
    return { ok: false, message: "商品综合报表里没有识别到有效的商品行", template: "productComprehensive" };
  }

  const totals = products.reduce(
    (acc, p) => {
      acc.saleAmount = round2(acc.saleAmount + p.saleAmount);
      acc.saleCost = round2(acc.saleCost + p.saleCost);
      acc.giftQty = round2(acc.giftQty + p.giftQty);
      return acc;
    },
    { saleAmount: 0, saleCost: 0, giftQty: 0 }
  );

  return {
    ok: true,
    template: "productComprehensive",
    message: `商品报表：${products.length} 个商品，销售 ¥${totals.saleAmount}`,
    products,
    patch: { products },
    summary: totals
  };
}

function importInventoryChange(rows, targetDate) {
  const byProduct = new Map();
  const totals = { gift: 0, damage: 0, lost: 0, purchase: 0 };
  let matchedRows = 0;
  let salesRows = 0;
  let adjustedRows = 0;
  let otherRows = 0;

  const classify = (key) => {
    if (/赠送|赠品/.test(key)) return "gift";
    if (/损坏|报损/.test(key)) return "damage";
    if (/丢失|遗失|盘亏/.test(key)) return "lost";
    if (/采购|入库|库存调整增加/.test(key)) return "purchase";
    if (/库存调整减少/.test(key)) return "adjust";
    if (/销售|退货/.test(key)) return "sale";
    return "other";
  };

  for (const row of rows) {
    const subtype = firstValue(row, ["子类型"]);
    if (!subtype) continue;
    const qty = Math.abs(numberValue(row, ["变动数量"]));
    if (!qty) continue;

    const bucket = classify(String(subtype).trim());
    if (bucket === "sale") {
      salesRows += 1;
      continue;
    }
    if (bucket === "adjust") {
      adjustedRows += 1;
      continue;
    }
    if (bucket === "other") {
      otherRows += 1;
      continue;
    }

    matchedRows += 1;
    totals[bucket] = round2(totals[bucket] + qty);
    const productName = String(firstValue(row, ["商品名称"]) || "").trim();
    const item = byProduct.get(productName) || { name: productName, gift: 0, damage: 0, lost: 0, purchase: 0 };
    item[bucket] = round2(item[bucket] + qty);
    byProduct.set(productName, item);
  }

  const inventoryRows = Array.from(byProduct.values())
    .filter((item) => item.gift || item.damage || item.lost)
    .map((item) => ({
      name: item.name,
      category: "",
      saleQty: 0,
      saleAmount: 0,
      saleCost: 0,
      giftQty: item.gift,
      damageQty: item.damage,
      lostQty: item.lost
    }));

  const extra = [];
  if (adjustedRows) extra.push(`库存调整减少 ${adjustedRows} 条未计入`);
  if (otherRows) extra.push(`其他 ${otherRows} 条未计入`);
  const suffix = extra.length ? `（${extra.join("，")}）` : "";

  if (!matchedRows) {
    const reason = salesRows
      ? `只有 ${salesRows} 条销售/常规变动`
      : "没有可识别的变动";
    return {
      ok: true,
      template: "inventoryChange",
      message: `库存报表：${reason}，无赠送/损坏/丢失，未导入${suffix}`,
      inventory: totals,
      patch: { inventory: [] },
      summary: totals
    };
  }

  return {
    ok: true,
    template: "inventoryChange",
    message: `库存变动：赠送 ${totals.gift}、损坏 ${totals.damage}、丢失 ${totals.lost}${suffix}`,
    inventory: totals,
    patch: { inventory: inventoryRows },
    summary: totals
  };
}

function importComprehensive(rows, targetDate, options) {
  let row = pickRow(rows, targetDate, ["日期", "开始时间"]) || rows[rows.length - 1] || rows[0];
  if (!isDailyRow(row) && targetDate) {
    const daily = rows.find(
      (r) => isDailyRow(r) && dateMatches(String(firstValue(r, ["日期", "开始时间"]) || "").trim(), targetDate),
    );
    if (daily) row = daily;
  }
  if (!row) return { ok: false, message: "综合报表没有数据行", template: "comprehensive" };

  const tableRevenue = numberValue(row, ["台桌营业额"]);
  const productRevenue = numberValue(row, ["商品营业额"]);
  const coachRevenue = numberValue(row, ["教练营业额"]);
  const giftRevenue = numberValue(row, ["礼物营业额"]);
  const powerRevenue = numberValue(row, ["充电宝营业额"]);
  const totalRevenue = numberValue(row, ["总营业额"]);
  const online = numberValue(row, ["线上收款金额"]);
  const offline = numberValue(row, ["线下收款金额"]);
  const flow = firstValue(row, ["总流水"]);
  const recharge = numberValue(row, ["储值卡充值"]) + numberValue(row, ["台费卡充值"]);
  const rechargeGift = numberValue(row, ["台费卡充值赠送金额"]);
  const consume = numberValue(row, ["储值卡消费"]);
  const giftCardConsume = numberValue(row, ["台费卡消费"]);
  const openCount = numberValue(row, ["开台次数"]);
  const openMinutes = numberValue(row, ["台桌总订单时长/分钟", "台桌总订单时长"]);
  const patch = {
    revenue: {
      table: tableRevenue,
      product: productRevenue,
      coach: coachRevenue,
      other: round2(giftRevenue + powerRevenue)
    },
    table: {
      openCount,
      openMinutes,
      peakHours: ""
    },
    member: {
      rechargeAmount: recharge,
      rechargeGiftAmount: rechargeGift,
      consumeAmount: consume,
      giftCardConsume
    },
    reconciliation: {
      systemRevenue: flow !== undefined && flow !== "" ? toNumber(String(flow).replace(/,/g, "")) : totalRevenue,
      actualRevenue: round2(online + offline) || ""
    }
  };

  return {
    ok: true,
    template: "comprehensive",
    message: `综合报表：总营收 ¥${totalRevenue}、开台 ${openCount} 次`,
    patch,
    summary: { 总营收: totalRevenue, 台桌: tableRevenue, 商品: productRevenue, 教练: coachRevenue, 开台: openCount }
  };
}

function importBusiness(rows, targetDate, options) {
  let row = pickRow(rows, targetDate, ["日期", "开始时间"]) || rows[rows.length - 1] || rows[0];
  if (!isDailyRow(row) && targetDate) {
    const daily = rows.find(
      (r) => isDailyRow(r) && dateMatches(String(firstValue(r, ["日期", "开始时间"]) || "").trim(), targetDate),
    );
    if (daily) row = daily;
  }
  if (!row) return { ok: false, message: "经营报表没有数据行", template: "business" };

  const customerCount = numberValue(row, ["客单总数"]);
  const tableRevenue = numberValue(row, ["台桌营业额"]);
  const productRevenue = numberValue(row, ["商品营业额"]);
  const coachRevenue = numberValue(row, ["教练营业额"]);
  const giftRevenue = numberValue(row, ["礼物营业额"]);
  const powerRevenue = numberValue(row, ["充电宝营业额"]);
  const totalRevenue = numberValue(row, ["总营业额"]);
  const openCount = numberValue(row, ["台桌订单数", "开台次数"]);
  const avgDuration = numberValue(row, ["平均客单时长"]);
  const dailyAvgDuration = numberValue(row, ["日平均台桌时长"]);
  const tableCount = numberValue(row, ["店铺台桌数"]);
  const openMinutes = round2(
    openCount && avgDuration
      ? openCount * avgDuration
      : dailyAvgDuration * Math.max(1, tableCount)
  );
  const douyinAmount = numberValue(row, ["抖音团购"]);
  const meituanAmount = numberValue(row, ["美团团购"]);
  const consumeAmount = numberValue(row, ["储值卡支付金额"]);
  const giftCardConsume = numberValue(row, ["台费卡支付金额", "礼金卡支付"]);
  const actualRevenue = numberValue(row, ["现金支付金额", "现金"]) +
    numberValue(row, ["聚合支付金额", "聚合支付"]) +
    numberValue(row, ["储值卡支付金额"]) +
    numberValue(row, ["台费卡支付金额"]) +
    numberValue(row, ["礼金卡支付"]) +
    numberValue(row, ["礼包卡支付"]);

  const groupon =
    options.grouponAmountSource === "summary"
      ? [
          ...(douyinAmount ? [{ platform: "抖音", verifyCount: 0, verifyAmount: round2(douyinAmount), newCustomerCount: 0 }] : []),
          ...(meituanAmount ? [{ platform: "美团", verifyCount: 0, verifyAmount: round2(meituanAmount), newCustomerCount: 0 }] : [])
        ]
      : [];

  const patch = {
    customerCount,
    revenue: {
      table: tableRevenue,
      product: productRevenue,
      coach: coachRevenue,
      other: round2(giftRevenue + powerRevenue)
    },
    member: {
      consumeAmount,
      giftCardConsume
    },
    table: {
      openCount,
      openMinutes,
      peakHours: ""
    },
    groupon,
    reconciliation: {
      systemRevenue: totalRevenue,
      actualRevenue: actualRevenue || ""
    }
  };

  return {
    ok: true,
    template: "business",
    message: `经营报表：总营收 ¥${totalRevenue}、台桌 ¥${tableRevenue}、商品 ¥${productRevenue}、教练 ¥${coachRevenue}`,
    patch,
    summary: { 总营收: totalRevenue, 台桌: tableRevenue, 商品: productRevenue, 教练: coachRevenue }
  };
}

function importMemberDeposit(rows, targetDate) {
  let recharge = 0;
  let gift = 0;
  let count = 0;
  for (const row of rows) {
    recharge = round2(recharge + numberValue(row, ["充值金额"]));
    gift = round2(gift + numberValue(row, ["赠送金额"]));
    count += 1;
  }
  return {
    ok: true,
    template: "member",
    message: `会员储值：${count} 笔，充值 ¥${recharge}，赠送 ¥${gift}`,
    patch: { member: { rechargeAmount: recharge, rechargeGiftAmount: gift } },
    summary: { 充值: recharge, 赠送: gift, 笔数: count }
  };
}

function importGroupon(rows, targetDate, options) {
  const byPlatform = {};
  let count = 0;
  const sample = rows[0] || {};
  const statusKey = ["核销状态", "状态", "核销类型"].find((k) => sample[k] !== undefined);
  const dateKeys = ["核销时间", "操作时间"];

  const dateSet = new Set();
  for (const row of rows) {
    const d = String(firstValue(row, dateKeys) || "").trim().slice(0, 10);
    if (d) dateSet.add(d);
  }
  const multiDate = dateSet.size > 1;

  let matched = 0;
  for (const row of rows) {
    const platformRaw = firstValue(row, ["归属平台"]);
    if (!platformRaw) continue;
    const platformText = String(platformRaw).trim();
    if (!platformText || platformText === "合计" || platformText === "总计") continue;

    if (multiDate && targetDate) {
      const d = String(firstValue(row, dateKeys) || "").trim().slice(0, 10);
      if (d && !dateMatches(d, targetDate)) continue;
    }

    const platform = platformText.includes("抖音") ? "抖音" : platformText.includes("美团") ? "美团" : "其他";
    const settled = numberValue(row, ["结算金额"]);
    const amount = options.grouponAmountSource === "summary" ? 0 : settled ? settled : numberValue(row, ["售价"]);
    const statusText = statusKey ? String(row[statusKey] ?? "").trim() : "";
    const isRefund = (statusText && !/核销|成功|完成/.test(statusText)) || amount < 0;
    byPlatform[platform] = byPlatform[platform] || { verifyCount: 0, verifyAmount: 0, refundCount: 0, refundAmount: 0 };
    if (isRefund) {
      byPlatform[platform].refundCount += 1;
      byPlatform[platform].refundAmount = round2(byPlatform[platform].refundAmount + Math.abs(amount));
    } else {
      byPlatform[platform].verifyCount += 1;
      byPlatform[platform].verifyAmount = round2(byPlatform[platform].verifyAmount + amount);
    }
    matched += 1;
    count += 1;
  }

  if (!matched) {
    const range = [...dateSet].sort().join(" 至 ");
    const why = multiDate
      ? `文件包含 ${dateSet.size} 天数据（${range}），但没有目标日期 ${targetDate || "-"} 的记录，请检查软件日期或导出范围`
      : "没有识别到有效核销行";
    return { ok: false, message: `团购核销：${why}`, template: "groupon" };
  }

  const groupon = Object.entries(byPlatform).map(([platform, item]) => ({
    platform,
    verifyCount: item.verifyCount,
    verifyAmount: item.verifyAmount,
    newCustomerCount: 0,
    refundCount: item.refundCount,
    refundAmount: item.refundAmount
  }));
  return {
    ok: true,
    template: "groupon",
    message:
      options.grouponAmountSource === "summary"
        ? `团购核销：${groupon.map((g) => `${g.platform} ${g.verifyCount} 单（金额按汇总报表）`).join("，")}`
        : `团购核销：${groupon
            .map((g) => `${g.platform} ${g.verifyCount} 单 / ¥${g.verifyAmount}${g.refundCount ? `（退款 ${g.refundCount} 单 / ¥${g.refundAmount}）` : ""}`)
            .join("，")}`,
    patch: { groupon },
    summary: groupon.reduce((acc, g) => {
      acc[g.platform] = `${g.verifyCount} 单/${g.verifyAmount}`;
      return acc;
    }, {})
  };
}

function memberFromChangeRows(rows, startDate, endDate, kind) {
  const changeAmount = (row) => {
    const key = Object.keys(row).find((k) => k.includes("变动金额"));
    return key ? numberValue(row, [key]) : 0;
  };
  const agg = {
    rechargeAmount: 0,
    rechargeGiftAmount: 0,
    consumeAmount: 0,
    tableCardConsume: 0,
    giftCardConsume: 0,
    newMembers: 0,
    consumeCount: 0
  };
  for (const row of rows) {
    const date = normalizeDate(extractDateValue(row));
    if (!inRange(date, startDate, endDate)) continue;
    if (kind === "member") {
      agg.rechargeAmount = round2(agg.rechargeAmount + numberValue(row, ["充值金额"]));
      agg.rechargeGiftAmount = round2(agg.rechargeGiftAmount + numberValue(row, ["赠送金额"]));
      continue;
    }
    const type = String(firstValue(row, ["变动类型"]) || "").trim();
    const card = String(firstValue(row, ["会员卡类型", "礼金卡类型"]) || "").trim();
    if (kind === "memberCardConsume") {
      const amount = numberValue(row, ["会员卡实扣金额", "会员卡应扣金额"]);
      const pay = String(firstValue(row, ["支付方式"]) || "").trim();
      if (/储值/.test(pay)) agg.consumeAmount = round2(agg.consumeAmount + amount);
      else agg.giftCardConsume = round2(agg.giftCardConsume + amount);
      agg.consumeCount += 1;
      continue;
    }
    const amount = Math.abs(changeAmount(row));
    if (kind === "giftCard") {
      if (/消费/.test(type)) agg.giftCardConsume = round2(agg.giftCardConsume + amount);
      else if (/赠送/.test(type)) agg.rechargeGiftAmount = round2(agg.rechargeGiftAmount + amount);
      if (/消费/.test(type)) agg.consumeCount += 1;
      continue;
    }
    // memberCard
    if (/充值/.test(type)) {
      agg.rechargeAmount = round2(agg.rechargeAmount + amount);
    } else if (/消费/.test(type)) {
      if (/储值/.test(card)) agg.consumeAmount = round2(agg.consumeAmount + amount);
      else agg.giftCardConsume = round2(agg.giftCardConsume + amount);
      agg.consumeCount += 1;
    } else if (/赠送/.test(type)) {
      agg.rechargeGiftAmount = round2(agg.rechargeGiftAmount + amount);
    } else if (/开卡|注册|新增/.test(type)) {
      agg.newMembers += 1;
    }
  }
  return agg;
}

function importMemberCardChange(rows, targetDate) {
  const agg = memberFromChangeRows(rows, targetDate, targetDate, "memberCard");
  return {
    ok: true,
    template: "memberCardChange",
    message: `会员卡变动：充值 ¥${round2(agg.rechargeAmount)}、消费 ¥${round2(agg.consumeAmount + agg.giftCardConsume)}、新增会员 ${agg.newMembers}`,
    patch: { member: { ...agg } },
    summary: agg
  };
}

function importGiftCardChange(rows, targetDate) {
  const agg = memberFromChangeRows(rows, targetDate, targetDate, "giftCard");
  return {
    ok: true,
    template: "giftCardChange",
    message: `礼金卡变动：消费 ¥${round2(agg.giftCardConsume)}、赠送 ¥${round2(agg.rechargeGiftAmount)}`,
    patch: { member: { ...agg } },
    summary: agg
  };
}

function importMemberCardConsume(rows, targetDate) {
  const agg = memberFromChangeRows(rows, targetDate, targetDate, "memberCardConsume");
  return {
    ok: true,
    template: "memberCardConsume",
    message: `会员卡消费：储值卡 ¥${round2(agg.consumeAmount)}、礼金卡 ¥${round2(agg.giftCardConsume)}`,
    patch: { member: { ...agg } },
    summary: agg
  };
}

/** 合并会员明细补丁：数值字段求和，避免不同来源互相覆盖。 */
export function mergeMember(a, b) {
  const out = { ...(a || {}), ...(b || {}) };
  for (const key of [
    "rechargeAmount",
    "rechargeGiftAmount",
    "consumeAmount",
    "tableCardConsume",
    "giftCardConsume",
    "newMembers",
    "consumeCount"
  ]) {
    out[key] = round2(toNumber(a?.[key]) + toNumber(b?.[key]));
  }
  return out;
}

export function mergeImportPatch(report, patch) {
  if (!patch) return report;
  const next = { ...report };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "groupon" && Array.isArray(value)) {
      const byPlatform = new Map();
      for (const g of [...(next.groupon || []), ...value]) {
        if (!g || !g.platform) continue;
        const cur = byPlatform.get(g.platform) || {
          platform: g.platform,
          verifyCount: 0,
          verifyAmount: 0,
          newCustomerCount: 0
        };
        cur.verifyCount = round2(toNumber(cur.verifyCount) + toNumber(g.verifyCount));
        if (!toNumber(cur.verifyAmount) && toNumber(g.verifyAmount)) {
          cur.verifyAmount = round2(g.verifyAmount);
        }
        cur.newCustomerCount = round2(toNumber(cur.newCustomerCount) + toNumber(g.newCustomerCount));
        byPlatform.set(g.platform, cur);
      }
      next.groupon = Array.from(byPlatform.values()).filter(
        (g) => toNumber(g.verifyCount) || toNumber(g.verifyAmount) || toNumber(g.newCustomerCount)
      );
      continue;
    }
    if (key === "inventory" && Array.isArray(value)) {
      const products = [...(next.products || [])];
      for (const inv of value) {
        if (!inv) continue;
        const idx = products.findIndex((p) => p.name && inv.name && p.name === inv.name);
        if (idx >= 0) {
          products[idx] = {
            ...products[idx],
            giftQty: round2(toNumber(products[idx].giftQty) + toNumber(inv.giftQty)),
            damageQty: round2(toNumber(products[idx].damageQty) + toNumber(inv.damageQty)),
            lostQty: round2(toNumber(products[idx].lostQty) + toNumber(inv.lostQty))
          };
        } else {
          products.push(inv);
        }
      }
      next.products = products;
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      next[key] &&
      typeof next[key] === "object" &&
      !Array.isArray(next[key])
    ) {
      next[key] = { ...next[key], ...value };
    } else {
      next[key] = value;
    }
  }
  return next;
}

/**
 * 应用导入补丁：普通字段走合并，团购数据整体替换（重新导入时避免旧值残留与重复累加）。
 */
export function applyImportPatch(report, patch) {
  const merged = mergeImportPatch(report, patch);
  if (patch && Array.isArray(patch.groupon)) {
    return { ...merged, groupon: patch.groupon };
  }
  return merged;
}

export function sortFilesForImport(files) {
  const priority = (item) => {
    const name = String(typeof item === "string" ? item : item.name || "");
    if (/综合|经营/.test(name)) return 0;
    if (/会员|储值/.test(name)) return 1;
    if (/第三方|团购|核销/.test(name)) return 2;
    if (/商品/.test(name)) return 3;
    if (/库存/.test(name)) return 4;
    return 5;
  };
  return [...files].sort((a, b) => priority(a) - priority(b));
}
