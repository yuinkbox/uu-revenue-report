export type Num = number | string;

export type ReportStatus = "draft" | "submitted" | "reviewing" | "finalized" | "sent";
export type DiffStatus = "" | "normal" | "explained" | "pending";

export interface ReportProduct {
  name: string;
  category: string;
  saleQty: Num;
  saleAmount: Num;
  saleCost: Num;
  giftQty: Num;
  damageQty: Num;
  lostQty: Num;
  profit?: Num;
}

export interface ReportGroupon {
  platform: string;
  verifyCount: Num;
  verifyAmount: Num;
  newCustomerCount: Num;
  refundCount?: Num;
  refundAmount?: Num;
  settledAmount?: Num;
}

export interface ReportAbnormal {
  type: string;
  count: Num;
  amount: Num;
  operator: string;
  remark: string;
}

/** 从日报汇总时的元信息（用于提示覆盖天数与缺失日期）。 */
export interface AggregationMeta {
  dayCount: number;
  rangeDays: number;
  missingDates: string[];
  generatedAt: string;
}

export interface Report {
  date: string;
  /** day = 单日报；custom = 自由起止周期（从日报汇总生成）。 */
  periodType?: "day" | "custom";
  endDate?: string;
  periodTarget?: Num;
  storeName: string;
  status?: ReportStatus;
  cashReceived?: Num;
  customerCount?: Num;
  productCost?: Num;
  productQty?: Num;
  revenue: { table: Num; product: Num; coach: Num; other: Num; remark: string };
  quickRevenue: Num;
  table: {
    openCount: Num;
    openMinutes: Num;
    salableMinutes: Num;
    peakHours: string;
    emptyHours: string;
  };
  products: ReportProduct[];
  lowStockItems: string;
  member: {
    newMembers: Num;
    rechargeAmount: Num;
    tableCardRecharge?: Num;
    rechargeGiftAmount: Num;
    consumeAmount: Num;
    giftCardConsume?: Num;
    newMemberRecharge?: Num;
    existingMemberRecharge?: Num;
  };
  groupon: ReportGroupon[];
  abnormal: ReportAbnormal[];
  reconciliation: {
    bankReceived?: Num;
    cashDeposit?: Num;
    diffReason?: string;
    diffStatus?: DiffStatus;
    systemError?: string;
    diffNote?: string;
  };
  done: string;
  notes: string;
  aggregationMeta?: AggregationMeta;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogProduct {
  name: string;
  category: string;
}

export interface Settings {
  storeName: string;
  monthTarget: Num;
  reconcileTolerance: Num;
  tableCount: Num;
  openHours: Num;
  salableMinutes: Num;
  safetyStockThreshold: Num;
  staff: string[];
  abnormalTypes: string[];
  diffReasons: string[];
  reportTitle: string;
  productCatalog: CatalogProduct[];
}

export type PageKey = "entry" | "preview" | "history" | "settings";

/** 服务器数据文件结构。 */
export interface ServerData {
  reports: Report[];
  settings: Settings | null;
  version: number;
  updatedAt: string;
}
