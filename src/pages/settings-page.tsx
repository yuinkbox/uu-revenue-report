import { useRef } from "react";
import { Database, Info, Save, ShieldCheck, SlidersHorizontal, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, NumberInput, TextInput } from "@/components/fields";
import PageHeader from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { toNumber } from "@/lib/calc";
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

  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  const setTableParams = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    next.salableMinutes = Math.round(toNumber(next.tableCount) * toNumber(next.openHours) * 60);
    onChange(next);
  };

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <PageHeader
        title="基础设置"
        description="门店、目标、台桌和对账参数"
        actions={
          <>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Database /> 导入全部数据
            </Button>
            <Button variant="outline" onClick={onExportBackup}>
              <Database /> 导出全部数据
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
          subtitle="数据保存在服务器，每次保存自动生成备份副本（保留最近 30 份）"
          icon={<ShieldCheck className="size-4" />}
        >
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              所有电脑通过浏览器访问同一个服务器地址，数据实时同步、服务器自动备份。
              <br />
              服务器上的「配置.json」可设置端口、数据目录与访问密码；密码留空则局域网内免登录。
              <br />
              「导出全部数据」= 把报告和设置存成一个 JSON 文件，用于离线存档；「导入全部数据」= 从该文件恢复（会覆盖同名日期报告）。
            </span>
          </div>
        </SectionCard>

        <SectionCard title="经营参数" icon={<SlidersHorizontal className="size-4" />}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="月度营收目标（元）">
              <NumberInput value={settings.monthTarget} onChange={(v) => set({ monthTarget: v })} />
            </Field>
            <Field label="台桌数">
              <NumberInput value={settings.tableCount} step="1" onChange={(v) => setTableParams({ tableCount: v })} />
            </Field>
            <Field label="每日营业时长（小时）" hint="10:00 - 次日 02:00 为 16 小时">
              <NumberInput value={settings.openHours} step="1" onChange={(v) => setTableParams({ openHours: v })} />
            </Field>
            <Field label="可售总时长" hint="台桌数 × 营业时长 × 60 分钟，自动计算">
              <div className="nums flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                {Math.round(toNumber(settings.tableCount) * toNumber(settings.openHours) * 60).toLocaleString("zh-CN")} 分钟
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
          title="异常类型"
          subtitle="录入页「异常记录」的类型下拉选项，每行一个"
          icon={<ShieldCheck className="size-4" />}
        >
          <Textarea
            rows={4}
            className="bg-card"
            value={(settings.abnormalTypes || []).join("\n")}
            onChange={(e) => set({ abnormalTypes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </SectionCard>
      </div>
    </div>
  );
}
