/* ============================================================================
   FILED THIS MONTH
   ----------------------------------------------------------------------------
   What the dashboard's "filed this month" figure is actually made of.

   The card used to link to the tracker with a "filed" filter, which answers a
   different question in a different unit: the card counts FILINGS completed in
   a month, the tracker's filter selects CLIENTS with nothing outstanding at
   all. 351 filings and 11 clients, from one click.

   Broken down by filing run, never by client — one row is "GSTR-3B July, 88
   clients", because a firm with 10,000 clients cannot be handed a list of
   them and a practice thinks in forms and periods anyway.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CLIENT_BY_ID } from "../domain/book.ts";
import { headClass } from "../domain/catalog.ts";
import { filedInMonth, monthsWithFilings } from "../domain/engine.ts";
import { MONTHS_LONG, TODAY, fmtShort } from "../domain/dates.ts";
import { useApp, useEngine } from "./app-state.tsx";
import { Drawer } from "./Drawer.tsx";
import { exportXlsx } from "./exportXlsx.ts";
import { Empty } from "./bits.tsx";
import { Icon } from "./Icon.tsx";

function monthLabelOf(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function FiledDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useApp();
  const [month, setMonth] = useState(() => TODAY.slice(0, 7));
  /* Which run is expanded. Only one at a time — this is a summary, and three
     open client lists at once is the list the drawer exists to avoid. */
  const [openRun, setOpenRun] = useState<string | null>(null);

  /* `months` already subscribes to the store via useEngine, so this
     component re-renders on every store change. `groups` is computed plainly
     (not through useEngine) because it also depends on `month`, local state
     that useEngine's memo does not track — memoizing it there left the list
     frozen on the old month whenever the arrows below changed `month`
     without a store change alongside it. */
  const months = useEngine(monthsWithFilings);
  const groups = filedInMonth(month);

  const total = useMemo(() => groups.reduce((a, g) => a + g.count, 0), [groups]);
  const clients = useMemo(
    () => new Set(groups.flatMap((g) => g.rows.map((r) => r.clientId))).size,
    [groups],
  );
  /* Filings with no acknowledgement on record. Surfaced because it is the one
     number the export is worth running for: these are the rows that cannot be
     proved from inside the app if a notice arrives. */
  const noArn = useMemo(() => groups.reduce((a, g) => a + g.withoutArn, 0), [groups]);

  /* Step through months that actually have filings, so the arrows can never
     land somewhere empty. */
  const idx = months.indexOf(month);
  const older = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : null;
  const newer = idx > 0 ? months[idx - 1] : null;

  const exportXlsxFile = async () => {
    const headers = [
      "Compliance", "Head", "Period", "Due date", "Client", "PAN",
      "Filed on", "Status source", "Acknowledgement", "Recorded by",
    ];
    const rows: (string | number)[][] = [];
    for (const g of groups) {
      for (const r of g.rows) {
        const c = CLIENT_BY_ID[r.clientId];
        rows.push([
          g.form, g.head, g.periodLabel, g.dueDate, c?.name ?? r.clientId, c?.pan ?? "",
          r.filedOn, r.basis, r.arn ?? "", r.filedBy ?? "",
        ]);
      }
    }
    await exportXlsx({ filename: `filed-${month}.xlsx`, headers, rows });
    toast(`Exported ${total} filings`);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Filed in ${monthLabelOf(month)}`}
      subtitle={
        total > 0
          ? (
            <>
              <b>{total.toLocaleString("en-IN")}</b> filings · {clients.toLocaleString("en-IN")} clients
              {noArn > 0 ? <> · {noArn.toLocaleString("en-IN")} without an acknowledgement</> : null}
            </>
          )
          : "Nothing completed in this month"
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn--sm"
            disabled={!older}
            onClick={() => { if (older) { setMonth(older); setOpenRun(null); } }}
          >
            <Icon name="chevronLeft" size={14} />
            {older ? monthLabelOf(older).split(" ")[0] : "Earlier"}
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={!newer}
            onClick={() => { if (newer) { setMonth(newer); setOpenRun(null); } }}
          >
            {newer ? monthLabelOf(newer).split(" ")[0] : "Later"}
            <Icon name="chevronRight" size={14} />
          </button>
          <span className="u-spacer" />
          <button type="button" className="btn btn--sm" onClick={exportXlsxFile} disabled={total === 0}>
            <Icon name="download" size={14} /> Export
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={onClose}>Close</button>
        </>
      }
    >
      {groups.length === 0 ? (
        <Empty title="Nothing filed">
          No filings were completed in {monthLabelOf(month)}.
        </Empty>
      ) : (
        <div className="filedlist">
          {groups.map((g) => {
            const expanded = openRun === g.runId;
            return (
              <div key={g.runId} className={`filedrow${expanded ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="filedrow__head"
                  aria-expanded={expanded}
                  onClick={() => setOpenRun(expanded ? null : g.runId)}
                >
                  <span className={`spine ${headClass(g.head)}`} />
                  <span className="filedrow__id">
                    <b>{g.form}</b>
                    <span className="u-mute">{g.periodLabel} · {g.head} · due {fmtShort(g.dueDate)}</span>
                  </span>
                  <span className="filedrow__n num">{g.count.toLocaleString("en-IN")}</span>
                  <Icon
                    name="chevronDown"
                    size={14}
                    className={`filedrow__caret${expanded ? " is-up" : ""}`}
                  />
                </button>

                {expanded ? (
                  <div className="filedrow__body">
                    {/* Capped. The point of the drill-down is "who", answered
                        for a readable number of them; the full set is the
                        export's job. */}
                    {g.rows.slice(0, 40).map((r) => {
                      const c = CLIENT_BY_ID[r.clientId];
                      return (
                        <Link key={r.clientId} to={`/clients/${r.clientId}`} className="filedcli" onClick={onClose}>
                          <span className="u-truncate">{c?.name ?? r.clientId}</span>
                          {r.arn
                            ? <span className="u-faint num">{r.arn}</span>
                            : <span className="u-faint">no ARN</span>}
                        </Link>
                      );
                    })}
                    {g.rows.length > 40 ? (
                      <div className="filedrow__more">
                        +{(g.rows.length - 40).toLocaleString("en-IN")} more · use Export for the full list
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
