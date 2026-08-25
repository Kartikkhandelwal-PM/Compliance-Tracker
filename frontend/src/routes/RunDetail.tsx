/* ============================================================================
   RUN DETAIL — the batch workspace
   ----------------------------------------------------------------------------
   Where the actual work happens: one form, one period, the client list behind
   it, and the three things staff do to that list — mark filed, chase, reassign.
   Bulk selection is the default interaction rather than an afterthought,
   because ticking 90 clients off GSTR-3B one at a time is the manual labour
   this module is meant to delete.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { FilingStatus, Obligation } from "../domain/types.ts";
import { useApp, useObligations } from "../ui/app-state.tsx";
import { STAFF, staffOf } from "../domain/book.ts";
import { DEF_BY_CODE } from "../domain/catalog.ts";
import {
  markFiled, ownerIdOf, ownerOf, reassign, sendReminders, unmarkFiled,
} from "../domain/engine.ts";
import { fmtLong, inr, inrShort } from "../domain/dates.ts";
import {
  Avatar, Check, Countdown, Empty, HeadName, PageHead, Pbar, Stat, StatusTag,
} from "../ui/bits.tsx";
import { exportXlsx } from "../ui/exportXlsx.ts";
import { Icon } from "../ui/Icon.tsx";
import { ObligationDrawer } from "../ui/ObligationDrawer.tsx";

type Filter = "all" | "open" | "overdue" | "filed" | "na";

export function RunDetailPage() {
  const { runId = "" } = useParams();
  const decoded = decodeURIComponent(runId);
  const all = useObligations();
  const { toast, me } = useApp();

  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<Obligation | null>(null);
  /* Mark-filed is the one bulk action here that cannot be shrugged off: it
     zeroes penalty exposure and stops the chase for every row it touches. The
     other two are recoverable — a reassignment is one more reassignment away
     from correct, and an extra reminder is a nuisance, not a compliance risk —
     so only this one asks. */
  const [confirming, setConfirming] = useState(false);

  const items = useMemo(() => all.filter((o) => o.runId === decoded), [all, decoded]);

  const rows = useMemo(() => {
    /* "Not applicable" rows used to be stripped here unconditionally, so the
       stat card counted rows the table could never display and "Everyone"
       did not include them. They are now reachable through their own filter,
       and still excluded from the working views where they would be noise. */
    let list = items;
    if (filter === "na") list = list.filter((o) => o.status === "Not Applicable");
    else {
      list = list.filter((o) => o.status !== "Not Applicable");
      if (filter === "open") list = list.filter((o) => o.status !== "Filed");
      else if (filter === "overdue") list = list.filter((o) => o.status === "Overdue");
      else if (filter === "filed") list = list.filter((o) => o.status === "Filed");
    }

    if (owner !== "all") list = list.filter((o) => o.assigneeId === owner);

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((o) => {
        const c = ownerOf(o);
        return (
          c.name.toLowerCase().includes(needle) ||
          ownerIdOf(o).value.toLowerCase().includes(needle)
        );
      });
    }

    const order: Record<FilingStatus, number> = { Overdue: 0, Pending: 1, Filed: 2, "Not Applicable": 3 };
    return [...list].sort(
      (a, b) => order[a.status] - order[b.status] ||
        b.exposure - a.exposure ||
        ownerOf(a).name.localeCompare(ownerOf(b).name),
    );
  }, [items, filter, owner, q]);

  if (items.length === 0) {
    return (
      <div className="page">
        <Empty title="Run not found">This filing run has no clients attached, or the link is stale.</Empty>
      </div>
    );
  }

  const first = items[0];
  const def = DEF_BY_CODE[first.defCode];
  const counts = items.reduce(
    (a, o) => {
      if (o.status === "Filed") a.filed++;
      else if (o.status === "Overdue") a.overdue++;
      else if (o.status === "Pending") a.pending++;
      else a.na++;
      a.exposure += o.exposure;
      return a;
    },
    { filed: 0, pending: 0, overdue: 0, na: 0, exposure: 0 },
  );

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectedIds = [...selected];

  const idLabel = ownerIdOf(first).label;

  const exportXlsxFile = async () => {
    const headers = ["Client", idLabel, "State", "Form", "Period", "Due date", "Status", "Status source", "Acknowledgement", "Filed on", "Recorded by", "Days overdue", "Estimated penalty", "Owner"];
    const dataRows = rows.map((o) => {
      const c = ownerOf(o);
      return [
        c.name, ownerIdOf(o).value, c.state, o.form, o.periodLabel, o.dueDate,
        o.status, o.basis, o.arn ?? "", o.filedOn ?? "", o.filedBy ?? "",
        o.daysOverdue, o.exposure, staffOf(o.assigneeId).name,
      ];
    });
    await exportXlsx({
      filename: `${def.code}-${first.periodLabel.replace(/[^\w]+/g, "-")}.xlsx`,
      headers, rows: dataRows,
    });
    toast(`Exported ${rows.length} rows`);
  };

  return (
    <div className="page page--wide">
      <PageHead
        title={`${def.form} · ${first.periodLabel}`}
        icon="runs"
        note={
          <>
            {def.head} · due <b>{fmtLong(first.dueDate)}</b> · applies to{" "}
            <b>{items.length - counts.na}</b> clients
          </>
        }
        aside={
          <>
            <button type="button" className="btn" onClick={exportXlsxFile}>
              <Icon name="download" size={15} /> Export
            </button>
            <Link to="/calendar" className="btn"><Icon name="chevronLeft" size={15} /> Calendar</Link>
          </>
        }
      />

      <div className="stats" style={{ marginBottom: "var(--s4)" }}>
        <Stat label="Overdue" value={counts.overdue} tone={counts.overdue ? "overdue" : undefined} sub="past due, not filed" />
        <Stat label="Pending" value={counts.pending} sub="not yet due" />
        <Stat label="Filed" value={counts.filed} tone="filed" sub={`${Math.round((counts.filed / Math.max(1, counts.filed + counts.pending + counts.overdue)) * 100)}% of the run`} />
        <Stat label="At risk" value={inrShort(counts.exposure)} tone={counts.exposure ? "overdue" : undefined} sub="estimated late fees" />
        <Stat
          label="Not applicable"
          value={counts.na}
          sub="excluded by rule or by a person"
          onClick={() => setFilter(filter === "na" ? "open" : "na")}
        />
      </div>

      <div style={{ marginBottom: "var(--s5)" }}>
        <Pbar filed={counts.filed} pending={counts.pending} overdue={counts.overdue} tall />
      </div>

      <div className="note" style={{ marginBottom: "var(--s5)" }}>
        <b>If missed:</b> {def.lateFee.note}
      </div>

      <div className="filters">
        <div className="field" style={{ width: 260 }}>
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a client by name or ${idLabel}`} />
        </div>
        <div className="seg">
          {([["open", "Open"], ["overdue", "Overdue"], ["filed", "Filed"], ["all", "Everyone"], ["na", "Not applicable"]] as [Filter, string][]).map(
            ([v, label]) => (
              <button key={v} type="button" className={filter === v ? "is-on" : ""} onClick={() => setFilter(v)}>
                {label}
              </button>
            ),
          )}
        </div>
        <select className="plain" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="all">Any owner</option>
          <option value="none">Unassigned</option>
          {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="u-spacer" />
        <span className="u-mute num" style={{ fontSize: "var(--t-12)" }}>{rows.length} rows</span>
      </div>

      <div className="sheet">
        <table className="ltable">
          <thead>
            <tr>
              <th className="tight" style={{ width: 34 }}>
                <button type="button" onClick={toggleAll} style={{ border: "none", background: "none", padding: 0 }} aria-label="Select all">
                  <Check on={allSelected} />
                </button>
              </th>
              <th>Client</th>
              <th>State</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Source</th>
              <th>Reminder</th>
              <th className="u-right">Days</th>
              <th className="u-right">At risk</th>
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const c = ownerOf(o);
              const on = selected.has(o.id);
              return (
                <tr key={o.id} className={`is-clickable${on ? " is-selected" : ""}`} onClick={() => setPeek(o)}>
                  <td className="tight" onClick={(e) => { e.stopPropagation(); toggle(o.id); }}>
                    <Check on={on} />
                  </td>
                  <td>
                    <div className="u-strong u-truncate" style={{ maxWidth: 280 }}>{c.name}</div>
                    <div className="num u-mute" style={{ fontSize: "var(--t-11)" }}>
                      {ownerIdOf(o).value}
                    </div>
                  </td>
                  <td className="u-mute">{c.state}</td>
                  <td>
                    <span className="u-row">
                      <Avatar initials={staffOf(o.assigneeId).initials} />
                      <span className="u-truncate" style={{ maxWidth: 110 }}>{staffOf(o.assigneeId).name}</span>
                    </span>
                  </td>
                  <td><StatusTag status={o.status} /></td>
                  <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>
                    {o.basis}
                    {/* The acknowledgement, or the fact that there isn't one.
                        Filed rows with nothing to show are the ones worth
                        finding later, so the absence is printed rather than
                        left as an empty cell that reads as "not checked". */}
                    {o.status === "Filed" ? (
                      <div className="num" style={{ fontSize: "var(--t-11)", marginTop: 2 }}>
                        {o.arn ?? <span className="u-faint">no ARN</span>}
                      </div>
                    ) : null}
                  </td>
                  <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{o.reminderStage}</td>
                  <td className="u-right">
                    {o.status === "Overdue"
                      ? <span className="cd cd--past">+{o.daysOverdue}</span>
                      : o.status === "Pending" ? <Countdown due={o.dueDate} /> : <span className="u-faint">—</span>}
                  </td>
                  <td className="u-right num" style={{ color: o.exposure ? "var(--st-overdue-fg)" : "var(--ink-4)", fontWeight: o.exposure ? 600 : 400 }}>
                    {o.exposure ? `₹${inr(o.exposure)}` : "—"}
                  </td>
                  <td className="u-faint"><Icon name="chevronRight" size={14} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <Empty title="No clients match these filters" /> : null}
      </div>

      {selectedIds.length > 0 ? (
        <div className="bulkbar">
          {confirming ? (
            <>
              {/* The count is spelled out again here rather than left to the
                  selection the reader may have stopped looking at. "Mark 312
                  filed?" is a different decision from "Mark filed?" and the
                  number is the whole of it. */}
              <span>
                Mark <b className="num">{selectedIds.length}</b>{" "}
                {selectedIds.length === 1 ? "client" : "clients"} filed?
                {" "}Late fees stop and reminders are cancelled. No acknowledgement
                number is recorded for a bulk action.
              </span>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  const ids = selectedIds;
                  markFiled(ids, { by: me.name });
                  toast(`${ids.length} marked filed by ${me.name}`, {
                    label: "Undo",
                    run: () => toast(`${unmarkFiled(ids)} filings reopened`),
                  });
                  setSelected(new Set());
                  setConfirming(false);
                }}
              >
                <Icon name="check" size={14} /> Yes, mark filed
              </button>
              <button type="button" className="btn btn--sm" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
          <span className="num"><b>{selectedIds.length}</b> selected</span>
          <button
            type="button"
            className="btn btn--sm"
            /* No acknowledgement prompt here, by design: this action routinely
               covers hundreds of clients and there is one ARN per client, not
               one per batch. Who marked them is still recorded — that costs the
               user nothing and is the question asked first when a filing is
               later disputed. */
            onClick={() => setConfirming(true)}
          >
            <Icon name="check" size={14} /> Mark filed
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => { sendReminders(selectedIds, ["WhatsApp", "Email"]); toast(`Reminders queued for ${selectedIds.length} clients`); setSelected(new Set()); }}
          >
            <Icon name="send" size={14} /> Remind
          </button>
          <select
            className="plain"
            style={{ height: 26, fontSize: "var(--t-12)" }}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              reassign(selectedIds, e.target.value);
              toast(`Reassigned ${selectedIds.length} items`);
              setSelected(new Set());
            }}
          >
            <option value="">Assign to…</option>
            {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <Icon name="close" size={14} />
          </button>
            </>
          )}
        </div>
      ) : null}

      <ObligationDrawer obligation={peek} onClose={() => setPeek(null)} />

      <div style={{ marginTop: "var(--s6)" }}>
        <HeadName head={def.head} />
        <span className="u-mute" style={{ fontSize: "var(--t-12)", marginLeft: 8 }}>
          Statutory rule: {def.dueRule} · Applicability: {def.applicability}
        </span>
      </div>
    </div>
  );
}
