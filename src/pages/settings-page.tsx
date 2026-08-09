import { useEffect, useRef, useState } from "react";
import { Database, FolderOpen, Info, Save, ShieldCheck, SlidersHorizontal, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Field, NumberInput, TextInput } from "@/components/fields";
import PageHeader from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { cn } from "@/lib/utils";
import type { Settings } from "@/types/report";

export default function SettingsPage({
  settings,
  onChange,
  onSave,
  onExportBackup,
  onImportBackup,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onSave: () => void;
  onExportBackup: () => void;
  onImportBackup: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [dataDir, setDataDir] = useState("");

  useEffect(() => {
    const api = window.pywebview?.api as { get_data_dir?: () => Promise<string> } | undefined;
    if (api?.get_data_dir) {
      api
        .get_data_dir()
        .then((p) => setDataDir(p))
        .catch(() => {});
    }
  }, []);

  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <PageHeader
        title="基础设置"
        description="门店、目标、台桌和人员配置"
        actions={
          <>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Database /> 导入备份
            </Button>
            <Button variant="outline" onClick={onExportBackup}>
              <Database /> 导出备份
            </Button>
            <Button onClick={onSave}>
              <Save /> 保存设置
            </Button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportBackup(f);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col gap-4">
        <SectionCard title="门店信息" icon={<Store className="size-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="门店名称" hint="内部专用，固定不可修改">
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                铜陵UU台球俱乐部
              </div>
            </Field>
            <Field label="日报标题" hint="显示在导出的文件标题中">
              <TextInput value={settings.reportTitle} onChange={(v) => set({ reportTitle: v })} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="数据安全"
          subtitle="桌面版会自动把日报和设置备份到数据文件夹"
          icon={<ShieldCheck className="size-4" />}
        >
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              数据文件夹：<span className="nums font-medium text-foreground">{dataDir || "exe 旁的「数据」文件夹"}</span>
              <br />
              多台电脑共用时，可在 exe 旁的「配置.json」里指定同一份数据文件夹（如网盘同步目录、共享盘），员工版和店长版即数据互通。
            </span>
          </div>
        </SectionCard>

        <SectionCard title="经营参数" icon={<SlidersHorizontal className="size-4" />}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="月度营收目标（元）">
              <NumberInput value={settings.monthTarget} onChange={(v) => set({ monthTarget: v })} />
            </Field>
            <Field label="台桌数">
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">27 张</div>
            </Field>
            <Field label="每日营业时长" hint="10:00 - 次日 02:00">
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">16 小时</div>
            </Field>
            <Field label="可售总时长" hint="27 张 × 16 小时 × 60 分钟">
              <div className="nums flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                25,920 分钟
              </div>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="对账设置" icon={<ShieldCheck className="size-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="对账容差（元）" hint="差异在容差内视为正常，默认 3 元">
              <NumberInput value={settings.reconcileTolerance} step="1" onChange={(v) => set({ reconcileTolerance: v })} />
            </Field>
            <Field label="差异原因选项" hint="每行一个，录入对账时下拉选择">
              <Textarea
                rows={6}
                className="bg-card"
                value={(settings.diffReasons || []).join("\n")}
                onChange={(e) => set({ diffReasons: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="团购核销金额口径"
          subtitle="导入第三方平台报表和经营报表时，日报里「团购核销金额」按哪个数计算"
          icon={<Database className="size-4" />}
        >
          <RadioGroup
            value={settings.grouponAmountSource || "detail"}
            onValueChange={(v) => set({ grouponAmountSource: v })}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {[
              {
                value: "detail",
                title: "明细口径",
                desc: "按第三方平台报表逐笔「结算金额/售价」合计",
              },
              {
                value: "summary",
                title: "汇总口径",
                desc: "按经营报表的「美团团购/抖音团购」金额",
              },
            ].map((opt) => {
              const active = (settings.grouponAmountSource || "detail") === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                    active ? "border-foreground/60 bg-muted/50" : "hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value={opt.value} className="mt-0.5" />
                  <span>
                    <span className="block text-[13px] font-medium">{opt.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{opt.desc}</span>
                  </span>
                </label>
              );
            })}
          </RadioGroup>
          <p className="text-xs leading-relaxed text-muted-foreground">
            单数两种口径都按第三方明细统计；两个口径金额不同时，以你在美团/抖音后台核对的数为准。选一次即可，之后每次导入都按这个口径。
          </p>
        </SectionCard>

        <SectionCard
          title="商云宝经营报表文件夹"
          subtitle="把商云宝导出的经营报表放到这里，店长就能一键导入自动填入日报"
          icon={<FolderOpen className="size-4" />}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="nums flex h-9 min-w-[240px] flex-1 items-center truncate rounded-md border bg-muted/50 px-3 text-[13px] text-muted-foreground">
              {settings.exportFolder || "尚未设置"}
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                if (!window.pywebview?.api?.select_folder) {
                  setMessage("只有桌面版支持选择文件夹");
                  return;
                }
                const folder = await window.pywebview.api.select_folder();
                if (folder && !folder.startsWith("error:")) set({ exportFolder: folder });
              }}
            >
              <FolderOpen /> 选择文件夹
            </Button>
          </div>
        </SectionCard>

        {message ? <p className="text-[13px] text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
