import * as XLSX from "xlsx";
import { applyImportPatch, importTaikeduoExcel, mergeImportPatch, mergeMember, summarizeWeeklyFiles } from "./src/lib/importers.js";

function fakeFile(name, rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return { name, arrayBuffer: async () => buffer };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

const comprehensive = fakeFile("综合报表.xlsx", [
  ["日期", "台桌营业额", "商品营业额", "教练营业额", "礼物营业额", "总营业额", "线上收款金额", "线下收款金额", "开台次数", "台桌总订单时长"],
  ["2026-08-03", 4200, 2100, 1500, 850, 8650, 8000, 600, 96, 8256]
]);

const comprehensiveResult = await importTaikeduoExcel(comprehensive, "2026-08-03");
assert(comprehensiveResult.ok, "综合报表可识别");
assert(comprehensiveResult.patch.reconciliation, "综合报表对账数据落到 reconciliation 字段");
assert(comprehensiveResult.patch.reconciliation.systemRevenue === 8650, "系统营收 = 8650");
assert(comprehensiveResult.patch.reconciliation.actualRevenue === 8600, "实收 = 8600");
assert(comprehensiveResult.patch.revenue.table === 4200, "台费 = 4200");
assert(comprehensiveResult.patch.table.openCount === 96, "开台 = 96");

const inventory = fakeFile("库存变动明细.xlsx", [
  ["商品名称", "变动类型", "子类型", "变动数量"],
  ["百岁山矿泉水", "出库", "赠送", 4],
  ["百岁山矿泉水", "出库", "赠送", 1],
  ["红牛", "出库", "损坏", 2],
  ["红牛", "出库", "丢失", 3]
]);

const inventoryResult = await importTaikeduoExcel(inventory, "2026-08-03");
assert(inventoryResult.ok, "库存变动明细可识别");
const invByName = Object.fromEntries(inventoryResult.patch.inventory.map((p) => [p.name, p]));
assert(invByName["百岁山矿泉水"].giftQty === 5, "百岁山矿泉水 赠送合计 5");
assert(invByName["红牛"].damageQty === 2, "红牛 损坏 2");
assert(invByName["红牛"].lostQty === 3, "红牛 丢失 3");

const base = {
  products: [{ name: "百岁山矿泉水", category: "酒水饮料", saleQty: 10, saleAmount: 100, saleCost: 40, giftQty: 0, damageQty: 0, lostQty: 0 }],
  groupon: [],
  abnormal: []
};
const merged = mergeImportPatch(base, inventoryResult.patch);
assert(merged.products.length === 2, "库存合并后商品行数 = 2");
assert(merged.products[0].giftQty === 5, "已存在商品赠送数量合并 = 5");
assert(merged.products[0].saleAmount === 100, "商品销售数据不被覆盖");
assert(merged.products[1].name === "红牛" && merged.products[1].damageQty === 2, "新商品行正确追加");

const salesOnly = fakeFile("库存变动明细报表.xlsx", [
  ["商品名称", "变动类型", "子类型", "变动数量"],
  ["红牛", "出库", "销售", -1],
  ["东方树叶", "出库", "销售", -1],
  ["百威啤酒", "出库", "销售", -3]
]);
const salesOnlyResult = await importTaikeduoExcel(salesOnly, "2026-08-03");
assert(salesOnlyResult.ok, "只有销售出库时不再报错");
assert(salesOnlyResult.message.includes("无赠送/损坏/丢失"), "提示无赠送/损坏/丢失");
assert(Array.isArray(salesOnlyResult.patch.inventory) && salesOnlyResult.patch.inventory.length === 0, "无有效数据时不产生商品行");

const withAdjust = fakeFile("库存调整.xlsx", [
  ["商品名称", "变动类型", "子类型", "变动数量"],
  ["荷花", "出库", "库存调整减少", -10],
  ["尖叫", "入库", "库存调整增加", 30],
  ["红牛", "出库", "损坏", -1]
]);
const withAdjustResult = await importTaikeduoExcel(withAdjust, "2026-08-03");
assert(withAdjustResult.ok, "含库存调整的表可导入");
assert(withAdjustResult.message.includes("库存调整减少 1 条未计入"), "提示库存调整减少未计入");
const adjByName = Object.fromEntries(withAdjustResult.patch.inventory.map((p) => [p.name, p]));
assert(adjByName["红牛"] && adjByName["红牛"].damageQty === 1, "损坏行正常导入");
assert(!adjByName["荷花"], "库存调整减少不进入商品行");

const groupon = fakeFile("第三方平台报表.xlsx", [
  ["团购券名称", "归属平台", "售价", "结算金额", "核销类型", "操作时间"],
  ["券A", "美团", 100, 90, "核销", "2026-07-29 10:00:00"],
  ["券B", "美团", 50, 0, "核销", "2026-07-29 11:00:00"],
  ["券C", "美团", 60, 0, "退款", "2026-07-29 12:00:00"],
  ["券D", "美团", 80, 0, "核销", "2026-07-28 09:00:00"],
  ["券E", "抖音", 30, 0, "核销", "2026-07-29 13:00:00"]
]);
const grouponResult = await importTaikeduoExcel(groupon, "2026-07-29");
assert(grouponResult.ok, "团购核销表可识别");
const gMap = Object.fromEntries(grouponResult.patch.groupon.map((g) => [g.platform, g]));
assert(gMap["美团"].verifyCount === 2, "美团只统计目标日期的核销行（排除退款和 7/28）");
assert(gMap["美团"].verifyAmount === 140, "美团金额优先取结算金额（90+50）");
assert(gMap["美团"].refundCount === 1 && gMap["美团"].refundAmount === 60, "退款单独统计");
assert(gMap["抖音"].verifyCount === 1 && gMap["抖音"].verifyAmount === 30, "抖音行正常统计");

const grouponCancel = fakeFile("第三方平台报表.xlsx", [
  ["团购券名称", "归属平台", "售价", "结算金额", "核销类型", "操作时间"],
  ["券A", "美团", 100, 0, "核销", "2026-08-08 10:00:00"],
  ["券B", "美团", 50, 0, "核销", "2026-08-08 11:00:00"],
  ["券C", "美团", -30, 0, "撤销", "2026-08-08 12:00:00"],
  ["券D", "美团", 20, 0, "撤销", "2026-08-08 13:00:00"]
]);
const grouponCancelResult = await importTaikeduoExcel(grouponCancel, "2026-08-08");
const cancelMap = Object.fromEntries(grouponCancelResult.patch.groupon.map((g) => [g.platform, g]));
assert(cancelMap["美团"].verifyCount === 2, "单数只统计核销行，撤销行不计单");
assert(cancelMap["美团"].verifyAmount === 150, "核销金额 = 100 + 50");
assert(cancelMap["美团"].refundCount === 2 && cancelMap["美团"].refundAmount === 50, "撤销行全部记为退款（30+20）");

const business = fakeFile("经营报表.xlsx", [
  ["日期", "客单总数", "台桌营业额", "商品营业额", "教练营业额", "总营业额", "美团团购", "抖音团购"],
  ["7/28/26", 30, 300, 200, 100, 600, 200, 50],
  ["7/29/26", 40, 400, 300, 150, 850, 500, 80]
]);
const businessResult = await importTaikeduoExcel(business, "2026-07-29");
assert(businessResult.ok, "经营报表可识别");
assert(businessResult.patch.revenue.table === 400, "经营报表按 7/29 取行（支持两位年份日期）");
assert(Array.isArray(businessResult.patch.groupon) && businessResult.patch.groupon.length === 0, "明细口径下经营报表不提供团购金额");

const businessSummary = await importTaikeduoExcel(business, "2026-07-29", { grouponAmountSource: "summary" });
const bSummaryMap = Object.fromEntries(businessSummary.patch.groupon.map((g) => [g.platform, g]));
assert(bSummaryMap["美团"].verifyAmount === 500, "汇总口径下美团金额来自 7/29 行");
assert(bSummaryMap["抖音"].verifyAmount === 80, "汇总口径下抖音金额来自 7/29 行");

const businessDetail = fakeFile("经营报表.xlsx", [
  ["客单总数", "台桌营业额", "商品营业额", "教练营业额", "总营业额", "储值卡支付金额", "台桌订单数", "平均客单时长"],
  [97, 994.17, 654.32, 780.3, 2428.79, 431.22, 73, 112.37]
]);
const businessDetailResult = await importTaikeduoExcel(businessDetail, "");
assert(businessDetailResult.patch.customerCount === 97, "客单总数自动带入");
assert(businessDetailResult.patch.member.consumeAmount === 431.22, "储值消费来自储值卡支付金额");
assert(Math.abs(businessDetailResult.patch.table.openMinutes - 8203.01) < 0.01, "台桌总时长=平均客单时长×台桌订单数");

const mergedGroupon = mergeImportPatch(
  { groupon: [{ platform: "抖音", verifyCount: 0, verifyAmount: 0, newCustomerCount: 0 }] },
  { groupon: [{ platform: "美团", verifyCount: 57, verifyAmount: 1034, newCustomerCount: 0 }] }
);
assert(mergedGroupon.groupon.length === 1 && mergedGroupon.groupon[0].platform === "美团", "合并后空平台行被移除");
assert(mergedGroupon.groupon[0].verifyCount === 57 && mergedGroupon.groupon[0].verifyAmount === 1034, "团购明细数据正确合并");

const weekBusiness = fakeFile("经营报表.xlsx", [
  ["日期", "客单总数", "台桌营业额", "商品营业额", "教练营业额", "总营业额", "美团团购", "抖音团购", "储值卡支付金额", "台桌订单数", "平均客单时长"],
  ["2026-07-27", 30, 300, 200, 100, 600, 100, 50, 80, 25, 100],
  ["2026-07-28", 40, 400, 300, 150, 850, 200, 60, 120, 30, 110],
  ["2026-08-01", 99, 999, 999, 999, 2997, 0, 0, 0, 1, 1]
]);
const weekMember = fakeFile("会员储值报表.xlsx", [
  ["会员名字", "充值金额", "赠送金额", "支付时间"],
  ["甲", 1000, 218, "2026-07-27 10:00:00"],
  ["乙", 500, 0, "2026-08-01 10:00:00"]
]);
const weekGroupon = fakeFile("第三方平台报表.xlsx", [
  ["归属平台", "售价", "结算金额", "核销类型", "操作时间"],
  ["美团", 100, 90, "核销", "2026-07-27 10:00:00"],
  ["抖音", 30, 0, "核销", "2026-07-28 11:00:00"],
  ["美团", 60, 0, "退款", "2026-07-27 12:00:00"]
]);
const weekProduct = fakeFile("商品综合报表.xlsx", [
  ["日期", "商品名称", "销售数量", "销售金额", "商品毛利润"],
  ["2026-07-27", "百岁山矿泉水", 10, 50, 30],
  ["2026-07-28", "红牛", 20, 200, 100],
  ["2026-08-01", "东鹏特饮", 99, 999, 500]
]);

const productNet = fakeFile("商品综合报表.xlsx", [
  ["商品名称", "商品分类", "净销售量", "营业额", "净销售成本", "净赠送数量", "经营毛利润"],
  ["百岁山矿泉水", "酒水饮料", 26, 130, 46.57, 0, 83.43],
  ["东鹏特饮", "酒水饮料", 9, 72, 31.87, 0, 40.13]
]);
const productNetResult = await importTaikeduoExcel(productNet, "");
assert(productNetResult.ok, "含净销售成本的商品表可识别");
const pn = productNetResult.patch.products[0];
assert(
  pn.name === "百岁山矿泉水" && pn.saleQty === 26 && pn.saleAmount === 130 && pn.saleCost === 46.57,
  "净销售量/营业额/净销售成本正确导入"
);

const memberChange = fakeFile("会员卡变动记录.xlsx", [
  ["会员姓名", "会员卡类型", "变动类型", "变动金额", "变动时间"],
  ["甲", "储值卡", "充值", 1000, "2026-08-08 09:00:00"],
  ["甲", "储值卡", "消费", -200, "2026-08-08 10:00:00"],
  ["乙", "台费卡", "消费", -100, "2026-08-08 11:00:00"],
  ["乙", "储值卡", "开卡", 0, "2026-08-08 12:00:00"]
]);
const memberChangeResult = await importTaikeduoExcel(memberChange, "2026-08-08");
assert(memberChangeResult.ok, "会员卡变动记录可识别");
const mc = memberChangeResult.patch.member;
assert(
  mc.rechargeAmount === 1000 && mc.consumeAmount === 200 && mc.giftCardConsume === 100 && mc.newMembers === 1,
  "会员卡变动汇总（台费卡消费归入礼金卡）"
);

const giftChange = fakeFile("礼金卡变动记录.xlsx", [
  ["会员名字", "礼金卡类型", "变动类型", "变动金额", "变动时间"],
  ["甲", "台桌", "消费抵扣", -112, "2026-08-08 10:00:00"],
  ["甲", "台桌", "赠送", 50, "2026-08-08 11:00:00"]
]);
const giftChangeResult = await importTaikeduoExcel(giftChange, "2026-08-08");
assert(giftChangeResult.ok, "礼金卡变动记录可识别");
const gc = giftChangeResult.patch.member;
assert(gc.giftCardConsume === 112 && gc.rechargeGiftAmount === 50, "礼金卡消费与赠送正确汇总");

const consumeReport = fakeFile("会员卡消费报表.xlsx", [
  ["会员名字", "支付方式", "会员卡实扣金额", "消费时间"],
  ["甲", "储值卡", 22, "2026-08-08 10:00:00"],
  ["乙", "礼金卡(台桌)", 100, "2026-08-08 11:00:00"],
  ["丙", "台费卡", 30, "2026-08-08 12:00:00"]
]);
const consumeResult = await importTaikeduoExcel(consumeReport, "2026-08-08");
const cr = consumeResult.patch.member;
assert(cr.consumeAmount === 22 && cr.giftCardConsume === 130, "会员卡消费报表拆分（台费卡归入礼金卡）");

const weekResult = await summarizeWeeklyFiles(
  [weekBusiness, weekMember, weekGroupon, weekProduct],
  "2026-07-27",
  "2026-07-28"
);
assert(weekResult.days.length === 2, "周报只统计区间内的经营报表天数（排除 8/1）");
assert(weekResult.summary.total === 1450, "周总营收 = 600 + 850");
assert(weekResult.summary.customerCount === 70, "周客单总数 = 30 + 40");
assert(weekResult.groupon["美团"].verifyCount === 1 && weekResult.groupon["美团"].verifyAmount === 90, "团购按区间统计并排除退款");
assert(weekResult.groupon["美团"].refundCount === 1 && weekResult.groupon["美团"].refundAmount === 60, "周报团购退款单独统计");
assert(weekResult.groupon["抖音"].verifyCount === 1 && weekResult.groupon["抖音"].verifyAmount === 30, "抖音团购统计正确");
assert(weekResult.member.rechargeAmount === 1000, "会员充值只统计区间内（排除 8/1）");
assert(weekResult.products.length === 2 && weekResult.products[0].name === "红牛", "商品 TOP 按销售金额排序且排除区间外");

const weekBusinessFile = fakeFile("经营报表.xlsx", [
  ["店铺名称", "开始时间", "结束时间", "总营业额", "台桌营业额", "商品营业额", "教练营业额", "客单总数"],
  ["铜陵UU台球俱乐部", "2026-08-01 00:00", "2026-08-08 00:00", 13062, 4504.76, 4586.13, 3971.11, 661],
  ["", "2026-08-01 00:00", "2026-08-02 00:00", 1739.87, 655.96, 662.39, 421.52, 116],
  ["", "2026-08-02 00:00", "2026-08-03 00:00", 1500, 500, 600, 400, 100],
  ["合计", "--", "--", 3239.87, 1155.96, 1262.39, 821.52, 216]
]);
const weekBizRes = await summarizeWeeklyFiles([weekBusinessFile], "2026-08-01", "2026-08-02");
assert(weekBizRes.days.length === 2, "周经营报表只统计每日行，排除周合计行");
assert(weekBizRes.summary.total === 3239.87, "周总营收 = 每日合计（不含周总行）");
const weeklyBizDay = await importTaikeduoExcel(weekBusinessFile, "2026-08-01");
assert(weeklyBizDay.patch.revenue.table === 655.96, "日报导入周表时取每日行而非周总行");

const weekProductNoDate = fakeFile("商品综合报表.xlsx", [
  ["商品名称", "商品分类", "净销售量", "营业额", "净销售成本"],
  ["百岁山矿泉水", "酒水饮料", 120, 599.81, 214.87],
  ["红牛", "酒水饮料", 38, 303.94, 134.56]
]);
const weekProdRes = await summarizeWeeklyFiles([weekProductNoDate], "2026-08-01", "2026-08-07");
assert(weekProdRes.products.length === 2 && weekProdRes.products[0].name === "百岁山矿泉水", "无日期列的商品表按周合计直接纳入");
assert(
  weekProdRes.products[0].saleQty === 120 && weekProdRes.products[0].saleAmount === 599.81 && weekProdRes.products[0].profit === 384.94,
  "周商品表用净销售量/营业额/经营毛利润汇总"
);
assert(
  weekProdRes.productTotals.qty === 158 &&
    weekProdRes.productTotals.amount === 903.75 &&
    weekProdRes.productTotals.cost === 349.43,
  "周商品汇总含全量合计（供商品与毛利使用）"
);

const mergedSummary = mergeImportPatch(
  { groupon: [{ platform: "美团", verifyCount: 3, verifyAmount: 904.5, newCustomerCount: 0 }] },
  { groupon: [{ platform: "美团", verifyCount: 57, verifyAmount: 0, newCustomerCount: 0 }] }
);
assert(mergedSummary.groupon[0].verifyCount === 60, "汇总口径下单数累加");
assert(mergedSummary.groupon[0].verifyAmount === 904.5, "汇总口径下金额保留经营报表的值");

const reapplied = applyImportPatch(
  { groupon: [{ platform: "美团", verifyCount: 79, verifyAmount: 1889.2, newCustomerCount: 0 }] },
  { groupon: [{ platform: "美团", verifyCount: 78, verifyAmount: 1834.3, newCustomerCount: 0 }] }
);
assert(reapplied.groupon.length === 1, "重新导入后仍只有一个平台行");
assert(reapplied.groupon[0].verifyCount === 78 && reapplied.groupon[0].verifyAmount === 1834.3, "重新导入替换团购数据，不重复累加");

const mm = mergeMember(
  { consumeAmount: 22, tableCardConsume: 0, giftCardConsume: 0, newMembers: 0 },
  { consumeAmount: 0, giftCardConsume: 112, newMembers: 2 }
);
assert(mm.consumeAmount === 22 && mm.giftCardConsume === 112 && mm.newMembers === 2, "会员明细合并按字段求和");

console.log(process.exitCode ? "有测试失败" : "全部通过");
