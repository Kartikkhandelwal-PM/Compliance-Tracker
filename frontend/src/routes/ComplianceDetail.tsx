/* ============================================================================
   ONE COMPLIANCE, AND EVERY DATE IT FALLS DUE
   ----------------------------------------------------------------------------
   The middle step of the drill: compliance → dates → clients.

   A compliance like GSTR-3B is not one deadline, it is twelve. This page shows
   the whole recurring series for the financial year, each period with its own
   due date and its own filed / pending / overdue split, so you can see at a
   glance which months are clean and which are carrying arrears. Picking a date
   opens the client list for that date.
   ========================================================================== */

import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useObligations } from "../ui/app-state.tsx";
import { DEF_BY_CODE, FY_LABEL, headClass } from "../domain/catalog.ts";
import { TODAY, countdown, fmtLong, inrShort } from "../domain/dates.ts";
import { Countdown, Empty, PageHead, Pbar, StatusTag } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";

export function ComplianceDetailPage() {
  const { code = "" } = useParams();
  const nav = useNavigate();
  const obligations = useObligations();
  const def = DEF_BY_CODE[decodeURIComponent(code)];

  /* Every occurrence of this compliance, with its live counts. */
  const periods = useMemo(() => {
    if (!def) return [];
    const m = new Map<string, {
      runId: string; periodLabel: string; dueDate: string;
      filed: number; pending: number; overdue: number; na: number; fees: number;
    }>();
    for (const o of obligations) {
      if (o.defCode !== def.code) continue;
      let p = m.get(o.runId);
      if (!p) {
        p = {
          runId: o.runId, periodLabel: o.periodLabel, dueDate: o.dueDate,
          filed: 0, pending: 0, overdue: 0, na: 0, fees: 0,
        };
        m.set(o.runId, p);
      }
      if (o.status === "Filed") p.filed++;
      else if (o.status === "Pending") p.pending++;
      else if (o.status === "Overdue") { p.overdue++; p.fees += o.exposure; }
      else p.na++;
    }
    return [...m.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [obligations, def]);

  const totals = useMemo(() => {
    let filed = 0, pending = 0, overdue = 0, fees = 0, clients = 0;
    for (const p of periods) {
      filed += p.filed; pending += p.pending; overdue += p.overdue; fees += p.fees;
      clients = Math.max(clients, p.filed + p.pending + p.overdue);
    }
    return { filed, pending, overdue, fees, clients };
  }, [periods]);

  if (!def) {
    return (
      <div className="page">
        <Empty title="Compliance not found">
          Nothing in the catalogue matches this code.{" "}
          <Link to="/compliances" style={{ color: "var(--link)" }}>Back to all compliances</Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <PageHead
        title={def.form}
        icon="rules"
        note={<>{def.description}</>}
        aside={
          <Link to="/compliances" className="btn btn--sm">
            <Icon name="chevronLeft" size={14} /> All compliances
          </Link>
        }
      />

      {/* ---- What this compliance is ------------------------------------
           Four short facts on one line, then the two long ones (who it applies
           to, what it costs) side by side underneath. The previous version
           flowed all six through an auto-fit grid, so "If missed" wrapped to
           three lines while "Filed by" was stranded alone on a second row with
           a large hole beside it. */}
      <div className="cmpabout">
        <div className="cmpabout__row">
          <div className="cmpabout__f">
            <dt>Head</dt>
            <dd className="u-row" style={{ gap: 6 }}>
              <i className={`grouphead__dot ${headClass(def.head)}`} />
              {def.head}
            </dd>
          </div>
          <div className="cmpabout__f">
            <dt>Frequency</dt>
            <dd>{def.frequency}</dd>
          </div>
          <div className="cmpabout__f">
            <dt>Due date rule</dt>
            <dd>{def.dueRule}</dd>
          </div>
          <div className="cmpabout__f">
            <dt>Filed by</dt>
            <dd>{def.clientFacing ? "Client files; firm sends reminders" : "Filed by the firm"}</dd>
          </div>
        </div>
        <div className="cmpabout__row cmpabout__row--wide">
          <div className="cmpabout__f">
            <dt>Applies to</dt>
            <dd>{def.applicability}</dd>
          </div>
          <div className="cmpabout__f">
            <dt>If missed</dt>
            <dd>{def.lateFee.note}</dd>
          </div>
        </div>
      </div>

      <div className="stats" style={{ margin: "var(--s4) 0" }}>
        <Stat2 label="Dates this year" value={periods.length} sub={FY_LABEL} />
        <Stat2 label="Clients it applies to" value={totals.clients.toLocaleString("en-IN")} sub="at its widest period" />
        <Stat2 label="Filed" value={totals.filed.toLocaleString("en-IN")} sub="across all periods" tone="filed" />
        <Stat2
          label="Overdue"
          value={totals.overdue.toLocaleString("en-IN")}
          sub={totals.fees > 0 ? `${inrShort(totals.fees)} late fees` : "nothing late"}
          tone={totals.overdue > 0 ? "overdue" : undefined}
        />
      </div>

      {/* ---- Every date ------------------------------------------------- */}
      <div className="sheet">
        <table className="ltable">
          <thead>
            <tr>
              <th>Period</th>
              <th>Due date</th>
              <th>Countdown</th>
              <th style={{ width: 170 }}>Progress</th>
              <th className="u-right">Filed</th>
              <th className="u-right">Open</th>
              <th className="u-right">Late fees</th>
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              const past = p.dueDate < TODAY;
              return (
                /* The whole row navigates. Previously only the period text and
                   the chevron were links, so clicking the due date, the
                   countdown or the progress bar did nothing at all, which is
                   most of the row's width. */
                <tr
                  key={p.runId}
                  className="is-clickable"
                  onClick={() => nav(`/runs/${encodeURIComponent(p.runId)}`)}
                >
                  <td>
                    <Link
                      to={`/runs/${encodeURIComponent(p.runId)}`}
                      className="u-strong"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.periodLabel}
                    </Link>
                  </td>
                  <td className="num">{fmtLong(p.dueDate)}</td>
                  <td>
                    {p.overdue > 0
                      ? <StatusTag status="Overdue" label={countdown(p.dueDate)} />
                      : <Countdown due={p.dueDate} />}
                  </td>
                  <td>
                    <Pbar filed={p.filed} pending={p.pending} overdue={p.overdue} />
                  </td>
                  <td className="u-right num">{p.filed}</td>
                  <td className="u-right num">{p.pending + p.overdue}</td>
                  <td className="u-right num" style={{ color: p.fees ? "var(--st-overdue-fg)" : "var(--ink-4)", fontWeight: p.fees ? 600 : 400 }}>
                    {p.fees ? inrShort(p.fees) : (past ? "nil" : "—")}
                  </td>
                  <td className="u-faint"><Icon name="chevronRight" size={14} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {periods.length === 0 ? (
          <Empty title="No dates in this financial year">
            This compliance has no occurrences seeded for {FY_LABEL}.
          </Empty>
        ) : (
          <div className="sheet__foot">Pick a period to see every client on that date and where each one stands.</div>
        )}
      </div>
    </div>
  );
}

/* A local stat tile: same shape as the dashboard's, without the icon chip,
   because six of them in a row here would be noise rather than navigation. */
function Stat2({
  label, value, sub, tone,
}: { label: string; value: React.ReactNode; sub?: string; tone?: "overdue" | "filed" }) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ""}`}>
      <div className="stat__top"><div className="stat__label">{label}</div></div>
      <div className={`stat__value${tone ? ` v-${tone}` : ""}`}>{value}</div>
      {sub ? <div className="stat__sub">{sub}</div> : null}
    </div>
  );
}
