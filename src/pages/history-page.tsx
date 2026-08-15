import { useMemo, useState } from "react";
import { CalendarDays, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/page-header";
import { totalRevenue } from "@/lib/calc";
import { money } from "@/lib/format";
import type { Report } from "@/types/report";

const PERIOD_ORDER: { key: string; label: string }[] = [
  { key: "day", label: "日报" },
  { key: "custom", label: "周期报告" },
];

function rangeText(r: Report) {
  if ((r.periodType || "day") === "day") return r.date;
  return `${r.date} ~ ${r.endDate || r.date}`;
}

export default function HistoryPage({
  reports,
  onView,
  onEdit,
  onDelete,
  onNew,
}: {
  reports: Report[];
  onView: (r: Report) => void;
  onEdit: (r: Report) => void;
  onDelete: (r: Report) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim();
    const filtered = reports.filter(
      (r) =>
        !q ||
        rangeText(r).includes(q) ||
        String(r.date).includes(q) ||
        String(r.notes || "").includes(q),
    );
    const map = new Map<string, Report[]>();
    for (const r of filtered) {
      const key = r.periodType === "custom" ? "custom" : "day";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return PERIOD_ORDER.map((p) => ({
      ...p,
      list: (map.get(p.key) || []).sort((a, b) => (a.date < b.date ? 1 : -1)),
    })).filter((g) => g.list.length);
  }, [reports, query]);

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <PageHeader
        title="历史报告"
        description={`共 ${reports.length} 份，按周期类型分组`}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                placeholder="搜索日期或备注，如 2026-08"
                className="h-9 w-[220px] bg-card pl-8"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button onClick={onNew}>
              <Plus /> 新建报告
            </Button>
          </>
        }
      />

      {groups.length ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const total = group.list.reduce((s, r) => s + totalRevenue(r), 0);
            return (
              <section key={group.key}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-[13px] font-semibold text-muted-foreground">{group.label}</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {group.list.length} 份 · 合计{" "}
                    <span className="nums font-medium text-foreground">{money(total)}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {group.list.map((r) => (
                    <div
                      key={r.date}
                      className="group flex items-center gap-4 rounded-xl border bg-card px-4 py-3 shadow-xs transition-colors hover:border-foreground/20"
                    >
                      <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted/70">
                        <div className="text-center">
                          <p className="nums text-[15px] font-bold leading-4">{r.date.slice(8, 10)}</p>
                          <p className="text-[9px] text-muted-foreground">{r.date.slice(5, 7)}月</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="nums text-[14px] font-semibold">{rangeText(r)}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {r.notes ? r.notes.slice(0, 40) : "无备注"}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-[10px] text-muted-foreground">总营收</p>
                        <p className="nums text-[15px] font-semibold">{money(totalRevenue(r))}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <Button variant="ghost" size="icon-sm" title="查看" onClick={() => onView(r)}>
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="编辑" onClick={() => onEdit(r)}>
                          <Pencil className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="删除"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>删除 {rangeText(r)} 的报告？</AlertDialogTitle>
                              <AlertDialogDescription>删除后无法恢复。如需留档，请先在基础设置中导出备份。</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-white hover:bg-destructive/90"
                                onClick={() => onDelete(r)}
                              >
                                确认删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted">
            <CalendarDays className="size-5 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold">{query ? "没有匹配的报告" : "还没有报告"}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {query ? `没有找到包含“${query}”的报告` : "从报告数据页开始填写数据"}
          </p>
          <Button className="mt-5" onClick={onNew}>
            去录入
          </Button>
        </div>
      )}
    </div>
  );
}
