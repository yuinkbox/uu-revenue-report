import { useCallback, useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import AppSidebar from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import DataEntry from "@/pages/data-entry";
import HistoryPage from "@/pages/history-page";
import ImportPage from "@/pages/import-page";
import PreviewPage from "@/pages/preview-page";
import SettingsPage from "@/pages/settings-page";
import { totalRevenue } from "@/lib/calc";
import { mergeImportPatch } from "@/lib/importers";
import { sampleReport } from "@/lib/sample";
import {
  defaultReportDate,
  defaultSettings,
  emptyReport,
  loadReports,
  loadSettings,
  migrateReport,
  saveReports,
  saveSettings,
  todayString,
} from "@/lib/store";
import type { ImportResult, PageKey, Report, Settings } from "@/types/report";

function pywebviewReady() {
  return !!(window.pywebview?.api && typeof window.pywebview.api.save_data === "function");
}

const PAGE_KEYS: PageKey[] = ["entry", "import", "preview", "history", "settings"];

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
    const existing = (loadReports() as Report[]).find((r) => r.date === date);
    return existing
      ? { ...existing, storeName: "铜陵UU台球俱乐部" }
      : (emptyReport(date, loadSettings()) as unknown as Report);
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [bridgeReady, setBridgeReady] = useState(pywebviewReady);

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

  useEffect(() => {
    if (bridgeReady) return undefined;
    if (pywebviewReady()) {
      setBridgeReady(true);
      return undefined;
    }
    const onReady = () => setBridgeReady(true);
    window.addEventListener("pywebviewready", onReady);
    return () => window.removeEventListener("pywebviewready", onReady);
  }, [bridgeReady]);

  useEffect(() => {
    if (!bridgeReady) return undefined;
    const api = window.pywebview?.api;
    if (!api?.load_data) return undefined;
    let cancelled = false;
    api.load_data().then((text) => {
      if (cancelled || !text || text.startsWith("error:") || !text.trim()) return;
      try {
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.reports)) return;
        saveReports(data.reports);
        setReports(data.reports);
        if (data.settings && typeof data.settings === "object") {
          const merged = { ...defaultSettings, ...data.settings } as unknown as Settings;
          saveSettings(merged);
          setSettings(merged);
        }
        const existing = (data.reports as Report[]).find((r) => r.date === defaultReportDate());
        if (existing) setDraft({ ...existing, storeName: "铜陵UU台球俱乐部" });
      } catch {
        // 备份文件损坏时忽略，继续用浏览器本地数据
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bridgeReady]);

  useEffect(() => {
    if (!bridgeReady) return undefined;
    const api = window.pywebview?.api;
    if (!api?.save_data) return undefined;
    const payload = JSON.stringify({ reports, settings, exportedAt: new Date().toISOString() });
    const t = setTimeout(() => {
      try {
        const p = api.save_data!(payload);
        if (p && typeof (p as Promise<string>).then === "function") (p as Promise<string>).catch(() => {});
      } catch {
        // 保存失败不打扰用户，数据仍在本机存储中
      }
    }, 400);
    return () => clearTimeout(t);
  }, [reports, settings, bridgeReady]);

  // 设置修改后自动持久化，避免新报告回到默认值
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
      const exists = reports.some((r) => r.date === next.date);
      const nextReports = exists ? reports.map((r) => (r.date === next.date ? next : r)) : [...reports, next];
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

  const handleLoadSample = () => {
    setDraft(sampleReport(draft.date || todayString(), settings) as unknown as Report);
    toast.success("示例数据已载入，可直接编辑");
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
    const next = reports.filter((r) => r.date !== report.date);
    saveReports(next);
    setReports(next);
    if (draft.date === report.date) setDraft(emptyReport(todayString(), settings) as unknown as Report);
    toast.success("报告已删除");
  };

  const handleApplyImport = (result: ImportResult | null) => {
    if (result) setDraft((d) => mergeImportPatch(d, result.patch) as Report);
    setImportResult(null);
    setPage("entry");
    toast.success("导入数据已应用到录入页");
  };

  const handleExportBackup = () => {
    const payload = { settings, reports, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    saveAs(blob, `UU经营报告备份_${todayString()}.json`);
    toast.success("备份已导出");
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
  const todayTotal = totalRevenue(reports.find((r) => r.date === today));

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
            onLoadSample={handleLoadSample}
            onGoImport={() => setPage("import")}
          />
        ) : null}
        {page === "import" ? (
          <ImportPage
            onApply={handleApplyImport}
            onGoEntry={() => setPage("entry")}
            reportDate={draft.date}
            externalResult={importResult}
            onClearExternal={() => setImportResult(null)}
            grouponAmountSource={settings.grouponAmountSource}
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
