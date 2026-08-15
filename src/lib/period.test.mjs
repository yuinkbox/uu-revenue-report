import {
  eachDate,
  findReportForRange,
  lastNDays,
  lastMonth,
  lastWeek,
  lastYearRange,
  periodRange,
  previousPeriodRange,
  rangeDays,
  shiftYears,
  thisMonth,
  thisQuarter,
  thisWeek,
  thisYear,
} from "./period.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

const day = periodRange("day", "2026-08-09");
assert(day.start === "2026-08-09" && day.end === "2026-08-09", "日报取当天");

const custom = periodRange("custom", "2026-08-09");
assert(custom.start === "2026-08-03" && custom.end === "2026-08-09", "自定义默认近7天（含当天）");

const week = thisWeek("2026-08-09");
assert(week.start === "2026-08-03" && week.end === "2026-08-09", "本周=本周一至周日（2026-08-09 是周日）");
const lweek = lastWeek("2026-08-09");
assert(lweek.start === "2026-07-27" && lweek.end === "2026-08-02", "上周=上周一至周日");
const month = thisMonth("2026-08-09");
assert(month.start === "2026-08-01" && month.end === "2026-08-31", "本月=自然月");
const lmonth = lastMonth("2026-08-09");
assert(lmonth.start === "2026-07-01" && lmonth.end === "2026-07-31", "上月=上一个自然月");
const quarter = thisQuarter("2026-08-09");
assert(quarter.start === "2026-07-01" && quarter.end === "2026-09-30", "本季=自然季度");
const year = thisYear("2026-08-09");
assert(year.start === "2026-01-01" && year.end === "2026-12-31", "今年=自然年");
const n30 = lastNDays(30, "2026-08-09");
assert(n30.start === "2026-07-11" && n30.end === "2026-08-09", "近30天含首尾");

const prevDay = previousPeriodRange("day", "2026-08-09", "2026-08-09");
assert(prevDay.start === "2026-08-08" && prevDay.end === "2026-08-08", "日报环比=前一天");

const prevCustom = previousPeriodRange("custom", "2026-08-03", "2026-08-09");
assert(prevCustom.start === "2026-07-27" && prevCustom.end === "2026-08-02", "自定义环比=紧邻的等长区间");

const prevCustom2 = previousPeriodRange("custom", "2026-07-01", "2026-07-31");
assert(prevCustom2.start === "2026-05-31" && prevCustom2.end === "2026-06-30", "31天区间环比=前31天");

const lyDay = lastYearRange("day", "2026-03-01", "2026-03-01");
assert(lyDay.start === "2025-03-01" && lyDay.end === "2025-03-01", "日同比=去年同月同日");

const lyLeap = lastYearRange("day", "2024-02-29", "2024-02-29");
assert(lyLeap.start === "2023-02-28", "闰日同比落到平年取2月28日");

const lyCustom = lastYearRange("custom", "2026-08-03", "2026-08-09");
assert(lyCustom.start === "2025-08-03" && lyCustom.end === "2025-08-09", "自定义同比=去年同一区间");

assert(shiftYears("2024-02-29", -1) === "2023-02-28", "跨年 2月29日 修正为 2月28日");
assert(shiftYears("2023-03-01", -1) === "2022-03-01", "普通日期跨年正确");

assert(rangeDays("2026-08-03", "2026-08-09") === 7, "区间天数含首尾");
assert(eachDate("2026-08-07", "2026-08-09").join(",") === "2026-08-07,2026-08-08,2026-08-09", "逐日列出区间");

const found = findReportForRange(
  [
    { periodType: "custom", date: "2026-08-03", endDate: "2026-08-09", total: 1 },
    { periodType: "custom", date: "2026-07-27", endDate: "2026-08-02", total: 2 }
  ],
  "custom",
  "2026-08-03",
  "2026-08-09"
);
assert(found && found.total === 1, "按周期范围找到对应报告");

console.log("period test done");
