import { importTaikeduoExcel, mergeImportPatch, sortFilesForImport } from "./importers";

async function base64ToArrayBuffer(base64) {
  const response = await fetch(`data:application/octet-stream;base64,${base64}`);
  return response.arrayBuffer();
}

export async function importFromFolder(folder, targetDate, options = {}) {
  try {
    if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.list_exports) {
      return { ok: false, messages: [{ ok: false, text: "当前不是桌面窗口，无法扫描文件夹" }], patch: {} };
    }

    const fileList = await window.pywebview.api.list_exports(folder);
    const files = sortFilesForImport(fileList || []);
    if (!files || !files.length) {
      return { ok: false, messages: [{ ok: false, text: "导出文件夹里没有找到表格文件" }], patch: {} };
    }

    let patch = {};
    const messages = [];
    let anyOk = false;

    for (const path of files) {
      const filename = path.split(/[\\/]/).pop();
      try {
        const base64 = await window.pywebview.api.read_export(path);
        if (!base64 || base64.startsWith("error:")) {
          messages.push({ ok: false, text: `${filename}：读取失败` });
          continue;
        }
        const fakeFile = {
          name: filename,
          arrayBuffer: async () => base64ToArrayBuffer(base64)
        };
        const result = await importTaikeduoExcel(fakeFile, targetDate, options);
        if (result.ok) {
          anyOk = true;
          messages.push({ ok: true, text: `${filename}：${result.message}` });
          patch = mergeImportPatch(patch, result.patch || {});
        } else {
          messages.push({ ok: false, text: `${filename}：${result.message}` });
        }
      } catch (err) {
        messages.push({ ok: false, text: `${filename}：解析失败 ${err.message || err}` });
      }
    }

    return { ok: anyOk, messages, patch };
  } catch (err) {
    return { ok: false, messages: [{ ok: false, text: `扫描文件夹失败：${err.message || err}` }], patch: {} };
  }
}
