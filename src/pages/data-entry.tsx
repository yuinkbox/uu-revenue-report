import { useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Table2,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Field, NumberInput, SelectInput, TextInput } from "@/components/fields";
import { MetricCard } from "@/components/metric-card";
import PageHeader from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import {
  averageTicket,
  directRevenue,
  productSummary,
  reconcileDiagnostics,
  reconcileMetrics,
  reportMetrics,
  round2,
  toNumber,
} from "@/lib/calc";
import { aggregateDayReports } from "@/lib/aggregate";
import { money, signedMoney, signedRate } from "@/lib/format";
import {
  PERIOD_TYPES,
  lastNDays,
  lastMonth,
  lastWeek,
  thisMonth,
  thisQuarter,
  thisWeek,
  thisYear,
} from "@/lib/period";
import { todayString } from "@/lib/store";
import type { Report, Settings } from "@/types/report";

const PERIOD_LABEL: Record<string, string> = {
  day: "日报",
  custom: "周期报告",
};

const PRESETS = [
  { label: "近7天", range: () => lastNDays(7, todayString()) },
  { label: "本周", range: () => thisWeek(todayString()) },
  { label: "上周", range: () => lastWeek(todayString()) },
  { label: "近30天", range: () => lastNDays(30, todayString()) },
  { label: "本月", range: () => thisMonth(todayString()) },
  { label: "上月", range: () => lastMonth(todayString()) },
  { label: "本季", range: () => thisQuarter(todayString()) },
  { label: "今年", range: () => thisYear(todayString()) },
];

export default function DataEntry({
  report,
  reports,
  settings,
  onChange,
  onSave,
  onPreview,
}: {
  report: Report;
  reports: Report[];
  settings: Settings;
  onChange: (r: Report) => void;
  onSave: () => void;
  onPreview: () => void;
}) {
  const periodType = report.periodType === "custom" ? "custom" : "day";
  const isDay = periodType === "day";
  const endDate = isDay ? report.date : report.endDate || report.date;
  const metrics = reportMetrics(report, reports, settings);
  const rm = reconcileMetrics(report, settings);
  const diagnosticLines = reconcileDiagnostics(report, metrics, settings);
  const ticket = averageTicket(report);

  const target = isDay ? settings.monthTarget : report.periodTarget;
  const targetRate = toNumber(target) > 0 ? (metrics.total / toNumber(target)) * 100 : null;

  const set = (patch: Partial<Report>) => onChange({ ...report, ...patch });
  const setNested = <K extends keyof Report>(key: K, patch: Partial<Report[K]>) =>
    set({ [key]: { ...(report[key] as object), ...patch } } as Partial<Report>);

  const applyPeriodType = (type: string) => {
    const day = todayString();
    if (type === "custom") {
      const r = lastNDays(7, day);
      set({ periodType: "custom", date: r.start, endDate: r.end });
    } else {
      set({ periodType: "day", date: day, endDate: day });
    }
  };

  const applyPreset = (fn: () => { start: string; end: string }) => {
    const r = fn();
    set({ date: r.start, endDate: r.end });
  };

  const setStartDate = (v: string) => {
    if (!v) return;
    set({ date: v, endDate: isDay ? v : endDate < v ? v : endDate });
  };

  const runAggregate = () => {
    const start = report.date;
    const end = isDay ? report.date : report.endDate || report.date;
    if (!start || !end || end < start) {
      toast.warning("请先选择正确的起止日期");
      return;
    }
    const { patch, meta } = aggregateDayReports(reports, start, end);
    if (!patch) {
      set({ aggregationMeta: meta });
      toast.warning(meta.missingDates.length ? `该范围内没有已保存的日报（缺 ${meta.missingDates.length} 天）` : "该范围内没有日报数据");
      return;
    }
    onChange({
      ...report,
      ...(patch as Partial<Report>),
      periodType: report.periodType,
      date: report.date,
      endDate: report.endDate,
      aggregationMeta: meta,
    });
    toast.success(isDay ? "已载入该日报数据" : `已按 ${meta.dayCount} 天日报汇总`);
  };

  const grouponRows = useMemo(() => {
    const platforms = ["美团", "抖音"];
    return platforms.map((p) => {
      const existing = report.groupon.find((g) => g.platform === p);
      return existing || { platform: p, verifyCount: 0, verifyAmount: 0, newCustomerCount: 0, refundCount: 0, refundAmount: 0 };
    });
  }, [report.groupon]);

  const updateGrouponRow = (platform: string, patch: Partial<Report["groupon"][number]>) => {
    const exists = report.groupon.some((g) => g.platform === platform);
    const next = exists
      ? report.groupon.map((g) => (g.platform === platform ? { ...g, ...patch } : g))
      : [...report.groupon, { platform, verifyCount: 0, verifyAmount: 0, newCustomerCount: 0, ...patch }];
    set({ groupon: next });
  };

  const abnormalOptions = useMemo(() => {
    const setOf = new Set<string>([...(settings.abnormalTypes || []), ...report.abnormal.map((a) => a.type).filter(Boolean)]);
    return Array.from(setOf);
  }, [settings.abnormalTypes, report.abnormal]);

  const hasProducts = report.products.some((p) => p.name);
  const prodSum = productSummary(report);
  const direct = directRevenue(report);
  const newRecharge = toNumber(report.member.newMemberRecharge);
  const existingRecharge = toNumber(report.member.existingMemberRecharge);
  const rechargeTotal = round2(newRecharge + existingRecharge);
  const rechargeDisplay = rechargeTotal > 0 ? rechargeTotal : toNumber(report.member.rechargeAmount);
  const setRecharge = (key: "newMemberRecharge" | "existingMemberRecharge", v: string) => {
    const nv = key === "newMemberRecharge" ? toNumber(v) : newRecharge;
    const ov = key === "existingMemberRecharge" ? toNumber(v) : existingRecharge;
    setNested("member", { [key]: v, rechargeAmount: round2(nv + ov) });
  };
  const targetHint = isDay
    ? `月度目标 ${money(settings.monthTarget)}`
    : report.periodTarget
      ? `本期目标 ${money(report.periodTarget)}`
      : "未设本期目标（显示日均）";
  const diffTone = rm.diff > 0 ? "danger" : rm.diff < 0 ? "success" : "default";

  const aggMeta = report.aggregationMeta;
  const missingShown = aggMeta ? aggMeta.missingDates.slice(0, 8) : [];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave]);

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <PageHeader
        title="报告数据"
        description={`手动填入数据，自动生成${PERIOD_LABEL[periodType]}`}
        actions={
          <>
            <Button variant="outline" onClick={onSave}>
              <Save /> 保存
            </Button>
            <Button onClick={onPreview}>生成预览</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="总营收（经营收入）"
          value={money(metrics.total)}
          hint="现场营业额 + 团购核销净额"
          icon={<Banknote className="size-4" />}
        />
        <MetricCard
          label="客单价"
          value={ticket === null ? "-" : money(ticket)}
          hint={report.customerCount ? `客单总数 ${report.customerCount}（总营收 ÷ 客单总数）` : "填「客单总数」后自动计算"}
          icon={<TrendingUp className="size-4" />}
        />
        <MetricCard
          label="目标达成率"
          value={targetRate === null ? "-" : `${targetRate.toFixed(1)}%`}
          hint={targetHint}
          icon={<Target className="size-4" />}
        />
        {!isDay ? (
          <MetricCard
            label="日均营收"
            value={money(metrics.dailyAverage ?? 0)}
            hint="总营收 ÷ 天数"
            icon={<TrendingUp className="size-4" />}
          />
        ) : null}
        <MetricCard
          label="对账差异"
          value={signedMoney(rm.diff)}
          tone={diffTone}
          hint={`容差 ${settings.reconcileTolerance} 元`}
          icon={<ClipboardCheck className="size-4" />}
        />
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="报告周期"
          subtitle={isDay ? "日报只填当天" : "自由选择起止日期，点「从日报汇总」自动合计区间内的日报"}
          icon={<CalendarDays className="size-4" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="周期类型">
              <SelectInput value={periodType} onChange={applyPeriodType} options={PERIOD_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
            </Field>
            <Field label="起始日期">
              <Input type="date" className="nums h-9 bg-card" value={report.date} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="结束日期" hint={isDay ? "日报只填当天" : undefined}>
              <Input
                type="date"
                className="nums h-9 bg-card"
                value={endDate}
                disabled={isDay}
                min={report.date}
                onChange={(e) => set({ endDate: e.target.value })}
              />
            </Field>
            <Field label="本期目标" hint={isDay ? "默认用月度目标" : "选填，用于目标达成率"}>
              <NumberInput value={report.periodTarget ?? ""} disabled={isDay} onChange={(v) => set({ periodTarget: v })} />
            </Field>
          </div>

          {!isDay ? (
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p.range)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runAggregate}>
              <Layers /> {isDay ? "载入已保存日报" : "从日报汇总"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => (isDay ? applyPeriodType("day") : applyPeriodType("custom"))}>
              <RefreshCw /> 回到当前{PERIOD_LABEL[periodType]}
            </Button>
            <span className="text-[12px] text-muted-foreground">
              {metrics.periodMom !== null
                ? `${isDay ? "环比昨日" : "环比上期"} ${signedRate(metrics.periodMom)}`
                : isDay
                  ? "无昨日数据"
                  : "无上期数据"}
              {targetRate !== null ? ` ｜ 目标达成 ${targetRate.toFixed(1)}%（${targetHint}）` : ""}
            </span>
          </div>

          {aggMeta ? (
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                已汇总 <b className="text-foreground">{aggMeta.dayCount}</b> / {aggMeta.rangeDays} 天日报
                {aggMeta.missingDates.length
                  ? `；缺少：${missingShown.join("、")}${aggMeta.missingDates.length > missingShown.length ? ` 等 ${aggMeta.missingDates.length} 天` : ""}`
                  : ""}
                。修改日期后可重新点「从日报汇总」刷新。
              </span>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="营收数据"
          subtitle="总营收 = 现场营业额 + 团购核销净额（经营收入口径，不含储值充值）"
          icon={<Banknote className="size-4" />}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="现场直开台费">
              <NumberInput value={report.revenue.table} onChange={(v) => setNested("revenue", { table: v })} />
            </Field>
            <Field label="商品收入">
              <NumberInput value={report.revenue.product} onChange={(v) => setNested("revenue", { product: v })} />
            </Field>
            <Field label="助教费收入">
              <NumberInput value={report.revenue.coach} onChange={(v) => setNested("revenue", { coach: v })} />
            </Field>
            <Field label="客单总数" hint="客单价 = 总营收 ÷ 客单总数">
              <NumberInput value={report.customerCount ?? ""} step="1" onChange={(v) => set({ customerCount: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="快速填总金额" hint="有分项时以分项合计为准">
              <NumberInput value={report.quickRevenue} onChange={(v) => set({ quickRevenue: v })} />
            </Field>
            <Field label="营收备注">
              <TextInput
                value={report.revenue.remark}
                onChange={(v) => setNested("revenue", { remark: v })}
                placeholder="如：有包场、设备故障等"
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="台桌运营" subtitle="用于计算台时利用率" icon={<Table2 className="size-4" />}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="开台数">
              <NumberInput value={report.table.openCount} onChange={(v) => setNested("table", { openCount: v })} step="1" />
            </Field>
            <Field label="总开台时长（分钟）">
              <NumberInput value={report.table.openMinutes} onChange={(v) => setNested("table", { openMinutes: v })} step="1" />
            </Field>
            <Field label="可售总时长（分钟）">
              <NumberInput value={report.table.salableMinutes} onChange={(v) => setNested("table", { salableMinutes: v })} step="1" />
            </Field>
            <Field label="台时利用率">
              <div className="nums flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                {metrics.utilization.toFixed(1)}%
              </div>
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="团购"
          subtitle="核销/退款从美团、抖音后台查询；结算到账金额填当天平台打进农商卡的钱（不计入现场实收）"
          icon={<Users className="size-4" />}
        >
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="min-w-[120px]">平台</TableHead>
                  <TableHead className="min-w-[90px]">核销券数</TableHead>
                  <TableHead className="min-w-[100px]">核销金额</TableHead>
                  <TableHead className="min-w-[90px]">退款券数</TableHead>
                  <TableHead className="min-w-[100px]">退款金额</TableHead>
                  <TableHead className="min-w-[110px]">结算到账金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouponRows.map((g) => (
                  <TableRow key={g.platform}>
                    <TableCell className="p-1.5 font-medium">{g.platform}</TableCell>
                    <TableCell className="p-1.5">
                      <NumberInput value={g.verifyCount} step="1" onChange={(v) => updateGrouponRow(g.platform, { verifyCount: v })} />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <NumberInput value={g.verifyAmount} onChange={(v) => updateGrouponRow(g.platform, { verifyAmount: v })} />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <NumberInput value={g.refundCount ?? 0} step="1" onChange={(v) => updateGrouponRow(g.platform, { refundCount: v })} />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <NumberInput value={g.refundAmount ?? 0} onChange={(v) => updateGrouponRow(g.platform, { refundAmount: v })} />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <NumberInput value={g.settledAmount ?? 0} onChange={(v) => updateGrouponRow(g.platform, { settledAmount: v })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard title="会员" subtitle="充值分新会员/老会员，消费与新增会员" icon={<Users className="size-4" />}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="新会员充值金额">
              <NumberInput value={report.member.newMemberRecharge ?? 0} onChange={(v) => setRecharge("newMemberRecharge", v)} />
            </Field>
            <Field label="老会员充值金额">
              <NumberInput value={report.member.existingMemberRecharge ?? 0} onChange={(v) => setRecharge("existingMemberRecharge", v)} />
            </Field>
            <Field label="充值合计">
              <div className="nums flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                {money(rechargeDisplay)}
              </div>
            </Field>
            <Field label="充值赠送金额" hint="赠送的是台桌费，记入礼金卡">
              <NumberInput value={report.member.rechargeGiftAmount} onChange={(v) => setNested("member", { rechargeGiftAmount: v })} />
            </Field>
            <Field label="台费卡充值" hint="通常为 0">
              <NumberInput value={report.member.tableCardRecharge ?? 0} onChange={(v) => setNested("member", { tableCardRecharge: v })} />
            </Field>
            <Field label="新增会员数">
              <NumberInput value={report.member.newMembers} step="1" onChange={(v) => setNested("member", { newMembers: v })} />
            </Field>
            <Field label="储值卡消费" hint="可用于一切消费">
              <NumberInput value={report.member.consumeAmount} onChange={(v) => setNested("member", { consumeAmount: v })} />
            </Field>
            <Field label="礼金卡消费" hint="只能消费指定物品，主要是台桌费">
              <NumberInput value={report.member.giftCardConsume ?? 0} onChange={(v) => setNested("member", { giftCardConsume: v })} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="现金与银行对账"
          subtitle="实收 = 现金 + 农商卡入账 − 现金存入 − 团购结算到账；应到账 = 营业额 + 充值 − 储值卡消费 − 台费卡消费"
          icon={<Banknote className="size-4" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="当日/期间现金收款" hint="当日收银现金总数（含已存入银行的现金）">
              <NumberInput value={report.cashReceived ?? 0} onChange={(v) => set({ cashReceived: v })} />
            </Field>
            <Field label="农商卡到账" hint="当日银行入账总额（含现金存入、团购平台结算）">
              <NumberInput value={report.reconciliation.bankReceived ?? 0} onChange={(v) => setNested("reconciliation", { bankReceived: v })} />
            </Field>
            <Field label="现金存入（如有）" hint="其中由现金存入银行的部分，避免重复计算">
              <NumberInput value={report.reconciliation.cashDeposit ?? 0} onChange={(v) => setNested("reconciliation", { cashDeposit: v })} />
            </Field>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b bg-muted/40">
                  <td className="px-3 py-2 font-medium">总营收（经营收入）</td>
                  <td className="nums px-3 py-2 text-right font-semibold">{money(metrics.total)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">现场营业额+团购核销净额</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">现场营业额（分项合计）</td>
                  <td className="nums px-3 py-2 text-right">{money(direct)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">台桌+商品+教练+其他</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">储值卡充值（预收款）</td>
                  <td className="nums px-3 py-2 text-right">{money(rechargeDisplay)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">新会员+老会员充值</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">台费卡充值（预收款）</td>
                  <td className="nums px-3 py-2 text-right">{money(report.member.tableCardRecharge ?? 0)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">台费卡充值金额</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">储值卡消费</td>
                  <td className="nums px-3 py-2 text-right">{money(report.member.consumeAmount)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">卡余额支付，不产生现金</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">台费卡/礼金卡消费</td>
                  <td className="nums px-3 py-2 text-right">{money(report.member.giftCardConsume ?? 0)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">卡余额支付，不产生现金</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">应到账（合计）</td>
                  <td className="nums px-3 py-2 text-right font-medium">{money(rm.expectedRevenue)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">营业额+充值−储值卡消费−台费卡消费</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">团购核销净额（未到账）</td>
                  <td className="nums px-3 py-2 text-right">{money(metrics.grouponNet)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">美团/抖音核销−退款，平台后结算</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">团购结算到账（已剔除）</td>
                  <td className="nums px-3 py-2 text-right">{money(metrics.settledAmount)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">平台当天打款，不计入现场实收</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">团购待收（累计）</td>
                  <td className="nums px-3 py-2 text-right">{money(metrics.pendingTotal)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">累计核销净额−累计结算到账</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">现场实收 / 应到账</td>
                  <td className="nums px-3 py-2 text-right">
                    {money(rm.actualReceived)} / {money(rm.expectedRevenue)}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">实收=现金+农商−现金存入−团购结算</td>
                </tr>
                <tr className={rm.diff > 0 ? "bg-red-50" : rm.diff < 0 ? "bg-emerald-50" : ""}>
                  <td className="px-3 py-2 font-medium">差异</td>
                  <td
                    className={
                      "nums px-3 py-2 text-right font-semibold " +
                      (rm.diff > 0 ? "text-destructive" : rm.diff < 0 ? "text-emerald-600" : "")
                    }
                  >
                    {signedMoney(rm.diff)}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px]">
                    {rm.tier === "normal" ? "正常（容差内）" : rm.tier === "explained" ? "已解释" : "待查"}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">累计差额（全部日报）</td>
                  <td className="nums px-3 py-2 text-right">{signedMoney(metrics.reconcileTotal)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">
                    累计实收−应到账；接近 0 = 多为到账时间差
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {diagnosticLines.length ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {diagnosticLines.map((line) => (
                <p key={line} className="leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="差异原因" hint="从固定原因中选择（选择后视为已解释）">
              <SelectInput
                value={report.reconciliation.diffReason || ""}
                onChange={(v) => setNested("reconciliation", { diffReason: v, diffStatus: v ? "explained" : "" })}
                options={settings.diffReasons}
                placeholder="选择差异原因"
              />
              <div className="mt-2">
                <TextInput
                  value={report.reconciliation.diffNote || ""}
                  onChange={(v) => setNested("reconciliation", { diffNote: v })}
                  placeholder="补充说明（选填）"
                />
              </div>
            </Field>
            <Field label="银行流水备注">
              <TextInput value={report.reconciliation.systemError || ""} onChange={(v) => setNested("reconciliation", { systemError: v })} placeholder="选填" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="商品与毛利" subtitle="成本价 = 商品成本 ÷ 销售数量；商品明细按商品逐个填写" icon={<Boxes className="size-4" />}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Field label="商品销售额">
              <NumberInput value={report.revenue.product} onChange={(v) => setNested("revenue", { product: v })} />
            </Field>
            <Field label="销售数量">
              <NumberInput value={report.productQty ?? 0} step="1" onChange={(v) => set({ productQty: v })} />
            </Field>
            <Field label="商品成本">
              <NumberInput value={report.productCost ?? 0} onChange={(v) => set({ productCost: v })} />
            </Field>
            <Field label="总利润" hint="销售额 − 总成本；未填成本时无法计算">
              <div className="nums flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                {prodSum.unknown ? "待填成本" : money(prodSum.profit)}
              </div>
            </Field>
            <Field label="毛利率" hint="利润 ÷ 销售额；未填成本时不显示">
              <div className="nums flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                {prodSum.unknown || prodSum.rate === null ? "-" : `${prodSum.rate.toFixed(1)}%`}
              </div>
            </Field>
          </div>
          {hasProducts ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="min-w-[150px]">商品</TableHead>
                    <TableHead>销售数量</TableHead>
                    <TableHead>销售额</TableHead>
                    <TableHead>成本价</TableHead>
                    <TableHead>成本</TableHead>
                    <TableHead>毛利</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.products
                    .filter((p) => p.name)
                    .slice(0, 20)
                    .map((p) => {
                      const qty = toNumber(p.saleQty);
                      const amount = toNumber(p.saleAmount);
                      const profitVal = toNumber(p.profit);
                      const cost = profitVal ? Math.round(Math.max(0, amount - profitVal) * 100) / 100 : toNumber(p.saleCost);
                      const profit = Math.round((amount - cost) * 100) / 100;
                      return (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="nums">{qty}</TableCell>
                          <TableCell className="nums">{money(amount)}</TableCell>
                          <TableCell className="nums">{qty > 0 ? money(cost / qty) : "-"}</TableCell>
                          <TableCell className="nums">{money(cost)}</TableCell>
                          <TableCell className="nums">{money(profit)}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="异常记录"
          subtitle="清台销单、改价、删除订单等异常情况，会进入报告与微信文案"
          icon={<AlertTriangle className="size-4" />}
        >
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="min-w-[150px]">类型</TableHead>
                  <TableHead className="min-w-[80px]">次数</TableHead>
                  <TableHead className="min-w-[100px]">金额</TableHead>
                  <TableHead className="min-w-[100px]">操作人</TableHead>
                  <TableHead className="min-w-[160px]">备注</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.abnormal.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="p-1.5">
                      <SelectInput
                        value={a.type}
                        onChange={(v) =>
                          set({ abnormal: report.abnormal.map((x, j) => (j === i ? { ...x, type: v } : x)) })
                        }
                        options={abnormalOptions}
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <NumberInput
                        value={a.count}
                        step="1"
                        onChange={(v) => set({ abnormal: report.abnormal.map((x, j) => (j === i ? { ...x, count: v } : x)) })}
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <NumberInput
                        value={a.amount}
                        onChange={(v) => set({ abnormal: report.abnormal.map((x, j) => (j === i ? { ...x, amount: v } : x)) })}
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <TextInput
                        value={a.operator}
                        onChange={(v) => set({ abnormal: report.abnormal.map((x, j) => (j === i ? { ...x, operator: v } : x)) })}
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <TextInput
                        value={a.remark}
                        onChange={(v) => set({ abnormal: report.abnormal.map((x, j) => (j === i ? { ...x, remark: v } : x)) })}
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="删除此行"
                        onClick={() => set({ abnormal: report.abnormal.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              set({
                abnormal: [
                  ...report.abnormal,
                  { type: settings.abnormalTypes[0] || "", count: 0, amount: 0, operator: "", remark: "" },
                ],
              })
            }
          >
            <Plus /> 添加一行
          </Button>
        </SectionCard>

        <SectionCard title="备注" subtitle="完成事项、经营小结与库存预警，会进入报告" icon={<ClipboardCheck className="size-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="完成事项" hint="如：设备维修完成、员工培训等">
              <Textarea
                rows={4}
                className="bg-card"
                value={report.done}
                placeholder="本期完成的事项，每行一条"
                onChange={(e) => set({ done: e.target.value })}
              />
            </Field>
            <Field label="经营小结 / 待办" hint="复盘结论与需要跟进的事项">
              <Textarea
                rows={4}
                className="bg-card"
                value={report.notes}
                placeholder="如：本期经营小结、需要跟进的事项"
                onChange={(e) => set({ notes: e.target.value })}
              />
            </Field>
          </div>
          <Field label="库存预警" hint="选填，如：红牛剩 5 箱、纸巾告急">
            <TextInput
              value={report.lowStockItems}
              onChange={(v) => set({ lowStockItems: v })}
              placeholder="需要补货的商品"
            />
          </Field>
        </SectionCard>
      </div>
    </div>
  );
}
