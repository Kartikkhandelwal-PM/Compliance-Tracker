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
import { useApp, useObligations } from "../ui/app-state.tsx";
import { buildRuns, dayLoads, summarise } from "../domain/engine.ts";
import { TODAY, addDays, dow, fmtLong, fmtShort, inrShort, urgency } from "../domain/dates.ts";
import { CountUp, PageHead, Seg, Stat } from "../ui/bits.tsx";
import { Runway } from "../ui/Runway.tsx";
import { RunList, type RunSort } from "../ui/RunList.tsx";
import { FiledDrawer } from "../ui/FiledDrawer.tsx";
import { Icon } from "../ui/Icon.tsx";
import { HeadExposureBars, StatusDonut } from "../ui/Charts.tsx";

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
  const [scope, setScope] = useState<Scope>("firm");
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [queue, setQueue] = useState<Queue>("arrears");

  const obligations = useMemo(
    () => (scope === "mine" ? all.filter((o) => o.assigneeId === me.id) : all),
    [all, scope, me.id],
  );

  const summary = useMemo(() => summarise(obligations), [obligations]);
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

  const headExposure = useMemo(() => {
    const byHead: Record<string, number> = {};
    for (const o of obligations) {
      if (o.status !== "Overdue") continue;
      byHead[o.head] = (byHead[o.head] ?? 0) + o.exposure;
    }
    return byHead;
  }, [obligations]);

  /* Share of this year's live obligations already closed. Deliberately NOT
     called "filed on time" — the figure is low mostly because the financial
     year is young, not because the firm is failing, and the old label implied
     the opposite. */
  const closedRate = Math.round(
    (statusMix.filed / Math.max(1, statusMix.filed + statusMix.pending + statusMix.overdue)) * 100,
  );

  const activeQueue = queue === "arrears" ? arrears.slice(0, 12)
    : queue === "week" ? thisWeek
    : horizon.slice(0, 14);

  const active = QUEUES.find((qq) => qq.key === queue) ?? QUEUES[0];

  return (
    <div className="page">
      <PageHead
        title="Dashboard"
        icon="today"
        note={fmtLong(TODAY)}
        aside={
          <Seg<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: "firm", label: "Whole firm" },
              { value: "mine", label: "My clients" },
            ]}
          />
        }
      />

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
            label="In arrears"
            value={<CountUp n={summary.overdueCount} />}
            tone="overdue"
            icon="alert"
            onClick={() => nav("/tracker?status=late")}
            sub={`${summary.overdueClients.toLocaleString("en-IN")} clients · ${inrShort(summary.exposure)} late fees`}
            hint="Filings past their statutory due date. The late-fee figure is estimated from each compliance's own penalty rule."
          />
          <Stat
            label="Open"
            value={<CountUp n={summary.pendingTotal} />}
            tone="cool"
            icon="outbox"
            onClick={() => nav("/tracker?status=open")}
            sub="pending, not yet due"
          />
          <Stat
            label="Filed this month"
            value={<CountUp n={summary.filedThisMonth} />}
            tone="filed"
            icon="check"
            onClick={() => setFiledOpen(true)}
            sub="click for the breakdown"
          />
          <Stat
            label="Unowned"
            value={<CountUp n={summary.unassigned} />}
            icon="user"
            onClick={() => nav("/clients?owner=none")}
            sub={summary.unassigned > 0 ? "open items with no staff" : "everything is owned"}
            hint="Open items on clients with no assigned staff member."
          />
        </div>
      </div>

      <div className="dashrow">
        <div className="chartcard">
          <div className="chartcard__head">Where every obligation stands</div>
          <StatusDonut
            centerLabel="closed"
            centerValue={`${closedRate}%`}
            segments={[
              { key: "filed", label: "Filed", value: statusMix.filed, cls: "filed" },
              { key: "pending", label: "Pending", value: statusMix.pending, cls: "pending" },
              { key: "overdue", label: "Overdue", value: statusMix.overdue, cls: "overdue" },
              { key: "na", label: "Not applicable", value: statusMix.na, cls: "na" },
            ]}
          />
        </div>
        <div className="chartcard">
          <div className="chartcard__head">
            Late fees by head <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "var(--ink-4)" }}>· estimated</span>
          </div>
          <HeadExposureBars byHead={headExposure} />
        </div>
      </div>

      {/* Picking a day now opens underneath the bar you clicked, instead of
          silently rewriting a list two screens further down. */}
      <Runway loads={loads} selected={pickedDay} onSelect={setPickedDay}>
        <RunList
          head
          defaultSort="open"
          defaultDesc
          runs={dayRuns}
          emptyTitle="Nothing due on this date"
          emptyBody="No statutory due date in the calendar falls on this day for this book."
        />
      </Runway>

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
                  onClick={() => setQueue(qq.key)}
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
          defaultSort={active.sort}
          defaultDesc={active.desc}
          runs={activeQueue}
          emptyTitle={active.empty}
          emptyBody={active.emptyBody}
        />
      </div>

      <FiledDrawer open={filedOpen} onClose={() => setFiledOpen(false)} />
    </div>
  );
}
