/* ============================================================================
   RUN LIST
   ----------------------------------------------------------------------------
   The primary object in this product is a FILING RUN: one form, one period,
   N clients. Staff do not work client-by-client — on the 18th they work
   "GSTR-3B, July, everyone who hasn't filed". So the run is what gets a row,
   and individual clients only appear once you open one.

   This is also what makes the screen survive a 10,000-client book: the row
   count is bounded by the statutory calendar, not by the size of the firm.

   COLUMN HEADER. The list used to be introduced by a sentence of prose ("Past
   their due date and still unfiled. Ordered by how many clients are missing…")
   which had to be read once and was then dead weight above every screen —
   and it left the six columns underneath unlabelled, so "62 / 418" and "18d"
   had to be inferred. `head` turns on a real header row: the columns are
   named, and the three that carry an ordering (due date, how many are open,
   what it is costing) can be sorted by clicking them. The prose survives as
   the tab's tooltip, where it is available once and in the way never.

   The header is deliberately NOT sticky. `.queuecard` and `.runs` both clip
   with overflow:hidden to keep their rounded corners, which silently breaks a
   sticky offset — the same trap that bit the tracker's <th> (see the `:has()`
   fix in app.css). A queue is a dozen rows; it does not need one.
   ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FilingRun } from "../domain/types.ts";
import { fmtShort, inrShort } from "../domain/dates.ts";
import { headClass } from "../domain/catalog.ts";
import { Countdown, Pbar } from "./bits.tsx";
import { Icon } from "./Icon.tsx";
import { Empty } from "./bits.tsx";

/** Which column the list is ordered by. `form` is alphabetical; the rest are
 *  the orderings staff actually ask for out loud. */
export type RunSort = "form" | "due" | "open" | "exposure";

interface Column {
  key: RunSort | null;
  label: string;
  /** Figures right-align; names left-align. */
  right?: boolean;
  /** First click on this column sorts descending (biggest problem first). */
  descFirst?: boolean;
}

/* Mirrors `.run`'s grid, column for column. The spine and chevron are
   structural, so they get an empty header cell rather than a label. */
const COLUMNS: Column[] = [
  { key: null, label: "" },
  { key: "form", label: "Compliance" },
  { key: "due", label: "Due" },
  { key: "open", label: "Open", right: true, descFirst: true },
  { key: null, label: "Progress" },
  { key: "exposure", label: "Late fees", right: true, descFirst: true },
  { key: null, label: "" },
];

function compare(a: FilingRun, b: FilingRun, key: RunSort): number {
  switch (key) {
    case "form":
      return a.def.form.localeCompare(b.def.form) || a.dueDate.localeCompare(b.dueDate);
    case "due":
      return a.dueDate.localeCompare(b.dueDate) || b.overdue - a.overdue;
    case "open":
      return (a.pending + a.overdue) - (b.pending + b.overdue) || a.dueDate.localeCompare(b.dueDate);
    case "exposure":
      return a.exposure - b.exposure || a.dueDate.localeCompare(b.dueDate);
  }
}

export function RunList({
  runs, emptyTitle, emptyBody, head = false, defaultSort = "due", defaultDesc,
}: {
  runs: FilingRun[];
  emptyTitle?: string;
  emptyBody?: string;
  /** Show the sortable column header. Off by default so the compact lists
   *  (month groups on Filing, the drawer) stay uninterrupted. */
  head?: boolean;
  defaultSort?: RunSort;
  defaultDesc?: boolean;
}) {
  const nav = useNavigate();
  const [sort, setSort] = useState<RunSort>(defaultSort);
  const [desc, setDesc] = useState(!!defaultDesc);

  /* Switching queue tab hands us a different list under a different natural
     ordering. Follow it, rather than keeping the ordering the user chose for
     the queue they just left. */
  useEffect(() => {
    setSort(defaultSort);
    setDesc(!!defaultDesc);
  }, [defaultSort, defaultDesc]);

  const ordered = useMemo(() => {
    if (!head) return runs; /* caller's order is authoritative when unheaded */
    const out = [...runs].sort((a, b) => compare(a, b, sort));
    return desc ? out.reverse() : out;
  }, [runs, sort, desc, head]);

  function toggle(col: Column) {
    if (!col.key) return;
    if (col.key === sort) setDesc((d) => !d);
    else {
      setSort(col.key);
      setDesc(!!col.descFirst);
    }
  }

  if (runs.length === 0) {
    return (
      <div className="runs">
        <Empty title={emptyTitle ?? "Nothing here"}>{emptyBody}</Empty>
      </div>
    );
  }

  return (
    <div className="runs">
      {head ? (
        <div className="runhead" role="row">
          {COLUMNS.map((col, i) =>
            col.key ? (
              <button
                key={col.key}
                type="button"
                role="columnheader"
                aria-sort={col.key === sort ? (desc ? "descending" : "ascending") : "none"}
                className={`runhead__c runhead__c--btn${col.right ? " is-right" : ""}${
                  col.key === sort ? " is-sorted" : ""
                }`}
                onClick={() => toggle(col)}
              >
                {col.label}
                <Icon
                  name="chevronDown"
                  size={12}
                  className={`runhead__caret${col.key === sort && !desc ? " is-up" : ""}`}
                />
              </button>
            ) : (
              <span key={i} className={`runhead__c${col.right ? " is-right" : ""}`} role="columnheader">
                {col.label}
              </span>
            ),
          )}
        </div>
      ) : null}

      {ordered.map((r) => {
        const open = r.pending + r.overdue;
        return (
          <button
            type="button"
            key={r.runId}
            className="run"
            onClick={() => nav(`/runs/${encodeURIComponent(r.runId)}`)}
          >
            <span className={`run__spine ${headClass(r.def.head)}`} />

            <span className="run__id">
              <span className="run__form">{r.def.form}</span>
              <span className="run__meta">
                <span>{r.periodLabel}</span>
                <span className="u-faint">·</span>
                <span>{r.def.head}</span>
              </span>
            </span>

            <span className="u-col run__duecol">
              <span className="run__due">{fmtShort(r.dueDate)}</span>
              <span className="run__cd"><Countdown due={r.dueDate} /></span>
            </span>

            <span className="u-col u-right run__opencol">
              <span className="num" style={{ fontSize: "var(--t-14)", fontWeight: 600 }}>{open}</span>
              <span className="u-mute" style={{ fontSize: "var(--t-11)" }}>of {r.total} open</span>
            </span>

            <span className="run__prog">
              <Pbar filed={r.filed} pending={r.pending} overdue={r.overdue} />
            </span>

            <span className={`run__money${r.exposure > 0 ? "" : " is-nil"}`}>
              {r.exposure > 0 ? inrShort(r.exposure) : "—"}
            </span>

            <span className="run__chev"><Icon name="chevronRight" size={16} /></span>
          </button>
        );
      })}
    </div>
  );
}
