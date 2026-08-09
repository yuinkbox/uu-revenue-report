import { round2 } from "./calc";

export function money(v: unknown): string {
  return `¥${round2(v).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moneyShort(v: unknown): string {
  return round2(v).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export function signedRate(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function signedMoney(v: unknown): string {
  const num = round2(v);
  if (num === 0) return "¥0.00";
  const abs = Math.abs(num).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${num > 0 ? "+" : "-"}¥${abs}`;
}

export function weekdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

export function relativeDay(date: string, today: string): string | null {
  const a = new Date(`${date}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff === 2) return "前天";
  return null;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${Number(y)}年${Number(m)}月`;
}
