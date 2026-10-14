/* ============================================================================
   CELL HOVER CARD — the Tracker cell's facts on hover
   ----------------------------------------------------------------------------
   A cell says only Filed / Late / Pending. Hovering it answers the next
   questions without a click: how late (and what it is costing), when it is
   due, who owns it, and whether the client has been chased. Clicking the
   cell still opens the full drawer.
   ========================================================================== */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Obligation, OutboxEntry } from "../domain/types.ts";
import { staffOf } from "../domain/book.ts";
import { TODAY, fmtShort, inrShort } from "../domain/dates.ts";

const days = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function CellHoverCard({
  cell, clientName, rect, outbox,
}: { cell: Obligation; clientName: string; rect: DOMRect; outbox: OutboxEntry[] }) {
  const lastReminder = useMemo(() => {
    let last: OutboxEntry | undefined;
    for (const e of outbox) if (e.obligationId === cell.id && (!last || e.sentAt > last.sentAt)) last = e;
    return last;
  }, [outbox, cell.id]);

  let tone = "pending", label = "Pending", headline = "", extra: string | null = null;
  if (cell.status === "Overdue") {
    tone = "overdue"; label = "Late";
    headline = `Late by ${plural(cell.daysOverdue, "day")}`;
    extra = cell.exposure > 0 ? `Late fee so far ${inrShort(cell.exposure)}` : null;
  } else if (cell.status === "Filed") {
    tone = "filed"; label = "Filed";
    const lateBy = cell.filedOn ? days(cell.filedOn, cell.dueDate) : 0;
    headline = cell.filedOn ? `Filed on ${fmtShort(cell.filedOn)}` : "Filed";
    extra = cell.filedOn ? (lateBy > 0 ? `${plural(lateBy, "day")} after the due date` : "On time") : null;
  } else if (cell.status === "Pending") {
    const d = days(cell.dueDate, TODAY);
    headline = d === 0 ? "Due today" : `Due ${fmtShort(cell.dueDate)} · in ${plural(d, "day")}`;
  } else {
    tone = "na"; label = "Not applicable";
    headline = "Does not apply to this client";
  }

  const owner = staffOf(cell.assigneeId).name;
  const reminder = lastReminder
    ? `${fmtShort(lastReminder.sentAt.slice(0, 10))} · ${lastReminder.channel} · ${lastReminder.status === "Read" ? "read" : lastReminder.status === "Delivered" ? "not opened" : lastReminder.status.toLowerCase()}`
    : "No reminder sent";

  /* Placement uses the card's real size, measured after it renders: below the
     cell if it fits, otherwise above, otherwise clamped inside the window.
     Hidden for that first measuring frame so it never flashes in the wrong
     place. */
  const W = 280, GAP = 6, EDGE = 8;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight, vh = window.innerHeight, vw = window.innerWidth;
    let top: number;
    if (rect.bottom + GAP + h <= vh - EDGE) top = rect.bottom + GAP;
    else if (rect.top - GAP - h >= EDGE) top = rect.top - GAP - h;
    else top = Math.max(EDGE, vh - EDGE - h);
    const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - W / 2), vw - W - EDGE);
    setPos({ top, left });
  }, [rect, cell.id]);

  return (
    <div
      ref={ref}
      className="hovercard"
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: W, visibility: pos ? "visible" : "hidden" }}
      role="tooltip"
    >
      <div className="hovercard__head">
        <b>{cell.form} · {cell.periodLabel}</b>
        <small>{clientName}</small>
      </div>
      <div className="hovercard__status">
        <span className={`mxlabel hc--${tone}`}>{label}</span>
        <span>
          <b>{headline}</b>
          {extra ? <small className={tone === "overdue" ? "hovercard__red" : ""}>{extra}</small> : null}
        </span>
      </div>
      <dl className="hovercard__dl">
        <dt>Due date</dt><dd>{fmtShort(cell.dueDate)}</dd>
        <dt>Owner</dt><dd>{cell.assigneeId === "none" ? <span className="hovercard__muted">No owner</span> : owner}</dd>
        <dt>Last reminder</dt><dd className={lastReminder ? "" : "hovercard__muted"}>{reminder}</dd>
      </dl>
      <div className="hovercard__foot">Click for full details</div>
    </div>
  );
}
