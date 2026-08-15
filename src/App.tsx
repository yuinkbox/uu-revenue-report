import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import AppSidebar from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import DataEntry from "@/pages/data-entry";
import HistoryPage from "@/pages/history-page";
import PreviewPage from "@/pages/preview-page";
import SettingsPage from "@/pages/settings-page";
import { totalRevenue } from "@/lib/calc";
import { saveViaDialog } from "@/lib/exporters";
import { fetchServerData, isServerMode, pushServerData } from "@/lib/api";
import {
  defaultReportDate,
  defaultSettings,
  emptyReport,
  loadReports,
  loadSettings,
  mergeReportsByUpdatedAt,
  migrateReport,
  saveReports,
  saveSettings,
  todayString,
} from "@/lib/store";
import type { PageKey, Report, Settings } from "@/types/report";

const PAGE_KEYS: PageKey[] = ["entry", "preview", "history", "settings"];

function pageFromHash(): PageKey {
  const h = window.location.hash.replace("#", "");
  return (PAGE_KEYS as string[]).includes(h) ? (h as PageKey) : "entry";
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings() as unknown as Settings);
  const [reports, setReports] = useState<Report[]>(() => loadReports() as Report[]);
  const [page, setPageState] = useState<PageKey>(pageFromHash);
  const [draft, setDraft] = useState<Report>(() => {
    const date = defaultReportDate();
    const existing = (loadReports() as Report[]).find(
      (r) => (r.periodType || "day") === "day" && r.date === date,
    );
    return existing
      ? { ...existing, storeName: "铜陵UU台球俱乐部" }
      : (emptyReport(date, loadSettings()) as unknown as Report);
  });
  const [baseVersion, setBaseVersion] = useState(0);
  const baseVersionRef = useRef(0);
  baseVersionRef.current = baseVersion;
  const serverLoadedRef = useRef(false);

  // 页面切换同步到地址栏 hash，刷新后停留在当前页
  const setPage = useCallback((p: PageKey) => {
    setPageState(p);
    window.location.hash = p === "entry" ? "" : p;
  }, []);

  useEffect(() => {
    const onHash = () => setPageState(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // 启动时从服务器拉取数据（服务器为主，本机缓存兜底）
  useEffect(() => {
    if (!isServerMode()) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchServerData();
        if (cancelled) return;
        if (data && Array.isArray(data.reports)) {
          const merged = mergeReportsByUpdatedAt(loadReports(), data.reports.map(migrateReport));
          saveReports(merged);
          setReports(merged);
          if (data.settings && typeof data.settings === "object") {
            const s = { ...defaultSettings, ...data.settings } as unknown as Settings;
            s.storeName = "铜陵UU台球俱乐部";
            saveSettings(s);
            setSettings(s);
          }
          setBaseVersion(typeof data.version === "number" ? data.version : 0);
          serverLoadedRef.current = true;
          const existing = merged.find((r) => (r.periodType || "day") === "day" && r.date === defaultReportDate());
          if (existing) setDraft({ ...existing, storeName: "铜陵UU台球俱乐部" });
        }
      } catch (err) {
        if ((err as Error).message === "unauthorized") return;
        // 服务器暂时不可用：允许后续保存继续尝试推送，成功时自动合并
        serverLoadedRef.current = true;
        if (!import.meta.env.DEV) toast.warning("服务器未连接，数据暂存本机");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 数据变化后推送到服务器（防抖），冲突时合并后重试
  useEffect(() => {
    if (!isServerMode() || !serverLoadedRef.current) return undefined;
    const t = window.setTimeout(async () => {
      try {
        const payload = { reports, settings, version: baseVersionRef.current };
        const res = await pushServerData(payload);
        if (res && (res as { conflict?: boolean }).conflict) {
          const server = (res as { server: { reports: Report[]; settings: Settings | null; version: number } }).server;
          const merged = mergeReportsByUpdatedAt(reports, (server.reports || []).map(migrateReport));
          saveReports(merged);
          setReports(merged);
          const s = { ...defaultSettings, ...(server.settings || {}) } as unknown as Settings;
          s.storeName = "铜陵UU台球俱乐部";
          saveSettings(s);
          setSettings(s);
          setBaseVersion(server.version);
          const retry = await pushServerData({ reports: merged, settings: s, version: server.version });
          if (retry && typeof (retry as { version?: number }).version === "number") {
            setBaseVersion((retry as { version: number }).version);
          }
          toast.warning("数据已与其他电脑合并保存");
        } else if (res && typeof (res as { version?: number }).version === "number") {
          setBaseVersion((res as { version: number }).version);
        }
      } catch (err) {
        if ((err as Error).message === "unauthorized") return;
        // 网络失败：保留本机缓存，下次保存再试
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [reports, settings]);

  // 设置修改后自动持久化到本机缓存
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const upsertReport = useCallback(
    (report: Report) => {
      const next: Report = {
        ...report,
        storeName: "铜陵UU台球俱乐部",
        createdAt: report.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const exists = reports.some((r) => r.date === next.date && r.periodType === next.periodType);
      const nextReports = exists
        ? reports.map((r) => (r.date === next.date && r.periodType === next.periodType ? next : r))
        : [...reports, next];
      saveReports(nextReports);
      setReports(nextReports);
      setDraft(next);
      return next;
    },
    [reports],
  );

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const handleSave = useCallback(() => {
    upsertReport(draftRef.current);
    toast.success("报告已保存");
  }, [upsertReport]);

  const handlePreview = () => {
    const saved = upsertReport(draft);
    setDraft(saved);
    setPage("preview");
    toast.success("报告已生成");
  };

  const handleView = (report: Report) => {
    setDraft({ ...report, storeName: "铜陵UU台球俱乐部" });
    setPage("preview");
  };

  const handleEdit = (report: Report) => {
    setDraft({ ...report, storeName: "铜陵UU台球俱乐部" });
    setPage("entry");
  };

  const handleDelete = (report: Report) => {
    const next = reports.filter((r) => !(r.date === report.date && r.periodType === report.periodType));
    saveReports(next);
    setReports(next);
    if (draft.date === report.date && draft.periodType === report.periodType) {
      setDraft(emptyReport(todayString(), settings) as unknown as Report);
    }
    toast.success("报告已删除");
  };

  const handleExportBackup = async () => {
    const payload = { settings, reports, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const saved = await saveViaDialog(`UU经营报告数据_${todayString()}.json`, blob);
    if (saved) toast.success("全部数据已导出");
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.reports) {
          const migrated = (data.reports as Report[]).map(migrateReport);
          saveReports(migrated);
          setReports(migrated);
        }
        if (data.settings) {
          const merged = { ...settings, ...data.settings } as Settings;
          saveSettings(merged);
          setSettings(merged);
        }
        toast.success("备份已恢复");
      } catch {
        toast.error("备份文件格式不正确");
      }
    };
    reader.readAsText(file);
  };

  const today = todayString();
  const todayTotal =
    draft.periodType === "day" && draft.date === today
      ? totalRevenue(draft)
      : totalRevenue(reports.find((r) => r.periodType === "day" && r.date === today));

  return (
    <div className="flex min-h-full">
      <AppSidebar page={page} setPage={setPage} storeName={settings.storeName} todayTotal={todayTotal} today={today} />
      <main className="app-main h-screen min-w-0 flex-1 overflow-y-auto px-8 pb-20 pt-7">
        {page === "entry" ? (
          <DataEntry
            report={draft}
            reports={reports}
            settings={settings}
            onChange={setDraft}
            onSave={handleSave}
            onPreview={handlePreview}
          />
        ) : null}
        {page === "preview" ? (
          <PreviewPage report={draft} reports={reports} settings={settings} onEdit={() => setPage("entry")} />
        ) : null}
        {page === "history" ? (
          <HistoryPage
            reports={reports}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNew={() => {
              setDraft(emptyReport(defaultReportDate(), settings) as unknown as Report);
              setPage("entry");
            }}
          />
        ) : null}
        {page === "settings" ? (
          <SettingsPage
            settings={settings}
            onChange={setSettings}
            onSave={() => {
              saveSettings(settings);
              toast.success("设置已保存");
            }}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        ) : null}
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
