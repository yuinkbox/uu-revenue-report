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

export interface Report {
  date: string;
  periodType?: "day" | "week" | "quarter" | "halfYear" | "year";
  endDate?: string;
  periodTarget?: Num;
  storeName: string;
  status?: ReportStatus;
  submittedAt?: string;
  submittedBy?: string;
  reviewingAt?: string;
  reviewingBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  sentAt?: string;
  sentBy?: string;
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
    tableCardConsume?: Num;
    giftCardConsume?: Num;
    newMemberRecharge?: Num;
    existingMemberRecharge?: Num;
  };
  groupon: ReportGroupon[];
  abnormal: ReportAbnormal[];
  reconciliation: {
    systemRevenue: Num | null;
    actualRevenue: Num | null;
    bankReceived?: Num;
    cashDeposit?: Num;
    diffReason?: string;
    diffStatus?: DiffStatus;
    systemError?: string;
    diffNote?: string;
  };
  done: string;
  notes: string;
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
  managerPassword: string;
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
  exportFolder: string;
  grouponAmountSource: string;
}

export interface ImportMessage {
  ok: boolean;
  text: string;
}

export interface ImportResult {
  ok: boolean;
  messages: ImportMessage[];
  patch: Record<string, unknown>;
  failed?: number;
}

export type PageKey = "entry" | "import" | "preview" | "history" | "settings" | "weekly";
