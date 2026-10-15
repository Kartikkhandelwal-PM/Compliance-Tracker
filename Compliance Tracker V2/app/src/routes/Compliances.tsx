/* ============================================================================
   COMPLIANCES — V2: one list that answers "where does each form stand"
   ----------------------------------------------------------------------------
   V1 showed the catalogue as large cards of static facts (frequency, due rule,
   applies to), with the live position squeezed into a corner chip. Finding
   out what was late, or what was next, meant opening a card, then a period,
   then the clients: three hops.

   V2 turns the catalogue into a Jira-style list. Each row carries the live
   position first (next due date, progress on that period, late count and
   fees), and expands in place to show the rules and every period of the year,
   each with a button straight to its clients. The summary tiles double as
   filters. The full compliance page is still one link away.
   ========================================================================== */

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEngine, useObligations } from "../ui/app-state.tsx";
import { buildRuns, untrackedCodes } from "../domain/engine.ts";
import { DEFS, FY_OPTIONS, FY_START, HEADS, fyLabel, headClass } from "../domain/catalog.ts";
import type { ComplianceDef, FilingRun } from "../domain/types.ts";
import { TODAY, addDays, fmtShort, inrShort } from "../domain/dates.ts";
import { Empty, PageHead } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";
import { CORRECTION_CODES } from "../ui/EntryPanels.tsx";
import { FilterPillMulti } from "../ui/Filters.tsx";

type Quick = "all" | "late" | "week" | "corrections";
type Sort = "late" | "due" | "fees";
/* Each tab implies its own order, so there is no sort control:
   everything by most late, late filings by money lost, due-soon and
   correction windows by the date that closes first. */
const SORT_FOR: Record<Quick, Sort> = { all: "late", late: "fees", week: "due", corrections: "due" };
const FREQS = ["Monthly", "Quarterly", "Half-yearly", "Annual"];

const n = (v: number) => v.toLocaleString("en-IN");
const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(TODAY)) / 864e5);

function DueCell({ run }: { run: FilingRun | undefined }) {
  if (!run) return <span className="cl-muted">No date this year</span>;
  const d = daysTo(run.dueDate);
  return (
    <>
      <span className="num">{fmtShort(run.dueDate)}</span>
      <small className={d < 0 ? "cl-late" : d <= 7 ? "cl-soon" : ""}>
        {d < 0 ? `${-d} days overdue` : d === 0 ? "due today" : `in ${d} days`}
      </small>
    </>
  );
}

function Progress({ run }: { run: FilingRun }) {
  const total = Math.max(1, run.total);
  const f = (run.filed / total) * 100;
  const o = (run.overdue / total) * 100;
  return (
    <div className="cl-prog" title={`${n(run.filed)} filed · ${n(run.pending)} open · ${n(run.overdue)} late`}>
      <span className="cl-prog__bar">
        <i className="is-filed" style={{ width: `${f}%` }} />
        <i className="is-late" style={{ width: `${o}%` }} />
      </span>
      <small className="num">{n(run.filed)} of {n(run.total)} filed</small>
    </div>
  );
}

/* One-line summary of the late-fee rule; the full statutory note sits under it. */
function feeShort(f: ComplianceDef["lateFee"]): string {
  switch (f.kind) {
    case "perDay": return `₹${n(f.amount)} per day${f.nilAmount ? ` (₹${n(f.nilAmount)} if nil)` : ""}${typeof f.cap === "number" ? `, up to ₹${n(f.cap)}` : ""}`;
    case "flat": return f.amount ? `₹${n(f.amount)} flat penalty` : "No late fee";
    case "s234f": return "Late fee under section 234F";
    case "interest": return `Interest at ${f.monthlyPct}% per month`;
    case "turnoverPct": return `${f.pct}% of turnover, up to ₹${n(f.cap)}`;
  }
}

function YearStats({ runs, clients }: { runs: FilingRun[]; clients: number }) {
  let filed = 0, open = 0, late = 0, fees = 0, total = 0;
  for (const r of runs) { filed += r.filed; open += r.pending; late += r.overdue; fees += r.exposure; total += r.total; }
  const pct = total ? Math.round((filed / total) * 100) : 0;
  const cells: [string, string, string?][] = [
    ["Due dates", n(runs.length)],
    ["Clients", n(clients)],
    ["Filed", n(filed), "filed"],
    ["Open, not late", n(open)],
    ["Late", n(late), late ? "late" : undefined],
    ["Late fees so far", fees ? inrShort(fees) : "Nil", fees ? "late" : undefined],
  ];
  return (
    <>
      <div className="cl-yearbar" title={`${pct}% of the year's filings are done`}>
        <span className="cl-prog__bar"><i className="is-filed" style={{ width: `${(filed / Math.max(1, total)) * 100}%` }} /><i className="is-late" style={{ width: `${(late / Math.max(1, total)) * 100}%` }} /></span>
        <small><b>{pct}%</b> of {n(total)} filings done</small>
      </div>
      <dl className="cl-stats">
        {cells.map(([k, v, tone]) => (
          <div key={k}><dt>{k}</dt><dd className={`num${tone ? ` is-${tone}` : ""}`}>{v}</dd></div>
        ))}
      </dl>
    </>
  );
}

/** Compliances whose windows run across several years, so the year picker does not apply. */
const ALL_YEARS_CODE = "ITR-U";

export function CompliancesPage() {
  const obligations = useObligations();
  const untracked = useEngine(untrackedCodes);
  const nav = useNavigate();
  /* Head and frequency each take several values; empty means all. */
  const [heads, setHeads] = useState<string[]>([]);
  const [quick, setQuick] = useState<Quick>("all");
  const [fy, setFy] = useState(FY_START);
  const [params] = useSearchParams();
  /* `?open=GSTR-1` lands with that row already expanded. */
  const [open, setOpen] = useState<string | null>(() => params.get("open"));
  const [freqs, setFreqs] = useState<string[]>([]);

  /* The filter bar is sticky under the top bar and the table header parks
     under the filter bar. The bar wraps on a narrow window, so its height is
     measured rather than assumed. */
  const pageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  /* The main column header's height too: an opened compliance's period table
     freezes its own header directly underneath it. */
  const theadRef = useRef<HTMLTableSectionElement>(null);
  useLayoutEffect(() => {
    const bar = barRef.current, page = pageRef.current;
    if (!bar || !page) return;
    const measure = () => {
      page.style.setProperty("--cl-bar-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
      const th = theadRef.current;
      if (th) page.style.setProperty("--cl-th-h", `${Math.round(th.getBoundingClientRect().height)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    if (theadRef.current) ro.observe(theadRef.current);
    return () => ro.disconnect();
  });

  /* Every period of every compliance in the year, grouped by compliance. */
  const byDef = useMemo(() => {
    /* The updated return is open for 48 months after the assessment year, so its
       open windows sit in earlier years' filings and never in the year picked
       here. It is read across every year, like its own page does, and years that
       have not opened yet are left out. */
    const runs = buildRuns(obligations.filter((o) => o.fy === fy || o.defCode === ALL_YEARS_CODE))
      .filter((r) => r.def.code !== ALL_YEARS_CODE || r.filed + r.pending + r.overdue > 0);
    const m = new Map<string, { runs: FilingRun[]; late: number; fees: number; clients: Set<string>; next?: FilingRun; current?: FilingRun }>();
    for (const r of runs) {
      let s = m.get(r.def.code);
      if (!s) { s = { runs: [], late: 0, fees: 0, clients: new Set() }; m.set(r.def.code, s); }
      s.runs.push(r);
      s.late += r.overdue;
      s.fees += r.exposure;
      for (const c of r.clientIds) s.clients.add(c);
    }
    for (const s of m.values()) {
      s.runs.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      s.next = s.runs.find((r) => r.dueDate >= TODAY && r.pending + r.overdue > 0) ?? s.runs.find((r) => r.dueDate >= TODAY);
      /* The period worth showing progress for: the latest one already due, or
         the next one when nothing has fallen due yet. */
      const due = s.runs.filter((r) => r.dueDate <= TODAY);
      s.current = due[due.length - 1] ?? s.next;
    }
    return m;
  }, [obligations, fy]);

  /* Opening a compliance brings its row to the top of the list, just under
     the frozen headers, so its actions are in view without scrolling. */
  useEffect(() => {
    if (!open) return;
    const row = document.querySelector<HTMLElement>(`tr.cl-row[data-code="${CSS.escape(open)}"]`);
    const root = row?.closest("main.work") as HTMLElement | null;
    const head = document.querySelector<HTMLElement>(".cl-table > thead");
    if (!row || !root || !head) return; void head;
    /* After the panel has laid out, glide the opened row up to sit just
       under the frozen headers. */
    requestAnimationFrame(() => {
      /* Where the header block ends once frozen (it may not be frozen yet). */
      const page = row.closest(".page") as HTMLElement | null;
      const v = (k: string) => parseFloat(page ? getComputedStyle(page).getPropertyValue(k) : "") || 0;
      const top = document.querySelector(".topline")?.getBoundingClientRect().bottom ?? root.getBoundingClientRect().top;
      const frozenBottom = top + 16 + v("--cl-bar-h") + v("--cl-th-h");
      root.scrollTo({ top: root.scrollTop + row.getBoundingClientRect().top - frozenBottom, behavior: "smooth" });
    });
  }, [open]);

  const tracked = useMemo(() => DEFS.filter((d) => !untracked.has(d.code)), [untracked]);

  const totals = useMemo(() => {
    const weekEnd = addDays(TODAY, 7);
    let lateDefs = 0, lateFees = 0, lateFilings = 0, weekDefs = 0, weekFilings = 0, corrDefs = 0, corrOpen = 0;
    for (const d of tracked) {
      const s = byDef.get(d.code);
      if (!s) continue;
      if (s.late > 0) { lateDefs++; lateFees += s.fees; lateFilings += s.late; }
      const wk = s.runs.filter((r) => r.dueDate >= TODAY && r.dueDate <= weekEnd && r.pending > 0);
      if (wk.length) { weekDefs++; weekFilings += wk.reduce((a, r) => a + r.pending, 0); }
      if (CORRECTION_CODES.has(d.code)) {
        const o = s.runs.reduce((a, r) => a + r.pending, 0);
        if (o > 0) { corrDefs++; corrOpen += o; }
      }
    }
    return { lateDefs, lateFees, lateFilings, weekDefs, weekFilings, corrDefs, corrOpen };
  }, [tracked, byDef]);

  const filtered = useMemo(() => {
    const weekEnd = addDays(TODAY, 7);
    return tracked.filter((d) => {
      if (heads.length && !heads.includes(d.head)) return false;
      const s = byDef.get(d.code);
      if (quick === "late" && !(s && s.late > 0)) return false;
      if (quick === "week" && !(s && s.runs.some((r) => r.dueDate >= TODAY && r.dueDate <= weekEnd && r.pending > 0))) return false;
      if (quick === "corrections" && !CORRECTION_CODES.has(d.code)) return false;
      if (freqs.length && !freqs.includes(d.frequency)) return false;
      return true;
    }).sort((a, b) => {
      const sort = SORT_FOR[quick];
      const sa = byDef.get(a.code), sb = byDef.get(b.code);
      const byDue = (sa?.next?.dueDate ?? "9999").localeCompare(sb?.next?.dueDate ?? "9999");
      if (sort === "due") return byDue;
      if (sort === "fees") return (sb?.fees ?? 0) - (sa?.fees ?? 0) || byDue;
      /* Default: forms with work late first, then by next date. */
      return (sb?.late ?? 0) - (sa?.late ?? 0) || byDue;
    });
  }, [tracked, byDef, heads, quick, freqs]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const d of filtered) {
      const list = m.get(d.head);
      if (list) list.push(d); else m.set(d.head, [d]);
    }
    return [...m.entries()].sort((a, b) => HEADS.indexOf(a[0]) - HEADS.indexOf(b[0]));
  }, [filtered]);


  return (
    <div className="page page--wide" ref={pageRef}>
      <PageHead
        title="Compliances"
        icon="rules"
        note={<><b>{filtered.length}</b> of {tracked.length} compliance types</>}
        aside={
          <select className="plain fysel" value={fy} onChange={(e) => setFy(Number(e.target.value))} aria-label="Financial year">
            {FY_OPTIONS.map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
          </select>
        }
      />


      {/* One card: the view tabs and filters are its header strip, then the
          column header, then the rows. Both header layers freeze together. */}
      <div className="cl-card">
      <div className="filters cl-bar" ref={barRef}>
        <div className="cl-bar__row cl-tabsrow">
          <div className="cl-tabs" role="tablist" aria-label="View">
            {([
              ["all", "All compliances", tracked.length, ""],
              ["late", "With late filings", totals.lateDefs, "late"],
              ["week", "Due in 7 days", totals.weekDefs, "soon"],
              ["corrections", "Correction windows", totals.corrDefs, ""],
            ] as [Quick, string, number, string][]).map(([k, label, v, tone]) => (
              <button key={k} type="button" role="tab" aria-selected={quick === k} className={`cl-tab${quick === k ? " is-on" : ""}`} onClick={() => setQuick(k)}>
                {label}<span className={`cl-tab__n${tone ? ` is-${tone}` : ""}`}>{n(v)}</span>
              </button>
            ))}
          </div>
          <span className="u-spacer" />
          {/* One bar: the tabs choose the view, these only narrow the form
              itself. "Due within" was dropped because it fought the
              "Due in 7 days" tab over the same question. */}
          <div className="cl-tools">
            {heads.length || freqs.length ? (
              <button type="button" className="cl-clear" onClick={() => { setHeads([]); setFreqs([]); }}>Clear</button>
            ) : null}
            <FilterPillMulti
              field="Head" noun="heads" values={heads} onChange={setHeads}
              options={HEADS.map((h) => ({ value: h, label: h }))}
            />
            <FilterPillMulti
              field="Frequency" noun="frequencies" values={freqs} onChange={setFreqs}
              options={FREQS.map((f) => ({ value: f, label: f }))}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cl-empty"><Empty title="No compliance matches these filters">Clear the filters to see the full list.</Empty></div>
      ) : (
        <>
          <table className="cl-table">
            <thead ref={theadRef}>
              <tr>
                <th style={{ width: "30%" }}>Compliance</th>
                <th>Frequency</th>
                <th>Next due</th>
                <th>Latest period</th>
                <th className="u-right">Late</th>
                <th className="u-right">Clients</th>
                <th aria-label="Expand" />
              </tr>
            </thead>
            <tbody>
              {groups.map(([g, defs]) => {
                const gLate = defs.reduce((a, d) => a + (byDef.get(d.code)?.late ?? 0), 0);
                return (
                  <Fragment key={g}>
                    <tr className="cl-group">
                      <td colSpan={7}>
                        <i className={`cl-group__dot ${headClass(g)}`} />
                        {g}
                        <span className="cl-group__n">{defs.length}</span>
                        {gLate ? <span className="tag tag--overdue">{n(gLate)} late</span> : null}
                      </td>
                    </tr>
                    {defs.map((d) => {
                      const s = byDef.get(d.code);
                      const isOpen = open === d.code;
                      return (
                        <Fragment key={d.code}>
                          <tr data-code={d.code} className={`cl-row${isOpen ? " is-open" : ""}`} onClick={() => setOpen(isOpen ? null : d.code)} aria-expanded={isOpen}>
                            <td>
                              <div className="cl-id">
                                <i className={`cl-spine ${headClass(d.head)}`} />
                                <div><b>{d.form}</b><small>{d.description}</small></div>
                              </div>
                            </td>
                            <td>{d.frequency}</td>
                            <td><DueCell run={s?.next} /></td>
                            <td>{s?.current ? <><small className="cl-period">{s.current.periodLabel}</small><Progress run={s.current} /></> : <span className="cl-muted">No periods</span>}</td>
                            <td className="u-right">
                              {s && s.late > 0
                                ? <><span className="tag tag--overdue">{n(s.late)} late</span><small className="cl-late num">{inrShort(s.fees)}</small></>
                                : <span className="cl-muted">None</span>}
                            </td>
                            <td className="u-right num">{n(s?.clients.size ?? 0)}</td>
                            <td className="u-right"><span className={`cl-chev${isOpen ? " is-open" : ""}`}><Icon name="chevronDown" size={16} /></span></td>
                          </tr>
                          {isOpen ? (
                            <tr className="cl-detail">
                              <td colSpan={7}>
                                {/* Summary cards first, then the periods; for a one-period form
                                    a single action line with one clear button. */}
                                <div className="cl-panels">
                                  <section className="cl-panel">
                                    <h4>About {d.form}</h4>
                                    <dl className="cl-dl">
                                      <dt>Head</dt><dd><i className={`cl-group__dot ${headClass(d.head)}`} />{d.head}</dd>
                                      <dt>Frequency</dt><dd>{d.frequency}</dd>
                                      <dt>Due date rule</dt><dd>{d.dueRule}</dd>
                                      <dt>Applies to</dt><dd>{d.applicability}</dd>
                                      <dt>Late fee</dt><dd><b>{feeShort(d.lateFee)}</b><small>{d.lateFee.note}</small></dd>
                                    </dl>
                                  </section>
                                  <section className="cl-panel">
                                    <h4>{d.code === ALL_YEARS_CODE ? "Open windows, all years" : `Due in ${fyLabel(fy)}`}</h4>
                                    <YearStats runs={s?.runs ?? []} clients={s?.clients.size ?? 0} />
                                  </section>
                                </div>
                                {(s?.runs.length ?? 0) === 1 && s ? (() => {
                                  const r = s.runs[0];
                                  const dd = daysTo(r.dueDate);
                                  return (
                                    <button type="button" className="cl-single" onClick={() => nav(`/runs/${encodeURIComponent(r.runId)}`)}>
                                      <span className="cl-single__what"><b>{r.periodLabel}</b><span>due {fmtShort(r.dueDate)} · {dd < 0 ? `${-dd} days overdue` : dd === 0 ? "due today" : `in ${dd} days`}</span></span>
                                      <span className="cl-single__prog"><Progress run={r} /></span>
                                      <span className="btn btn--primary">Open clients <Icon name="chevronRight" size={14} /></span>
                                    </button>
                                  );
                                })() : (
                                <div className="cl-pwrap">
                                  <table className="cl-periods">
                                    <colgroup>
                                      <col style={{ width: "22%" }} /><col style={{ width: "10%" }} /><col style={{ width: "16%" }} />
                                      <col style={{ width: "17%" }} /><col style={{ width: "8%" }} /><col style={{ width: "10%" }} /><col style={{ width: "17%" }} />
                                    </colgroup>
                                    <thead><tr><th className="cl-pth-first">
                                      {/* Names the open compliance, so the frozen header still says
                                          whose periods these are once its row has scrolled away. */}
                                      <span className="cl-pth-form"><i className={`cl-group__dot ${headClass(d.head)}`} />{d.form}</span> · Period
                                    </th><th>Due date</th><th>Status</th><th>Progress</th><th className="u-right">Open</th><th className="u-right">Late fees</th><th className="u-right">Clients</th></tr></thead>
                                    <tbody>
                                      {(s?.runs ?? []).map((r) => {
                                        const dd = daysTo(r.dueDate);
                                        const current = r.runId === s?.next?.runId;
                                        return (
                                          <tr key={r.runId} className={`cl-prow${current ? " is-current" : r.dueDate > TODAY ? " is-future" : ""}`} onClick={() => nav(`/runs/${encodeURIComponent(r.runId)}`)}>
                                            <td><b>{r.periodLabel}</b>{current ? <span className="tag tag--pending cl-cur">Next due</span> : null}</td>
                                            <td className="num">{fmtShort(r.dueDate)}</td>
                                            <td>
                                              {r.overdue > 0 ? <span className="tag tag--overdue">{-dd} days overdue</span>
                                                : r.pending === 0 ? <span className="tag tag--filed">All filed</span>
                                                : dd === 0 ? <span className="tag tag--pending">Due today</span>
                                                : dd <= 7 ? <span className="tag tag--pending">Due in {dd} days</span>
                                                : <span className="tag tag--na">In {dd} days</span>}
                                            </td>
                                            <td><Progress run={r} /></td>
                                            <td className="u-right num">{n(r.pending + r.overdue)}</td>
                                            <td className="u-right num">{r.exposure ? <span className="cl-late">{inrShort(r.exposure)}</span> : <span className="cl-muted">–</span>}</td>
                                            <td className="u-right">
                                              <button type="button" className="btn btn--sm btn--primary" onClick={(e) => { e.stopPropagation(); nav(`/runs/${encodeURIComponent(r.runId)}`); }}>
                                                Open clients <Icon name="chevronRight" size={13} />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                )}
                                <Link className="cl-full" to={`/compliances/${encodeURIComponent(d.code)}`} onClick={(e) => e.stopPropagation()}>
                                  Open the full {d.form} page <Icon name="chevronRight" size={13} />
                                </Link>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      </div>
    </div>
  );
}
