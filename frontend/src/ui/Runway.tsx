/* ============================================================================
   RUNWAY
   ----------------------------------------------------------------------------
   The signature element, and the one piece of chart in the product.

   A CA office does not run on a smooth workload — it runs on a monthly pulse:
   the 7th (TDS challan), 10th (GSTR-7/8), 11th (GSTR-1), 15th (PF/ESI), 20th
   (GSTR-3B), then the annual walls at 31 Jul, 30 Sep, 31 Oct. A donut of
   "filed vs pending" hides that rhythm completely. A time strip makes it the
   first thing you see.

   Bar height = open items landing that day (sqrt-scaled so a 4-item day is
   still visible next to a 400-item wall). Left of the today marker is the
   past — bars there are unfiled arrears, not history.

   TWO FIXES TO THE HOVER READOUT.
   1. Every bar also carried a native `title`, so the browser's own tooltip
      opened on top of the styled one and the two overlapped — one saying
      "30 Jul 2026 — 0 open" over another saying "0 open · 0 overdue".
      The native one is gone; a bar is a graphical mark and gets one readout.
   2. The readout was positioned `absolute` inside `.runway`, which clips with
      overflow:hidden to hold its rounded corners — so a tooltip sitting above
      the bar was sliced in half by the card's own top edge. It is now `fixed`
      in viewport coordinates (the same escape the calendar's chip tooltip
      uses) and clamped to the window, so it can never be cut off.

   Picking a day expands a panel underneath rather than only changing a list
   further down the page: the answer to "what lands on the 20th" now appears
   where the question was asked.
   ========================================================================== */

import { useEffect, useState, type ReactNode } from "react";
import type { DayLoad } from "../domain/engine.ts";
import { TODAY, dow, fmtDate, isWeekend, parts, urgency } from "../domain/dates.ts";
import { Icon } from "./Icon.tsx";
import { useRevealOnPick } from "./bits.tsx";

const DOW_INITIAL = ["S", "M", "T", "W", "T", "F", "S"];
/** Half the tooltip's widest expected box — used to keep it inside the window. */
const TIP_HALF = 110;

export function Runway({
  loads, selected, onSelect, children,
}: {
  loads: DayLoad[];
  selected?: string | null;
  onSelect?: (date: string | null) => void;
  /** Detail for the selected day, revealed in the panel below the strip. */
  children?: ReactNode;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; d: DayLoad } | null>(null);
  /* Clicking a bar opened the panel below the fold on a laptop, so the click
     looked like it had done nothing. The panel brings itself into view once
     its open transition has run. */
  const panelRef = useRevealOnPick<HTMLDivElement>(selected ?? null);

  /* A tooltip pinned to viewport coordinates has to let go when the page moves
     under it, or it hangs over the wrong bar. */
  useEffect(() => {
    if (!tip) return;
    const drop = () => setTip(null);
    window.addEventListener("scroll", drop, true);
    window.addEventListener("resize", drop);
    return () => {
      window.removeEventListener("scroll", drop, true);
      window.removeEventListener("resize", drop);
    };
  }, [tip]);

  const max = Math.max(1, ...loads.map((l) => l.open));
  const scale = (n: number) => (n <= 0 ? 0 : Math.max(3, Math.round((Math.sqrt(n) / Math.sqrt(max)) * 78)));

  const totalOpen = loads.reduce((a, l) => a + l.open, 0);
  const arrears = loads.filter((l) => l.date < TODAY).reduce((a, l) => a + l.overdue, 0);
  const openPanel = !!selected && !!children;

  return (
    <div className={`runway${openPanel ? " has-panel" : ""}`}>
      <div className="runway__head">
        <span className="runway__title">Filing runway</span>
        <span className="shead__note num">
          {loads.length} days · {totalOpen} open items
          {arrears > 0 ? ` · ${arrears} in arrears` : ""}
        </span>
        <span className="runway__legend">
          <span><i style={{ background: "var(--urg-past-solid)" }} />arrears</span>
          <span><i style={{ background: "var(--urg-now-solid)" }} />≤1d</span>
          <span><i style={{ background: "var(--urg-near-solid)" }} />≤3d</span>
          <span><i style={{ background: "var(--urg-soon-solid)" }} />≤7d</span>
          <span><i style={{ background: "var(--urg-calm-solid)" }} />later</span>
        </span>
      </div>

      {/* Wrapped together so the day strip and its axis scroll in lockstep on
          a phone, where 30+ days can no longer each be squeezed thin enough
          to keep a two-line date label legible. Desktop has no need of the
          wrapper's own scrolling — both children stay the flex row they
          always were, just with a fixed per-day width below the breakpoint
          instead of an ever-shrinking flex:1 1 0. */}
      <div className="runway__scroll">
      <div className="runway__strip">
        {loads.map((l) => {
          const past = l.date < TODAY;
          const isToday = l.date === TODAY;
          const band = past ? (l.overdue > 0 ? "past" : "calm") : urgency(l.date);
          /* Anchored to the BAR, not to the button. The button fills the strip's
             full height, so anchoring there parked every tooltip up at the
             card's title regardless of how tall the day actually was — a 3-item
             day and a 436-item wall both threw their readout over the header.
             Off the bar it sits just above the mark it describes. */
          const show = (el: Element) => {
            const bar = el.querySelector(".rwday__bar") ?? el;
            const r = bar.getBoundingClientRect();
            setTip({
              x: Math.min(window.innerWidth - TIP_HALF - 8, Math.max(TIP_HALF + 8, r.left + r.width / 2)),
              y: r.top - 6,
              d: l,
            });
          };
          return (
            <button
              key={l.date}
              type="button"
              className={`rwday${past ? " is-past" : ""}${isToday ? " is-today" : ""}${selected === l.date ? " is-sel" : ""}`}
              aria-label={`${fmtDate(l.date)}: ${l.open} open, ${l.overdue} overdue`}
              aria-expanded={selected === l.date}
              onClick={() => onSelect?.(selected === l.date ? null : l.date)}
              onMouseEnter={(e) => show(e.currentTarget)}
              onFocus={(e) => show(e.currentTarget)}
              onMouseLeave={() => setTip(null)}
              onBlur={() => setTip(null)}
            >
              {isWeekend(l.date) ? <span className="rwday__weekend" /> : null}
              <span className={`rwday__bar b-${band}`} style={{ height: scale(l.open) }} />
            </button>
          );
        })}
      </div>

      <div className="runway__axis">
        {loads.map((l) => {
          const { d } = parts(l.date);
          const isToday = l.date === TODAY;
          const first = d === 1;
          return (
            <span
              key={l.date}
              className={`rwtick${isToday ? " is-today" : ""}${first ? " is-month" : ""}${selected === l.date ? " is-sel" : ""}`}
            >
              <b>{isToday ? "today" : d}</b>
              {first ? fmtDate(l.date).split(" ")[1] : DOW_INITIAL[dow(l.date)]}
            </span>
          );
        })}
      </div>
      </div>

      {/* Slide-down detail. The wrapper animates grid-template-rows 0fr → 1fr,
          which is the one way to transition to a height nobody knows in
          advance — max-height guesses either clip the content or make the
          easing wrong. */}
      <div ref={panelRef} className={`rwpanel${openPanel ? " is-open" : ""}`}>
        <div className="rwpanel__clip">
          <div className="rwpanel__in">
            {selected ? (
              <div className="rwpanel__bar">
                <Icon name="calendar" size={14} />
                <b>{fmtDate(selected)}</b>
                <span className="u-spacer" />
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onSelect?.(null)}
                >
                  <Icon name="close" size={12} /> Close
                </button>
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </div>

      {tip ? (
        /* Two lines, no hint. A "click to see what lands" line repeated on
           every one of thirty bars is a tutorial nobody needs twice, and it
           made a readout of two numbers into a paragraph. */
        <div className="rwtip" style={{ left: tip.x, top: tip.y }} role="status">
          <div className="rwtip__d">{fmtDate(tip.d.date)}</div>
          <div className="rwtip__n">
            {tip.d.open === 0 && tip.d.overdue === 0 ? "nothing due" : (
              <>
                <b>{tip.d.open}</b> open
                {tip.d.overdue > 0 ? <> · <b className="is-late">{tip.d.overdue}</b> late</> : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
