import { emptyReport } from "./store";

export function sampleReport(date, settings) {
  const report = emptyReport(date, settings);
  report.storeName = settings.storeName || "铜陵UU台球俱乐部";
  report.revenue = { table: 4200, product: 2100, coach: 1500, other: 850, remark: "示例数据" };
  report.table = {
    openCount: 96,
    openMinutes: 8256,
    salableMinutes: settings.salableMinutes || 14400,
    peakHours: "19:00-22:00",
    emptyHours: "14:00-16:00"
  };
  report.products = [
    { name: "百岁山矿泉水", category: "酒水饮料", saleQty: 96, saleAmount: 479.7, saleCost: 171.87, giftQty: 4, damageQty: 0, lostQty: 0 },
    { name: "东方树叶", category: "酒水饮料", saleQty: 48, saleAmount: 383.86, saleCost: 169.52, giftQty: 0, damageQty: 0, lostQty: 0 },
    { name: "东鹏特饮", category: "酒水饮料", saleQty: 44, saleAmount: 351.98, saleCost: 155.77, giftQty: 0, damageQty: 0, lostQty: 0 },
    { name: "红牛", category: "酒水饮料", saleQty: 32, saleAmount: 320, saleCost: 150.67, giftQty: 2, damageQty: 0, lostQty: 0 },
    { name: "扑克牌", category: "其他", saleQty: 18, saleAmount: 90, saleCost: 22.14, giftQty: 0, damageQty: 1, lostQty: 0 }
  ];
  report.lowStockItems = "康师傅拌面、菊花茶";
  report.member = { newMembers: 5, rechargeAmount: 2000, rechargeGiftAmount: 300, consumeAmount: 3600 };
  report.groupon = [
    { platform: "抖音", verifyCount: 8, verifyAmount: 450, newCustomerCount: 6 },
    { platform: "美团", verifyCount: 4, verifyAmount: 230, newCustomerCount: 2 }
  ];
  report.abnormal = [
    { type: "清台销单", count: 2, amount: 86, operator: "肖晓", remark: "客人中途离开" },
    { type: "改价改时长", count: 1, amount: 18, operator: "肖晓", remark: "" }
  ];
  report.reconciliation = { systemRevenue: 8650, actualRevenue: 8600 };
  report.done = "1. 完成会员活动复盘\n2. 完成库存盘点";
  report.notes = "1. 康师傅拌面补货\n2. 跟进昨日清台销单\n3. 抖音团购周末活动检查";
  return report;
}
