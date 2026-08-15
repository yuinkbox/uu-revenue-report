import { ClipboardList, FileText, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { moneyShort } from "@/lib/format";
import type { PageKey } from "@/types/report";

const NAV_ITEMS: { key: PageKey; label: string; icon: typeof ClipboardList }[] = [
  { key: "entry", label: "报告数据", icon: ClipboardList },
  { key: "preview", label: "报告预览", icon: FileText },
  { key: "history", label: "历史报告", icon: History },
  { key: "settings", label: "基础设置", icon: Settings },
];

export default function AppSidebar({
  page,
  setPage,
  storeName,
  todayTotal,
  today,
}: {
  page: PageKey;
  setPage: (p: PageKey) => void;
  storeName: string;
  todayTotal: number;
  today: string;
}) {
  return (
    <aside className="app-sidebar sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r bg-sidebar px-3 py-4">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <img src="./logo-icon.png" alt="UU" className="size-9 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight">UU 经营报告</p>
          <p className="text-[11px] text-muted-foreground">门店经营分析工具</p>
        </div>
      </div>

      <div className="mx-1 mb-4 rounded-xl border bg-card p-3.5 shadow-xs">
        <p className="text-[11px] text-muted-foreground">今日营收 · {today.slice(5).replace("-", "/")}</p>
        <p className="nums mt-1 text-[22px] font-semibold leading-7 tracking-tight">
          <span className="mr-0.5 text-sm font-normal text-muted-foreground">¥</span>
          {moneyShort(todayTotal)}
        </p>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setPage(item.key)}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors",
                "hover:bg-sidebar-accent hover:text-foreground",
                active && "bg-sidebar-accent font-medium text-foreground shadow-xs",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t px-2 pt-3">
        <p className="truncate text-[13px] font-medium">{storeName}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">数据保存在服务器 · 自动备份</p>
      </div>
    </aside>
  );
}
