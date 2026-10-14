/* ============================================================================
   NOTICES — what a tax department has sent a client
   ----------------------------------------------------------------------------
   A notice is not a filing. It arrives unasked, from the Income Tax, GST or
   TDS department, and carries its own reply deadline; missing that deadline can
   cost the client far more than missing a normal due date. So notices are a
   separate record with their own life cycle, rather than one more kind of
   obligation.

   In production the KDK ITR, GST and TDS modules send these in. Here they are
   seeded, deterministically, so the screens have something real to show. Staff
   only: nothing here is sent to a client.

   Each notice belongs to a PAN client and names the registration it was issued
   against (the PAN itself, a GSTIN or a TAN), the same split the rest of the
   app uses.
   ========================================================================== */

import type { RecordType } from "./types.ts";
import { CLIENTS, GSTINS_BY_CLIENT, STAFF, TANS_BY_CLIENT, h } from "./book.ts";
import { TODAY, addDays } from "./dates.ts";

export type NoticeDept = "Income Tax" | "GST" | "TDS";

/** Received → Under review → Reply drafted → Replied → Closed. */
export const NOTICE_STAGES = ["Received", "Under review", "Reply drafted", "Replied", "Closed"] as const;
export type NoticeStatus = (typeof NOTICE_STAGES)[number];

/** How a closed notice ended. */
export const NOTICE_OUTCOMES = [
  "Dropped by department",
  "Rectified and accepted",
  "Demand paid",
  "Demand reduced",
  "Appeal filed",
] as const;
export type NoticeOutcome = (typeof NOTICE_OUTCOMES)[number];

export interface NoticeEvent {
  on: string;
  by: string;
  text: string;
}

export interface Notice {
  id: string;
  /** The PAN client. */
  clientId: string;
  /** Which kind of registration it was issued against, and its record id. */
  regType: RecordType;
  regId: string;
  dept: NoticeDept;
  /** "Intimation u/s 143(1)", "Show cause notice (DRC-01)" and so on. */
  type: string;
  section: string;
  /** The department's own reference number. */
  refNo: string;
  /** Assessment year or tax period the notice is about. */
  period: string;
  receivedOn: string;
  replyDue: string;
  /** Amount the department says is owed, ₹. 0 when none is demanded. */
  demand: number;
  status: NoticeStatus;
  /** When the reply went out. Set once the notice reaches Replied. */
  repliedOn?: string;
  /** The acknowledgement the portal gave for that reply. */
  replyRef?: string;
  /** When it was closed, and how it ended. Set once it reaches Closed. */
  closedOn?: string;
  outcome?: NoticeOutcome;
  assigneeId: string;
  /** Which KDK module sent it in. */
  source: string;
  history: NoticeEvent[];
}

interface Kind {
  dept: NoticeDept;
  type: string;
  section: string;
  /** Days the client has to reply. */
  days: number;
  demand: boolean;
}

const KINDS: Kind[] = [
  { dept: "Income Tax", type: "Intimation", section: "u/s 143(1)", days: 30, demand: true },
  { dept: "Income Tax", type: "Defective return", section: "u/s 139(9)", days: 15, demand: false },
  { dept: "Income Tax", type: "Scrutiny", section: "u/s 143(2)", days: 15, demand: false },
  { dept: "Income Tax", type: "Reassessment", section: "u/s 148", days: 30, demand: false },
  { dept: "Income Tax", type: "Demand", section: "u/s 156", days: 30, demand: true },
  { dept: "GST", type: "Scrutiny of return (ASMT-10)", section: "Sec 61", days: 30, demand: false },
  { dept: "GST", type: "Show cause notice (DRC-01)", section: "Sec 73", days: 30, demand: true },
  { dept: "GST", type: "Return not filed (GSTR-3A)", section: "Sec 46", days: 15, demand: false },
  { dept: "GST", type: "Cancellation show cause (REG-17)", section: "Rule 22", days: 7, demand: false },
  { dept: "TDS", type: "Default notice", section: "u/s 201", days: 30, demand: true },
  { dept: "TDS", type: "Late filing fee", section: "u/s 234E", days: 30, demand: true },
  { dept: "TDS", type: "Intimation", section: "u/s 200A", days: 30, demand: true },
];

const SOURCE: Record<NoticeDept, string> = {
  "Income Tax": "KDK ITR module",
  GST: "KDK GST module",
  TDS: "KDK TDS module",
};

function periodFor(dept: NoticeDept, key: string): string {
  const r = h(key + "|p");
  if (dept === "Income Tax") return r < 0.5 ? "AY 2025-26" : "AY 2024-25";
  const months = ["Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026"];
  if (dept === "GST") return months[Math.floor(r * months.length)];
  return r < 0.5 ? "Q1 FY 2026-27" : "Q4 FY 2025-26";
}

const STATUS_AT = [0.22, 0.52, 0.72, 0.88, 1] as const;

export function buildNotices(): Notice[] {
  const out: Notice[] = [];
  const staff = STAFF.filter((s) => s.id !== "none");
  const make = (clientId: string, regType: RecordType, regId: string, dept: NoticeDept, i: number, assignee: string) => {
    const key = `${regId}|notice|${i}`;
    const kinds = KINDS.filter((k) => k.dept === dept);
    const k = kinds[Math.floor(h(key + "|k") * kinds.length)];
    const receivedOn = addDays(TODAY, -Math.floor(h(key + "|d") * 48));
    const replyDue = addDays(receivedOn, k.days);
    /* The longer a notice has been open, the likelier it has been answered. */
    const age = Math.round((Date.parse(TODAY) - Date.parse(receivedOn)) / 864e5);
    const r = Math.min(1, h(key + "|s") + (age / k.days) * 0.22);
    const status = NOTICE_STAGES[STATUS_AT.findIndex((t) => r < t)];
    const ref = `${dept === "Income Tax" ? "ITBA" : dept === "GST" ? "ZD" : "TRACES"}${String(Math.floor(h(key + "|r") * 9e9) + 1e9)}`;
    /* When each stage was reached, spread across the notice's age so the
       dates rise in order and never run past today. */
    const at = [0, 0.2, 0.45, 0.7, 0.9].map((f) => addDays(receivedOn, Math.round(age * f)));
    const history: NoticeEvent[] = [{ on: receivedOn, by: SOURCE[dept], text: "Notice received" }];
    const step = NOTICE_STAGES.indexOf(status);
    for (let s = 1; s <= step; s++) {
      history.push({
        on: at[s],
        by: staff[Math.floor(h(key + "|by" + s) * staff.length)].name,
        text: `Moved to ${NOTICE_STAGES[s]}`,
      });
    }
    const outcomes = k.demand
      ? (["Demand paid", "Demand reduced", "Appeal filed"] as const)
      : (["Dropped by department", "Rectified and accepted", "Appeal filed"] as const);
    out.push({
      id: `N${String(out.length + 1).padStart(3, "0")}`,
      clientId, regType, regId, dept, type: k.type, section: k.section, refNo: ref,
      period: periodFor(dept, key), receivedOn, replyDue,
      demand: k.demand ? Math.round((h(key + "|a") * 480000 + 8000) / 100) * 100 : 0,
      status, assigneeId: assignee, source: SOURCE[dept], history,
      repliedOn: step >= 3 ? at[3] : undefined,
      replyRef: step >= 3 ? `${dept === "Income Tax" ? "IT" : dept === "GST" ? "GST" : "TDS"}-RPL-${String(Math.floor(h(key + "|ack") * 9e7) + 1e7)}` : undefined,
      closedOn: step >= 4 ? at[4] : undefined,
      outcome: step >= 4 ? outcomes[Math.floor(h(key + "|o") * outcomes.length)] : undefined,
    });
  };

  for (const c of CLIENTS) {
    if (h(`${c.id}|n-it`) < 0.07) make(c.id, "Client", c.id, "Income Tax", 0, c.assigneeId);
    for (const g of GSTINS_BY_CLIENT[c.id] ?? []) {
      if (h(`${g.id}|n-gst`) < 0.06) make(c.id, "GstEntity", g.id, "GST", 0, g.assigneeId);
    }
    for (const d of TANS_BY_CLIENT[c.id] ?? []) {
      if (h(`${d.id}|n-tds`) < 0.05) make(c.id, "TdsDeductor", d.id, "TDS", 0, d.assigneeId);
    }
  }
  return out;
}

/* ---- Reading a notice ---------------------------------------------------- */

/** Still waiting on us: no reply has gone out yet. */
export function needsReply(n: Notice): boolean {
  return n.status === "Received" || n.status === "Under review" || n.status === "Reply drafted";
}

export function isOpen(n: Notice): boolean {
  return n.status !== "Closed";
}

/** Days until the reply is due. Negative once it has passed. */
export function daysToReply(n: Notice): number {
  return Math.round((Date.parse(n.replyDue) - Date.parse(TODAY)) / 864e5);
}

export type Urgency = "overdue" | "soon" | "later" | "done";

export function urgencyOf(n: Notice): Urgency {
  if (!needsReply(n)) return "done";
  const d = daysToReply(n);
  return d < 0 ? "overdue" : d <= 7 ? "soon" : "later";
}
