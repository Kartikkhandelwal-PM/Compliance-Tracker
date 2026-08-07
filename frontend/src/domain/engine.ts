/* ============================================================================
   ENGINE — applies the rules to the book and holds mutable state
   ----------------------------------------------------------------------------
   Obligation = one client × one statutory occurrence. The filing history is
   simulated from a per-client discipline score and a stable hash, so the same
   book is produced on every load and nothing jumps around between renders.
   In production, status comes from the three real sources in the spec: portal
   verification, KDK's own filing modules, and manual marking.
   ========================================================================== */

import type {
  Client, FilingRun, FilingStatus, Obligation, OutboxEntry,
  ReminderStage, StatusBasis,
} from "./types.ts";
import { CLIENTS, CLIENT_BY_ID, staffOf } from "./book.ts";
import { DEF_BY_CODE, OCCURRENCES } from "./catalog.ts";
import { applicableCompliances, estimateExposure } from "./rules.ts";
import { TODAY, addDays, diffDays } from "./dates.ts";
import { compose } from "./messages.ts";

/* Stable 0–1 hash so simulated history never shifts between renders. */
function h(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return (x >>> 0) / 4294967296;
}

const OCC_BY_DEF = new Map<string, typeof OCCURRENCES>();
for (const o of OCCURRENCES) {
  const list = OCC_BY_DEF.get(o.defCode);
  if (list) list.push(o);
  else OCC_BY_DEF.set(o.defCode, [o]);
}

const WINDOW_START = "2026-04-01";
const WINDOW_END = "2027-03-31";

function reminderStageFor(status: FilingStatus, dueDate: string, clientFacing: boolean): ReminderStage {
  if (status === "Not Applicable") return "N/A";
  if (status === "Filed") return "Cancelled: resolved";
  if (!clientFacing) return status === "Overdue" ? "Overdue escalation" : "Not scheduled";
  const n = diffDays(TODAY, dueDate);
  if (n < 0) return "Overdue escalation";
  if (n === 0) return "Due-date sent";
  if (n <= 3) return "T-3 sent";
  if (n <= 7) return "T-7 sent";
  return "T-7 scheduled";
}

function build(): Obligation[] {
  const out: Obligation[] = [];

  for (const client of CLIENTS) {
    const applicable = applicableCompliances(client);

    for (const app of applicable) {
      const def = DEF_BY_CODE[app.defCode];
      const occs = OCC_BY_DEF.get(app.defCode);
      if (!def || !occs) continue;

      for (const occ of occs) {
        if (occ.dueDate < WINDOW_START || occ.dueDate > WINDOW_END) continue;

        const id = `${client.id}::${occ.runId}`;
        const seed = h(id);
        const daysOverdue = Math.max(0, diffDays(occ.dueDate, TODAY));
        const notYetDue = diffDays(TODAY, occ.dueDate) > 0;

        let status: FilingStatus;
        let basis: StatusBasis;
        let filedOn: string | undefined;
        let override: Obligation["override"];

        /* ~1.5% of the book carries a human override — the spec requires
           rule-driven and manual decisions to be told apart, so some must
           exist to look at. */
        if (h(id + "|ovr") < 0.015) {
          status = "Not Applicable";
          /* A person made this call, not the engine. Labelling it
             "Rule-excluded" contradicted the override recorded alongside it. */
          basis = "Manually excluded";
          override = {
            by: staffOf(client.assigneeId).name,
            on: addDays(TODAY, -Math.floor(h(id + "|d") * 90) - 5),
            action: "excluded",
            reason: [
              "Registration surrendered — confirmed with the client.",
              "Client filed directly through their own consultant this period.",
              "Not applicable — turnover below threshold, verified from books.",
              "Duplicate registration; obligation tracked under the other GSTIN.",
            ][Math.floor(h(id + "|r") * 4)],
          };
        } else if (notYetDue) {
          const daysToGo = diffDays(TODAY, occ.dueDate);
          const filesEarly = daysToGo <= 14 && seed < (client.profile.discipline - 0.6) * 0.8;
          if (filesEarly) {
            status = "Filed";
            basis = h(id + "|b") < 0.55 ? "Filed via KDK" : "Portal verified";
            filedOn = addDays(occ.dueDate, -Math.floor(h(id + "|f") * daysToGo) - 1);
          } else {
            status = "Pending";
            basis = "Due date not passed";
          }
        } else {
          /* Old arrears mostly get cleared eventually — real backlogs cluster
             in the last few weeks, not evenly across the year. */
          const ageBonus = Math.min(0.5, (daysOverdue / 60) * 0.5);
          const pFiled = Math.min(0.985, client.profile.discipline * 0.88 + ageBonus);
          if (seed < pFiled) {
            status = "Filed";
            const b = h(id + "|b");
            basis = b < 0.4 ? "Portal verified" : b < 0.82 ? "Filed via KDK" : "Manually marked";
            filedOn = addDays(occ.dueDate, Math.floor(h(id + "|f") * 6) - 4);
          } else {
            status = "Overdue";
            basis = "Due date passed";
          }
        }

        const effOverdue = status === "Overdue" ? daysOverdue : 0;
        const exp = estimateExposure(def, effOverdue, client);

        out.push({
          id,
          clientId: client.id,
          runId: occ.runId,
          defCode: def.code,
          head: def.head,
          form: app.form,
          periodLabel: occ.periodLabel,
          dueDate: occ.dueDate,
          status,
          basis,
          rule: app.hit,
          override,
          assigneeId: client.assigneeId,
          daysOverdue: effOverdue,
          exposure: exp.amount,
          exposureFormula: exp.formula,
          filedOn,
          reminderStage: reminderStageFor(status, occ.dueDate, def.clientFacing),
        });
      }
    }
  }

  return out;
}

/* ==========================================================================
   STORE
   ========================================================================== */

let OBLIGATIONS: Obligation[] = build();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getVersion(): number {
  return version;
}
export function allObligations(): Obligation[] {
  return OBLIGATIONS;
}

let outbox: OutboxEntry[] = [];

/** Mark a set of obligations filed — the manual fallback in the spec's
 *  three-source filing status model. */
export function markFiled(ids: string[], by = "Manually marked" as StatusBasis) {
  const set = new Set(ids);
  OBLIGATIONS = OBLIGATIONS.map((o) => {
    if (!set.has(o.id) || o.status === "Filed") return o;
    return {
      ...o,
      status: "Filed",
      basis: by,
      filedOn: TODAY,
      daysOverdue: 0,
      exposure: 0,
      exposureFormula: "Filed — penalty no longer accruing.",
      reminderStage: "Cancelled: resolved",
    };
  });
  emit();
}

/** Manual override: take a compliance off a client with a recorded reason. */
export function markNotApplicable(ids: string[], reason: string, by: string) {
  const set = new Set(ids);
  OBLIGATIONS = OBLIGATIONS.map((o) => {
    if (!set.has(o.id)) return o;
    return {
      ...o,
      status: "Not Applicable",
      basis: "Manually excluded",
      daysOverdue: 0,
      exposure: 0,
      exposureFormula: "Not applicable — no penalty exposure.",
      reminderStage: "N/A",
      override: { by, on: TODAY, action: "excluded", reason },
    };
  });
  emit();
}

/** Put a rule-excluded compliance back on a client. */
export function reinstate(ids: string[], reason: string, by: string) {
  const set = new Set(ids);
  OBLIGATIONS = OBLIGATIONS.map((o) => {
    if (!set.has(o.id)) return o;
    const client = CLIENT_BY_ID[o.clientId];
    const def = DEF_BY_CODE[o.defCode];
    const overdue = Math.max(0, diffDays(o.dueDate, TODAY));
    const exp = estimateExposure(def, overdue, client);
    return {
      ...o,
      status: overdue > 0 ? "Overdue" : "Pending",
      basis: overdue > 0 ? "Due date passed" : "Due date not passed",
      daysOverdue: overdue,
      exposure: exp.amount,
      exposureFormula: exp.formula,
      reminderStage: reminderStageFor(overdue > 0 ? "Overdue" : "Pending", o.dueDate, def.clientFacing),
      override: { by, on: TODAY, action: "included", reason },
    };
  });
  emit();
}

export function reassign(ids: string[], staffId: string) {
  const set = new Set(ids);
  OBLIGATIONS = OBLIGATIONS.map((o) => (set.has(o.id) ? { ...o, assigneeId: staffId } : o));
  emit();
}

/** Queue reminders. Honours the quiet-hours guard from the reminder logic
 *  sheet: sends outside 09:00–20:00 are held, not dropped. */
/** Message text for an obligation, in the shape OutboxEntry stores it. */
function composeFor(o: Obligation): { preview: string; body: string; subject: string } {
  const c = compose(o, CLIENT_BY_ID[o.clientId], staffOf(o.assigneeId));
  return { preview: c.line, body: c.body, subject: c.subject };
}

export function sendReminders(ids: string[], channels: ("WhatsApp" | "Email")[], hour = 11) {
  const quiet = hour < 9 || hour >= 20;
  const set = new Set(ids);
  const entries: OutboxEntry[] = [];
  for (const o of OBLIGATIONS) {
    if (!set.has(o.id)) continue;
    const client = CLIENT_BY_ID[o.clientId];
    for (const ch of channels) {
      if (ch === "WhatsApp" && !client.whatsapp) continue;
      entries.push({
        id: `${o.id}|${ch}|${outbox.length + entries.length}`,
        clientId: o.clientId,
        obligationId: o.id,
        channel: ch,
        stage: o.status === "Overdue" ? "Overdue escalation" : "T-7 sent",
        sentAt: TODAY,
        status: quiet ? "Queued (quiet hours)" : "Delivered",
        ...composeFor(o),
      });
    }
  }
  outbox = [...entries, ...outbox];
  emit();
}

export function getOutbox(): OutboxEntry[] {
  return outbox;
}

/* Seed a plausible send history so the outbox is not empty on first open. */
(function seedOutbox() {
  const recent = OBLIGATIONS.filter(
    (o) => (o.status === "Overdue" || o.status === "Pending") &&
      DEF_BY_CODE[o.defCode].clientFacing &&
      diffDays(TODAY, o.dueDate) < 8,
  ).slice(0, 260);

  outbox = recent.map((o, i) => {
    const client = CLIENT_BY_ID[o.clientId];
    const r = h(o.id + "|ob");
    const ch: "WhatsApp" | "Email" = client.whatsapp && r < 0.62 ? "WhatsApp" : "Email";
    return {
      id: `seed-${i}`,
      clientId: o.clientId,
      obligationId: o.id,
      channel: ch,
      stage: o.status === "Overdue" ? "Overdue escalation" : o.reminderStage,
      sentAt: addDays(TODAY, -Math.floor(r * 6)),
      status: r < 0.06 ? "Failed" : r < 0.13 ? "Queued (quiet hours)" : r < 0.55 ? "Read" : "Delivered",
      ...composeFor(o),
    };
  });
})();

/* ==========================================================================
   AGGREGATION — always counts first, individuals only on drill-down
   ========================================================================== */

export function buildRuns(obs: Obligation[]): FilingRun[] {
  const map = new Map<string, FilingRun>();

  for (const o of obs) {
    if (o.status === "Not Applicable") continue;
    let run = map.get(o.runId);
    if (!run) {
      const def = DEF_BY_CODE[o.defCode];
      run = {
        runId: o.runId,
        def,
        periodLabel: o.periodLabel,
        dueDate: o.dueDate,
        daysOverdue: Math.max(0, diffDays(o.dueDate, TODAY)),
        total: 0, filed: 0, pending: 0, overdue: 0, exposure: 0,
        clientIds: [],
      };
      map.set(o.runId, run);
    }
    run.total++;
    if (o.status === "Filed") run.filed++;
    else if (o.status === "Overdue") run.overdue++;
    else run.pending++;
    run.exposure += o.exposure;
    run.clientIds.push(o.clientId);
  }

  return [...map.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface FirmSummary {
  overdueCount: number;
  overdueClients: number;
  exposure: number;
  dueThisWeek: number;
  dueToday: number;
  filedThisMonth: number;
  pendingTotal: number;
  unassigned: number;
}

export function summarise(obs: Obligation[]): FirmSummary {
  let overdueCount = 0, exposure = 0, dueThisWeek = 0, dueToday = 0,
    filedThisMonth = 0, pendingTotal = 0, unassigned = 0;
  const overdueClients = new Set<string>();
  const weekEnd = addDays(TODAY, 7);
  const monthStart = TODAY.slice(0, 7) + "-01";

  for (const o of obs) {
    if (o.status === "Overdue") {
      overdueCount++;
      overdueClients.add(o.clientId);
      exposure += o.exposure;
      if (o.assigneeId === "none") unassigned++;
    } else if (o.status === "Pending") {
      pendingTotal++;
      if (o.dueDate <= weekEnd) dueThisWeek++;
      if (o.dueDate === TODAY) dueToday++;
      if (o.assigneeId === "none") unassigned++;
    } else if (o.status === "Filed" && o.filedOn && o.filedOn >= monthStart) {
      filedThisMonth++;
    }
  }

  return {
    overdueCount, overdueClients: overdueClients.size, exposure,
    dueThisWeek, dueToday, filedThisMonth, pendingTotal, unassigned,
  };
}

/** Per-day load for the runway ribbon. */
export interface DayLoad {
  date: string;
  total: number;
  open: number;
  overdue: number;
  exposure: number;
}

export function dayLoads(obs: Obligation[], from: string, days: number): DayLoad[] {
  const map = new Map<string, DayLoad>();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    map.set(d, { date: d, total: 0, open: 0, overdue: 0, exposure: 0 });
  }
  for (const o of obs) {
    const slot = map.get(o.dueDate);
    if (!slot) continue;
    slot.total++;
    if (o.status === "Overdue") {
      slot.overdue++;
      slot.open++;
      slot.exposure += o.exposure;
    } else if (o.status === "Pending") slot.open++;
  }
  return [...map.values()];
}

export function clientsOf(ids: string[]): Client[] {
  return ids.map((id) => CLIENT_BY_ID[id]).filter(Boolean);
}
