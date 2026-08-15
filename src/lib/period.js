export const PERIOD_TYPES = [
  { value: "day", label: "日报" },
  { value: "custom", label: "自定义周期" }
];

function pad(n) {
  return String(n).padStart(2, "0");
}

export function parseDate(value) {
  if (value instanceof Date) return value;
  const text = String(value || "").trim();
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date();
}

export function fmt(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftDate(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return fmt(d);
}

/** 跨年按“去年同月同日”处理；2月29日落到平年时取2月28日。 */
export function shiftYears(dateStr, delta) {
  const d = parseDate(dateStr);
  const y = d.getFullYear() + delta;
  const leap = (yy) => (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0;
  const day = d.getMonth() === 1 && d.getDate() === 29 && !leap(y) ? 28 : d.getDate();
  return fmt(new Date(y, d.getMonth(), day));
}

/** 区间天数（含首尾）。 */
export function rangeDays(start, end) {
  const s = parseDate(start);
  const e = parseDate(end || start);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

/**
 * 常用区间快捷方式（均含首尾）。
 */
export function dayRange(anchor) {
  const d = parseDate(anchor);
  const s = fmt(d);
  return { start: s, end: s, label: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` };
}

export function lastNDays(n, anchor) {
  const end = parseDate(anchor);
  const start = new Date(end);
  start.setDate(start.getDate() - (n - 1));
  return { start: fmt(start), end: fmt(end), label: `近${n}天` };
}

export function thisWeek(anchor) {
  const d = parseDate(anchor);
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  return { start: fmt(mon), end: fmt(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)), label: "本周" };
}

export function lastWeek(anchor) {
  const d = parseDate(anchor);
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow - 7);
  return { start: fmt(mon), end: fmt(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)), label: "上周" };
}

export function thisMonth(anchor) {
  const d = parseDate(anchor);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: fmt(start), end: fmt(end), label: "本月" };
}

export function lastMonth(anchor) {
  const d = parseDate(anchor);
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 0);
  return { start: fmt(start), end: fmt(end), label: "上月" };
}

export function thisQuarter(anchor) {
  const d = parseDate(anchor);
  const q = Math.floor(d.getMonth() / 3);
  return {
    start: fmt(new Date(d.getFullYear(), q * 3, 1)),
    end: fmt(new Date(d.getFullYear(), q * 3 + 3, 0)),
    label: "本季"
  };
}

export function thisYear(anchor) {
  const d = parseDate(anchor);
  return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: "今年" };
}

/** 根据周期类型与锚点日期给出默认区间：日报=当天，自定义=近7天。 */
export function periodRange(type, anchor) {
  if (type === "custom") return lastNDays(7, anchor);
  return dayRange(anchor);
}

/** 环比：取当前区间之前的等长区间（日报=前一天；自定义=紧邻的等长区间）。 */
export function previousPeriodRange(type, start, end) {
  if (type === "custom") {
    const len = rangeDays(start, end);
    const prevEnd = shiftDate(start, -1);
    const prevStart = shiftDate(start, -len);
    return { start: prevStart, end: prevEnd };
  }
  return { start: shiftDate(start, -1), end: shiftDate(start, -1) };
}

/** 同比：去年同月同日（自定义=去年同一区间）。 */
export function lastYearRange(type, start, end) {
  if (type === "custom") {
    return { start: shiftYears(start, -1), end: shiftYears(end || start, -1) };
  }
  return { start: shiftYears(start, -1), end: shiftYears(start, -1) };
}

/** 在同类报告中找日期范围匹配的最新一份。 */
export function findReportForRange(reports, periodType, start, end) {
  return (
    (reports || [])
      .filter(
        (r) =>
          r.periodType === periodType &&
          r.date >= start &&
          (r.endDate || r.date) <= end
      )
      .sort((a, b) => ((b.endDate || b.date) < (a.endDate || a.date) ? 1 : -1))[0] || null
  );
}

/** 列出区间内每一天（含首尾）。 */
export function eachDate(start, end) {
  const out = [];
  const s = parseDate(start);
  const e = parseDate(end || start);
  if (e < s) return out;
  const cur = new Date(s);
  while (cur <= e) {
    out.push(fmt(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
