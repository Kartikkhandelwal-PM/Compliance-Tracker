  /* ============================================================================
   COMPLIANCE CALENDAR
   ----------------------------------------------------------------------------
   The statutory month, and the highest-traffic screen in the module — a CA
   office plans its week off this grid, so it has to read as a calendar before
   it reads as a dataset.

   Three decisions drive the layout:

   1. THE DATE IS THE LARGEST THING IN THE CELL. Not the counts, not the form
      codes. If it doesn't look like a wall calendar at a glance, it has failed.
   2. RESTRAINT INSIDE THE CELL. Three form chips maximum — head-coloured
      spine, form code, open count — then "+N more". Everything else lives in
      the day panel that opens when you pick a date. A cell is a signal, not a
      report.
   3. TWO LAYERS, HONESTLY SEPARATED. The statutory dates are generated from
      the recurring rules and exist for *any* financial year. The open counts
      and ₹ exposure come from the client book, which is only seeded for
      FY 2026-27. Selecting another year shows a correct statutory calendar with
      no book behind it, and says so, rather than inventing numbers.

   Filters (head, owner, arrears-only) narrow both layers together, so the
   grid, the month tabs and the day panel always agree with each other.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useEngine, useObligations } from "../ui/app-state.tsx";
import { buildRuns, untrackedCodes } from "../domain/engine.ts";
import type { FilingRun } from "../domain/types.ts";
import { DEF_BY_CODE, FY_START, HEADS, fyLabel, headClass, occurrencesForFY } from "../domain/catalog.ts";
import { STAFF } from "../domain/book.ts";
import {
  DOW, MONTHS, TODAY, addDays, dow, fmtLong, inrShort, iso, monthLabelLong, parts,
} from "../domain/dates.ts";
import { Countdown, Empty, PageHead, Pbar, SectionHead, Seg, Stat, useRevealOnPick } from "../ui/bits.tsx";
import { RunList } from "../ui/RunList.tsx";
import { Icon } from "../ui/Icon.tsx";

/** Grid = the month as a wall calendar. Timeline = the year as one ordered run. */
type View = "grid" | "timeline";

/** Financial years offered. Only FY_START has a client book behind it. */
const FY_OPTIONS = [FY_START - 1, FY_START, FY_START + 1];

/** The twelve months of a financial year, Apr → Mar, as [year, month]. */
function fyMonthList(fyStart: number): [number, number][] {
  return [
    [fyStart, 4], [fyStart, 5], [fyStart, 6], [fyStart, 7], [fyStart, 8], [fyStart, 9],
    [fyStart, 10], [fyStart, 11], [fyStart, 12],
    [fyStart + 1, 1], [fyStart + 1, 2], [fyStart + 1, 3],
  ];
}

interface DayCell {
  runs: FilingRun[];
  open: number;
  overdue: number;
  exposure: number;
}

export function CalendarPage() {
  const obligations = useObligations();
  const untracked = useEngine(untrackedCodes);
  const t = parts(TODAY);

  const [fy, setFy] = useState(FY_START);
  /** Index into fyMonthList — August 2026 is index 4 of FY 2026-27. */
  const [monthIdx, setMonthIdx] = useState(() => {
    const list = fyMonthList(FY_START);
    const i = list.findIndex(([y, m]) => y === t.y && m === t.m);
    return i >= 0 ? i : 0;
  });
  const [params] = useSearchParams();
  /* Arriving from "1,240 filings are due today" has to open that day, not drop
     the reader on the month with the answer somewhere inside it. */
  const [picked, setPicked] = useState<string | null>(() => params.get("date"));
  /* The day panel sits below a six-week grid, so picking a date changed
     something a full screen away and people did not know to look. */
  const dayRef = useRevealOnPick<HTMLDivElement>(picked, 60);
  const [view, setView] = useState<View>("grid");
  const tlineRef = useRef<HTMLOListElement>(null);



  const [head, setHead] = useState(() => params.get("head") ?? "all");
  const [owner, setOwner] = useState(() => params.get("owner") ?? "all");

  /* Follow the URL when it changes under an already-open page, and move the
     month to wherever the linked date actually is. */
  useEffect(() => {
    const d = params.get("date");
    if (!d) return;
    setPicked(d);
    const { y, m } = parts(d);
    const i = fyMonthList(FY_START).findIndex(([yy, mm]) => yy === y && mm === m);
    if (i >= 0) setMonthIdx(i);
    const h = params.get("head");
    if (h) setHead(h);
  }, [params]);
  /* Was a lone toggle chip sitting among two dropdowns — the same mismatch
     the Clients page had. As a select it also gains the half of the question a
     toggle could never ask: show me only the days that are clean. */
  const [dayState, setDayState] = useState<"all" | "arrears" | "clear">("all");

  /* Hover detail for a compliance chip. Positioned in viewport coordinates and
     rendered fixed, so it escapes the grid's clipping without any of the cells
     needing overflow:visible. */
  const [tip, setTip] = useState<{ x: number; y: number; run: FilingRun; date: string } | null>(null);

  const showTip = (e: { currentTarget: Element }, run: FilingRun, date: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top - 8, run, date });
  };
  const hideTip = () => setTip(null);

  const seeded = fy === FY_START;
  const months = fyMonthList(fy);
  const [cy, cm] = months[monthIdx];

  /* ---- Filter the book, then aggregate ---------------------------------- */

  const filteredObligations = useMemo(() => {
    let list = obligations;
    if (head !== "all") list = list.filter((o) => o.head === head);
    if (owner !== "all") list = list.filter((o) => o.assigneeId === owner);
    return list;
  }, [obligations, head, owner]);

  const runs = useMemo(() => buildRuns(filteredObligations), [filteredObligations]);

  /**
   * For the seeded FY we show the book's runs. For any other FY we still have
   * a real statutory calendar — generate it from the same recurring rules and
   * render zero-count placeholder runs so the dates are right even though no
   * client is attached.
   */
  const displayRuns = useMemo<FilingRun[]>(() => {
    if (seeded) {
      if (dayState === "arrears") return runs.filter((r) => r.overdue > 0);
      if (dayState === "clear") return runs.filter((r) => r.overdue === 0);
      return runs;
    }
    if (dayState === "arrears") return [];
    /* An unseeded year is drawn from the statutory calendar rather than from
       the book, so it has to apply the firm's catalogue settings itself —
       a compliance switched off in Settings is not on this firm's calendar in
       any year. */
    return occurrencesForFY(fy)
      .map((occ): FilingRun | null => {
        const def = DEF_BY_CODE[occ.defCode];
        if (!def) return null;
        if (untracked.has(occ.defCode)) return null;
        if (head !== "all" && def.head !== head) return null;
        return {
          runId: occ.runId,
          def,
          periodLabel: occ.periodLabel,
          dueDate: occ.dueDate,
          daysOverdue: 0,
          total: 0, filed: 0, pending: 0, overdue: 0, exposure: 0,
          clientIds: [],
        };
      })
      .filter((r): r is FilingRun => r !== null);
  }, [seeded, runs, dayState, fy, head, untracked]);

  const byDate = useMemo(() => {
    const map = new Map<string, DayCell>();
    for (const r of displayRuns) {
      let cell = map.get(r.dueDate);
      if (!cell) {
        cell = { runs: [], open: 0, overdue: 0, exposure: 0 };
        map.set(r.dueDate, cell);
      }
      cell.runs.push(r);
      cell.open += r.pending + r.overdue;
      cell.overdue += r.overdue;
      cell.exposure += r.exposure;
    }
    /* Biggest workload first — that is what you need to see in a 128px box. */
    for (const cell of map.values()) {
      cell.runs.sort(
        (a, b) => b.overdue - a.overdue
          || (b.pending + b.overdue) - (a.pending + a.overdue)
          || a.def.form.localeCompare(b.def.form),
      );
    }
    return map;
  }, [displayRuns]);

  /* ---- Grid: six weeks starting the Sunday on or before the 1st --------- */

  const firstOfMonth = iso(cy, cm, 1);
  const gridStart = addDays(firstOfMonth, -dow(firstOfMonth));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const monthPrefix = `${cy}-${String(cm).padStart(2, "0")}`;
  const monthRuns = useMemo(
    () => displayRuns
      .filter((r) => r.dueDate.startsWith(monthPrefix))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.exposure - a.exposure),
    [displayRuns, monthPrefix],
  );

  const monthTotals = useMemo(() => {
    let open = 0, overdue = 0, exposure = 0, filed = 0;
    for (const r of monthRuns) {
      open += r.pending + r.overdue;
      overdue += r.overdue;
      exposure += r.exposure;
      filed += r.filed;
    }
    return { open, overdue, exposure, filed, runs: monthRuns.length };
  }, [monthRuns]);

  /**
   * Timeline: every date in the FY that carries at least one filing, in order,
   * grouped by date. Unlike the grid this ignores month boundaries — the point
   * is the sequence.
   */
  const timeline = useMemo(() => {
    const groups = [...byDate.entries()]
      .map(([date, cell]) => ({ date, ...cell }))
      .sort((a, b) => a.date.localeCompare(b.date));
    /* Anchor on today: show a little history, then everything ahead. */
    const from = addDays(TODAY, -30);
    return groups.filter((g) => g.date >= from);
  }, [byDate]);

  /**
   * Reveal timeline rows as they are scrolled to.
   *
   * Observed against `main.work`, the app's scroll container — the window never
   * scrolls, so a viewport-rooted observer would never fire. Rows are marked
   * once and left marked: re-hiding on scroll-up turns a list into a flicker.
   */
  useEffect(() => {
    if (view !== "timeline") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const list = tlineRef.current;
    if (!list) return;
    const root = list.closest("main.work") as HTMLElement | null;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { root, rootMargin: "0px 0px -40px 0px", threshold: 0.01 },
    );
    for (const row of list.querySelectorAll(".tlgroup")) io.observe(row);
    return () => io.disconnect();
  }, [view, timeline]);


  /** The single heaviest date this month — the one to staff for. */
  const busiest = useMemo(() => {
    let best: { date: string; open: number } | null = null;
    for (const [date, cell] of byDate) {
      if (!date.startsWith(monthPrefix)) continue;
      if (!best || cell.open > best.open) best = { date, open: cell.open };
    }
    return best && best.open > 0 ? best : null;
  }, [byDate, monthPrefix]);

  /** Per-month open counts, for the year strip. */
  const monthLoads = useMemo(
    () => months.map(([y, m]) => {
      const p = `${y}-${String(m).padStart(2, "0")}`;
      let open = 0, overdue = 0;
      for (const r of displayRuns) {
        if (!r.dueDate.startsWith(p)) continue;
        open += r.pending + r.overdue;
        overdue += r.overdue;
      }
      return { open, overdue };
    }),
    [months, displayRuns],
  );

  const pickedCell = picked ? byDate.get(picked) : undefined;

  const step = (n: number) => {
    setPicked(null);
    setMonthIdx((i) => Math.min(11, Math.max(0, i + n)));
  };

  const jumpToToday = () => {
    setFy(FY_START);
    const list = fyMonthList(FY_START);
    const i = list.findIndex(([y, m]) => y === t.y && m === t.m);
    setMonthIdx(i >= 0 ? i : 0);
    setPicked(null);
  };

  const filtersOn = head !== "all" || owner !== "all" || dayState !== "all";

  return (
    <div className="page page--wide">
      <PageHead
        title="Calendar"
        icon="calendar"
        note={
          seeded ? (
            <>
              <b>{monthTotals.runs}</b> filings in {monthLabelLong(cy, cm)} ·{" "}
              <b>{monthTotals.open.toLocaleString("en-IN")}</b> open
            </>
          ) : (
            <>statutory dates only. The book is seeded for {fyLabel(FY_START)}.</>
          )
        }
        aside={
          <div className="u-row">
            <Seg<View>
              value={view}
              onChange={setView}
              options={[
                { value: "grid", label: "Calendar" },
                { value: "timeline", label: "Timeline" },
              ]}
            />
            <select
              className="plain"
              value={fy}
              onChange={(e) => { setFy(Number(e.target.value)); setPicked(null); }}
              aria-label="Financial year"
            >
              {FY_OPTIONS.map((y) => (
                <option key={y} value={y}>{fyLabel(y)}</option>
              ))}
            </select>
            <button type="button" className="btn btn--sm" onClick={jumpToToday}>
              Today
            </button>
          </div>
        }
      />

      {/* ---- Filters ---------------------------------------------------- */}
      <div className="filters">
        <select className="plain" value={head} onChange={(e) => { setHead(e.target.value); setPicked(null); }}>
          <option value="all">All heads</option>
          {HEADS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select
          className="plain"
          value={owner}
          onChange={(e) => { setOwner(e.target.value); setPicked(null); }}
          disabled={!seeded}
          title={seeded ? undefined : "Owners come from the client book, which is only seeded for the current FY"}
        >
          <option value="all">Any owner</option>
          <option value="none">Unassigned</option>
          {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          className="plain"
          value={dayState}
          onChange={(e) => { setDayState(e.target.value as typeof dayState); setPicked(null); }}
          disabled={!seeded}
          aria-label="Day state"
          title={seeded ? undefined : "Arrears need a client book, which this FY does not have"}
        >
          <option value="all">All days</option>
          <option value="arrears">With arrears</option>
          <option value="clear">Nothing late</option>
        </select>
        {filtersOn ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => { setHead("all"); setOwner("all"); setDayState("all"); setPicked(null); }}
          >
            <Icon name="close" size={12} /> Clear filters
          </button>
        ) : null}
        <span className="u-spacer" />
        <span className="shead__note">
          {displayRuns.length} filings across {fyLabel(fy)}
        </span>
      </div>

      {/* ---- The financial year, twelve months at once ------------------- */}
      <div className="calbar">
        <button type="button" className="btn btn--icon" onClick={() => step(-1)} disabled={monthIdx === 0} aria-label="Previous month">
          <Icon name="chevronLeft" size={16} />
        </button>
        <div className="fymonths" role="tablist" aria-label={`Months of ${fyLabel(fy)}`}>
          {months.map(([y, m], i) => {
            const load = monthLoads[i];
            return (
              <button
                key={`${y}-${m}`}
                type="button"
                role="tab"
                aria-selected={i === monthIdx}
                className={`fymonth${i === monthIdx ? " is-on" : ""}${load.overdue > 0 ? " has-risk" : ""}`}
                onClick={() => { setMonthIdx(i); setPicked(null); }}
                title={`${monthLabelLong(y, m)}${seeded ? ` · ${load.open} open` : ""}`}
              >
                {MONTHS[m - 1]}
                {seeded ? (
                  <span className="fymonth__n">{load.open > 0 ? load.open : "—"}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn--icon" onClick={() => step(1)} disabled={monthIdx === 11} aria-label="Next month">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>

      {/* ---- Month at a glance ------------------------------------------ */}
      {seeded ? (
        <div className="stats" style={{ marginBottom: "var(--s4)" }}>
          <Stat
            label="Landing this month"
            value={monthTotals.open.toLocaleString("en-IN")}
            tone="cool"
            icon="calendar"
            sub={`${monthTotals.runs} filings across ${MONTHS[cm - 1]}`}
          />
          <Stat
            label="In arrears"
            value={monthTotals.overdue}
            tone={monthTotals.overdue > 0 ? "overdue" : undefined}
            icon="alert"
            sub={
              monthTotals.overdue > 0
                ? `past due · ${inrShort(monthTotals.exposure)} late fees`
                : "nothing late this month"
            }
          />
          <Stat
            label="Filed"
            value={monthTotals.filed.toLocaleString("en-IN")}
            tone="filed"
            icon="check"
            sub="closed for this month's dates"
          />
          <Stat
            label="Busiest date"
            value={busiest ? `${parts(busiest.date).d} ${MONTHS[parts(busiest.date).m - 1]}` : "—"}
            tone="soon"
            icon="clock"
            sub={busiest ? `${busiest.open.toLocaleString("en-IN")} filings land that day` : "no dates this month"}
          />
        </div>
      ) : null}

      {/* ---- The grid ----------------------------------------------------
           A day cell is NOT one big button. The date selects the day; each
           compliance chip is its own link straight to that compliance's page.
           Nesting links inside a button would be invalid and would also make
           "click the form I care about" impossible, which is the main thing
           anyone wants to do from a calendar. */}
      {view === "grid" ? (
      <div className="cal">
        <div className="cal__dow">
          {DOW.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="cal__grid">
          {cells.map((date) => {
            const dp = parts(date);
            const outside = dp.m !== cm;
            const cell = byDate.get(date);
            const list = cell?.runs ?? [];
            const weekend = dow(date) === 0 || dow(date) === 6;
            const hasRisk = (cell?.overdue ?? 0) > 0;

            return (
              <div
                key={date}
                className={
                  "calday"
                  + (outside ? " is-out" : "")
                  + (weekend ? " is-weekend" : "")
                  + (date === TODAY ? " is-today" : "")
                  + (hasRisk ? " has-risk" : "")
                  + (picked === date ? " is-sel" : "")
                }
              >
                <button
                  type="button"
                  className="calday__head"
                  onClick={() => setPicked(picked === date ? null : date)}
                  aria-label={`${fmtLong(date)}${cell ? `: ${list.length} filings, ${cell.open} open` : ": nothing due"}`}
                  title={cell ? `${fmtLong(date)}. See everything due this day.` : fmtLong(date)}
                >
                  <span className="calday__num">{dp.d}</span>
                  {cell && cell.open > 0 ? (
                    <span className={`calday__count${hasRisk ? " is-alarm" : ""}`}>
                      {hasRisk ? `${cell.overdue} late` : cell.open}
                    </span>
                  ) : null}
                </button>

                {list.slice(0, 3).map((r) => (
                  <Link
                    key={r.runId}
                    to={`/runs/${encodeURIComponent(r.runId)}`}
                    className={`calpill${r.overdue > 0 ? " p-overdue" : ""}`}
                    onMouseEnter={(e) => showTip(e, r, date)}
                    onMouseLeave={hideTip}
                    onFocus={(e) => showTip(e, r, date)}
                    onBlur={hideTip}
                  >
                    <i className={`calpill__spine ${headClass(r.def.head)}`} />
                    <b>{r.def.form}</b>
                    {seeded && r.pending + r.overdue > 0 ? (
                      <span className="n">{r.pending + r.overdue}</span>
                    ) : <span className="n" />}
                  </Link>
                ))}
                {list.length > 3 ? (
                  <button
                    type="button"
                    className="calmore"
                    onClick={() => setPicked(date)}
                  >
                    +{list.length - 3} more
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="callegend">
          {HEADS.map((h) => (
            <span key={h}>
              <i className={headClass(h)} />{h}
            </span>
          ))}
          <span className="u-spacer" />
          <span><i style={{ background: "var(--st-overdue-solid)" }} />day carries arrears</span>
        </div>
      </div>
      ) : (
        /* ---- Timeline: the whole financial year in due-date order --------
           The grid answers "what does this month look like"; the timeline
           answers "what is coming, in order, regardless of month boundaries" —
           which is how you actually plan across the 31 Jul / 30 Sep / 31 Oct
           walls that a month view keeps cutting in half. */
        <div className="sheet">
          <ol className="tline" ref={tlineRef}>
            {timeline.map((group) => (
              <li key={group.date} className={`tlgroup${group.date === TODAY ? " is-today" : ""}${group.overdue > 0 ? " has-risk" : ""}`}>
                <div className="tlgroup__date">
                  <b className="num">{parts(group.date).d}</b>
                  <span>{MONTHS[parts(group.date).m - 1]}</span>
                  <em>{DOW[dow(group.date)]}</em>
                </div>
                <div className="tlgroup__body">
                  <div className="tlgroup__meta">
                    {group.date === TODAY ? <span className="tag tag--pending">Today</span> : null}
                    <Countdown due={group.date} />
                    {seeded ? (
                      <span className="u-mute" style={{ fontSize: "var(--t-12)" }}>
                        {group.open.toLocaleString("en-IN")} open
                        {group.overdue > 0 ? ` · ${group.overdue} late` : ""}
                      </span>
                    ) : null}
                  </div>
                  <div className="tlgroup__runs">
                    {group.runs.map((r) => (
                      <Link
                        key={r.runId}
                        to={`/runs/${encodeURIComponent(r.runId)}`}
                        className="tlrun"
                        onMouseEnter={(e) => showTip(e, r, group.date)}
                        onMouseLeave={hideTip}
                      >
                        <i className={`calpill__spine ${headClass(r.def.head)}`} />
                        <span className="tlrun__form">{r.def.form}</span>
                        <span className="tlrun__per">{r.periodLabel}</span>
                        {seeded ? (
                          <>
                            <span className="tlrun__bar">
                              <Pbar filed={r.filed} pending={r.pending} overdue={r.overdue} />
                            </span>
                            <span className="tlrun__n num">
                              {r.overdue > 0 ? <b style={{ color: "var(--st-overdue-fg)" }}>{r.overdue} late</b> : `${r.pending} open`}
                            </span>
                          </>
                        ) : null}
                        <Icon name="chevronRight" size={13} className="tlrun__chev" />
                      </Link>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {timeline.length === 0 ? (
            <Empty title="Nothing scheduled">No statutory dates match the current filters.</Empty>
          ) : null}
        </div>
      )}

      {/* ---- Day panel / month list ------------------------------------- */}
      {picked ? (
        <div ref={dayRef} className="daypanel">
          <SectionHead
            icon="calendar"
            title={fmtLong(picked)}
            note={
              pickedCell
                ? `${pickedCell.runs.length} filings · ${pickedCell.open} open${pickedCell.exposure > 0 ? ` · ${inrShort(pickedCell.exposure)} at risk` : ""}`
                : "nothing due"
            }
          >
            <button type="button" className="btn btn--sm" onClick={() => setPicked(null)}>
              <Icon name="close" size={13} /> Clear
            </button>
          </SectionHead>
          <RunList
            head
            defaultSort="open"
            defaultDesc
            runs={pickedCell?.runs ?? []}
            emptyTitle="No statutory due dates"
            emptyBody="Nothing in the master calendar falls on this date for the current filters."
          />
        </div>
      ) : (
        <>
          <SectionHead
            icon="calendar"
            title={`Everything due in ${monthLabelLong(cy, cm)}`}
            note={`${monthRuns.length} filings${filtersOn ? " matching your filters" : ""}`}
          />
          <RunList
            head
            defaultSort="due"
            runs={monthRuns}
            emptyTitle="A clear month"
            emptyBody={
              filtersOn
                ? "No statutory dates fall in this month for the current filters. Try widening them."
                : "No statutory due dates fall in this month."
            }
          />
        </>
      )}

      <p className="u-faint" style={{ fontSize: "var(--t-11)", marginTop: "var(--s6)" }}>
        Dates come from the recurring statutory rules, not a typed list. CBIC/CBDT extensions and
        state-specific professional tax dates are not applied automatically.
      </p>

      {/* Hover detail. Fixed-positioned so it is never clipped by a cell. */}
      {tip ? (
        <div className="caltip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <div className="caltip__head">
            {/* No head spine here. `.calpill__spine` takes its width from the
                calendar chip it belongs to, so in this card it collapsed to 0px
                while the flex gap still reserved 8px — an empty indent in front
                of the name. The head is named in the sub-line below anyway. */}
            <div className="caltip__form">{tip.run.def.form}</div>
            <div className="caltip__sub">
              {tip.run.periodLabel} · {tip.run.def.head} · {tip.run.def.frequency}
            </div>
          </div>

          <div className="caltip__due">
            <Icon name="calendar" size={12} />
            <span className="num">{fmtLong(tip.date)}</span>
          </div>

          {seeded ? (
            <>
              {/* Figures as labelled columns. As one run-on line they read as
                  prose — "359 applies to 282 filed 0 pending" — and the number
                  that matters was the hardest to find. */}
              <div className="caltip__rows">
                <span className="caltip__stat">
                  <b>{tip.run.total.toLocaleString("en-IN")}</b><span>clients</span>
                </span>
                <span className="caltip__stat">
                  <b>{tip.run.filed.toLocaleString("en-IN")}</b><span>filed</span>
                </span>
                <span className="caltip__stat">
                  <b>{tip.run.pending.toLocaleString("en-IN")}</b><span>pending</span>
                </span>
                {tip.run.overdue > 0 ? (
                  <span className="caltip__stat is-late">
                    <b>{tip.run.overdue.toLocaleString("en-IN")}</b><span>overdue</span>
                  </span>
                ) : null}
              </div>
              {tip.run.exposure > 0 ? (
                <div className="caltip__fees">
                  <Icon name="alert" size={12} />
                  {inrShort(tip.run.exposure)} late fees accrued
                </div>
              ) : null}
            </>
          ) : (
            <div className="caltip__rows">
              <span className="u-mute" style={{ fontSize: "var(--t-12)" }}>
                No client book for this year
              </span>
            </div>
          )}

          <div className="caltip__go">
            Open this compliance <Icon name="arrowRight" size={12} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
