import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Info, Loader2, UploadCloud, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { importTaikeduoExcel, mergeImportPatch, sortFilesForImport } from "@/lib/importers";
import { cn } from "@/lib/utils";
import type { ImportMessage, ImportResult } from "@/types/report";

const TIPS: { title: string; desc: string }[] = [
  {
    title: "每天最省事：只导「综合报表」一张就够生成核心日报",
    desc: "营收、台桌、会员充值、对账全在里面，再配「商品综合报表」就有 TOP 商品",
  },
  { title: "商品综合报表", desc: "自动填商品 TOP（可选，不导就没有 TOP 行）" },
  { title: "第三方平台报表", desc: "补团购核销单数和金额（可选，金额口径可在基础设置里选）" },
  { title: "库存变动明细 / 会员储值报表", desc: "可选补充，缺了不影响生成日报" },
];

export default function ImportPage({
  onApply,
  onGoEntry,
  reportDate,
  externalResult,
  grouponAmountSource = "detail",
}: {
  onApply: (result: ImportResult | null) => void;
  onGoEntry: () => void;
  reportDate: string;
  externalResult: ImportResult | null;
  onClearExternal: () => void;
  grouponAmountSource?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const shownResult = externalResult || result;

  async function handleFiles(fileList: FileList | null) {
    const files = sortFilesForImport(Array.from(fileList || []));
    if (!files.length) return;
    setBusy(true);
    setResult(null);

    const messages: ImportMessage[] = [];
    let patch: Record<string, unknown> = {};
    let anyOk = false;
    let failed = 0;

    for (const file of files) {
      try {
        const res = (await importTaikeduoExcel(file, reportDate || "", { grouponAmountSource })) as {
          ok: boolean;
          message: string;
          patch?: Record<string, unknown>;
        };
        if (res.ok) {
          anyOk = true;
          messages.push({ ok: true, text: `${file.name}：${res.message}` });
          patch = mergeImportPatch(patch, res.patch || {});
        } else {
          failed += 1;
          messages.push({ ok: false, text: `${file.name}：${res.message}` });
        }
      } catch (err) {
        failed += 1;
        messages.push({ ok: false, text: `${file.name}：读取失败 ${(err as Error).message || err}` });
      }
    }

    setResult({ ok: anyOk, messages, patch, failed });
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <PageHeader title="导入台客多数据" description="可以一次选择多张报表，自动识别并合并到当天日报" />

      <div className="flex flex-col gap-4">
        <SectionCard
          title="选择 Excel 文件"
          subtitle="推荐：综合报表/经营报表 + 商品综合报表 + 库存变动明细 + 团购核销"
          icon={<FileSpreadsheet className="size-4" />}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed bg-muted/40 px-5 py-12 text-center transition-colors",
              "hover:border-foreground/40 hover:bg-muted/70",
              dragOver && "border-foreground bg-muted",
            )}
          >
            <span className="grid size-12 place-items-center rounded-full border bg-card shadow-xs">
              {busy ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <UploadCloud className="size-5 text-muted-foreground" />
              )}
            </span>
            <span className="mt-1 text-[15px] font-medium">
              {busy ? "正在读取文件…" : "点击选择文件，可多选，也可拖拽到这里"}
            </span>
            <span className="text-xs text-muted-foreground">从台客多报表中心导出后直接导入（.xlsx / .xls / .csv）</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </SectionCard>

        {shownResult ? (
          <SectionCard title="导入结果" icon={shownResult.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}>
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3",
                shownResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900",
              )}
            >
              {shownResult.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-medium">
                  {shownResult.ok ? `导入完成，共 ${shownResult.messages.length} 个文件` : "没有成功导入任何文件"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {shownResult.messages.map((m, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] leading-4",
                        m.ok ? "bg-white/80 text-emerald-900" : "bg-white/80 text-red-800",
                      )}
                    >
                      <span className="truncate">{m.text}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {shownResult.ok ? (
                <Button onClick={() => onApply(shownResult)}>应用到录入页</Button>
              ) : (
                <Button variant="outline" onClick={onGoEntry}>
                  返回手动录入
                </Button>
              )}
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="哪些台客多报表值得导入" icon={<Info className="size-4" />}>
            <div className="flex flex-col gap-3">
              {TIPS.map((tip) => (
                <div key={tip.title} className="flex items-start gap-2.5">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-foreground/40" />
                  <div>
                    <p className="text-[13px] font-medium">{tip.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
