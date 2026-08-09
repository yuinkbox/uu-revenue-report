import { useEffect, useMemo, useRef } from "react";
import {
  Banknote,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  FolderSearch,
  RefreshCw,
  Save,
  Sparkles,
  Table2,
  Target,
  TrendingUp,
  Upload,
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
import { averageTicket, directRevenue, productSummary, reconcileMetrics, reportMetrics, round2, toNumber } from "@/lib/calc";
import { applyImportPatch, importTaikeduoExcel, mergeMember, summarizeWeeklyFiles } from "@/lib/importers";
import { money, signedMoney, signedRate } from "@/lib/format";
import { PERIOD_TYPES, periodRange } from "@/lib/period";
import { todayString } from "@/lib/store";
import type { Report, Settings } from "@/types/report";

const PERIOD_LABEL: Record<string, string> = {
  day: "日报",
  week: "周报",
  quarter: "季报",
  halfYear: "半年报",
  year: "年报",
};

export default function DataEntry({
  report,
  reports,
  settings,
  onChange,
  onSave,
  onPreview,
  onLoadSample,
  onGoImport,
}: {
  report: Report;
  reports: Report[];
  settings: Settings;
  onChange: (r: Report) => void;
  onSave: () => void;
  onPreview: () => void;
  onLoadSample: () => void;
  onGoImport: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const periodType = report.periodType || "day";
  const isDay = periodType === "day";
  const metrics = reportMetrics(report, reports, settings);
  const rm = reconcileMetrics(report, settings);
  const ticket = averageTicket(report);

  const target = isDay || periodType === "week" ? settings.monthTarget : report.periodTarget;
  const targetRate = toNumber(target) > 0 ? (metrics.total / toNumber(target)) * 100 : null;

  const set = (patch: Partial<Report>) => onChange({ ...report, ...patch });
  const setNested = <K extends keyof Report>(key: K, patch: Partial<Report[K]>) =>
    set({ [key]: { ...(report[key] as object), ...patch } } as Partial<Report>);

  const applyPeriodType = (type: string) => {
    const range = periodRange(type, todayString());
    set({ periodType: type as Report["periodType"], date: range.start, endDate: range.end });
  };

  const resetRange = () => {
    const range = periodRange(periodType, todayString());
    set({ date: range.start, endDate: range.end });
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

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    try {
      const list = Array.from(files);
      if (isDay) {
        let next = report;
        let applied = 0;
        let detailMember: Partial<Report["member"]> | null = null;
        for (const file of list) {
          const res = await importTaikeduoExcel(file, report.date, {
            grouponAmountSource: settings.grouponAmountSource,
          });
          const patch = (res as { patch?: Record<string, unknown> }).patch;
          if (res.ok && patch) {
            const template = (res as { template?: string }).template;
            const detailTemplates = ["memberCardChange", "giftCardChange", "memberCardConsume"];
            if (template && detailTemplates.includes(template)) {
              detailMember = mergeMember(detailMember || {}, (patch.member || {}) as object);
              const { member: _member, ...rest } = patch;
              next = applyImportPatch(next, rest) as Report;
            } else {
              next = applyImportPatch(next, patch) as Report;
            }
            const prodPatch = patch.products as Array<{ saleQty?: number; saleCost?: number; saleAmount?: number }> | undefined;
            if (Array.isArray(prodPatch) && prodPatch.length) {
              const qty = prodPatch.reduce((s, p) => s + toNumber(p.saleQty), 0);
              const cost = prodPatch.reduce((s, p) => s + toNumber(p.saleCost), 0);
              const amount = prodPatch.reduce((s, p) => s + toNumber(p.saleAmount), 0);
              next = {
                ...next,
                productQty: qty,
                productCost: cost,
                revenue: { ...next.revenue, product: amount }
              };
            }
            applied += 1;
          }
        }
        if (detailMember) next = { ...next, member: { ...next.member, ...detailMember } };
        if (applied) {
          onChange(next);
          toast.success(`已导入 ${applied} 个商云宝报表`);
        } else {
          toast.warning("没有识别到可导入的报表");
        }
      } else {
        const res = await summarizeWeeklyFiles(list, report.date, report.endDate || report.date);
        if (res.days.length) {
          const sum = (key: keyof (typeof res.days)[number]) => res.days.reduce((s, d) => s + Number(d[key]), 0);
          const patch = {
            customerCount: res.summary.customerCount,
            quickRevenue: res.summary.total,
            revenue: {
              table: sum("table"),
              product: sum("product"),
              coach: sum("coach"),
              other: 0,
              remark: report.revenue.remark,
            },
            table: { ...report.table, openCount: res.summary.openCount },
            member: {
              ...report.member,
              rechargeAmount: res.member.rechargeAmount,
              rechargeGiftAmount: res.member.rechargeGiftAmount,
              consumeAmount: res.member.consumeAmount,
              tableCardConsume: res.member.tableCardConsume,
              giftCardConsume: res.member.giftCardConsume,
            },
            products: res.products,
            productQty: res.productTotals.qty,
            productCost: res.productTotals.cost,
            groupon: [
              { platform: "美团", verifyCount: res.groupon["美团"].verifyCount, verifyAmount: res.groupon["美团"].verifyAmount, newCustomerCount: 0 },
              { platform: "抖音", verifyCount: res.groupon["抖音"].verifyCount, verifyAmount: res.groupon["抖音"].verifyAmount, newCustomerCount: 0 },
            ],
          };
          onChange(applyImportPatch(report, patch) as Report);
          toast.success(`已按 ${res.days.length} 天汇总导入`);
        } else {
          toast.warning("区间内没有识别到经营数据，请检查日期范围或报表文件");
        }
      }
    } catch (err) {
      toast.error(`导入出错：${(err as Error).message || err}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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
  const targetHint =
    isDay || periodType === "week"
      ? `月度目标 ${money(settings.monthTarget)}`
      : report.periodTarget
        ? `本期目标 ${money(report.periodTarget)}`
        : "未设本期目标";
  const diffTone = rm.diff > 0 ? "danger" : rm.diff < 0 ? "success" : "default";

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
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv"
        hidden
        onChange={(e) => handleImportFiles(e.target.files)}
      />
      <PageHeader
        title="报告数据"
        description={`填入数据，自动生成${PERIOD_LABEL[periodType]}`}
        actions={
          <>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FolderSearch /> 导入商云宝报表
            </Button>
            <Button variant="outline" onClick={onGoImport}>
              <Upload /> 手动导入
            </Button>
            <Button variant="ghost" onClick={onLoadSample}>
              <Sparkles /> 载入示例
            </Button>
            <Button variant="outline" onClick={onSave}>
              <Save /> 保存
            </Button>
            <Button onClick={onPreview}>生成预览</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="总营收" value={money(metrics.total)} icon={<Banknote className="size-4" />} />
        <MetricCard
          label="客单价"
          value={ticket === null ? "-" : money(ticket)}
          hint={
            report.customerCount
              ? `客单总数 ${report.customerCount}（总营收 ÷ 客单总数）`
              : "导入经营报表后自动带入客单总数并计算"
          }
          icon={<TrendingUp className="size-4" />}
        />
        <MetricCard
          label="目标达成率"
          value={targetRate === null ? "-" : `${targetRate.toFixed(1)}%`}
          hint={targetHint}
          icon={<Target className="size-4" />}
        />
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
          subtitle="选择周期类型和日期范围，日报/周报/季报/半年报/年报通用"
          icon={<CalendarDays className="size-4" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="周期类型">
              <SelectInput value={periodType} onChange={applyPeriodType} options={PERIOD_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
            </Field>
            <Field label="起始日期">
              <Input type="date" className="nums h-9 bg-card" value={report.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="结束日期" hint={isDay ? "日报只填当天" : undefined}>
              <Input
                type="date"
                className="nums h-9 bg-card"
                value={report.endDate || report.date}
                disabled={isDay}
                onChange={(e) => set({ endDate: e.target.value })}
              />
            </Field>
            <Field label="本期目标" hint={isDay || periodType === "week" ? "默认用月度目标" : "季/半年/年报填周期目标"}>
              <NumberInput
                value={target ?? ""}
                disabled={isDay || periodType === "week"}
                onChange={(v) => set({ periodTarget: v })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={resetRange}>
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
        </SectionCard>

        <SectionCard
          title="营收数据"
          subtitle="总营收 = 现金 + 农商卡 − 存现 + 团购核销；台桌/商品/教练为商云宝参考（辅助核对）"
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

        <SectionCard
          title="台桌运营"
          subtitle="用于计算台时利用率"
          icon={<Table2 className="size-4" />}
        >
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

        <SectionCard title="团购" subtitle="从美团/抖音后台查询后手填，核销与退款分开" icon={<Users className="size-4" />}>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="min-w-[120px]">平台</TableHead>
                  <TableHead className="min-w-[90px]">核销券数</TableHead>
                  <TableHead className="min-w-[100px]">核销金额</TableHead>
                  <TableHead className="min-w-[90px]">退款券数</TableHead>
                  <TableHead className="min-w-[100px]">退款金额</TableHead>
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
          subtitle="当日营收以资金为准（现金+农商卡−存现+团购核销），商云宝数据仅作参考核对"
          icon={<Banknote className="size-4" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="当日/期间现金收款">
              <NumberInput value={report.cashReceived ?? 0} onChange={(v) => set({ cashReceived: v })} />
            </Field>
            <Field label="农商卡到账">
              <NumberInput value={report.reconciliation.bankReceived ?? 0} onChange={(v) => setNested("reconciliation", { bankReceived: v })} />
            </Field>
            <Field label="现金存入（如有）">
              <NumberInput value={report.reconciliation.cashDeposit ?? 0} onChange={(v) => setNested("reconciliation", { cashDeposit: v })} />
            </Field>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b bg-muted/40">
                  <td className="px-3 py-2 font-medium">当日营收（资金口径）</td>
                  <td className="nums px-3 py-2 text-right font-semibold">{money(metrics.total)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">现金+农商卡−存现+团购核销</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">商云宝营业额（参考）</td>
                  <td className="nums px-3 py-2 text-right">{money(direct)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">台桌+商品+教练</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">现场实收 / 应到账</td>
                  <td className="nums px-3 py-2 text-right">
                    {money(rm.actualReceived)} / {money(rm.expectedRevenue)}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">应到账按商云宝推算</td>
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
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="差异原因" hint="从固定原因中选择">
              <SelectInput
                value={report.reconciliation.diffReason || ""}
                onChange={(v) => setNested("reconciliation", { diffReason: v })}
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
            <Field label="商云宝错误记录">
              <TextInput value={report.reconciliation.systemError || ""} onChange={(v) => setNested("reconciliation", { systemError: v })} placeholder="选填" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="商品与毛利"
          subtitle="成本价 = 商品成本 ÷ 销售数量，导入商品综合报表后自动计算"
          icon={<Boxes className="size-4" />}
        >
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
                      const cost = profitVal
                        ? Math.round(Math.max(0, amount - profitVal) * 100) / 100
                        : toNumber(p.saleCost);
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

        <SectionCard title="备注" subtitle="异常、客诉、复盘结论，会进入报告" icon={<ClipboardCheck className="size-4" />}>
          <Textarea
            rows={4}
            className="bg-card"
            value={report.notes}
            placeholder="如：本期经营小结、需要跟进的事项"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </SectionCard>
      </div>
    </div>
  );
}
