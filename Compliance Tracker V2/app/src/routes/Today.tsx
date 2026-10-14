/* ============================================================================
   DASHBOARD — where the firm stands
   ----------------------------------------------------------------------------
   Answers one question on arrival: what needs attention, and when.

   Two deliberate changes from the earlier version of this screen:

   1. PENALTY IS NO LONGER THE HEADLINE. Late fees are a *consequence* of
      missing a date, not the thing a practice tracks. Leading with "₹18L at
      risk" made the app read like a debt collector and buried the actual work.
      Exposure is still computed and still shown — as a secondary line, beside
      the filings that caused it.
   2. THIRTY DAYS, NOT SIXTY. A 60-day runway squeezed 60 bars into the width
      and every one was too thin to read. A month is also the real planning
      horizon: you level work around the 7th/11th/15th/20th, not around a date
      six weeks out.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp, useObligations, useOutbox } from "../ui/app-state.tsx";
import { AppStrip, BigDeadlinesCard, CorrectionsCard, NoticesCard, RemindersCard, TaxLiabilityCard } from "../ui/EntryPanels.tsx";
import { fyLabel } from "../domain/catalog.ts";
import { buildRuns, dayLoads, summarise, taxLiabilitySummary } from "../domain/engine.ts";
import { FY_START } from "../domain/catalog.ts";
import { MONTHS, TODAY, addDays, dow, fmtLong, fmtShort, inrShort, urgency } from "../domain/dates.ts";
import { CountUp, PageHead, Stat } from "../ui/bits.tsx";
import { Runway } from "../ui/Runway.tsx";
import { RunList, type RunSort } from "../ui/RunList.tsx";
import { FiledDrawer } from "../ui/FiledDrawer.tsx";
import { Icon } from "../ui/Icon.tsx";


const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Scope = "firm" | "mine";
type Queue = "arrears" | "week" | "horizon";

/* `note` is no longer printed above the list. A paragraph of explanation is
   read once and then occupies the same 40px above every visit; the columns it
   was standing in for are now labelled by the list's own header. It survives
   as the tab's tooltip — available on demand, in the way never. */
const QUEUES: {
  key: Queue;
  label: string;
  note: string;
  empty: string;
  emptyBody?: string;
  sort: RunSort;
  desc?: boolean;
}[] = [
  {
    key: "arrears",
    label: "In arrears",
    note: "Past their due date and still unfiled. Ordered by how many clients are missing, so the widest problems surface first.",
    empty: "Nothing in arrears",
    emptyBody: "Every compliance past its due date has been filed, marked filed, or ruled not applicable.",
    sort: "open",
    desc: true,
  },
  {
    key: "week",
    label: "This week",
    note: "Landing in the next seven days. This is the window you can still staff for.",
    empty: "A clear week",
    emptyBody: "No statutory due dates fall in the next seven days for this book.",
    sort: "due",
  },
  {
    key: "horizon",
    label: "Next 45 days",
    note: "Further out, in date order. Useful for spotting the annual walls before they arrive.",
    empty: "Nothing scheduled",
    emptyBody: "No statutory due dates fall in the next six weeks.",
    sort: "due",
  },
];

export function TodayPage() {
  const all = useObligations();
  const nav = useNavigate();
  const [filedOpen, setFiledOpen] = useState(false);
  const { me } = useApp();
  /* V2: the whole-firm / my-clients switch is gone from the entry screen. */
  const scope = "firm" as Scope;
  const outbox = useOutbox();
  /* V2: the runway opens on today, so what lands today is listed on arrival. */
  const [pickedDay, setPickedDay] = useState<string | null>(TODAY);
  const [queue, setQueue] = useState<Queue>("arrears");
  /* The queue opens short so the sections below stay in view; "See more"
     expands it in place. */
  const [expanded, setExpanded] = useState(false);
  const QUEUE_PREVIEW = 5;

  /* The dashboard is "what needs attention now" — scoped to the current
     financial year so a resolved arrear from a retired year never counts
     toward this year's arrears or exposure. */
  const obligations = useMemo(
    () => all.filter((o) => o.fy === FY_START && (scope !== "mine" || o.assigneeId === me.id)),
    [all, scope, me.id],
  );

  const summary = useMemo(() => summarise(obligations), [obligations]);
  const liability = useMemo(() => taxLiabilitySummary(obligations), [obligations]);
  const runs = useMemo(() => buildRuns(obligations), [obligations]);
  /* 30 days: a week of arrears behind, the rest of the month ahead. */
  const loads = useMemo(() => dayLoads(obligations, addDays(TODAY, -7), 30), [obligations]);

  /* The seven days the hero plots. Volume alone does not tell you how to
     staff a week — a week with 400 filings on one day and a week with 400 flat
     are different problems, and only the shape says which you have. */
  const weekAhead = useMemo(() => {
    const runIds = new Set<string>();
    const byDay = new Map<string, number>();
    for (let i = 0; i < 7; i++) byDay.set(addDays(TODAY, i), 0);
    for (const o of obligations) {
      if (o.status !== "Pending") continue;
      const slot = byDay.get(o.dueDate);
      if (slot === undefined) continue;
      byDay.set(o.dueDate, slot + 1);
      runIds.add(o.runId);
    }
    const entries = [...byDay.entries()];
    const peak = Math.max(1, ...entries.map(([, n]) => n));
    return {
      runCount: runIds.size,
      label: entries.map(([d, n]) => `${fmtShort(d)}: ${n}`).join(", "),
      days: entries.map(([date, n], i) => ({
        date,
        n,
        band: urgency(date),
        pct: n > 0 ? Math.max(6, (n / peak) * 100) : 0,
        label: i === 0 ? "today" : DOW_SHORT[dow(date)],
      })),
    };
  }, [obligations]);


  /* Ordered by how many clients are actually late, then by how long it has been
     late. Previously this sorted by ₹ exposure, which put an expensive
     single-client arrear above a form 70 clients have missed — the wrong call
     now that penalty is a secondary signal rather than the organising one. */
  const arrears = useMemo(
    () => runs
      .filter((r) => r.overdue > 0)
      .sort((a, b) => b.overdue - a.overdue || a.dueDate.localeCompare(b.dueDate)),
    [runs],
  );

  const thisWeek = useMemo(() => {
    const end = addDays(TODAY, 7);
    return runs
      .filter((r) => r.dueDate >= TODAY && r.dueDate <= end && r.pending > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.pending - a.pending);
  }, [runs]);

  const horizon = useMemo(() => {
    const from = addDays(TODAY, 8);
    const to = addDays(TODAY, 45);
    return runs
      .filter((r) => r.dueDate >= from && r.dueDate <= to && r.pending > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [runs]);

  const dayRuns = useMemo(
    () => (pickedDay ? runs.filter((r) => r.dueDate === pickedDay) : []),
    [runs, pickedDay],
  );

  const statusMix = useMemo(() => {
    let filed = 0, pending = 0, overdue = 0, na = 0;
    for (const o of obligations) {
      if (o.status === "Filed") filed++;
      else if (o.status === "Pending") pending++;
      else if (o.status === "Overdue") overdue++;
      else na++;
    }
    return { filed, pending, overdue, na };
  }, [obligations]);



  const fullQueue = queue === "arrears" ? arrears
    : queue === "week" ? thisWeek
    : horizon;
  const activeQueue = expanded ? fullQueue : fullQueue.slice(0, QUEUE_PREVIEW);
  const hiddenCount = fullQueue.length - activeQueue.length;

  const active = QUEUES.find((qq) => qq.key === queue) ?? QUEUES[0];

  return (
    <div className="page">
      <PageHead
        title="Dashboard"
        icon="today"
        note={<>{fmtLong(TODAY)} · {fyLabel(FY_START)} is <b>{Math.round((statusMix.filed / Math.max(1, statusMix.filed + statusMix.pending + statusMix.overdue)) * 100)}%</b> done</>}
      />


      {/* V2 order, most urgent first: where to go, the numbers, what needs
          action now, what is coming, then the team and the overview. */}


      {/* One hero card beside a 2×2 of supporting figures. Five equal tiles in
          a row assert that five things matter equally; they do not.

          THE HERO IS THE WEEK AHEAD. Two earlier attempts led with a figure the
          firm cannot act on: the rupee exposure (which made the dashboard read
          as a debt collector's) and then the arrears count (a tally of what has
          already gone wrong). Both are outcomes. What a practice actually opens
          this screen to decide is *what has to go out in the next seven days*
          and whether the desks can carry it — so that leads, with the shape of
          the week under it. Arrears keeps a tile; it is a real number, just not
          the one you plan from. */}
      <div className="dashtop">
        <button type="button" className="hero" onClick={() => nav("/calendar")}>
          <div className="hero__label">
            <Icon name="clock" size={13} /> Due in the next 7 days
          </div>
          <div className="hero__val num"><CountUp n={summary.dueThisWeek} /></div>
          <p className="hero__sub">
            filings across <b>{weekAhead.runCount}</b> compliances
            {summary.dueToday > 0
              ? <> · <b>{summary.dueToday.toLocaleString("en-IN")}</b> land today</>
              : <> · none land today</>}
          </p>

          {/* Seven bars, one per day: the week is planned around which day the
              wall falls on, which a single total cannot say. */}
          <div className="week" role="img" aria-label={weekAhead.label}>
            {weekAhead.days.map((d) => (
              <span key={d.date} className="week__d">
                {/* A day with nothing due draws no mark. The 3px minimum that
                    keeps a small day visible was painting a coloured sliver on
                    empty days too, which read as "something lands here". */}
                <span className="week__bar">
                  {d.n > 0 ? (
                    <i className={`week__fill u-${d.band}`} style={{ height: `${d.pct}%` }} />
                  ) : null}
                </span>
                <span className="week__n num">{d.n > 0 ? d.n : ""}</span>
                <span className="week__k">{d.label}</span>
              </span>
            ))}
          </div>
          <span className="hero__go">Open the calendar <Icon name="chevronRight" size={13} /></span>
        </button>

        {/* Every tile goes somewhere. A figure you cannot open is a poster. */}
        <div className="dashkpi">
          <Stat
            label="Tax liability"
            action="See open work"
            value={inrShort(liability.total)}
            tone="cool"
            icon="rules"
            onClick={() => nav("/tracker?status=open")}
            sub={`${liability.clients.toLocaleString("en-IN")} clients · ${inrShort(liability.overdue)} on overdue filings`}
            hint="Estimated tax payable on filings still open: GST, TDS, income tax and advance tax. Filings with no tax figure are not counted."
          />
          <Stat
            label="Open"
            action="See open work"
            value={<CountUp n={summary.pendingTotal} />}
            tone="cool"
            icon="outbox"
            onClick={() => nav("/tracker?status=open")}
            sub="pending, not yet due"
          />
          <Stat
            label="Filed this month"
            action="See what was filed"
            value={<CountUp n={summary.filedThisMonth} />}
            tone="filed"
            icon="check"
            onClick={() => setFiledOpen(true)}
            /* Names the axis instead of the interaction. This counts work
               COMPLETED this month whatever it was due — including arrears
               cleared from earlier months — while the calendar's "Filed" card
               counts this month's DUE DATES that are done. Two different
               questions, and the two screens showed different numbers under the
               same word with nothing to explain the gap. That the card opens a
               breakdown is discoverable by clicking it; which of the two figures
               it is, is not. */
            sub={`completed in ${MONTHS[Number(TODAY.slice(5, 7)) - 1]}, any due date`}
          />
          <Stat
            label="Unowned"
            action="Assign owners"
            value={<CountUp n={summary.unassigned} />}
            icon="user"
            onClick={() => nav("/clients?owner=none")}
            sub={summary.unassigned > 0 ? "open items with no staff" : "everything is owned"}
            hint="Open items on clients with no assigned staff member."
          />
        </div>
      </div>

      <h2 className="ep-section">Needs action now<span>Late filings, tax due and correction windows closing</span></h2>

      {/* ---- One work queue, three tabs ---------------------------------
           These were three stacked lists (arrears, this week, horizon) which
           made the page read as an endless scroll of near-identical rows with
           no sense of where one ended and the next began. They are the same
           object filtered three ways, so they belong behind one control. */}
      <div className="queuecard">
        <div className="queuecard__bar">
          {/* The queue is only ever the queue now. A picked runway date used to
              quietly replace this list while all three tabs still looked
              selected; the date opens in the runway's own panel instead, so the
              two never disagree about what is on screen. */}
          <div className="qtabs" role="tablist" aria-label="Work queue">
            {QUEUES.map((qq) => {
              const n = qq.key === "arrears" ? arrears.length
                : qq.key === "week" ? thisWeek.length
                : horizon.length;
              const on = queue === qq.key;
              return (
                <button
                  key={qq.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`qtab${on ? " is-on" : ""}${qq.key === "arrears" && arrears.length > 0 ? " is-late" : ""}`}
                  title={qq.note}
                  onClick={() => { setQueue(qq.key); setExpanded(false); }}
                >
                  {qq.label}
                  <span className="qtab__n num">{n}</span>
                </button>
              );
            })}
          </div>

          <span className="u-spacer" />
          <Link to="/tracker" className="btn btn--sm">
            Open tracker <Icon name="chevronRight" size={13} />
          </Link>
        </div>

        <RunList
          head
          money="liability"
          defaultSort={active.sort}
          defaultDesc={active.desc}
          runs={activeQueue}
          emptyTitle={active.empty}
          emptyBody={active.emptyBody}
        />
        {fullQueue.length > QUEUE_PREVIEW ? (
          <div className="ep-more">
            <span>Showing {activeQueue.length} of {fullQueue.length} compliances</span>
            <button type="button" className="btn btn--sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : `See ${hiddenCount} more`}
            </button>
          </div>
        ) : null}
      </div>

      <div className="ep-grid3">
        <NoticesCard />
        <TaxLiabilityCard obligations={obligations} />
        <CorrectionsCard obligations={obligations} />
      </div>

      <h2 className="ep-section">Coming up<span>The next 30 days, big annual dates and reminders to follow up</span></h2>

      {/* Picking a day now opens underneath the bar you clicked, instead of
          silently rewriting a list two screens further down. */}
      <Runway loads={loads} selected={pickedDay} onSelect={setPickedDay}>
        <RunList
          head
          money="liability"
          defaultSort="open"
          defaultDesc
          runs={dayRuns}
          emptyTitle="Nothing due on this date"
          emptyBody="No statutory due date in the calendar falls on this day for this book."
        />
      </Runway>

      <div className="ep-grid2">
        <BigDeadlinesCard runs={runs} />
        <RemindersCard outbox={outbox} />
      </div>

      {/* The app shortcuts are useful but not urgent, so they close the page
          rather than open it. */}
      <h2 className="ep-section">Work by head<span>Jump into GST, TDS, Income Tax or ROC</span></h2>
      <AppStrip obligations={obligations} />

      <FiledDrawer open={filedOpen} onClose={() => setFiledOpen(false)} />
    </div>
  );
}
