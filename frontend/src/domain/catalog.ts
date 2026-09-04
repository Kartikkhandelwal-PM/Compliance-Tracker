/* ============================================================================
   MASTER STATUTORY CATALOG — FY 2026-27
   ----------------------------------------------------------------------------
   Encoded from the "Recurring Pattern (Generic)" sheet rather than the flat
   136-row list, because the generic rule is the thing that stays true next
   year. Occurrences are generated from the rule, so rolling the calendar
   forward is a one-line change, not a re-typing exercise.

   Late fees are indicative and mirror the master calendar's own wording.
   ========================================================================== */

import type { ComplianceDef, Occurrence } from "./types.ts";
import { iso, monthLabel } from "./dates.ts";

/** The financial year the seeded client book belongs to (Apr 2026 – Mar 2027). */
export const FY_START = 2026;

export const FY_LABEL = fyLabel(FY_START);
export const AY_LABEL = ayLabel(FY_START);

/** "FY 2026-27" for fyStart 2026. */
export function fyLabel(fyStart: number): string {
  return `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

/** Assessment year is one ahead of the financial year it assesses. */
export function ayLabel(fyStart: number): string {
  return `AY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

/** The twelve period months of a financial year, in order: Apr … Mar. */
function fyMonths(fyStart: number): [number, number][] {
  return [
    [fyStart, 4], [fyStart, 5], [fyStart, 6], [fyStart, 7], [fyStart, 8], [fyStart, 9],
    [fyStart, 10], [fyStart, 11], [fyStart, 12],
    [fyStart + 1, 1], [fyStart + 1, 2], [fyStart + 1, 3],
  ];
}

/* `key` embeds `fyStart` so a quarter's runId stays unique once occurrences
   from more than one financial year sit in the same store — otherwise
   "CMP-08::Q1" from FY 2025-26 and FY 2026-27 would collide. */
function fyQuarters(fyStart: number): { key: string; label: string; endY: number; endM: number }[] {
  return [
    { key: `Q1-${fyStart}`, label: `Q1 · Apr–Jun ${fyStart}`, endY: fyStart, endM: 6 },
    { key: `Q2-${fyStart}`, label: `Q2 · Jul–Sep ${fyStart}`, endY: fyStart, endM: 9 },
    { key: `Q3-${fyStart}`, label: `Q3 · Oct–Dec ${fyStart}`, endY: fyStart, endM: 12 },
    { key: `Q4-${fyStart}`, label: `Q4 · Jan–Mar ${fyStart + 1}`, endY: fyStart + 1, endM: 3 },
  ];
}

function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

/** Monthly return due on `day` of the month following the period. */
function monthlyFollowing(
  fyStart: number,
  code: string,
  day: number,
  override?: (y: number, m: number) => string | null,
): Occurrence[] {
  return fyMonths(fyStart).map(([y, m]) => {
    const [ny, nm] = nextMonth(y, m);
    const custom = override?.(y, m) ?? null;
    return {
      runId: `${code}::${y}-${String(m).padStart(2, "0")}`,
      defCode: code,
      periodKey: `${y}-${String(m).padStart(2, "0")}`,
      periodLabel: monthLabel(y, m),
      dueDate: custom ?? iso(ny, nm, day),
      fy: fyStart,
    };
  });
}

/** Monthly, but only the first two months of each quarter — for IFF, where
 *  the third month's invoices go through the quarterly return itself rather
 *  than a monthly upload of their own. */
function iffMonths(fyStart: number, code: string, day: number): Occurrence[] {
  return fyMonths(fyStart)
    .filter((_, i) => i % 3 !== 2)
    .map(([y, m]) => {
      const [ny, nm] = nextMonth(y, m);
      return {
        runId: `${code}::${y}-${String(m).padStart(2, "0")}`,
        defCode: code,
        periodKey: `${y}-${String(m).padStart(2, "0")}`,
        periodLabel: monthLabel(y, m),
        dueDate: iso(ny, nm, day),
        fy: fyStart,
      };
    });
}

/** Quarterly return due on `day` of the `offset`-th month after quarter end. */
function quarterlyFollowing(fyStart: number, code: string, day: number, offset = 1): Occurrence[] {
  return fyQuarters(fyStart).map((q) => {
    let y = q.endY;
    let m = q.endM + offset;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    return {
      runId: `${code}::${q.key}`,
      defCode: code,
      periodKey: q.key,
      periodLabel: q.label,
      dueDate: iso(y, m, day),
      fy: fyStart,
    };
  });
}

/** Quarterly with explicitly notified dates (TDS/TCS returns). */
function quarterlyFixed(fyStart: number, code: string, dates: [number, number, number][]): Occurrence[] {
  return fyQuarters(fyStart).map((q, i) => {
    const [y, m, d] = dates[i];
    return {
      runId: `${code}::${q.key}`,
      defCode: code,
      periodKey: q.key,
      periodLabel: q.label,
      dueDate: iso(y, m, d),
      fy: fyStart,
    };
  });
}

function once(
  code: string,
  y: number,
  m: number,
  d: number,
  periodKey: string,
  periodLabel: string,
  fy: number,
): Occurrence {
  return {
    runId: `${code}::${periodKey}`,
    defCode: code,
    periodKey,
    periodLabel,
    dueDate: iso(y, m, d),
    fy,
  };
}

/* ==========================================================================
   DEFINITIONS
   ========================================================================== */

export const DEFS: ComplianceDef[] = [
  /* ---- GST ------------------------------------------------------------- */
  {
    code: "GSTR-1",
    head: "GST",
    form: "GSTR-1",
    description: "Outward supplies return",
    frequency: "Monthly",
    dueRule: "11th of the following month",
    applicability: "Regular taxpayers filing monthly",
    lateFee: {
      kind: "perDay",
      amount: 50,
      nilAmount: 20,
      cap: "turnoverPct",
      capPct: 0.0,
      note: "₹50/day (₹20/day if nil). Cap by turnover slab: ₹2,000 up to ₹1.5cr, ₹5,000 up to ₹5cr, ₹10,000 above.",
    },
    clientFacing: true,
  },
  {
    code: "GSTR-3B",
    head: "GST",
    form: "GSTR-3B",
    description: "Summary return and tax payment",
    frequency: "Monthly",
    dueRule: "20th of the following month",
    applicability: "Regular taxpayers filing monthly",
    lateFee: {
      kind: "perDay",
      amount: 50,
      nilAmount: 20,
      cap: "turnoverPct",
      note: "₹50/day (₹20/day if nil) plus interest at 18% p.a. on tax payable.",
    },
    clientFacing: true,
  },
  {
    code: "GSTR-1-QRMP",
    head: "GST",
    form: "GSTR-1 (QRMP)",
    description: "Quarterly outward supplies return",
    frequency: "Quarterly",
    dueRule: "13th of the month following the quarter",
    applicability: "QRMP scheme taxpayers",
    lateFee: { kind: "perDay", amount: 50, nilAmount: 20, cap: 5000, note: "Late fee per the standard GSTR-1 slab." },
    clientFacing: true,
  },
  {
    code: "IFF",
    head: "GST",
    form: "IFF",
    description: "Invoice Furnishing Facility — optional early upload of B2B invoices",
    frequency: "Monthly",
    dueRule: "13th of the following month, for month 1 and month 2 of each quarter only",
    applicability: "QRMP scheme taxpayers, optional in place of waiting for the quarterly GSTR-1",
    lateFee: { kind: "flat", amount: 0, note: "No late fee under GST law — IFF is a facility, not a statutory return. Skipping it only delays those invoices reaching the recipient's books until the quarterly GSTR-1." },
    clientFacing: true,
  },
  {
    code: "GSTR-3B-QRMP-A",
    head: "GST",
    form: "GSTR-3B (QRMP · Cat A)",
    description: "Quarterly summary return and tax payment",
    frequency: "Quarterly",
    dueRule: "22nd of the month following the quarter",
    applicability: "QRMP taxpayers in Category A states/UTs",
    lateFee: { kind: "perDay", amount: 50, nilAmount: 20, cap: 5000, note: "Late fee plus interest as applicable." },
    clientFacing: true,
  },
  {
    code: "GSTR-3B-QRMP-B",
    head: "GST",
    form: "GSTR-3B (QRMP · Cat B)",
    description: "Quarterly summary return and tax payment",
    frequency: "Quarterly",
    dueRule: "24th of the month following the quarter",
    applicability: "QRMP taxpayers in Category B states/UTs",
    lateFee: { kind: "perDay", amount: 50, nilAmount: 20, cap: 5000, note: "Late fee plus interest as applicable." },
    clientFacing: true,
  },
  {
    code: "CMP-08",
    head: "GST",
    form: "CMP-08",
    description: "Statement-cum-challan of tax payable",
    frequency: "Quarterly",
    dueRule: "18th of the month following the quarter",
    applicability: "Composition scheme taxpayers",
    lateFee: { kind: "perDay", amount: 50, nilAmount: 20, cap: 5000, note: "₹50/day (₹20/day if nil)." },
    clientFacing: true,
  },
  {
    code: "GSTR-7",
    head: "GST",
    form: "GSTR-7",
    description: "TDS return under GST",
    frequency: "Monthly",
    dueRule: "10th of the following month",
    applicability: "TDS deductors registered under GST (s.51)",
    lateFee: { kind: "perDay", amount: 100, cap: 5000, note: "₹100/day (CGST+SGST combined), capped at ₹5,000." },
    clientFacing: true,
  },
  {
    code: "GSTR-8",
    head: "GST",
    form: "GSTR-8",
    description: "TCS return under GST",
    frequency: "Monthly",
    dueRule: "10th of the following month",
    applicability: "E-commerce operators (s.52)",
    lateFee: { kind: "perDay", amount: 100, cap: 5000, note: "₹100/day (CGST+SGST combined), capped at ₹5,000." },
    clientFacing: true,
  },
  {
    code: "GSTR-4",
    head: "GST",
    form: "GSTR-4",
    description: "Annual return (composition)",
    frequency: "Annual",
    dueRule: "30 April following the financial year",
    applicability: "Composition scheme taxpayers",
    lateFee: { kind: "perDay", amount: 50, nilAmount: 20, cap: "turnoverPct", capPct: 0.0025, note: "₹50/day, capped at 0.25% of turnover." },
    clientFacing: true,
  },
  {
    code: "GSTR-9",
    head: "GST",
    form: "GSTR-9",
    description: "Annual return",
    frequency: "Annual",
    dueRule: "31 December following the financial year",
    applicability: "Regular taxpayers above the notified turnover threshold",
    lateFee: { kind: "perDay", amount: 200, cap: "turnoverPct", capPct: 0.005, note: "₹200/day (CGST+SGST), capped at 0.5% of turnover." },
    clientFacing: true,
  },
  {
    code: "GSTR-9C",
    head: "GST",
    form: "GSTR-9C",
    description: "Self-certified reconciliation statement",
    frequency: "Annual",
    dueRule: "31 December following the financial year",
    applicability: "Turnover above ₹5 crore",
    lateFee: { kind: "flat", amount: 25000, note: "General penalty provisions under the Act." },
    clientFacing: true,
  },

  /* ---- Income Tax ------------------------------------------------------- */
  {
    /* Filed and owned by the deductor, not the ITR client — this is the
       deposit for the 24Q/26Q/27Q/27EQ returns below, so it belongs with
       them under head "TDS", not "Income Tax". (It's still an Income Tax
       Act provision, s.200(1) — that's a legal fact, not a grouping.) */
    code: "TDS-CHALLAN",
    head: "TDS",
    form: "TDS/TCS Payment (Challan)",
    description: "Deposit of tax deducted/collected at source",
    frequency: "Monthly",
    dueRule: "7th of the following month (30 April for March)",
    applicability: "All deductors / collectors of tax at source",
    lateFee: { kind: "interest", monthlyPct: 1.5, basis: "tdsPerQuarter", note: "Interest 1%–1.5% per month of delay, plus penalty exposure u/s 271C." },
    clientFacing: false,
  },
  {
    code: "ADV-TAX",
    head: "Income Tax",
    form: "Advance Tax Instalment",
    description: "Payment of estimated tax liability in instalments",
    frequency: "Quarterly",
    dueRule: "15 Jun (15%), 15 Sep (45%), 15 Dec (75%), 15 Mar (100%)",
    applicability: "Taxpayers with estimated tax liability above ₹10,000",
    lateFee: { kind: "interest", monthlyPct: 1, basis: "taxDue", note: "Interest u/s 234C on the shortfall." },
    clientFacing: true,
  },
  {
    /* Finance Act, 2026 split what used to be one 31 July non-audit bucket
       in two: ITR-1/ITR-2 filers (no business or professional income) keep
       31 July, while ITR-3/ITR-4 filers move to 31 August — see
       ITR-NONAUDIT-BIZ below. */
    code: "ITR-NONAUDIT",
    head: "Income Tax",
    form: "ITR (non-audit)",
    description: "Income tax return filing — no business or professional income",
    frequency: "Annual",
    dueRule: "31 July following the financial year",
    applicability: "Individual / HUF not requiring audit, with no business or professional income (ITR-1 / ITR-2)",
    lateFee: { kind: "s234f", note: "Late fee ₹1,000–₹5,000 u/s 234F plus interest u/s 234A." },
    clientFacing: true,
  },
  {
    code: "ITR-NONAUDIT-BIZ",
    head: "Income Tax",
    form: "ITR (non-audit, business)",
    description: "Income tax return filing — business or professional income",
    frequency: "Annual",
    dueRule: "31 August following the financial year",
    applicability: "Individual / HUF not requiring audit, with business or professional income (ITR-3 / ITR-4)",
    lateFee: { kind: "s234f", note: "Late fee ₹1,000–₹5,000 u/s 234F plus interest u/s 234A." },
    clientFacing: true,
  },
  {
    code: "TAX-AUDIT",
    head: "Income Tax",
    form: "Tax Audit Report (3CA/3CB-3CD)",
    description: "Tax audit report filing",
    frequency: "Annual",
    dueRule: "30 September following the financial year",
    applicability: "Assessees liable to tax audit u/s 44AB",
    lateFee: { kind: "turnoverPct", pct: 0.005, cap: 150000, note: "Penalty u/s 271B: 0.5% of turnover, capped at ₹1,50,000." },
    clientFacing: true,
  },
  {
    code: "ITR-AUDIT",
    head: "Income Tax",
    form: "ITR (audit cases)",
    description: "Income tax return filing",
    frequency: "Annual",
    dueRule: "31 October following the financial year",
    applicability: "Companies and assessees requiring audit",
    lateFee: { kind: "s234f", note: "Late fee u/s 234F plus interest u/s 234A." },
    clientFacing: true,
  },
  {
    code: "ITR-TP",
    head: "Income Tax",
    form: "ITR + Form 3CEB",
    description: "Transfer pricing report and return",
    frequency: "Annual",
    dueRule: "30 November following the financial year",
    applicability: "Assessees with international / specified domestic transactions",
    lateFee: { kind: "flat", amount: 100000, note: "Penalty u/s 271BA ₹1,00,000 for failure to furnish Form 3CEB." },
    clientFacing: true,
  },
  {
    /* Applicability isn't decided from the profile like everything else here
       — it depends on what happened to the client's own original ITR
       obligation for the same year. See `buildDerivedItr()` in engine.ts and
       the `revisedReturnApplicability` / `itrUApplicability` functions in
       rules.ts. Never gets a per-day late fee: missing the window doesn't
       accrue a penalty, it just closes the door. */
    code: "ITR-REVISED",
    head: "Income Tax",
    form: "Revised Return (ITR)",
    description: "Revision of an already-filed return",
    frequency: "Annual",
    dueRule: "31 December following the financial year, or before assessment is completed, if earlier",
    applicability: "Clients whose original return was filed, while the s.139(5) revision window remains open",
    lateFee: { kind: "flat", amount: 0, note: "No independent penalty for revising — interest under sections 234A/234B/234C can still apply on any additional tax admitted." },
    clientFacing: true,
  },
  {
    code: "ITR-U",
    head: "Income Tax",
    form: "Updated Return (ITR-U)",
    description: "Filing or correcting a return after the normal, belated and revised windows have closed",
    frequency: "Annual",
    dueRule: "Within 48 months from the end of the relevant assessment year",
    applicability: "Any client within the 48-month s.139(8A) window, whether or not the original return was filed",
    lateFee: { kind: "flat", amount: 0, note: "No late fee as such — filing carries additional tax under section 140B (25%/50%/60%/70% of tax plus interest, depending on when within the 48 months it's filed) and is blocked in some cases (loss return, refund increase, search/survey, prosecution, ITR-U already filed). Verify eligibility on the portal before filing." },
    clientFacing: true,
  },

  /* ---- TDS returns ------------------------------------------------------ */
  {
    code: "24Q",
    head: "TDS",
    form: "Form 24Q",
    description: "TDS return (salaries)",
    frequency: "Quarterly",
    dueRule: "31 Jul / 31 Oct / 31 Jan / 31 May",
    applicability: "Employers deducting TDS on salary (s.192)",
    lateFee: { kind: "perDay", amount: 200, cap: "tdsAmount", note: "₹200/day u/s 234E, capped at the TDS amount; penalty u/s 271H may also apply." },
    clientFacing: false,
  },
  {
    code: "26Q",
    head: "TDS",
    form: "Form 26Q",
    description: "TDS return (non-salary payments)",
    frequency: "Quarterly",
    dueRule: "31 Jul / 31 Oct / 31 Jan / 31 May",
    applicability: "Deductors making non-salary payments to residents",
    lateFee: { kind: "perDay", amount: 200, cap: "tdsAmount", note: "₹200/day u/s 234E, capped at the TDS amount; penalty u/s 271H may also apply." },
    clientFacing: false,
  },
  {
    code: "27Q",
    head: "TDS",
    form: "Form 27Q",
    description: "TDS return (payments to non-residents)",
    frequency: "Quarterly",
    dueRule: "31 Jul / 31 Oct / 31 Jan / 31 May",
    applicability: "Deductors making payments to non-residents",
    lateFee: { kind: "perDay", amount: 200, cap: "tdsAmount", note: "₹200/day u/s 234E, capped at the TDS amount." },
    clientFacing: false,
  },
  {
    code: "27EQ",
    head: "TDS",
    form: "Form 27EQ",
    description: "TCS return",
    frequency: "Quarterly",
    dueRule: "31 Jul / 31 Oct / 31 Jan / 31 May",
    applicability: "Collectors of tax at source",
    lateFee: { kind: "perDay", amount: 200, cap: "tdsAmount", note: "₹200/day u/s 234E, capped at the TCS amount." },
    clientFacing: false,
  },

  /* ---- ROC / MCA -------------------------------------------------------- */
  {
    code: "AOC-4",
    head: "ROC/MCA",
    form: "AOC-4",
    description: "Filing of financial statements (~30 days from AGM)",
    frequency: "Annual",
    dueRule: "30 days from the AGM",
    applicability: "All companies",
    lateFee: { kind: "perDay", amount: 100, note: "Additional fee ₹100/day of delay, uncapped." },
    clientFacing: true,
  },
  {
    code: "MGT-7",
    head: "ROC/MCA",
    form: "MGT-7 / MGT-7A",
    description: "Annual return filing (~60 days from AGM)",
    frequency: "Annual",
    dueRule: "60 days from the AGM",
    applicability: "All companies (MGT-7A for OPC / small companies)",
    lateFee: { kind: "perDay", amount: 100, note: "Additional fee ₹100/day of delay, uncapped." },
    clientFacing: true,
  },
  {
    code: "DPT-3",
    head: "ROC/MCA",
    form: "DPT-3",
    description: "Return of deposits / transactions not treated as deposits",
    frequency: "Annual",
    dueRule: "30 June every year",
    applicability: "Companies other than government companies",
    lateFee: { kind: "flat", amount: 20000, note: "Penalty on the company and officers under the Companies Act." },
    clientFacing: true,
  },
  {
    code: "MSME-1",
    head: "ROC/MCA",
    form: "MSME-1",
    description: "Half-yearly return of outstanding payments to MSMEs",
    frequency: "Half-yearly",
    dueRule: "30 April and 31 October",
    applicability: "Companies with MSME dues outstanding beyond 45 days",
    lateFee: { kind: "flat", amount: 20000, note: "Penalty under the Companies Act for non-filing." },
    clientFacing: true,
  },
  {
    code: "DIR-3-KYC",
    head: "ROC/MCA",
    form: "DIR-3 KYC",
    description: "Director KYC filing",
    frequency: "Annual",
    dueRule: "30 September every year",
    applicability: "All DIN holders",
    lateFee: { kind: "flat", amount: 5000, note: "Flat penalty ₹5,000 if filed late." },
    clientFacing: true,
  },
  {
    code: "LLP-11",
    head: "ROC/MCA (LLP)",
    form: "Form 11",
    description: "Annual return of LLP",
    frequency: "Annual",
    dueRule: "30 May following the financial year",
    applicability: "All LLPs",
    lateFee: { kind: "perDay", amount: 100, note: "Additional fee ₹100/day, uncapped." },
    clientFacing: true,
  },
  {
    code: "LLP-8",
    head: "ROC/MCA (LLP)",
    form: "Form 8",
    description: "Statement of Account and Solvency",
    frequency: "Annual",
    dueRule: "30 October following the financial year",
    applicability: "All LLPs",
    lateFee: { kind: "perDay", amount: 100, note: "Additional fee ₹100/day, uncapped." },
    clientFacing: true,
  },

  /* ---- Other statutory -------------------------------------------------- */
  {
    code: "PF-ECR",
    head: "Other Statutory",
    form: "PF (EPF) Payment & ECR",
    description: "Provident fund contribution deposit and ECR upload",
    frequency: "Monthly",
    dueRule: "15th of the following month",
    applicability: "Establishments covered under the EPF Act",
    lateFee: { kind: "interest", monthlyPct: 1, basis: "contribution", basisPct: 0.24, note: "Interest 12% p.a. plus damages under the EPF Act. Contribution taken at 24% of payroll (12% employee + 12% employer)." },
    clientFacing: false,
  },
  {
    code: "ESI",
    head: "Other Statutory",
    form: "ESI Payment & Return",
    description: "ESI contribution deposit",
    frequency: "Monthly",
    dueRule: "15th of the following month",
    applicability: "Establishments covered under the ESI Act",
    lateFee: { kind: "interest", monthlyPct: 1, basis: "contribution", basisPct: 0.0325, note: "Interest 12% p.a. plus damages under the ESI Act. Contribution taken at 3.25% of wages (0.75% employee + 3.25% employer applies to covered wages)." },
    clientFacing: false,
  },
  {
    code: "PTAX",
    head: "Other Statutory",
    form: "Professional Tax",
    description: "Enrolment / periodic return per state law",
    frequency: "Annual",
    dueRule: "Varies by state, commonly 30 June",
    applicability: "Employers / self-employed persons in PT states",
    lateFee: { kind: "flat", amount: 2500, note: "Varies significantly by state; verify locally." },
    clientFacing: true,
  },
];

export const DEF_BY_CODE: Record<string, ComplianceDef> = Object.fromEntries(
  DEFS.map((d) => [d.code, d]),
);

/** Which of the three unlinked records (`Client`/`GstEntity`/`TdsDeductor`)
 *  owns a compliance's obligations. Mostly `def.head` — "GST" is always a
 *  GstEntity, "TDS" is always a TdsDeductor (this now includes `TDS-CHALLAN`,
 *  the deposit for the 24Q/26Q/27Q/27EQ returns, moved out of head "Income
 *  Tax" for exactly this reason) — with one remaining deliberate override:
 *  `PF-ECR`/`ESI`/`PTAX` sit under "Other Statutory" but are payroll/employer
 *  obligations that exist for the same reason 24Q does — the entity runs
 *  payroll — so they belong to the deductor too, not the ITR/ROC client. */
const DEDUCTOR_OVERRIDE = new Set(["PF-ECR", "ESI", "PTAX"]);

export function recordTypeForDef(code: string): "Client" | "GstEntity" | "TdsDeductor" {
  if (DEDUCTOR_OVERRIDE.has(code)) return "TdsDeductor";
  const def = DEF_BY_CODE[code];
  if (def?.head === "GST") return "GstEntity";
  if (def?.head === "TDS") return "TdsDeductor";
  return "Client";
}

/* ==========================================================================
   OCCURRENCES — the statutory calendar, generated from the rules above
   ========================================================================== */

/** March TDS challan is due 30 April, not 7 April. */
const marchChallanOverride = (y: number, m: number) => (m === 3 ? iso(y, 4, 30) : null);

/**
 * The full statutory calendar for one financial year, generated from the
 * recurring rules above. Every year here is expressed as an offset from
 * `fyStart`, never a literal — so the calendar rolls forward by changing one
 * argument, which is what the "Recurring Pattern (Generic)" sheet is for.
 *
 * Annual filings that fall *due* inside this FY but report on the *previous*
 * one (GSTR-4, GSTR-9/9C, AOC-4, MGT-7, DPT-3, LLP-11/8) keep the earlier
 * period in their label — that mismatch is real, not a bug.
 */
export function occurrencesForFY(fyStart: number): Occurrence[] {
  const prevFY = fyLabel(fyStart - 1);
  const prevKey = `FY${fyStart - 1}-${String(fyStart % 100).padStart(2, "0")}`;
  const thisKey = `FY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;

  return [
    ...monthlyFollowing(fyStart, "GSTR-1", 11),
    ...monthlyFollowing(fyStart, "GSTR-3B", 20),
    ...monthlyFollowing(fyStart, "GSTR-7", 10),
    ...monthlyFollowing(fyStart, "GSTR-8", 10),
    ...quarterlyFollowing(fyStart, "GSTR-1-QRMP", 13),
    ...iffMonths(fyStart, "IFF", 13),
    ...quarterlyFollowing(fyStart, "GSTR-3B-QRMP-A", 22),
    ...quarterlyFollowing(fyStart, "GSTR-3B-QRMP-B", 24),
    ...quarterlyFollowing(fyStart, "CMP-08", 18),
    once("GSTR-4", fyStart, 4, 30, prevKey, prevFY, fyStart),
    once("GSTR-4", fyStart + 1, 4, 30, thisKey, fyLabel(fyStart), fyStart),
    once("GSTR-9", fyStart, 12, 31, prevKey, prevFY, fyStart),
    once("GSTR-9C", fyStart, 12, 31, prevKey, prevFY, fyStart),

    ...monthlyFollowing(fyStart, "TDS-CHALLAN", 7, marchChallanOverride),
    ...monthlyFollowing(fyStart, "PF-ECR", 15),
    ...monthlyFollowing(fyStart, "ESI", 15),

    {
      runId: "ADV-TAX::I1", defCode: "ADV-TAX", periodKey: "I1",
      periodLabel: "1st instalment · 15%", dueDate: iso(fyStart, 6, 15), fy: fyStart,
    },
    {
      runId: "ADV-TAX::I2", defCode: "ADV-TAX", periodKey: "I2",
      periodLabel: "2nd instalment · 45%", dueDate: iso(fyStart, 9, 15), fy: fyStart,
    },
    {
      runId: "ADV-TAX::I3", defCode: "ADV-TAX", periodKey: "I3",
      periodLabel: "3rd instalment · 75%", dueDate: iso(fyStart, 12, 15), fy: fyStart,
    },
    {
      runId: "ADV-TAX::I4", defCode: "ADV-TAX", periodKey: "I4",
      periodLabel: "4th instalment · 100%", dueDate: iso(fyStart + 1, 3, 15), fy: fyStart,
    },

    once("ITR-NONAUDIT", fyStart, 7, 31, `AY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`, ayLabel(fyStart), fyStart),
    once("ITR-NONAUDIT-BIZ", fyStart, 8, 31, `AY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`, ayLabel(fyStart), fyStart),
    once("TAX-AUDIT", fyStart, 9, 30, `AY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`, ayLabel(fyStart), fyStart),
    once("ITR-AUDIT", fyStart, 10, 31, `AY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`, ayLabel(fyStart), fyStart),
    once("ITR-TP", fyStart, 11, 30, `AY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`, ayLabel(fyStart), fyStart),
    /* Tagged `fy: fyStart` — same FY-selector bucket as the original ITR it
       derives from — even though the actual due date (window close) falls
       years later. */
    once("ITR-REVISED", fyStart, 12, 31, `AY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`, ayLabel(fyStart), fyStart),
    once("ITR-U", fyStart + 5, 3, 31, `AY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`, ayLabel(fyStart), fyStart),

    ...(["24Q", "26Q", "27Q", "27EQ"] as const).flatMap((code) =>
      quarterlyFixed(fyStart, code, [
        [fyStart, 7, 31], [fyStart, 10, 31], [fyStart + 1, 1, 31], [fyStart + 1, 5, 31],
      ]),
    ),

    once("AOC-4", fyStart, 10, 29, prevKey, prevFY, fyStart),
    once("MGT-7", fyStart, 11, 29, prevKey, prevFY, fyStart),
    once("DPT-3", fyStart, 6, 30, prevKey, prevFY, fyStart),
    once("MSME-1", fyStart, 4, 30, `H2${prevKey}`, `Oct ${fyStart - 1} – Mar ${fyStart}`, fyStart),
    once("MSME-1", fyStart, 10, 31, `H1${thisKey}`, `Apr – Sep ${fyStart}`, fyStart),
    once("DIR-3-KYC", fyStart, 9, 30, thisKey, fyLabel(fyStart), fyStart),
    once("LLP-11", fyStart, 5, 30, prevKey, prevFY, fyStart),
    once("LLP-8", fyStart, 10, 30, prevKey, prevFY, fyStart),
    once("PTAX", fyStart, 6, 30, thisKey, fyLabel(fyStart), fyStart),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** How many financial years before FY_START carry a seeded client book, so
 *  the year picker (Calendar, Compliance Detail, Client Detail, Tracker) can
 *  offer real history rather than only the current year. Grows every year:
 *  bump this, not the years themselves, once another year has passed. */
export const HISTORY_YEARS = 2;

/** Every financial year with a real client book behind it, oldest first. */
export const SEEDED_FYS: number[] = Array.from(
  { length: HISTORY_YEARS + 1 },
  (_, i) => FY_START - HISTORY_YEARS + i,
);

/** The year immediately ahead — seeded with a statutory calendar so its due
 *  dates are visible early, but never with client data, since it hasn't
 *  started. */
export const YEAR_AHEAD = FY_START + 1;

/** The full year-picker list offered throughout the product, oldest first. */
export const FY_OPTIONS: number[] = [...SEEDED_FYS, YEAR_AHEAD];

/** Every offered year's statutory calendar, precomputed once. */
export const OCCURRENCES_BY_FY: Record<number, Occurrence[]> = Object.fromEntries(
  FY_OPTIONS.map((fy) => [fy, occurrencesForFY(fy)]),
);

/** The current year's calendar — what most of the seeded client book reads
 *  by default. Kept for call sites that only ever care about "now". */
export const OCCURRENCES: Occurrence[] = OCCURRENCES_BY_FY[FY_START];

export const OCC_BY_RUN: Record<string, Occurrence> = Object.fromEntries(
  Object.values(OCCURRENCES_BY_FY).flat().map((o) => [o.runId, o]),
);

/** CSS class for a head's identity spine. */
export function headClass(head: string): string {
  switch (head) {
    case "GST": return "head-gst";
    case "Income Tax": return "head-it";
    case "TDS": return "head-tds";
    case "ROC/MCA": return "head-roc";
    case "ROC/MCA (LLP)": return "head-llp";
    default: return "head-other";
  }
}

export const HEADS: string[] = [
  "GST", "Income Tax", "TDS", "ROC/MCA", "ROC/MCA (LLP)", "Other Statutory",
];
