import { findReportForRange, lastYearRange, periodRange, previousPeriodRange } from "./period.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

// 2026-08-09 是周日
const day = periodRange("day", "2026-08-09");
assert(day.start === "2026-08-09" && day.end === "2026-08-09", "日报取当天");

const weekSunday = periodRange("week", "2026-08-09");
assert(weekSunday.start === "2026-07-27" && weekSunday.end === "2026-08-02", "周日打开取上一个完整周");
const weekMonday = periodRange("week", "2026-08-10");
assert(weekMonday.start === "2026-08-03" && weekMonday.end === "2026-08-09", "周一打开取上周一至周日");

const quarter = periodRange("quarter", "2026-08-09");
assert(quarter.start === "2026-07-01" && quarter.end === "2026-09-30", "季报取自然季度");

const half = periodRange("halfYear", "2026-08-09");
assert(half.start === "2026-07-01" && half.end === "2026-12-31", "半年报取自然半年");

const year = periodRange("year", "2026-08-09");
assert(year.start === "2026-01-01" && year.end === "2026-12-31", "年报取自然年");

const prev = previousPeriodRange("week", "2026-08-03");
assert(prev.start === "2026-07-27" && prev.end === "2026-08-02", "环比取上一周期");

const ly = lastYearRange("quarter", "2026-07-01");
assert(ly.start === "2025-07-01" && ly.end === "2025-09-30", "同比取去年同期");

const found = findReportForRange(
  [
    { periodType: "week", date: "2026-08-03", endDate: "2026-08-09", total: 1 },
    { periodType: "week", date: "2026-07-27", endDate: "2026-08-02", total: 2 }
  ],
  "week",
  "2026-08-03",
  "2026-08-09"
);
assert(found && found.total === 1, "按周期范围找到对应报告");

console.log("period test done");
