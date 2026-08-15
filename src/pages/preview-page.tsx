import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  FileDown,
  FileJson,
  FileSpreadsheet,
  FileText,
  ImageDown,
  Printer,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/page-header";
import { averageTicket, directRevenue, productSummary, reconcileMetrics, reportMetrics, toNumber } from "@/lib/calc";
import { exportExcel, exportImage, exportPDF, exportReportData, exportWord } from "@/lib/exporters";
import { buildWeChatText } from "@/lib/reportText";
import { money, signedMoney, signedRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Report, Settings } from "@/types/report";

const PERIOD_LABEL: Record<string, string> = {
  day: "日报",
  custom: "周期报告",
};

function KpiCell({ label, value, bad, good }: { label: string; value: string; bad?: boolean; good?: boolean }) {
  return (
    <div className={cn("px-3 py-3 text-center", bad && "bg-red-50", good && "bg-emerald-50")}>
      <p className={cn("text-[11px]", bad ? "text-destructive" : good ? "text-emerald-600" : "text-muted-foreground")}>{label}</p>
      <p className={cn("nums mt-1 text-[16px] font-semibold", bad && "text-destructive", good && "text-emerald-600")}>{value}</p>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
        <span className="h-3.5 w-[3px] rounded-full bg-foreground" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function DlRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed py-2 last:border-b-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="nums text-[13px] font-medium">{value}</dd>
    </div>
  );
}

export default function PreviewPage({
  report,
  reports,
  settings,
  onEdit,
}: {
  report: Report;
  reports: Report[];
  settings: Settings;
  onEdit: () => void;
}) {
  const metrics = reportMetrics(report, reports, settings);
  const rm = reconcileMetrics(report, settings);
  const ticket = averageTicket(report);
  const prodSum = productSummary(report);
  const [copied, setCopied] = useState(false);

  const periodType = report.periodType === "custom" ? "custom" : "day";
  const periodLabel = PERIOD_LABEL[periodType] || "日报";
  const rangeLabel = periodType === "day" ? report.date : `${report.date} ~ ${report.endDate || report.date}`;
  const isDay = periodType === "day";
  const target = isDay ? settings.monthTarget : report.periodTarget;
  const targetRate = toNumber(target) > 0 ? (metrics.total / toNumber(target)) * 100 : null;
  const targetLabel = isDay ? "目标达成率·月目标" : "目标达成率·本期目标";

  const warnings: string[] = [];
  if (rm.tier !== "normal") warnings.push(`对账差异 ${money(rm.diff)}，需要核对`);
  if (!report.notes.trim()) warnings.push("缺少备注，建议补充经营小结");
  if (
    !isDay &&
    report.aggregationMeta &&
    report.aggregationMeta.missingDates.length > 0
  ) {
    warnings.push(
      `本周期汇总缺少 ${report.aggregationMeta.missingDates.length} 天日报：${report.aggregationMeta.missingDates.slice(0, 5).join("、")}${
        report.aggregationMeta.missingDates.length > 5 ? "…" : ""
      }，补录日报后请重新汇总`,
    );
  }

  async function copyText() {
    const text = buildWeChatText(report, metrics, settings);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const hasGroupon = report.groupon.some((g) => g.verifyCount || g.verifyAmount);
  const direct = directRevenue(report);

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <PageHeader
        title="报告预览"
        description={`${periodLabel} · ${rangeLabel}`}
        actions={
          <>
            <Button variant="outline" onClick={onEdit}>
              <RefreshCw /> 返回编辑
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <FileDown /> 导出 <ChevronDown className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => exportPDF(report, metrics, settings)}>
                  <FileText /> PDF 文档
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportExcel(report, metrics, settings)}>
                  <FileSpreadsheet /> Excel 表格
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportWord(report, metrics, settings)}>
                  <FileText /> Word 文档
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportReportData(report)}>
                  <FileJson /> 数据 JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportImage(report)}>
                  <ImageDown /> 长图 PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()}>
                  <Printer /> 打印
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={copyText}>
              {copied ? <Check /> : <Copy />} {copied ? "已复制" : "复制微信报告"}
            </Button>
          </>
        }
      />

      {warnings.length ? (
        <div className="print-hidden mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5 text-[13px]">
            {warnings.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </div>
      ) : null}

      <article className="report-doc mx-auto max-w-[880px] rounded-xl border bg-card p-10 shadow-md">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-foreground pb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Business Revenue Report
            </p>
            <h2 className="mt-2 text-[26px] font-bold tracking-tight">{report.storeName || settings.storeName}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {periodLabel} · {rangeLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">总营收</p>
            <p className="nums mt-0.5 text-[32px] font-bold leading-9 tracking-tight">{money(metrics.total)}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">客单价 {ticket === null ? "-" : money(ticket)}</p>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
          <div className="bg-muted/40">
            <KpiCell
              label={!isDay && targetRate === null ? "日均营收" : targetLabel}
              value={!isDay && targetRate === null ? money(metrics.dailyAverage ?? 0) : targetRate === null ? "-" : `${targetRate.toFixed(1)}%`}
            />
          </div>
          <div className="bg-muted/40">
            <KpiCell
              label={isDay ? "环比昨日" : "环比上期"}
              value={metrics.periodMom === null ? "-" : signedRate(metrics.periodMom)}
            />
          </div>
          <div className="bg-muted/40">
            <KpiCell label="客单价" value={ticket === null ? "-" : money(ticket)} />
          </div>
          <div className="bg-muted/40">
            <KpiCell label="对账差异" value={signedMoney(rm.diff)} bad={rm.diff > 0} good={rm.diff < 0} />
          </div>
        </div>

        <DocSection title="收入结构">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.shares
              .filter((s: { key: string; label: string; value: number; rate: number }) => s.value > 0)
              .map((s: { key: string; label: string; value: number; rate: number }) => (
              <div key={s.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">{s.label}</span>
                  <span className="nums text-[13px] font-semibold">{s.rate.toFixed(1)}%</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground/85" style={{ width: `${Math.min(100, s.rate)}%` }} />
                </div>
                <p className="nums mt-2 text-[12px] text-muted-foreground">{money(s.value)}</p>
              </div>
              ))}
          </div>
        </DocSection>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <DocSection title="台桌运营">
            <dl>
              <DlRow label="开台数" value={`${report.table.openCount || 0} 桌`} />
              <DlRow label="总开台时长" value={`${report.table.openMinutes || 0} 分钟`} />
              <DlRow label="台时利用率" value={`${metrics.utilization.toFixed(1)}%`} />
            </dl>
          </DocSection>
          <DocSection title="会员">
            <dl>
              <DlRow label="新增会员" value={`${report.member.newMembers || 0} 人`} />
              <DlRow label="新会员充值" value={money(report.member.newMemberRecharge)} />
              <DlRow label="老会员充值" value={money(report.member.existingMemberRecharge)} />
              <DlRow
                label="充值合计"
                value={money(
                  toNumber(report.member.newMemberRecharge) + toNumber(report.member.existingMemberRecharge) > 0
                    ? toNumber(report.member.newMemberRecharge) + toNumber(report.member.existingMemberRecharge)
                    : report.member.rechargeAmount,
                )}
              />
              <DlRow label="充值赠送（礼金卡）" value={money(report.member.rechargeGiftAmount)} />
              <DlRow label="台费卡充值" value={money(report.member.tableCardRecharge ?? 0)} />
              <DlRow label="储值卡消费" value={money(report.member.consumeAmount)} />
              <DlRow label="礼金卡消费" value={money(report.member.giftCardConsume)} />
            </dl>
          </DocSection>
        </div>

        <DocSection title="团购">
          {hasGroupon ? (
            <div className="flex flex-col gap-1.5 text-[13px]">
              {report.groupon
                .filter(
                  (g) => g.platform && (g.verifyCount || g.verifyAmount || g.refundCount || g.refundAmount || g.settledAmount),
                )
                .map((g) => (
                  <div
                    key={g.platform}
                    className="flex items-center justify-between gap-4 border-b border-dashed py-1.5 last:border-b-0"
                  >
                    <span className="font-medium">{g.platform}</span>
                    <span className="nums text-right">
                      核销 {toNumber(g.verifyCount)} 单 / {money(g.verifyAmount)}
                      {toNumber(g.refundCount) || toNumber(g.refundAmount)
                        ? ` ｜ 退款 ${toNumber(g.refundCount)} 单 / ${money(g.refundAmount)}`
                        : ""}
                      {toNumber(g.settledAmount)
                        ? ` ｜ 结算到账 ${money(g.settledAmount)}`
                        : ""}
                    </span>
                  </div>
                ))}
              {hasGroupon ? (
                <p className="pt-1 text-[12px] text-muted-foreground">
                  核销净额 {money(metrics.grouponNet)}（未到账）｜ 累计待收 {money(metrics.pendingTotal)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">本期无团购数据</p>
          )}
        </DocSection>

        <DocSection title="商品与毛利">
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
            <span>
              商品销售 <b className="nums text-foreground">{money(prodSum.amount)}</b>
            </span>
            <span>
              商品成本 <b className="nums text-foreground">{money(prodSum.cost)}</b>
            </span>
            <span>
              总利润 <b className="nums text-foreground">{prodSum.unknown ? "待填成本" : money(prodSum.profit)}</b>
            </span>
            <span>
              毛利率{" "}
              <b className="nums text-foreground">
                {prodSum.unknown || prodSum.rate === null ? "-" : `${prodSum.rate.toFixed(1)}%`}
              </b>
            </span>
          </div>
        </DocSection>

        <DocSection title="对账结论">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b bg-muted/40">
                  <td className="px-3 py-2 font-medium">总营收（经营收入）</td>
                  <td className="nums px-3 py-2 text-right font-semibold">{money(metrics.total)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">商云宝营业额+团购核销净额</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">现场营业额（分项合计）</td>
                  <td className="nums px-3 py-2 text-right">{money(direct)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">台桌+商品+教练+其他</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">储值卡充值（预收款）</td>
                  <td className="nums px-3 py-2 text-right">
                    {money(
                      toNumber(report.member.newMemberRecharge) + toNumber(report.member.existingMemberRecharge) > 0
                        ? toNumber(report.member.newMemberRecharge) + toNumber(report.member.existingMemberRecharge)
                        : report.member.rechargeAmount,
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">新会员+老会员充值</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">台费卡充值（预收款）</td>
                  <td className="nums px-3 py-2 text-right">{money(report.member.tableCardRecharge ?? 0)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">商云宝报表「台费卡充值」</td>
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
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">
                    营业额+充值−储值卡消费−台费卡消费
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">团购核销净额（未到账）</td>
                  <td className="nums px-3 py-2 text-right">{money(metrics.grouponNet)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">美团/抖音核销−退款</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-medium">团购结算到账（已剔除）</td>
                  <td className="nums px-3 py-2 text-right">{money(metrics.settledAmount)}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">平台当天打款，不计入实收</td>
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
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">
                    实收=现金+农商−现金存入−团购结算
                  </td>
                </tr>
                <tr className={rm.diff > 0 ? "bg-red-50" : rm.diff < 0 ? "bg-emerald-50" : ""}>
                  <td className="px-3 py-2 font-medium">差异</td>
                  <td
                    className={cn(
                      "nums px-3 py-2 text-right font-semibold",
                      rm.diff > 0 ? "text-destructive" : rm.diff < 0 ? "text-emerald-600" : "",
                    )}
                  >
                    {signedMoney(rm.diff)}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">
                    {rm.tier === "normal" ? "正常（容差内）" : rm.tier === "explained" ? "已解释" : "待查"}
                    {report.reconciliation.diffReason
                      ? ` ｜ ${report.reconciliation.diffReason}${report.reconciliation.diffNote ? `（${report.reconciliation.diffNote}）` : ""}`
                      : ""}
                    {report.reconciliation.systemError ? ` ｜ ${report.reconciliation.systemError}` : ""}
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
        </DocSection>

        <DocSection title="经营小结">
          <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-[13px] leading-relaxed">
            {report.notes || "无"}
          </p>
          {report.revenue.remark ? (
            <p className="mt-2 text-[12px] text-muted-foreground">营收备注：{report.revenue.remark}</p>
          ) : null}
        </DocSection>

        <DocSection title="完成事项与库存">
          <dl>
            <DlRow
              label="完成事项"
              value={<span className="whitespace-pre-wrap text-right">{report.done || "-"}</span>}
            />
            <DlRow label="库存预警" value={report.lowStockItems || "-"} />
          </dl>
        </DocSection>

        <footer className="mt-8 flex items-center justify-between border-t pt-4 text-[11px] text-muted-foreground">
          <span>{report.storeName || settings.storeName}</span>
          <span>
            {periodLabel} · {rangeLabel}
          </span>
        </footer>
      </article>
    </div>
  );
}
