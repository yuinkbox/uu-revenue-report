export const PERIOD_TYPES = [
  { value: "day", label: "日报" },
  { value: "week", label: "周报" },
  { value: "quarter", label: "季报" },
  { value: "halfYear", label: "半年报" },
  { value: "year", label: "年报" }
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function parseDate(value) {
  if (value instanceof Date) return value;
  const text = String(value || "").trim();
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date();
}

function fmt(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDate(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return fmt(d);
}

/**
 * 根据周期类型与锚点日期计算周期范围。
 * 周报默认取"上一周"（周一至周日），与业务约定一致。
 */
export function periodRange(type, anchor) {
  const d = parseDate(anchor);
  const y = d.getFullYear();
  const m = d.getMonth();
  if (type === "day") {
    const s = fmt(d);
    return { start: s, end: s, label: `${y}年${m + 1}月${d.getDate()}日` };
  }
  if (type === "week") {
    const dow = (d.getDay() + 6) % 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - dow - 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const start = fmt(mon);
    const end = fmt(sun);
    return { start, end, label: `${mon.getMonth() + 1}月${mon.getDate()}日~${sun.getMonth() + 1}月${sun.getDate()}日` };
  }
  if (type === "quarter") {
    const q = Math.floor(m / 3);
    const start = fmt(new Date(y, q * 3, 1));
    const end = fmt(new Date(y, q * 3 + 3, 0));
    return { start, end, label: `${y}年Q${q + 1}` };
  }
  if (type === "halfYear") {
    const h = m < 6 ? 0 : 1;
    const start = fmt(new Date(y, h * 6, 1));
    const end = fmt(new Date(y, h * 6 + 6, 0));
    return { start, end, label: `${y}年${h === 0 ? "上半年" : "下半年"}` };
  }
  if (type === "year") {
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}年` };
  }
  return { start: fmt(d), end: fmt(d), label: fmt(d) };
}

/** 环比：取当前周期之前的同长度周期（周报=上一自然周）。 */
export function previousPeriodRange(type, start) {
  if (type === "week") {
    return { start: shiftDate(start, -7), end: shiftDate(start, -1) };
  }
  const d = parseDate(start);
  if (type === "day") return { start: shiftDate(start, -1), end: shiftDate(start, -1) };
  if (type === "quarter") {
    const y = d.getFullYear();
    const q = Math.floor(d.getMonth() / 3) - 1;
    const py = q < 0 ? y - 1 : y;
    const pq = ((q % 4) + 4) % 4;
    return {
      start: fmt(new Date(py, pq * 3, 1)),
      end: fmt(new Date(py, pq * 3 + 3, 0))
    };
  }
  if (type === "halfYear") {
    const h = d.getMonth() < 6 ? 1 : 0;
    const py = d.getMonth() < 6 ? d.getFullYear() - 1 : d.getFullYear();
    return { start: fmt(new Date(py, h * 6, 1)), end: fmt(new Date(py, h * 6 + 6, 0)) };
  }
  if (type === "year") {
    return { start: `${d.getFullYear() - 1}-01-01`, end: `${d.getFullYear() - 1}-12-31` };
  }
  return { start: shiftDate(start, -1), end: shiftDate(start, -1) };
}

/** 同比：取去年同期（同类型、去年同范围）。 */
export function lastYearRange(type, start) {
  const d = parseDate(start);
  if (type === "day") return { start: shiftDate(start, -365), end: shiftDate(start, -365) };
  const y = d.getFullYear() - 1;
  if (type === "week") {
    const range = periodRange("week", start);
    const nd = new Date(range.start);
    nd.setFullYear(nd.getFullYear() - 1);
    return periodRange("week", fmt(nd));
  }
  if (type === "quarter") {
    const q = Math.floor(d.getMonth() / 3);
    return { start: fmt(new Date(y, q * 3, 1)), end: fmt(new Date(y, q * 3 + 3, 0)) };
  }
  if (type === "halfYear") {
    const h = d.getMonth() < 6 ? 0 : 1;
    return { start: fmt(new Date(y, h * 6, 1)), end: fmt(new Date(y, h * 6 + 6, 0)) };
  }
  if (type === "year") {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  return { start: shiftDate(start, -365), end: shiftDate(start, -365) };
}

/** 在同类型报告中找日期范围匹配的最新一份。 */
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
