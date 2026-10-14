/* Generator for a shareable "Compliance Calendar" workbook — every real due
   date for a financial year, one tab per head (GST, Income Tax, TDS,
   ROC/MCA, ROC/MCA (LLP), Other Statutory), pulled straight from the same
   catalogue and recurring rules the app itself runs on
   (`src/domain/catalog.ts`), so it can never quietly drift from what the
   product actually tracks.

   Reusable for any year, not just this one: pass the FY's starting
   calendar year as an argument.
     node scripts/exportComplianceCalendar.ts        # this year (FY_START)
     node scripts/exportComplianceCalendar.ts 2027    # FY 2027-28
*/

import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_UNTRACKED, DEFS, DEF_BY_CODE, FY_START, HEADS, fyLabel, occurrencesForFY,
} from "../src/domain/catalog.ts";
import type { LateFee } from "../src/domain/types.ts";

/** "2026-04-30" → a real Excel date, not a text string that happens to look
 *  like one — built in UTC so the day itself can't shift under a reader's
 *  local timezone, and shown as `yyyy-mm-dd` regardless of the workbook's
 *  own locale (Excel's default would otherwise render it e.g. 30-04-2026
 *  or 4/30/2026 depending on the machine that opens it). */
function toExcelDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function lateFeeText(lf: LateFee): string {
  if (lf.kind === "perDay") {
    const cap = lf.cap === "turnoverPct" ? `capped at ${lf.capPct}% of turnover`
      : lf.cap === "tdsAmount" ? "capped at the TDS/TCS amount"
      : typeof lf.cap === "number" ? `capped at ₹${lf.cap.toLocaleString("en-IN")}`
      : "no cap";
    return `₹${lf.amount}/day (${cap})`;
  }
  if (lf.kind === "flat") return lf.amount === 0 ? "None" : `₹${lf.amount.toLocaleString("en-IN")} flat`;
  if (lf.kind === "s234f") return "₹1,000–₹5,000 slab (s.234F)";
  if (lf.kind === "interest") return `${lf.monthlyPct}% per month on ${lf.basis}`;
  return `${lf.pct}% of turnover, capped at ₹${lf.cap.toLocaleString("en-IN")}`;
}

const UNTRACKED_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E6" } };
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6E63" } };

const COLUMNS = ["Code", "Title", "Period", "Due date", "Description", "Frequency", "Applies to", "Late fee", "Tracked by default"];
const WIDTHS = [16, 24, 20, 14, 32, 11, 36, 30, 18];

/** Excel worksheet names can't carry `/` (among others) — "ROC/MCA" and
 *  "ROC/MCA (LLP)", real head names everywhere else in the app, need a
 *  tab-safe spelling here only. */
function sheetSafeName(name: string): string {
  return name.replace(/\//g, "-");
}

function addSheet(wb: ExcelJS.Workbook, name: string, occs: { code: string; period: string; due: string }[]) {
  const ws = wb.addWorksheet(sheetSafeName(name), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(COLUMNS);
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  const sorted = [...occs].sort((a, b) => a.due.localeCompare(b.due) || a.code.localeCompare(b.code));
  for (const o of sorted) {
    const d = DEF_BY_CODE[o.code];
    const trackedByDefault = !DEFAULT_UNTRACKED.has(o.code);
    ws.addRow([
      o.code, d.form, o.period, toExcelDate(o.due), d.description, d.frequency, d.applicability,
      lateFeeText(d.lateFee), trackedByDefault ? "Yes" : "No — off by default",
    ]);
  }

  const dueCol = COLUMNS.indexOf("Due date") + 1;
  for (let i = 0; i < sorted.length; i++) {
    const row = ws.getRow(i + 2);
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(dueCol).numFmt = "yyyy-mm-dd";
    if (DEFAULT_UNTRACKED.has(sorted[i].code)) {
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = UNTRACKED_FILL; });
      row.getCell(COLUMNS.length).font = { bold: true, color: { argb: "FFB3261E" } };
    }
  }

  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  return sorted.length;
}

const GENERIC_COLUMNS = ["Code", "Title", "Head", "Description", "Frequency", "Recurring due date rule", "Applies to", "Late fee", "Tracked by default"];
const GENERIC_WIDTHS = [16, 24, 12, 32, 11, 30, 36, 30, 18];

/** The rule itself, not any one year's dates — one row per compliance code,
 *  independent of which financial year is open when someone reads it. This
 *  is the sheet that stays correct forever; the year-specific tabs are one
 *  year's reading of it, and go stale the moment that year ends. */
function addGenericSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Recurring Pattern (Generic)", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(GENERIC_COLUMNS);
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  const sorted = [...DEFS].sort((a, b) => {
    const hi = HEADS.indexOf(a.head) - HEADS.indexOf(b.head);
    return hi !== 0 ? hi : a.code.localeCompare(b.code);
  });
  for (const d of sorted) {
    const trackedByDefault = !DEFAULT_UNTRACKED.has(d.code);
    ws.addRow([
      d.code, d.form, d.head, d.description, d.frequency, d.dueRule, d.applicability,
      lateFeeText(d.lateFee), trackedByDefault ? "Yes" : "No — off by default",
    ]);
  }

  for (let i = 0; i < sorted.length; i++) {
    const row = ws.getRow(i + 2);
    row.alignment = { vertical: "top", wrapText: true };
    if (DEFAULT_UNTRACKED.has(sorted[i].code)) {
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = UNTRACKED_FILL; });
      row.getCell(GENERIC_COLUMNS.length).font = { bold: true, color: { argb: "FFB3261E" } };
    }
  }

  GENERIC_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  return sorted.length;
}

/** ITR-U and the four TDS correction statements are tagged to the year
 *  they correct, not the year they're actually due — sometimes years
 *  later (ITR-U's window closes 5 years out). Everything else recurs
 *  monthly/quarterly/annually and is filtered by due date below instead. */
const LONG_TAIL_CODES = new Set(["ITR-U", "24Q-CORR", "26Q-CORR", "27Q-CORR", "27EQ-CORR"]);

/** The same due-date-window rule Compliance Detail and the Tracker use in
 *  the app itself: a financial year's calendar is every due date landing
 *  between its own 1 April and the following 31 March, not every
 *  occurrence *tagged* to that year. Most agree on both, but a monthly or
 *  quarterly return's LAST period of the year is due a few weeks into the
 *  next one (e.g. March's GSTR-3B, due 20 April) — filtering by the tag
 *  alone silently drops it, and the year's own last month, due in the
 *  following year's window, quietly takes its place instead. Pulling in
 *  the prior origin year's occurrences and filtering everything by due
 *  date, rather than trusting either year's tag, reconstructs the same
 *  12-in-a-row view the app shows. */
function occurrencesForCalendarYear(fyStart: number) {
  const from = `${fyStart}-04-01`;
  const to = `${fyStart + 1}-03-31`;
  const candidates = [...occurrencesForFY(fyStart - 1), ...occurrencesForFY(fyStart)];
  const filtered = candidates.filter((occ) => (
    LONG_TAIL_CODES.has(occ.defCode) ? occ.fy === fyStart : occ.dueDate >= from && occ.dueDate <= to
  ));
  /* GSTR-4 alone generates two `once()` occurrences per origin year on
     purpose (last year's, due this April; this year's, due next April) —
     see the note on `occurrencesForFY`. Pulling in both fyStart-1 and
     fyStart's own occurrence sets means fyStart-1's forward-looking entry
     and fyStart's backward-looking one describe the exact same real
     filing and land on the same runId; keep one. */
  const seen = new Map<string, (typeof filtered)[number]>();
  for (const occ of filtered) seen.set(occ.runId, occ);
  return [...seen.values()];
}

async function main() {
  const fyStart = Number(process.argv[2]) || FY_START;
  const occs = occurrencesForCalendarYear(fyStart);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Compliance Tracker";
  wb.created = new Date();

  const byHead = new Map<string, { code: string; period: string; due: string }[]>();
  for (const occ of occs) {
    const def = DEF_BY_CODE[occ.defCode];
    if (!def) continue;
    const list = byHead.get(def.head);
    const row = { code: occ.defCode, period: occ.periodLabel, due: occ.dueDate };
    if (list) list.push(row);
    else byHead.set(def.head, [row]);
  }

  const legendWs = wb.addWorksheet("Read me");
  legendWs.getColumn(1).width = 100;
  legendWs.addRows([
    [`Compliance calendar — ${fyLabel(fyStart)}`],
    [""],
    ["\"Recurring Pattern (Generic)\" is the rule itself — one row per compliance, independent of any year. It never goes stale and doesn't need regenerating."],
    ["Everything after it is this specific financial year's actual reading of that rule: one tab per head (GST, Income Tax, TDS, ROC/MCA, ROC/MCA (LLP), Other Statutory), plus one combined chronological view across all of them."],
    ["Each row there is one real due date this financial year — every month of a monthly return, every quarter of a quarterly one, including corrections, revised returns and QRMP Category A/B variants as their own rows."],
    ["Highlighted rows are switched OFF by default in Settings → Compliances (a firm turns them on if it handles that filing) — everything else is tracked out of the box."],
    [""],
    ["To regenerate the year-specific tabs for another year: node scripts/exportComplianceCalendar.ts <fyStartYear>, e.g. 2027 for FY 2027-28."],
  ]);
  legendWs.getRow(1).font = { bold: true, size: 14 };
  legendWs.getRow(6).fill = UNTRACKED_FILL;

  addGenericSheet(wb);

  // A combined, chronological view across every head, right after the
  // read-me — "what's due when" for the whole practice on one screen.
  const all = [...byHead.values()].flat();
  const allWs = wb.addWorksheet("All (chronological)", { views: [{ state: "frozen", ySplit: 1 }] });
  allWs.addRow(["Head", ...COLUMNS]);
  const allHeader = allWs.getRow(1);
  allHeader.height = 22;
  allHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  const allSorted = [...all].sort((a, b) => a.due.localeCompare(b.due) || a.code.localeCompare(b.code));
  for (const o of allSorted) {
    const d = DEF_BY_CODE[o.code];
    const trackedByDefault = !DEFAULT_UNTRACKED.has(o.code);
    allWs.addRow([
      d.head, o.code, d.form, o.period, toExcelDate(o.due), d.description, d.frequency, d.applicability,
      lateFeeText(d.lateFee), trackedByDefault ? "Yes" : "No — off by default",
    ]);
  }
  const allDueCol = COLUMNS.indexOf("Due date") + 2; // +1 for the leading "Head" column
  for (let i = 0; i < allSorted.length; i++) {
    const row = allWs.getRow(i + 2);
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(allDueCol).numFmt = "yyyy-mm-dd";
    if (DEFAULT_UNTRACKED.has(allSorted[i].code)) {
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = UNTRACKED_FILL; });
      row.getCell(COLUMNS.length + 1).font = { bold: true, color: { argb: "FFB3261E" } };
    }
  }
  allWs.getColumn(1).width = 16;
  WIDTHS.forEach((w, i) => { allWs.getColumn(i + 2).width = w; });

  let total = 0;
  for (const head of HEADS) {
    const rows = byHead.get(head);
    if (!rows || rows.length === 0) continue;
    total += addSheet(wb, head, rows);
  }

  const path = fileURLToPath(new URL(`../../Compliance Calendar - ${fyLabel(fyStart).replace(/\s+/g, "")}.xlsx`, import.meta.url));
  await wb.xlsx.writeFile(path);
  console.log(`Wrote ${total} occurrences across ${byHead.size} heads (${fyLabel(fyStart)}) to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
