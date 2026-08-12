import * as XLSX from "xlsx";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { directRevenue, reconcileMetrics, round2, formatPercent, toNumber, topProducts } from "./calc";
import { signedMoney } from "./format";

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/**
 * 保存文件：桌面版弹窗选择保存位置；浏览器版直接下载。
 */
export async function saveViaDialog(filename, blob) {
  const api = window.pywebview?.api;
  if (api?.save_file) {
    try {
      const dataUrl = await blobToDataUrl(blob);
      const result = await api.save_file(dataUrl, filename);
      if (String(result).includes("saved")) return true;
      if (String(result).includes("cancelled")) return false;
    } catch {
      // 弹窗失败则退回浏览器下载
    }
  }
  saveAs(blob, filename);
  return false;
}

function money(v) {
  return `¥${round2(v).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function rate(v) {
  return v === null || v === undefined ? "-" : formatPercent(v);
}

function reportRows(report, metrics, settings, version = "shareholder") {
  const rows = [
    ["日期", report.date],
    ["门店", report.storeName || settings.storeName],
    ["总营收（经营收入）", money(metrics.total)],
    ["环比上期", rate(metrics.periodMom)],
    [
      report.periodType === "day" || report.periodType === "week" ? "月目标完成率" : "本期目标达成率",
      rate(
        (() => {
          const target =
            report.periodType === "day" || report.periodType === "week"
              ? settings.monthTarget
              : report.periodTarget;
          return toNumber(target) > 0 ? (metrics.total / toNumber(target)) * 100 : null;
        })(),
      ),
    ]
  ];

  metrics.shares.forEach((s) => rows.push([`${s.label}收入`, `${money(s.value)}（${rate(s.rate)}）`]));
  rows.push(["开台数", report.table.openCount || 0]);
  rows.push(["台时利用率", rate(metrics.utilization)]);
  rows.push(["新增会员", report.member.newMembers || 0]);
  rows.push(["新会员充值", money(report.member.newMemberRecharge)]);
  rows.push(["老会员充值", money(report.member.existingMemberRecharge)]);
  rows.push([
    "充值合计（预收款·不计入营收）",
    money(
      toNumber(report.member.newMemberRecharge) + toNumber(report.member.existingMemberRecharge) > 0
        ? toNumber(report.member.newMemberRecharge) + toNumber(report.member.existingMemberRecharge)
        : report.member.rechargeAmount,
    ),
  ]);
  rows.push(["充值赠送（礼金卡）", money(report.member.rechargeGiftAmount)]);
  rows.push(["台费卡充值", money(report.member.tableCardRecharge ?? 0)]);
  rows.push(["会员消费占比", rate(metrics.memberRate)]);
  rows.push(["储值卡消费", money(report.member.consumeAmount)]);
  rows.push(["礼金卡消费", money(report.member.giftCardConsume)]);
  rows.push([
    "团购核销",
    `${metrics.groupon.verifyCount} 单 / ${money(metrics.groupon.verifyAmount)}` +
      (metrics.groupon.refundCount > 0
        ? `（退款 ${metrics.groupon.refundCount} 单 / ${money(metrics.groupon.refundAmount)}）`
        : ""),
  ]);
  rows.push(["团购结算到账（不计入实收）", money(metrics.settledAmount)]);
  rows.push(["团购待收（累计）", money(metrics.pendingTotal)]);
  rows.push(["商品销售金额", money(metrics.productTotal.saleAmount)]);
  rows.push(["商品销售成本", money(metrics.productTotal.saleCost)]);
  rows.push(["商品毛利", money(metrics.grossProfit)]);
  rows.push(["今日TOP商品", topProducts(report, 5).map((p) => p.name).join("、") || "-"]);
  rows.push(["赠送数量", `${metrics.productTotal.giftQty} 件`]);
  rows.push(["损坏/丢失", `${metrics.productTotal.damageQty} / ${metrics.productTotal.lostQty} 件`]);
  rows.push(["异常记录", `${metrics.abnormal.count} 笔 / ${money(metrics.abnormal.amount)}`]);
  if (version !== "staff") {
    const rm = reconcileMetrics(report, settings);
    rows.push(["商云宝营业额（参考）", money(directRevenue(report))]);
    rows.push(["应到账（营业额+充值−储值卡消费−台费卡消费）", money(rm.expectedRevenue)]);
    rows.push(["现场实收（现金+农商−现金存入−团购结算）", money(rm.actualReceived)]);
    rows.push(["对账差异", signedMoney(rm.diff)]);
    rows.push(["累计差额（同周期全部日报）", signedMoney(metrics.reconcileTotal)]);
    rows.push(["差异状态", rm.tier === "normal" ? "正常（容差内）" : rm.tier === "explained" ? "已解释" : "待查"]);
    if (report.reconciliation?.diffReason) {
      const note = report.reconciliation.diffNote ? `（${report.reconciliation.diffNote}）` : "";
      rows.push(["差异原因", `${report.reconciliation.diffReason}${note}`]);
    }
    if (report.reconciliation?.systemError) rows.push(["商云宝记录", report.reconciliation.systemError]);
  }
  rows.push(["昨日完成", report.done || "-"]);
  rows.push(["今日待办", report.notes || "-"]);
  return rows;
}

function abnormalRows(report) {
  return report.abnormal
    .filter((a) => a.count || a.amount || a.operator)
    .map((a) => [a.type, a.count || 0, money(a.amount), a.operator || "-", a.remark || ""]);
}

export function exportExcel(report, metrics, settings, version = "shareholder") {
  const data = [["营收日报"], [`${report.storeName || settings.storeName} · ${report.date}`], []];
  data.push(["项目", "数值"]);
  reportRows(report, metrics, settings, version).forEach((r) => data.push(r));

  data.push([], ["异常记录", "次数", "金额", "操作人", "备注"]);
  abnormalRows(report).forEach((r) => data.push(r));

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "日报");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return saveViaDialog(`营收报告_${report.date}.xlsx`, blob);
}

export async function exportWord(report, metrics, settings, version = "shareholder") {
  const title = new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    children: [new TextRun(report.storeName || settings.storeName)]
  });
  const subtitle = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun(`营收日报 · ${report.date}`)]
  });

  const body = reportRows(report, metrics, settings, version).map(
    ([k, v]) =>
      new Paragraph({
        children: [new TextRun({ text: `${k}：`, bold: true }), new TextRun(String(v))]
      })
  );

  const abnormalHeader = ["类型", "次数", "金额", "操作人", "备注"].map(
    (t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })] })
  );
  const abnormalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: abnormalHeader }),
      ...abnormalRows(report).map(
        (r) =>
          new TableRow({
            children: r.map((c) => new TableCell({ children: [new Paragraph(String(c))] }))
          })
      )
    ]
  });

  const doc = new Document({
    sections: [
      {
        children: [
          title,
          subtitle,
          new Paragraph(""),
          ...body,
          new Paragraph(""),
          new Paragraph({ children: [new TextRun({ text: "异常记录", bold: true })] }),
          abnormalTable
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  return saveViaDialog(`营收报告_${report.date}.docx`, blob);
}

export async function exportReportData(report) {
  const payload = JSON.stringify(
    {
      report,
      exportedAt: new Date().toISOString(),
      app: "UU 经营报告",
    },
    null,
    2,
  );
  const blob = new Blob([payload], { type: "application/json" });
  return saveViaDialog(`报告数据_${report.date}.json`, blob);
}

export async function exportPDF(report, metrics, settings) {
  const element = document.querySelector(".report-doc");
  if (!element) {
    window.print();
    return;
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  doc.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    doc.addPage();
    doc.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const filename = `营收日报_${report.date}.pdf`;
  if (window.pywebview && window.pywebview.api && window.pywebview.api.save_pdf) {
    const dataUrl = doc.output("datauristring");
    window.pywebview.api.save_pdf(dataUrl, filename).then((result) => {
      if (!String(result).includes("saved")) window.print();
    });
    return;
  }
  try {
    saveAs(doc.output("blob"), filename);
  } catch {
    window.print();
  }
}

export async function exportImage(report) {
  const element = document.querySelector(".report-doc");
  if (!element) {
    window.print();
    return;
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true
  });
  const dataUrl = canvas.toDataURL("image/png");
  const filename = `营收日报_${report.date}.png`;

  if (window.pywebview && window.pywebview.api && window.pywebview.api.save_image) {
    const result = await window.pywebview.api.save_image(dataUrl, filename);
    if (!String(result).includes("saved")) window.print();
    return;
  }
  try {
    saveAs(dataUrl, filename);
  } catch {
    window.print();
  }
}
