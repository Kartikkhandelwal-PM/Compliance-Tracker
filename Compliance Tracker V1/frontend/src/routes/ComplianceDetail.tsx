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

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useObligations } from "../ui/app-state.tsx";
import {
  CORR_BASE_CODE, DEF_BY_CODE, FY_OPTIONS, FY_START, OCCURRENCES_BY_FY, SEEDED_FYS, fyLabel, headClass,
} from "../domain/catalog.ts";
import { TODAY, countdown, fmtLong, inrShort, iso } from "../domain/dates.ts";
import { Countdown, Empty, PageHead, Pbar } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";

/** Compliances whose window stays open for years, not one — ITR-U (up to
 *  48 months) and the TDS correction statements (2 years). At any moment
 *  several origin years' windows are open at once (this AY's, and the one
 *  before it, and the one before that...), all equally live — "due this
 *  specific year" would only ever catch the single cohort closing that
 *  year and hide the rest, which are just as open and just as actionable.
 *  So instead of a year picker, every currently-open origin year shows
 *  together; the engine already stops generating one the moment its window
 *  closes (see `lookbackFYs`), so this list is never anything to page
 *  through, just whatever is still live right now. */
const LONG_TAIL_CODES = new Set(["ITR-U", "24Q-CORR", "26Q-CORR", "27Q-CORR", "27EQ-CORR"]);

/** The current book year's own close — 31 March of the year after
 *  `FY_START`. Doubles as the cutoff for whether a not-yet-open long-tail
 *  period is worth previewing at all: one due to open before this FY is
 *  out is worth a "coming soon" row; one that only opens once the NEXT FY
 *  starts (24Q-CORR's Q4, whose original isn't even due till 31 May) isn't
 *  — there is a whole year of nothing to say about it before that's true. */
const CURRENT_FY_END = iso(FY_START + 1, 3, 31);

export function ComplianceDetailPage() {
  const { code = "" } = useParams();
  const nav = useNavigate();
  const obligations = useObligations();
  const def = DEF_BY_CODE[decodeURIComponent(code)];
  const longTail = def ? LONG_TAIL_CODES.has(def.code) : false;
  const [fy, setFy] = useState(FY_START);
  const seeded = SEEDED_FYS.includes(fy);

  /* Every occurrence of this compliance due inside the picked year's own
     Apr–Mar span — by due date, not by the `fy` tag, so a compliance tagged
     to the year it corrects rather than the year it's due (see `longTail`
     below) still lands under the year it's actually due in when it does
     have exactly one such year. For the year ahead there is no client book
     yet, so periods fall back to the statutory calendar with every count
     left at zero — the same two-layer approach Calendar uses — but only
     once there's genuinely no real obligation to show instead. */
  const periods = useMemo(() => {
    if (!def) return [];
    if (longTail) {
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
      /* A period where every client came back Not Applicable never had
         anything to act on yet — for ITR-U that's a not-yet-started
         assessment year, for a TDS correction it's a quarter whose original
         hasn't been filed yet (see `tdsCorrectionApplicability` /
         `itrUApplicability` in rules.ts). Whether it's worth a "coming
         soon" row depends on how far off that still is. A quarter's
         correction opens once its original is due, worth flagging when
         that's still within this FY — 24Q-CORR's Q4 is the one case where
         it isn't: that original isn't even due till 31 May, a good two
         months into the NEXT FY. ITR-U's not-yet-open year is always the
         CURRENT, still-running one — it only opens on this FY's very last
         day, so for practically this whole year there's nothing coming
         soon about it either; it never gets a preview row, just like Q4. */
      const opensWithinThisFY = (p: { periodLabel: string }) => {
        if (def.code === "ITR-U") return false;
        const baseCode = CORR_BASE_CODE[def.code];
        const original = obligations.find((o) => o.defCode === baseCode && o.periodLabel === p.periodLabel);
        return original !== undefined && original.dueDate <= CURRENT_FY_END;
      };
      return [...m.values()]
        .filter((p) => p.filed > 0 || p.pending > 0 || p.overdue > 0 || opensWithinThisFY(p))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }
    const from = `${fy}-04-01`;
    const to = `${fy + 1}-03-31`;
    const m = new Map<string, {
      runId: string; periodLabel: string; dueDate: string;
      filed: number; pending: number; overdue: number; na: number; fees: number;
    }>();
    for (const o of obligations) {
      if (o.defCode !== def.code || o.dueDate < from || o.dueDate > to) continue;
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
    if (m.size > 0) return [...m.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (!seeded) {
      return OCCURRENCES_BY_FY[fy]
        .filter((occ) => occ.defCode === def.code && occ.dueDate >= from && occ.dueDate <= to)
        .map((occ) => ({
          runId: occ.runId, periodLabel: occ.periodLabel, dueDate: occ.dueDate,
          filed: 0, pending: 0, overdue: 0, na: 0, fees: 0,
        }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }
    return [];
  }, [obligations, def, fy, seeded, longTail]);

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
          <div className="u-row">
            {longTail ? (
              <span
                className="tag tag--outline"
                title="This compliance's window stays open for years, not one, so every year still open shows together instead of a single year at a time."
              >
                All years
              </span>
            ) : (
              <select
                className="plain"
                value={fy}
                onChange={(e) => setFy(Number(e.target.value))}
                aria-label="Financial year"
              >
                {FY_OPTIONS.map((y) => (
                  <option key={y} value={y}>{fyLabel(y)}</option>
                ))}
              </select>
            )}
            <Link to="/compliances" className="btn btn--sm">
              <Icon name="chevronLeft" size={14} /> All compliances
            </Link>
          </div>
        }
      />

      {/* ---- What this compliance is ------------------------------------
           Three short facts on one line, then the two long ones (who it applies
           to, what it costs) side by side underneath. The previous version
           flowed all six through an auto-fit grid, so "If missed" wrapped to
           three lines while "Filed by" was stranded alone on a second row with
           a large hole beside it.

           "Filed by" (client-files vs. firm-files) used to sit here as a
           single fixed label for the whole compliance type, on a page that
           covers every client at once — but who actually filed is a
           per-obligation fact (see the Source column two clicks in, on
           Filing Run Detail), not one true answer for all of them. Showing
           it here read as a universal claim it couldn't back up, so it's
           gone from this aggregate view; the real, per-client answer is
           still visible where there's an actual obligation to point at. */}
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
        <Stat2
          label={longTail ? "Open periods" : "Dates this year"}
          value={periods.length}
          sub={longTail ? "across every seeded year" : fyLabel(fy)}
        />
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
              /* longTail-only: kept as a preview (see `opensWithinThisFY`
                 above) but still nothing to act on yet. */
              const notYetOpen = longTail && p.filed === 0 && p.pending === 0 && p.overdue === 0;
              return (
                /* The whole row navigates. Previously only the period text and
                   the chevron were links, so clicking the due date, the
                   countdown or the progress bar did nothing at all, which is
                   most of the row's width. */
                <tr
                  key={p.runId}
                  className={`is-clickable${notYetOpen ? " is-muted" : ""}`}
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
                    {notYetOpen ? (
                      <span
                        className="tag tag--outline"
                        title="Nothing to act on yet — the return this would correct hasn't been filed for this period. It'll open on its own once it has."
                      >
                        Not open yet
                      </span>
                    ) : p.pending === 0 && p.overdue === 0 ? (
                      /* Nothing left open this period — filed (or ruled not
                         applicable) across the board. `Countdown` colours
                         purely off the calendar date, so a past due date
                         still painted itself red here even with nothing
                         outstanding, which read as a problem where there
                         wasn't one. Same wording, neutral colour instead. */
                      <span className="cd cd--calm">{countdown(p.dueDate)}</span>
                    ) : (
                      <Countdown due={p.dueDate} />
                    )}
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
          longTail ? (
            <Empty title="No open periods">
              No client currently has this one open in any seeded year.
            </Empty>
          ) : (
            <Empty title="No dates in this financial year">
              This compliance has no occurrences seeded for {fyLabel(fy)}.
            </Empty>
          )
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
