/* ============================================================================
   ENTRY PANELS — what a CA needs on the first screen after login
   ----------------------------------------------------------------------------
   V2 makes the tracker the landing page of Spectrum Cloud, so the dashboard
   gains panels that answer the questions a partner asks before anything else:
   which app do I open, what corrections are still open, where is money
   leaking, what big dates are coming, which reminders did not land, and what
   work has nobody on it. Every row opens the screen that resolves it.
   ========================================================================== */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { FilingRun, Head, Obligation, OutboxEntry } from "../domain/types.ts";
import { CLIENT_BY_ID } from "../domain/book.ts";
import { TODAY, addDays, fmtShort, inrShort } from "../domain/dates.ts";
import { getNotices, taxLiabilitySummary } from "../domain/engine.ts";
import { daysToReply, needsReply, urgencyOf } from "../domain/notices.ts";
import { useEngine } from "./app-state.tsx";
import { Icon } from "./Icon.tsx";

const n = (v: number) => v.toLocaleString("en-IN");
const daysLeft = (d: string) => Math.round((Date.parse(d) - Date.parse(TODAY)) / 864e5);

function clientName(id: string): string {
  return CLIENT_BY_ID[id]?.name ?? id;
}

/* ---- Apps: the jump-off into each head ----------------------------------- */

const APPS: { head: Head; label: string; mark: string; cls: string }[] = [
  { head: "GST", label: "GST", mark: "G", cls: "head-gst" },
  { head: "TDS", label: "TDS", mark: "T", cls: "head-tds" },
  { head: "Income Tax", label: "Income Tax", mark: "I", cls: "head-it" },
  { head: "ROC/MCA", label: "ROC / MCA", mark: "R", cls: "head-roc" },
];

export function AppStrip({ obligations }: { obligations: Obligation[] }) {
  const nav = useNavigate();
  const counts = useMemo(() => {
    const m: Record<string, { open: number; late: number }> = {};
    for (const a of APPS) m[a.head] = { open: 0, late: 0 };
    for (const o of obligations) {
      const head = o.head === "ROC/MCA (LLP)" ? "ROC/MCA" : o.head;
      const c = m[head];
      if (!c) continue;
      if (o.status === "Pending") c.open++;
      if (o.status === "Overdue") { c.open++; c.late++; }
    }
    return m;
  }, [obligations]);

  return (
    <section className="ep-apps" aria-label="Open an app">
      {APPS.map((a) => {
        const c = counts[a.head];
        return (
          <button key={a.head} type="button" className="ep-app" onClick={() => nav(`/tracker?head=${encodeURIComponent(a.head)}`)}>
            <span className={`ep-app__mark ${a.cls}`}>{a.mark}</span>
            <span className="ep-app__txt">
              <b>{a.label}</b>
              <small>{n(c.open)} open{c.late ? <> · <em>{n(c.late)} late</em></> : null}</small>
            </span>
            <span className="ep-app__go">Open <Icon name="chevronRight" size={14} /></span>
          </button>
        );
      })}
    </section>
  );
}

/* ---- Corrections still open ---------------------------------------------- */

const CORRECTION_GROUPS: { key: string; label: string; codes: string[]; note: string }[] = [
  { key: "gstr1a", label: "GSTR-1A", codes: ["GSTR-1A", "GSTR-1A-QRMP-A", "GSTR-1A-QRMP-B"], note: "Closes when that period's GSTR-3B is filed" },
  { key: "itrrev", label: "Revised ITR", codes: ["ITR-REVISED"], note: "Window open until 31 Dec of the assessment year" },
  { key: "itru", label: "Updated return (ITR-U)", codes: ["ITR-U"], note: "Up to 48 months from the end of the AY" },
  { key: "tdscorr", label: "TDS / TCS corrections", codes: ["24Q-CORR", "26Q-CORR", "27Q-CORR", "27EQ-CORR"], note: "Up to 2 years from the end of the FY" },
];

export const CORRECTION_CODES = new Set(CORRECTION_GROUPS.flatMap((g) => g.codes));

export function CorrectionsCard({ obligations }: { obligations: Obligation[] }) {
  const nav = useNavigate();
  const rows = useMemo(() => CORRECTION_GROUPS.map((g) => {
    const open = obligations.filter((o) => g.codes.includes(o.defCode) && o.status === "Pending");
    const soonest = open.reduce<string | null>((d, o) => (d === null || o.dueDate < d ? o.dueDate : d), null);
    const closingSoon = open.filter((o) => o.dueDate <= addDays(TODAY, 30)).length;
    const clients = new Set(open.map((o) => o.clientId)).size;
    return { ...g, open: open.length, clients, soonest, closingSoon };
  }), [obligations]);
  const total = rows.reduce((a, r) => a + r.open, 0);
  const closing = rows.reduce((a, r) => a + r.closingSoon, 0);

  /* Same template as Penalty running: title + link, hero number, clean list. */
  return (
    <div className="ec ec--blue">
      <CardHead title="Corrections open" link="All compliances" onLink={() => nav("/compliances")} icon="history" tone="blue" />
      <div className="ec__hero">
        <b className="num">{n(total)}</b>
        <span>correction windows open{closing ? <>, <em className="ec__red">{n(closing)} close in 30 days</em></> : null}</span>
      </div>
      <div className="ec__label">By type</div>
      <ul className="ec__list">
        {rows.map((r) => (
          <li key={r.key}>
            <button type="button" onClick={() => nav(`/compliances?open=${encodeURIComponent(r.codes[0])}`)}>
              <span className="ec__main">
                <b>{r.label}</b>
                <small>{r.soonest ? <>{n(r.clients)} clients · next closes {fmtShort(r.soonest)}</> : r.note}</small>
              </span>
              {r.soonest && daysLeft(r.soonest) <= 90 ? <span className={`ec__count${daysLeft(r.soonest) <= 7 ? " is-soon" : ""}`}>closes in {daysLeft(r.soonest)} days</span> : null}
              <span className={`ec__val num${r.open ? "" : " ep-muted"}`}>{n(r.open)}</span>
              <Icon name="chevronRight" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Tax liability, and the clients carrying the most --------------------- */

/* Each card carries its own colour and icon so they are told apart at a glance. */
function CardHead({ title, link, onLink, icon, tone }: { title: string; link: string; onLink: () => void; icon?: Parameters<typeof Icon>[0]["name"]; tone?: string }) {
  return (
    <div className="ec__head">
      <h3>{icon ? <span className={`ec__ic ec__ic--${tone}`}><Icon name={icon} size={15} /></span> : null}{title}</h3>
      <button type="button" className="ep-link" onClick={onLink}>{link} <Icon name="chevronRight" size={13} /></button>
    </div>
  );
}

export function TaxLiabilityCard({ obligations }: { obligations: Obligation[] }) {
  const nav = useNavigate();
  const sum = useMemo(() => taxLiabilitySummary(obligations), [obligations]);
  const max = Math.max(1, ...sum.top.map((t) => t.amount));

  return (
    <div className="ec ec--liability">
      <CardHead title="Tax liability" link="All clients" onLink={() => nav("/clients")} icon="rules" tone="blue" />
      <div className="ec__hero">
        <b className="num">{n(sum.clients)}</b>
        <span>clients with tax due, across {n(sum.filings)} open filings</span>
      </div>
      <div className="ec__label">Largest liabilities</div>
      <ul className="ec__list">
        {sum.top.map((c) => (
          <li key={c.clientId}>
            <button type="button" onClick={() => nav(`/clients/${c.clientId}`)}>
              <span className="ec__main"><b>{clientName(c.clientId)}</b><small>{n(c.filings)} open {c.filings === 1 ? "filing" : "filings"}</small></span>
              <span className="ec__amt">
                <span className="ec__val num">{inrShort(c.amount)}</span>
                <span className="ec__mini"><i style={{ width: `${Math.max(6, (c.amount / max) * 100)}%` }} /></span>
              </span>
              <Icon name="chevronRight" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Notices waiting for a reply ------------------------------------------ */

export function NoticesCard() {
  const nav = useNavigate();
  const notices = useEngine(getNotices);
  const { waiting, late, top } = useMemo(() => {
    const waiting = notices.filter(needsReply);
    const top = [...waiting].sort((a, b) => a.replyDue.localeCompare(b.replyDue)).slice(0, 5);
    return { waiting: waiting.length, late: waiting.filter((x) => urgencyOf(x) === "overdue").length, top };
  }, [notices]);

  return (
    <div className="ec">
      <CardHead title="Notices" link="All notices" onLink={() => nav("/notices")} icon="notice" tone="red" />
      {/* The figure, then one line under it: the same shape as the cards beside
          this one, so the lists below start level. */}
      <div className="ec__hero ec__hero--stack">
        <b className="num">{n(waiting)}</b>
        <span>
          waiting for a reply
          {late ? <>, <span className="ec__red" style={{ fontWeight: 653 }}>{n(late)} overdue</span></> : null}
        </span>
      </div>
      <div className="ec__label">Reply first</div>
      <ul className="ec__list">
        {top.map((x) => {
          const d = daysToReply(x);
          return (
            <li key={x.id}>
              <button type="button" onClick={() => nav(`/notices?open=${x.id}`)}>
                <span className="ec__main"><b>{clientName(x.clientId)}</b><small>{x.type} · {x.dept}</small></span>
                <span className="ec__amt">
                  <span className={`ec__val num${d < 0 ? " ec__red" : ""}`} style={{ fontSize: "var(--t-13)" }}>
                    {d < 0 ? `${-d}d overdue` : d === 0 ? "today" : `${d}d left`}
                  </span>
                </span>
                <Icon name="chevronRight" size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---- Big deadlines ahead -------------------------------------------------- */

export function BigDeadlinesCard({ runs }: { runs: FilingRun[] }) {
  const nav = useNavigate();
  const rows = useMemo(() => runs
    .filter((r) => r.def.frequency === "Annual" && !CORRECTION_CODES.has(r.def.code) && r.dueDate >= TODAY && r.dueDate <= addDays(TODAY, 90) && r.pending > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5), [runs]);
  const notFiled = rows.reduce((a, r) => a + r.pending, 0);

  return (
    <div className="ec ec--purple">
      <CardHead title="Big deadlines ahead" link="Calendar" onLink={() => nav("/calendar")} icon="calendar" tone="purple" />
      <div className="ec__hero">
        <b className="num">{n(notFiled)}</b>
        <span>annual filings still to do in the next 90 days</span>
      </div>
      <ul className="ec__list">
        {rows.map((r) => {
          const done = Math.round((r.filed / Math.max(1, r.total)) * 100);
          const days = daysLeft(r.dueDate);
          return (
            <li key={r.runId}>
              <button type="button" onClick={() => nav(`/runs/${encodeURIComponent(r.runId)}`)}>
                <span className="ec__cal"><small>{fmtShort(r.dueDate).split(" ")[1]}</small><b className="num">{Number(r.dueDate.slice(8, 10))}</b></span>
                <span className="ec__main"><b>{r.def.form}</b><small>{r.periodLabel} · in {days} days · {done}% filed</small></span>
                <span className="ec__val num">{n(r.pending)}<small className="ec__unit">not filed</small></span>
                <Icon name="chevronRight" size={14} />
              </button>
            </li>
          );
        })}
        {rows.length === 0 ? <li className="ep-muted">No annual filings fall in the next 90 days.</li> : null}
      </ul>
    </div>
  );
}

/* ---- Reminders that need a look ------------------------------------------ */

export function RemindersCard({ outbox }: { outbox: OutboxEntry[] }) {
  const nav = useNavigate();
  const c = useMemo(() => {
    let failed = 0, unread = 0, held = 0;
    for (const e of outbox) {
      if (e.status === "Failed") failed++;
      else if (e.status === "Delivered") unread++;
      else if (e.status === "Queued (quiet hours)") held++;
    }
    return { failed, unread, held };
  }, [outbox]);
  const rows = [
    { k: "failed", label: "Failed to send", sub: "Wrong number or email, or blocked. Fix and resend.", v: c.failed, tone: "red" },
    { k: "delivered", label: "Delivered, not opened", sub: "The client has not read it yet. Follow up.", v: c.unread, tone: "blue" },
    { k: "held", label: "Held for quiet hours", sub: "Goes out in the next sending window.", v: c.held, tone: "grey" },
  ];
  return (
    <div className="ec ec--amber">
      <CardHead title="Reminders that need a look" link="Reminders" onLink={() => nav("/reminders")} icon="send" tone="amber" />
      <div className="ec__hero">
        <b className={`num${c.failed ? " ec__red" : ""}`}>{n(c.failed)}</b>
        <span>failed to reach the client</span>
      </div>
      <ul className="ec__list">
        {rows.map((r) => (
          <li key={r.k}>
            <button type="button" onClick={() => nav(`/reminders?status=${r.k}`)}>
              <i className={`ec__dot ec__dot--${r.tone}`} />
              <span className="ec__main"><b>{r.label}</b><small>{r.sub}</small></span>
              <span className="ec__val num">{n(r.v)}</span>
              <Icon name="chevronRight" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Unassigned work ------------------------------------------------------ */

export function UnassignedCard({ obligations }: { obligations: Obligation[] }) {
  const nav = useNavigate();
  const { total, late, byHead } = useMemo(() => {
    let total = 0, late = 0;
    const byHead: Record<string, number> = {};
    for (const o of obligations) {
      if (o.status !== "Pending" && o.status !== "Overdue") continue;
      /* Same rule as the Unowned tile (engine summarise): owner set to "none". */
      if (o.assigneeId !== "none") continue;
      total++;
      if (o.status === "Overdue") late++;
      byHead[o.head] = (byHead[o.head] ?? 0) + 1;
    }
    return { total, late, byHead: Object.entries(byHead).sort((a, b) => b[1] - a[1]) };
  }, [obligations]);
  return (
    <div className="ec">
      <CardHead title="Work with no owner" link="Assign owners" onLink={() => nav("/clients?owner=none")} />
      <div className="ec__hero">
        <b className="num">{n(total)}</b>
        <span>open items nobody is working on{late ? <>, <em className="ec__red">{n(late)} already late</em></> : null}</span>
      </div>
      <StackBar parts={byHead.map(([h, v]) => ({ label: h, value: v, cls: HEAD_CLS[h] ?? "head-other" }))} />
    </div>
  );
}

const HEAD_CLS: Record<string, string> = {
  GST: "head-gst", TDS: "head-tds", "Income Tax": "head-it", "ROC/MCA": "head-roc", "ROC/MCA (LLP)": "head-llp", "Other Statutory": "head-other",
};

/* One horizontal bar split into parts, with a legend underneath. */
function StackBar({ parts }: { parts: { label: string; value: number; cls: string }[] }) {
  const total = Math.max(1, parts.reduce((a, p) => a + p.value, 0));
  return (
    <div className="ec__stack">
      <span className="ec__bar">{parts.map((p) => <i key={p.label} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${n(p.value)}`} />)}</span>
      <ul className="ec__legend">
        {parts.map((p) => <li key={p.label}><i className={p.cls} />{p.label}<b className="num">{n(p.value)}</b></li>)}
      </ul>
    </div>
  );
}

/* Replaces the donut: the year's position as one bar the eye reads left to right. */
export function YearCard({ filed, pending, overdue, na, fy }: { filed: number; pending: number; overdue: number; na: number; fy: string }) {
  const nav = useNavigate();
  const live = filed + pending + overdue;
  const pct = Math.round((filed / Math.max(1, live)) * 100);
  return (
    <div className="ec">
      <CardHead title={`Where ${fy} stands`} link="Tracker" onLink={() => nav("/tracker")} />
      <div className="ec__hero">
        <b className="num">{pct}%</b>
        <span>of this year's {n(live)} filings are done</span>
      </div>
      <StackBar parts={[
        { label: "Filed", value: filed, cls: "st-filed" },
        { label: "Pending", value: pending, cls: "st-pending" },
        { label: "Late", value: overdue, cls: "st-overdue" },
      ]} />
      <p className="ec__note">{n(na)} items that do not apply to a client are not counted.</p>
    </div>
  );
}
