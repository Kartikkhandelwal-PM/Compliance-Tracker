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
  Channel, Client, ComplianceOverride, DeliveryStatus, FilingRun, FilingStatus,
  FirmProfile, Head, NotificationSettings, Obligation, Occurrence, OutboxEntry, Party,
  RecordType, ReminderSettings, ReminderStage, ScheduleStep, ScheduledSend,
  SenderProfile, StatusBasis, StepKind,
} from "./types.ts";
import {
  CLIENTS, CLIENT_BY_ID, GST_ENTITIES, GST_ENTITY_BY_ID, TDS_DEDUCTORS,
  TDS_DEDUCTOR_BY_ID, staffOf,
} from "./book.ts";
import { DEF_BY_CODE, FY_START, OCCURRENCES_BY_FY, SEEDED_FYS } from "./catalog.ts";
import type { Applicable, DerivedItrDecision, ExposureContext } from "./rules.ts";
import {
  applicableClientCompliances, applicableDeductorCompliances,
  applicableGstCompliances, estimateExposure, estimatedTax,
  itrUApplicability, revisedReturnApplicability,
} from "./rules.ts";
import {
  TODAY, addDays, dateOf, diffDays, inQuietHours, iso, nextSendableAt, stamp,
} from "./dates.ts";
import { compose, getSender, setSender } from "./messages.ts";

/* Stable 0–1 hash so simulated history never shifts between renders. */
function h(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return (x >>> 0) / 4294967296;
}

/** One financial year's occurrences, grouped by compliance code. Built fresh
 *  per year rather than once globally, now that `build()` walks every seeded
 *  year rather than only the current one. */
function occByDefFor(fy: number): Map<string, Occurrence[]> {
  const map = new Map<string, Occurrence[]>();
  for (const o of OCCURRENCES_BY_FY[fy]) {
    const list = map.get(o.defCode);
    if (list) list.push(o);
    else map.set(o.defCode, [o]);
  }
  return map;
}

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

/** A run of stable pseudo-random digits. Built in 6-digit chunks so a long
 *  acknowledgement number never has to come out of one float. */
function digitRun(id: string, salt: string, len: number): string {
  let s = "";
  for (let i = 0; s.length < len; i++) {
    s += String(Math.floor(h(`${id}|${salt}|${i}`) * 1e6)).padStart(6, "0");
  }
  return s.slice(0, len);
}

/**
 * A plausible portal acknowledgement for seeded history.
 *
 * Only filings that came from a portal or from KDK's own modules get one. A
 * seeded "Manually marked" filing is left without, because that is the real
 * gap this field exists to expose: someone ticked it off and no receipt was
 * ever captured. The shapes only need to be recognisable to a practitioner —
 * GST issues an ARN, the income-tax portal a 15-digit acknowledgement, MCA an
 * SRN — since real numbers arrive from the portal, never from this function.
 */
function synthAck(id: string, head: Head, ownerType: RecordType, ownerId: string, filedOn: string): string {
  const [y, m] = filedOn.split("-");
  switch (head) {
    case "GST": {
      const gstin = ownerType === "GstEntity" ? GST_ENTITY_BY_ID[ownerId]?.gstin : undefined;
      const st = gstin?.slice(0, 2) ?? "08";
      const check = "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(h(`${id}|ck`) * 24)];
      return `AA${st}${m}${y.slice(2)}${digitRun(id, "arn", 6)}${check}`;
    }
    case "Income Tax":
      return digitRun(id, "ack", 15);
    case "ROC/MCA":
    case "ROC/MCA (LLP)":
      return `R${digitRun(id, "srn", 8)}`;
    default:
      /* TDS token numbers and challan receipts are both plain 15-digit runs. */
      return digitRun(id, "tok", 15);
  }
}

/** The handful of numbers a late-fee model might read, from whichever of the
 *  three records owns the obligation — see `ExposureContext`'s own note on
 *  why a field a record doesn't have is safely 0 rather than threaded
 *  through as optional. */
function exposureContextFor(ownerType: RecordType, ownerId: string): ExposureContext {
  if (ownerType === "GstEntity") {
    const g = GST_ENTITY_BY_ID[ownerId];
    return { turnover: g.profile.turnover, totalIncome: 0, tdsPerQuarter: 0, monthlyPayroll: 0, estimatedTax: 0 };
  }
  if (ownerType === "TdsDeductor") {
    const d = TDS_DEDUCTOR_BY_ID[ownerId];
    return {
      turnover: d.profile.turnover, totalIncome: 0, tdsPerQuarter: d.profile.tdsPerQuarter,
      monthlyPayroll: d.profile.monthlyPayroll, estimatedTax: 0,
    };
  }
  const c = CLIENT_BY_ID[ownerId];
  return {
    turnover: c.profile.turnover, totalIncome: c.profile.totalIncome,
    tdsPerQuarter: 0, monthlyPayroll: 0, estimatedTax: estimatedTax(c.profile),
  };
}

/** Every screen that needs a record's name/contact/owner reaches it through
 *  this, rather than assuming `clientId` joins into `CLIENT_BY_ID` — it may
 *  join into `GST_ENTITY_BY_ID` or `TDS_DEDUCTOR_BY_ID` instead, per
 *  `ownerType`. Returns the shared `Party` shape every UI screen already
 *  reads (name, whatsapp, email, phone, assigneeId); a screen that also
 *  needs the type-specific id (PAN/GSTIN/TAN) uses `ownerIdOf` below. */
export function ownerOf(o: { ownerType: RecordType; clientId: string }): Party {
  if (o.ownerType === "GstEntity") return GST_ENTITY_BY_ID[o.clientId];
  if (o.ownerType === "TdsDeductor") return TDS_DEDUCTOR_BY_ID[o.clientId];
  return CLIENT_BY_ID[o.clientId];
}

/** The type-specific identifier a record is filed under, labelled. */
export function ownerIdOf(o: { ownerType: RecordType; clientId: string }): { label: string; value: string } {
  if (o.ownerType === "GstEntity") return { label: "GSTIN", value: GST_ENTITY_BY_ID[o.clientId]?.gstin ?? "" };
  if (o.ownerType === "TdsDeductor") return { label: "TAN", value: TDS_DEDUCTOR_BY_ID[o.clientId]?.tan ?? "" };
  return { label: "PAN", value: CLIENT_BY_ID[o.clientId]?.pan ?? "" };
}

/** One pass over one of the three unlinked arrays, applying its own
 *  applicability function and producing `Obligation`s tagged with its
 *  `ownerType`. The status-simulation logic below is identical for all
 *  three — it only ever reads `owner.id`, `owner.assigneeId` and
 *  `owner.profile.discipline`, which every one of `Client`/`GstEntity`/
 *  `TdsDeductor` carries — so one generic walk replaces what would
 *  otherwise be three copies differing only in which array and which
 *  applicability function they call. */
function buildFor<T extends Party & { profile: { discipline: number } }>(
  owners: T[], ownerType: RecordType, applicable: (owner: T) => Applicable[],
  occByDef: Map<string, Occurrence[]>,
): Obligation[] {
  const out: Obligation[] = [];

  for (const owner of owners) {
    for (const app of applicable(owner)) {
      const def = DEF_BY_CODE[app.defCode];
      const occs = occByDef.get(app.defCode);
      if (!def || !occs) continue;

      for (const occ of occs) {
        const id = `${owner.id}::${occ.runId}`;
        const seed = h(id);
        const daysOverdue = Math.max(0, diffDays(occ.dueDate, TODAY));
        const notYetDue = diffDays(TODAY, occ.dueDate) > 0;

        let status: FilingStatus;
        let basis: StatusBasis;
        let filedOn: string | undefined;
        let arn: string | undefined;
        let filedBy: string | undefined;
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
            by: staffOf(owner.assigneeId).name,
            on: addDays(TODAY, -Math.floor(h(id + "|d") * 90) - 5),
            action: "excluded",
            reason: [
              "Registration surrendered. Confirmed with the client.",
              "Client filed directly through their own consultant this period.",
              "Not applicable. Turnover below threshold, verified from books.",
              "Duplicate registration; obligation tracked under the other GSTIN.",
            ][Math.floor(h(id + "|r") * 4)],
          };
        } else if (notYetDue) {
          const daysToGo = diffDays(TODAY, occ.dueDate);
          const filesEarly = daysToGo <= 14 && seed < (owner.profile.discipline - 0.6) * 0.8;
          if (filesEarly) {
            status = "Filed";
            basis = h(id + "|b") < 0.55 ? "Filed via KDK" : "Portal verified";
            /* Counted back from TODAY, not forward from the due date.
               Deriving it from the due date put the filing date in the FUTURE
               — "GSTR-3B for July, filed on 14 August" when today is the 6th —
               so the dashboard's "filed this month" was counting 147 filings
               that had not happened yet. Something already marked Filed must
               have been filed on or before today. */
            filedOn = addDays(TODAY, -Math.floor(h(id + "|f") * 6));
            arn = synthAck(id, def.head, ownerType, owner.id, filedOn);
          } else {
            status = "Pending";
            basis = "Due date not passed";
          }
        } else {
          /* Old arrears mostly get cleared eventually — real backlogs cluster
             in the last few weeks, not evenly across the year. */
          const ageBonus = Math.min(0.5, (daysOverdue / 60) * 0.5);
          const pFiled = Math.min(0.985, owner.profile.discipline * 0.88 + ageBonus);
          if (seed < pFiled) {
            status = "Filed";
            const b = h(id + "|b");
            basis = b < 0.4 ? "Portal verified" : b < 0.82 ? "Filed via KDK" : "Manually marked";
            /* Scattered either side of the due date, then clamped: where the
               due date is today or yesterday the +1 end of that window lands
               in the future, and a filing cannot be dated after today. */
            const guess = addDays(occ.dueDate, Math.floor(h(id + "|f") * 6) - 4);
            filedOn = guess > TODAY ? TODAY : guess;
            /* Manually marked filings are left without an acknowledgement on
               purpose — that is the gap, not an oversight in the seed. */
            if (basis !== "Manually marked") arn = synthAck(id, def.head, ownerType, owner.id, filedOn);
            else filedBy = staffOf(owner.assigneeId).name;
          } else {
            status = "Overdue";
            basis = "Due date passed";
          }
        }

        const effOverdue = status === "Overdue" ? daysOverdue : 0;
        const exp = estimateExposure(def, effOverdue, exposureContextFor(ownerType, owner.id));

        out.push({
          id,
          ownerType,
          clientId: owner.id,
          runId: occ.runId,
          defCode: def.code,
          fy: occ.fy,
          head: def.head,
          form: app.form,
          periodLabel: occ.periodLabel,
          dueDate: occ.dueDate,
          status,
          basis,
          rule: app.hit,
          override,
          assigneeId: owner.assigneeId,
          daysOverdue: effOverdue,
          exposure: exp.amount,
          exposureFormula: exp.formula,
          filedOn,
          filedBy,
          arn,
          reminderStage: reminderStageFor(status, occ.dueDate, def.clientFacing),
        });
      }
    }
  }

  return out;
}

/** The original ITR obligations Revised Return / ITR-U eligibility is
 *  decided from — see `buildDerivedItr` below. */
const ORIGINAL_ITR_CODES = new Set(["ITR-NONAUDIT", "ITR-NONAUDIT-BIZ", "ITR-AUDIT", "ITR-TP"]);

/** Shared shape for both derived obligations below. Neither has a real
 *  per-day late fee — missing the window just closes it, it doesn't accrue a
 *  penalty the way an overdue GSTR-3B does — so status is only ever Pending,
 *  Filed or Not Applicable, never Overdue. A small stable-hash chance marks
 *  an open one as already filed, so the seeded book isn't uniformly
 *  untouched. `reminderStage` follows the same T-7/T-3/due-date ladder as
 *  every other client-facing compliance — Revised Return's near-term 31
 *  December due date puts it on the ladder almost immediately; ITR-U's
 *  window-close due date is years out, so it sits at "T-7 scheduled" until
 *  that approaches. */
function makeDerivedObligation(
  owner: Client, occ: Occurrence, decision: DerivedItrDecision, defCode: string,
): Obligation {
  const def = DEF_BY_CODE[defCode];
  const id = `${owner.id}::${occ.runId}`;
  let status: FilingStatus;
  let basis: StatusBasis;
  let filedOn: string | undefined;
  let filedBy: string | undefined;

  if (!decision.open) {
    status = "Not Applicable";
    basis = "Rule-excluded";
  } else if (h(id + "|derived-filed") < 0.06) {
    status = "Filed";
    basis = "Manually marked";
    filedOn = addDays(TODAY, -Math.floor(h(id + "|f") * 60) - 1);
    filedBy = staffOf(owner.assigneeId).name;
  } else {
    status = "Pending";
    basis = "Due date not passed";
  }

  return {
    id,
    ownerType: "Client",
    clientId: owner.id,
    runId: occ.runId,
    defCode,
    fy: occ.fy,
    head: def.head,
    form: def.form,
    periodLabel: occ.periodLabel,
    dueDate: occ.dueDate,
    status,
    basis,
    rule: decision.hit,
    assigneeId: owner.assigneeId,
    daysOverdue: 0,
    exposure: 0,
    exposureFormula: def.lateFee.note,
    filedOn,
    filedBy,
    reminderStage: reminderStageFor(status, occ.dueDate, def.clientFacing),
  };
}

/** Revised Return and ITR-U don't fit `buildFor()`: their applicability
 *  depends on what happened to the client's own original ITR obligation for
 *  the same year, not on the profile alone. Run as a second pass over the
 *  obligations `buildFor()` just produced for this year's clients, so the
 *  original's filed status/date is already there to read. */
function buildDerivedItr(fy: number, clientObls: Obligation[], occByDef: Map<string, Occurrence[]>): Obligation[] {
  const origByClient = new Map<string, Obligation>();
  for (const o of clientObls) {
    if (ORIGINAL_ITR_CODES.has(o.defCode)) origByClient.set(o.clientId, o);
  }

  const revOcc = occByDef.get("ITR-REVISED")?.[0];
  const uOcc = occByDef.get("ITR-U")?.[0];
  /* End of the assessment year this FY's original ITR belongs to — see the
     matching note on `Occurrence.fy` in types.ts. */
  const ayEnd = iso(fy + 1, 3, 31);
  const out: Obligation[] = [];

  for (const owner of CLIENTS) {
    const original = origByClient.get(owner.id);
    if (!original) continue;

    /* Nothing to revise if the original was never filed. */
    if (revOcc && original.status === "Filed") {
      const decision = revisedReturnApplicability(original, revOcc.dueDate, TODAY);
      out.push(makeDerivedObligation(owner, revOcc, decision, "ITR-REVISED"));
    }
    /* ITR-U applies whether or not the original was filed — no status gate. */
    if (uOcc) {
      const decision = itrUApplicability(original, uOcc.dueDate, ayEnd, TODAY);
      out.push(makeDerivedObligation(owner, uOcc, decision, "ITR-U"));
    }
  }
  return out;
}

/** Every seeded financial year, not just the current one — a past year's
 *  occurrences are all in the past relative to `TODAY`, so the same
 *  filed-vs-overdue simulation below naturally produces a mostly-closed
 *  history for them; the year ahead is deliberately left out, since it
 *  hasn't started and carries no client data at all. */
function build(): Obligation[] {
  const out: Obligation[] = [];
  for (const fy of SEEDED_FYS) {
    const occByDef = occByDefFor(fy);
    const clientObls = buildFor(CLIENTS, "Client", applicableClientCompliances, occByDef);
    out.push(...clientObls);
    out.push(...buildDerivedItr(fy, clientObls, occByDef));
    out.push(...buildFor(GST_ENTITIES, "GstEntity", applicableGstCompliances, occByDef));
    out.push(...buildFor(TDS_DEDUCTORS, "TdsDeductor", applicableDeductorCompliances, occByDef));
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
/**
 * The book, minus anything the firm has switched off.
 *
 * The filter belongs HERE and not at each call site. Every screen in the
 * product reads the book through this one function, so a compliance the firm
 * does not handle disappears from all of them at once — tracker, calendar,
 * dashboard, client profiles, exports. The first cut of the settings screen
 * only consulted the flag when deciding who to chase, so switching GSTR-1 off
 * silently stopped its reminders while leaving it on every other screen: the
 * worst of both, and exactly the kind of half-applied setting that makes
 * people stop trusting the switches.
 */
export function allObligations(): Obligation[] {
  if (OVERRIDES.size === 0) return OBLIGATIONS;
  return OBLIGATIONS.filter((o) => complianceSetting(o.defCode).tracked);
}

/** Untracked compliance codes — for the screens that read the catalogue
 *  directly (the calendar's date list, the compliance index) rather than
 *  through the book. */
export function untrackedCodes(): Set<string> {
  const out = new Set<string>();
  for (const [code, cfg] of OVERRIDES) if (!cfg.tracked) out.add(code);
  return out;
}

let outbox: OutboxEntry[] = [];

/**
 * Mark a set of obligations filed — the manual fallback in the spec's
 * three-source filing status model.
 *
 * `by` is REQUIRED. Marking filed zeroes the penalty exposure and cancels the
 * client's reminders, which makes it the entry most in need of an author: if a
 * return turns out not to have been filed, "who decided this" is the first
 * question asked. It costs the user nothing to capture — the signed-in staff
 * member is already known — so it is recorded on every path, bulk included.
 *
 * `arn` is optional, and only the single-obligation path offers it. See the
 * field's note on `Obligation` for why a bulk action cannot ask for one.
 */
export function markFiled(
  ids: string[],
  rec: { by: string; arn?: string },
  basis: StatusBasis = "Manually marked",
) {
  const set = new Set(ids);
  const arn = rec.arn?.trim();
  OBLIGATIONS = OBLIGATIONS.map((o) => {
    if (!set.has(o.id) || o.status === "Filed") return o;
    return {
      ...o,
      status: "Filed",
      basis,
      filedOn: TODAY,
      filedBy: rec.by,
      ...(arn ? { arn } : {}),
      daysOverdue: 0,
      exposure: 0,
      exposureFormula: "Filed. Penalty no longer accruing.",
      reminderStage: "Cancelled: resolved",
    };
  });
  emit();
}

/**
 * Reverse a filing — the undo for a mis-click.
 *
 * Needed because marking filed is the one destructive action in the app that
 * had no way back: it zeroes the penalty exposure and cancels the client's
 * reminders, and the bulk control on the run screen can apply it to several
 * hundred clients in a single press. Until the backend exists a refresh
 * happens to rescue you; once filings persist, an unrecoverable mis-click on
 * 400 clients silently understates the firm's exposure.
 *
 * The obligation goes back to whatever the due date says it is — Pending or
 * Overdue — rather than to whatever it was before, because days have passed and
 * the penalty has to be recomputed from today. Only obligations recorded as
 * filed BY A PERSON can be reversed; a portal or software confirmation is not
 * this screen's to overrule.
 */
export function unmarkFiled(ids: string[]): number {
  const set = new Set(ids);
  let n = 0;
  OBLIGATIONS = OBLIGATIONS.map((o) => {
    if (!set.has(o.id) || o.status !== "Filed" || o.basis !== "Manually marked") return o;
    const def = DEF_BY_CODE[o.defCode];
    const overdue = Math.max(0, diffDays(o.dueDate, TODAY));
    const exp = estimateExposure(def, overdue, exposureContextFor(o.ownerType, o.clientId));
    const status: FilingStatus = overdue > 0 ? "Overdue" : "Pending";
    n++;
    return {
      ...o,
      status,
      basis: overdue > 0 ? "Due date passed" : "Due date not passed",
      filedOn: undefined,
      filedBy: undefined,
      arn: undefined,
      daysOverdue: overdue,
      exposure: exp.amount,
      exposureFormula: exp.formula,
      reminderStage: reminderStageFor(status, o.dueDate, def.clientFacing),
    };
  });
  if (n > 0) emit();
  return n;
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
      exposureFormula: "Not applicable. No penalty exposure.",
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
    const def = DEF_BY_CODE[o.defCode];
    const overdue = Math.max(0, diffDays(o.dueDate, TODAY));
    const exp = estimateExposure(def, overdue, exposureContextFor(o.ownerType, o.clientId));
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

/* ==========================================================================
   REMINDER ENGINE
   --------------------------------------------------------------------------
   Reminders used to be manual only: someone selected rows and pressed send.
   That does not survive contact with a real book — nobody opens the app on
   the 13th to chase the 20th, so the chase happens when someone remembers,
   which is usually after the due date.

   The cadence below is a LADDER OF OFFSETS hung off the statutory due date,
   not a calendar. One ladder therefore drives every compliance in the
   catalogue against every client it applies to: "three days before, on
   WhatsApp" is a rule, "3 Aug for GSTR-3B July" is its consequence.

   Two things the ladder is deliberately NOT allowed to do:

     • It never fires on a resolved obligation. A step is evaluated at send
       time against live status, so a client who filed on the 12th is not
       chased on the 13th. This is the single most damaging thing a reminder
       system can get wrong — it destroys trust in every other message.
     • It never sends outside 09:00–20:00. Out-of-window sends are HELD and
       released at 09:00, not dropped: a statutory notice at 6am reads as
       spam and gets the business number blocked.
   ========================================================================== */

/** The prototype's fixed "now". Real deployments read the clock; here it is
 *  pinned so the same book renders identically on every load. Late afternoon,
 *  so that the morning's automatic sends are already history and the evening's
 *  are still ahead — which is the state the screens are designed against. */
export const NOW = stamp(TODAY, 17, 30);

const DEFAULT_SCHEDULE: ScheduleStep[] = [
  {
    id: "t7",
    offset: -7,
    stage: "T-7 sent",
    label: "First reminder",
    intent: "First heads-up, with time to collect documents.",
    channels: ["WhatsApp", "Email"],
    sendAt: 10,
    enabled: true,
  },
  {
    id: "t3",
    offset: -3,
    stage: "T-3 sent",
    label: "Follow-up",
    intent: "Last easy reminder before the deadline.",
    channels: ["WhatsApp"],
    sendAt: 11,
    enabled: true,
  },
  {
    id: "t0",
    offset: 0,
    stage: "Due-date sent",
    label: "Due today",
    intent: "Due today. Sent in the morning.",
    channels: ["WhatsApp", "Email"],
    sendAt: 9,
    enabled: true,
  },
  {
    id: "p1",
    offset: 1,
    stage: "Overdue escalation",
    label: "Missed",
    intent: "Missed. Shows the late fee so far.",
    channels: ["WhatsApp", "Email"],
    sendAt: 10,
    enabled: true,
  },
  {
    id: "p7",
    offset: 7,
    stage: "Overdue escalation",
    label: "Escalation",
    intent: "A week late. The client's owner is copied in.",
    channels: ["Email"],
    sendAt: 11,
    enabled: true,
    ccOwner: true,
  },
  {
    id: "p30",
    offset: 30,
    stage: "Overdue escalation",
    label: "Final notice",
    intent: "A month late. Off by default.",
    channels: ["Email"],
    sendAt: 11,
    enabled: false,
    ccOwner: true,
  },
];

let SCHEDULE: ScheduleStep[] = DEFAULT_SCHEDULE.map((s) => ({ ...s }));

let SETTINGS: ReminderSettings = {
  autoSend: true,
  quietHours: true,
  quietStart: 9,
  quietEnd: 20,
  skipWeekends: true,
  /* Off — combining several due filings into one message is not built yet.
     Nothing in this file merges obligations before composing a send, so a
     default of `true` here would claim behaviour the scheduler doesn't have.
     Scoped to a later phase; deliberately has no control on Settings — do
     not add one without checking that decision still holds. */
  digest: false,
};

/* --- Organisation ---------------------------------------------------------
   The firm's own identity, and the account its messages come from. Both are
   configuration rather than code: the sender block is reproduced at the foot
   of every reminder, so editing it here changes what every client reads. */

let FIRM: FirmProfile = {
  name: "KDK Software",
  frn: "012345C",
  membershipNo: "402198",
  pan: "AABCK1234M",
  gstin: "08AABCK1234M1Z5",
  addressLine: "2nd Floor, Shanti Tower, Ajmer Road",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302006",
  phone: "+91 141 400 1234",
  email: "compliance@kdksoftware.com",
  website: "kdksoftware.com",
};

export function getFirm(): FirmProfile {
  return FIRM;
}

export function updateFirm(patch: Partial<FirmProfile>) {
  FIRM = { ...FIRM, ...patch };
  /* The firm name is the "on behalf of" in every signature. */
  if (patch.name) setSender({ by: patch.name });
  emit();
}

/** The sender, surfaced through the engine so one `emit()` re-renders every
 *  screen that quotes it — the previews above all. */
export function getSenderProfile(): SenderProfile {
  const s = getSender();
  return {
    waName: s.name,
    waNumber: s.handle,
    waVerified: s.verified,
    fromEmail: s.fromEmail,
    replyTo: s.replyTo,
  };
}

export function updateSenderProfile(patch: Partial<SenderProfile>) {
  setSender({
    ...(patch.waName !== undefined ? { name: patch.waName } : {}),
    ...(patch.waNumber !== undefined ? { handle: patch.waNumber } : {}),
    ...(patch.waVerified !== undefined ? { verified: patch.waVerified } : {}),
    ...(patch.fromEmail !== undefined ? { fromEmail: patch.fromEmail } : {}),
    ...(patch.replyTo !== undefined ? { replyTo: patch.replyTo } : {}),
  });
  emit();
}

/* --- Compliance catalogue overrides ---------------------------------------
   A firm that does not run payroll has no business tracking PF and ESI, and
   whether a filing is the client's own act decides whether they are ever
   chased about it. Both were fixed in the catalogue; both are now the firm's
   to set, and both feed straight back into who gets a reminder. */

const OVERRIDES = new Map<string, ComplianceOverride>();

export function complianceSetting(code: string): ComplianceOverride {
  const def = DEF_BY_CODE[code];
  return OVERRIDES.get(code) ?? { tracked: true, clientFacing: def?.clientFacing ?? false };
}

export function updateCompliance(code: string, patch: Partial<ComplianceOverride>) {
  OVERRIDES.set(code, { ...complianceSetting(code), ...patch });
  emit();
}

export function resetCompliances() {
  OVERRIDES.clear();
  emit();
}

/**
 * Flip a record's WhatsApp opt-in (or any other `Party` field) — works on
 * whichever of the three record types owns it.
 *
 * Records are looked up by id everywhere (`CLIENT_BY_ID[id]` and its two
 * counterparts), never held onto across a render, so mutating the record in
 * place and emitting is enough — the next read sees the change, and nothing
 * depends on the object's identity staying stable the way OBLIGATIONS'
 * array-replace pattern does.
 */
export function updateParty(ownerType: RecordType, id: string, patch: Partial<Party>) {
  const rec = ownerType === "GstEntity" ? GST_ENTITY_BY_ID[id]
    : ownerType === "TdsDeductor" ? TDS_DEDUCTOR_BY_ID[id]
      : CLIENT_BY_ID[id];
  if (!rec) return;
  Object.assign(rec, patch);
  emit();
}

/** How many compliances the firm has switched off, for the settings summary. */
export function untrackedCount(): number {
  let n = 0;
  for (const [, v] of OVERRIDES) if (!v.tracked) n++;
  return n;
}

/* --- Bell notifications ---------------------------------------------------
   Which alerts the app is allowed to raise. Every one is a real condition,
   but which of them a given practice wants shouted at it differs. */

let NOTIFS: NotificationSettings = {
  gap: true,
  dueToday: true,
  unowned: true,
  failed: true,
};

export function getNotificationSettings(): NotificationSettings {
  return NOTIFS;
}

export function updateNotificationSettings(patch: NotificationSettings) {
  NOTIFS = { ...NOTIFS, ...patch };
  emit();
}

/* The signature last seen for each alert, not just a read/unread flag — an
   alert someone opened at "3 clients have not filed" is a different alert
   once the count moves to 5, and should raise the badge again rather than
   staying silent because that ID was clicked once before. */
let VIEWED_NOTIFS: Record<string, string> = {};

export function getViewedNotifs(): Record<string, string> {
  return VIEWED_NOTIFS;
}

export function markNotifViewed(kind: string, signature: string) {
  if (VIEWED_NOTIFS[kind] === signature) return;
  VIEWED_NOTIFS = { ...VIEWED_NOTIFS, [kind]: signature };
  emit();
}

/* --- Default owner for new work ------------------------------------------- */

let DEFAULT_ASSIGNEE = "none";

export function getDefaultAssignee(): string {
  return DEFAULT_ASSIGNEE;
}

export function setDefaultAssignee(id: string) {
  DEFAULT_ASSIGNEE = id;
  emit();
}

/** Batches already materialised, keyed `runId|stepId`, so a scheduler tick is
 *  idempotent and history is never re-sent. */
const fired = new Set<string>();
/** Batches a person has suppressed, same key. */
const skipped = new Set<string>();

export function getSchedule(): ScheduleStep[] {
  return SCHEDULE;
}

export function updateStep(id: string, patch: Partial<ScheduleStep>) {
  SCHEDULE = SCHEDULE.map((s) => (s.id === id ? { ...s, ...patch } : s));
  emit();
}

/** Toggling a channel off on its last remaining step would leave a step that
 *  fires and sends nothing, so the step switches off with it. */
export function toggleStepChannel(id: string, ch: Channel) {
  SCHEDULE = SCHEDULE.map((s) => {
    if (s.id !== id) return s;
    const channels = s.channels.includes(ch)
      ? s.channels.filter((c) => c !== ch)
      : [...s.channels, ch];
    return { ...s, channels, enabled: channels.length === 0 ? false : s.enabled };
  });
  emit();
}

export function resetSchedule() {
  SCHEDULE = DEFAULT_SCHEDULE.map((s) => ({ ...s }));
  emit();
}

export function getReminderSettings(): ReminderSettings {
  return SETTINGS;
}

export function updateReminderSettings(patch: Partial<ReminderSettings>) {
  SETTINGS = { ...SETTINGS, ...patch };
  emit();
}

/** Message text for an obligation, in the shape OutboxEntry stores it. */
function composeFor(
  o: Obligation, channel: Channel, kind: StepKind,
): { preview: string; body: string; subject: string } {
  const c = compose(o, ownerOf(o), channel, kind);
  return { preview: c.line, body: c.body, subject: c.subject };
}

/** Which rung of the ladder a manual, ad-hoc chase reads as. Capped at "p1"
 *  regardless of how overdue the obligation actually is — the escalation and
 *  final-notice wording (and the owner cc that comes with them) belong to
 *  the automatic ladder's own p7/p30 steps, never to a one-off chase someone
 *  fires from a client screen. */
function manualKindFor(o: Obligation): StepKind {
  if (o.status === "Overdue") return "p1";
  const n = diffDays(TODAY, o.dueDate);
  if (n === 0) return "t0";
  if (n <= 3) return "t3";
  return "t7";
}

/** Obligations still in scope for a chase: unresolved, on a compliance the
 *  firm still tracks, and one the client is the one who files. The last two
 *  are the firm's settings, not the catalogue's defaults. Scoped to the
 *  current year on top of that — a stray arrear still open from a retired
 *  financial year is a write-off conversation, not something the automated
 *  cadence should still be messaging a client about. */
function chaseable(o: Obligation): boolean {
  if (o.fy !== FY_START) return false;
  if (o.status !== "Pending" && o.status !== "Overdue") return false;
  const cfg = complianceSetting(o.defCode);
  return cfg.tracked && cfg.clientFacing;
}

interface RunBucket {
  runId: string;
  defCode: string;
  head: Head;
  form: string;
  periodLabel: string;
  dueDate: string;
  obligationIds: string[];
  whatsapp: number;
}

/** One pass over the book, bucketed by filing run. Everything the scheduler
 *  needs is derived from this — never from a per-client scan, which at 10,000
 *  clients would be re-walked on every render. */
function bucketRuns(): RunBucket[] {
  const map = new Map<string, RunBucket>();
  for (const o of OBLIGATIONS) {
    if (!chaseable(o)) continue;
    let b = map.get(o.runId);
    if (!b) {
      const def = DEF_BY_CODE[o.defCode];
      b = {
        runId: o.runId,
        defCode: o.defCode,
        head: def.head,
        form: def.form,
        periodLabel: o.periodLabel,
        dueDate: o.dueDate,
        obligationIds: [],
        whatsapp: 0,
      };
      map.set(o.runId, b);
    }
    b.obligationIds.push(o.id);
    if (ownerOf(o)?.whatsapp) b.whatsapp++;
  }
  return [...map.values()];
}

/** Every send the ladder implies inside `[from, to]`, newest first.
 *  Aggregated per run × step: one row is "GSTR-3B July, follow-up, 418
 *  clients", never 418 rows. */
function computeSends(fromTs: string, toTs: string): ScheduledSend[] {
  const out: ScheduledSend[] = [];
  for (const b of bucketRuns()) {
    for (const step of SCHEDULE) {
      if (!step.enabled || step.channels.length === 0) continue;
      const raw = stamp(addDays(b.dueDate, step.offset), step.sendAt);
      /* A weekend step at or before the due date moves EARLIER, never later —
         a warning delivered after its own deadline is worse than no warning.
         Steps after the due date move later, since they cannot be sent before
         the date they report as missed. */
      const fireAt = SETTINGS.quietHours
        ? nextSendableAt(
            raw, SETTINGS.quietStart, SETTINGS.quietEnd, SETTINGS.skipWeekends,
            step.offset <= 0 ? "earlier" : "later",
          )
        : raw;
      if (fireAt < fromTs || fireAt > toTs) continue;
      const key = `${b.runId}|${step.id}`;
      if (fired.has(key)) continue;
      out.push({
        key,
        runId: b.runId,
        defCode: b.defCode,
        head: b.head,
        form: b.form,
        periodLabel: b.periodLabel,
        dueDate: b.dueDate,
        step,
        fireAt,
        clientCount: b.obligationIds.length,
        whatsappCount: b.whatsapp,
        obligationIds: b.obligationIds,
        skipped: skipped.has(key),
      });
    }
  }
  out.sort((a, z) => a.fireAt.localeCompare(z.fireAt));
  return out;
}

/** What is queued to go out, from now to the horizon. */
export function scheduledSends(horizonDays = 45): ScheduledSend[] {
  return computeSends(NOW, stamp(addDays(TODAY, horizonDays), 23, 59));
}

/** Steps whose moment has passed but which have not been materialised — what a
 *  scheduler tick would send if it ran right now. */
export function dueSends(): ScheduledSend[] {
  return computeSends("0000", NOW).filter((s) => !s.skipped);
}

export function skipScheduled(key: string, on = true) {
  if (on) skipped.add(key);
  else skipped.delete(key);
  emit();
}

/* --- Materialising a send ------------------------------------------------- */

/** Simulated delivery outcome. Real deployments read this back from the
 *  WhatsApp Business and mail-transport webhooks; the shape is the same. */
function outcome(seed: string, at: string): DeliveryStatus {
  if (SETTINGS.quietHours && inQuietHours(at, SETTINGS.quietStart, SETTINGS.quietEnd)) {
    return "Queued (quiet hours)";
  }
  const r = h(seed);
  if (r < 0.05) return "Failed";
  if (r < 0.52) return "Read";
  return "Delivered";
}

let serial = 0;

function entryFor(
  o: Obligation,
  ch: Channel,
  stage: ReminderStage,
  kind: StepKind,
  at: string,
  origin: OutboxEntry["origin"],
  extra: Partial<OutboxEntry> = {},
): OutboxEntry {
  const def = DEF_BY_CODE[o.defCode];
  return {
    id: `ob-${serial++}`,
    ownerType: o.ownerType,
    clientId: o.clientId,
    obligationId: o.id,
    channel: ch,
    stage,
    kind,
    sentAt: at,
    status: outcome(`${o.id}|${ch}|${at}`, at),
    origin,
    attempt: 1,
    defCode: o.defCode,
    head: def.head,
    form: def.form,
    ...composeFor(o, ch, kind),
    ...extra,
  };
}

function materialise(send: ScheduledSend, at: string, origin: OutboxEntry["origin"], by?: string) {
  const byId = new Map(OBLIGATIONS.map((o) => [o.id, o]));
  const entries: OutboxEntry[] = [];
  for (const id of send.obligationIds) {
    const o = byId.get(id);
    /* Re-checked at send time, not at schedule time: anything filed since the
       batch was computed drops out here. */
    if (!o || !chaseable(o)) continue;
    const owner = ownerOf(o);
    if (!owner) continue;
    for (const ch of send.step.channels) {
      if (ch === "WhatsApp" && !owner.whatsapp) continue;
      entries.push(entryFor(o, ch, send.step.stage, send.step.id, at, origin, by ? { sentBy: by } : {}));
    }
  }
  if (entries.length > 0) outbox = [...entries, ...outbox];
  fired.add(send.key);
  return entries.length;
}

/** A scheduler tick. Materialises every batch whose moment has passed.
 *  Idempotent — a batch is fired once and remembered. */
export function runScheduler(): number {
  if (!SETTINGS.autoSend) return 0;
  let n = 0;
  for (const send of dueSends()) n += materialise(send, send.fireAt, "Automatic");
  if (n > 0) emit();
  return n;
}

/** Send a queued batch ahead of its moment. */
export function sendScheduledNow(key: string, by: string): number {
  const send = computeSends("0000", stamp(addDays(TODAY, 400), 23, 59)).find((s) => s.key === key);
  if (!send) return 0;
  const n = materialise(send, NOW, "Manual", by);
  emit();
  return n;
}

/* --- Manual sends --------------------------------------------------------- */

/** Chase a specific set of obligations now. The button behind every "Send
 *  reminder" in the product. */
export function sendReminders(
  ids: string[],
  channels: Channel[],
  by = "s1",
  at = NOW,
): number {
  const set = new Set(ids);
  const entries: OutboxEntry[] = [];
  for (const o of OBLIGATIONS) {
    if (!set.has(o.id) || !chaseable(o)) continue;
    const owner = ownerOf(o);
    if (!owner) continue;
    const kind = manualKindFor(o);
    const stage: ReminderStage = o.status === "Overdue" ? "Overdue escalation"
      : kind === "t0" ? "Due-date sent" : kind === "t3" ? "T-3 sent" : "T-7 sent";
    for (const ch of channels) {
      if (ch === "WhatsApp" && !owner.whatsapp) continue;
      entries.push(entryFor(o, ch, stage, kind, at, "Manual", { sentBy: by }));
    }
  }
  if (entries.length > 0) {
    outbox = [...entries, ...outbox];
    emit();
  }
  return entries.length;
}

/** Send the same message again, on the same channel, recorded as a repeat
 *  rather than as a fresh first notice.
 *
 *  Reuses the original entry's subject, body and preview line verbatim
 *  rather than recomposing them — a resend is "as the original, unchanged",
 *  not a freshly worded notice for however many days it has now been. */
export function resendEntries(entryIds: string[], by = "s1"): number {
  const wanted = new Set(entryIds);
  const byId = new Map(OBLIGATIONS.map((o) => [o.id, o]));
  const entries: OutboxEntry[] = [];
  for (const e of outbox) {
    if (!wanted.has(e.id)) continue;
    const o = byId.get(e.obligationId);
    if (!o || !chaseable(o)) continue;
    entries.push({
      ...e,
      id: `ob-${serial++}`,
      sentAt: NOW,
      status: outcome(`${e.id}|resend|${serial}`, NOW),
      origin: "Manual",
      sentBy: by,
      resendOf: e.id,
      attempt: e.attempt + 1,
    });
  }
  if (entries.length > 0) {
    outbox = [...entries, ...outbox];
    emit();
  }
  return entries.length;
}

/** Every failed message, tried again. The one bulk action this log needs:
 *  a failure means the client was never actually told. */
export function retryFailed(by = "s1"): number {
  return resendEntries(outbox.filter((e) => e.status === "Failed").map((e) => e.id), by);
}

/**
 * Release everything held for quiet hours, now.
 *
 * Live status is re-checked per message before it goes out. A message held
 * overnight can have been settled by morning — the client rings in, someone
 * marks it filed — and releasing it anyway chases a client for a return this
 * same app shows as filed. That is the one failure a reminder system cannot
 * recover from, and the engine's own rule at the top of this section says a
 * step is evaluated at SEND time; a held message is sent here, so this is send
 * time. `resendEntries` has always guarded this; releasing did not.
 *
 * The wording is re-checked too, not just the status. A message queued last
 * night was composed against that moment — "due today", a days-overdue count
 * — and hours or a weekend can pass before it actually reaches the wire.
 * Re-running `composeFor` here means the client reads the day it actually
 * received the message, never the day it was originally drafted.
 *
 * Cancelled messages stay in the log with a status of their own rather than
 * being deleted, so "why didn't this go?" has an answer.
 */
export function releaseQueued(): { sent: number; cancelled: number } {
  const byId = new Map(OBLIGATIONS.map((o) => [o.id, o]));
  let sent = 0;
  let cancelled = 0;
  outbox = outbox.map((e) => {
    if (!e.status.startsWith("Queued")) return e;
    const o = byId.get(e.obligationId);
    if (!o || !chaseable(o)) {
      cancelled++;
      return { ...e, status: "Cancelled" as DeliveryStatus };
    }
    sent++;
    return { ...e, ...composeFor(o, e.channel, e.kind), status: outcome(`${e.id}|rel`, NOW), sentAt: NOW };
  });
  if (sent > 0 || cancelled > 0) emit();
  return { sent, cancelled };
}

export function getOutbox(): OutboxEntry[] {
  return outbox;
}

/* --------------------------------------------------------------------------
   SEEDED HISTORY
   --------------------------------------------------------------------------
   Walked back through the same ladder that drives the future, so the log and
   the schedule tell one consistent story: a message in the log is one the
   cadence explains, at an hour the cadence would have chosen.

   Bounded on purpose. Every past step against every unfiled obligation would
   be six figures of rows — a realistic number for a real firm and a useless
   one for a prototype, since nothing on screen reads past the first few
   hundred. The seed takes the most recent slice and stops.
   ------------------------------------------------------------------------- */
(function seedOutbox() {
  const past = computeSends("0000", NOW)
    .sort((a, z) => z.fireAt.localeCompare(a.fireAt));

  /* EVERY past batch is marked settled, not just the ones written out below.
     Otherwise the first scheduler tick would treat a year of history as
     newly due and dump thousands of backdated messages into the log — the
     system's worst possible first impression, and in production an actual
     mail-out. History is closed; only the future is pending. */
  for (const send of past) fired.add(send.key);

  const entries: OutboxEntry[] = [];
  const byId = new Map(OBLIGATIONS.map((o) => [o.id, o]));

  /* The most recent batch PER COMPLIANCE, rather than the most recent batches
     outright. Taken outright, the log is whatever happened to fall in the last
     fortnight — which in this book is GST and Income Tax and nothing else, so
     a head filter has two values to offer and the screen misrepresents the
     spread of a real practice's correspondence. One per compliance gives the
     log the shape the book actually has. */
  const perCompliance = new Map<string, typeof past>();
  for (const s of past) {
    const list = perCompliance.get(s.defCode);
    if (list) list.push(s);
    else perCompliance.set(s.defCode, [s]);
  }
  const spread = [...perCompliance.values()]
    .flatMap((list) => list.slice(0, 2))
    .sort((a, z) => z.fireAt.localeCompare(a.fireAt))
    .slice(0, 30);

  for (const send of spread) {
    /* A slice per batch rather than the whole run: the point is a plausible
       spread of clients, channels and outcomes, not a full mail-merge. */
    for (const id of send.obligationIds.slice(0, 13)) {
      const o = byId.get(id);
      if (!o) continue;
      const owner = ownerOf(o);
      if (!owner) continue;
      const r = h(`${id}|${send.step.id}`);
      /* Real sends scatter across the minutes after a batch starts rather
         than all landing on the same second. */
      const at = stamp(dateOf(send.fireAt), send.step.sendAt, Math.floor(r * 58));
      for (const ch of send.step.channels) {
        if (ch === "WhatsApp" && !owner.whatsapp) continue;
        entries.push(entryFor(o, ch, send.step.stage, send.step.id, at, "Automatic"));
      }
    }
  }

  /* A handful of hand-sent chases on top, so the log shows both origins and
     the "sent by" column has something to say.
     Every fifth one goes out at 21:00-odd — a real thing staff do at the end
     of a bad day, and the only way an entry can land in the quiet-hours hold:
     the scheduler itself never picks an hour outside the window, so without
     these the held state would exist in the code and nowhere on screen. */
  const manual = OBLIGATIONS.filter(
    (o) => o.fy === FY_START && o.status === "Overdue" && DEF_BY_CODE[o.defCode].clientFacing,
  ).slice(0, 22);
  manual.forEach((o, i) => {
    const r = h(`${o.id}|manual`);
    const late = i % 5 === 0;
    const hour = late ? 21 : 12 + Math.floor(r * 5);
    /* Never stamp a send after `NOW`. A 21:00 entry dated today would be a
       message the log claims to have already sent four hours from now, which
       the relative column renders, correctly and absurdly, as "in 4h". Any
       hour past the current one belongs to a previous day. */
    const daysBack = Math.floor(r * 4) + (hour > 17 ? 1 : 0);
    const at = stamp(addDays(TODAY, -daysBack), hour, Math.floor(r * 59));
    entries.push(entryFor(o, "Email", "Overdue escalation", "p1", at, "Manual", {
      sentBy: ["s1", "s2", "s3"][Math.floor(r * 3)],
    }));
  });

  outbox = entries.sort((a, z) => z.sentAt.localeCompare(a.sentAt));
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

/* ==========================================================================
   COMPLETED FILINGS, BY MONTH
   --------------------------------------------------------------------------
   Aggregated per filing run — one row is "GSTR-3B July, 88 clients", never 88
   rows. The dashboard's "filed this month" figure is a count of obligations,
   so opening it has to break down along the same axis the work is organised
   by, not spill a client list nobody can read at 10,000.
   ========================================================================== */

/** One completed filing inside a group — enough to prove it happened. */
export interface FiledRow {
  ownerType: RecordType;
  clientId: string;
  filedOn: string;
  basis: StatusBasis;
  arn?: string;
  filedBy?: string;
}

export interface FiledGroup {
  runId: string;
  defCode: string;
  form: string;
  head: Head;
  periodLabel: string;
  dueDate: string;
  count: number;
  rows: FiledRow[];
  /** How many of `rows` carry no acknowledgement number. Bulk marking cannot
   *  collect one per client, so this is expected to be non-zero — it is here so
   *  the gap can be seen and worked through, not treated as a fault. */
  withoutArn: number;
  /** Latest filing date in the group, for ordering by recency. */
  lastFiledOn: string;
}

/** `month` is a `yyyy-mm` key. Scoped to the current year, like the
 *  Dashboard tile this drawer opens from — it has no year selector of its
 *  own, so silently paging into a retired year's history would be a
 *  scope change nothing on screen explains. */
export function filedInMonth(month: string): FiledGroup[] {
  const map = new Map<string, FiledGroup>();
  for (const o of allObligations()) {
    if (o.fy !== FY_START) continue;
    if (o.status !== "Filed" || !o.filedOn) continue;
    if (o.filedOn.slice(0, 7) !== month) continue;
    let g = map.get(o.runId);
    if (!g) {
      g = {
        runId: o.runId,
        defCode: o.defCode,
        form: o.form,
        head: o.head,
        periodLabel: o.periodLabel,
        dueDate: o.dueDate,
        count: 0,
        rows: [],
        withoutArn: 0,
        lastFiledOn: o.filedOn,
      };
      map.set(o.runId, g);
    }
    g.count++;
    g.rows.push({
      ownerType: o.ownerType,
      clientId: o.clientId,
      filedOn: o.filedOn,
      basis: o.basis,
      arn: o.arn,
      filedBy: o.filedBy,
    });
    if (!o.arn) g.withoutArn++;
    if (o.filedOn > g.lastFiledOn) g.lastFiledOn = o.filedOn;
  }
  /* Most work first — that is what "what did we get through" means. */
  return [...map.values()].sort((a, b) => b.count - a.count || a.form.localeCompare(b.form));
}

/** Months that actually have completed filings, newest first — so the drawer's
 *  month stepper can only land somewhere with something to show. */
export function monthsWithFilings(): string[] {
  const set = new Set<string>();
  for (const o of allObligations()) {
    if (o.fy === FY_START && o.status === "Filed" && o.filedOn) set.add(o.filedOn.slice(0, 7));
  }
  return [...set].sort().reverse();
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
