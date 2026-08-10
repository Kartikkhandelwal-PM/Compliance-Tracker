/* ============================================================================
   CLIENTS
   ----------------------------------------------------------------------------
   The book, as a list. That is the whole job.

   This screen used to open on a wall of aggregate cards — entity-type
   breakdown, arrears totals, ₹ at risk — which pushed the actual list below the
   fold. Nobody arriving at "Clients" wants a report; they want to find a client
   or scan the book. Aggregate analysis moved to the Dashboard where it belongs.

   640 clients here, 10,000 in production, so the table is paged and every
   narrowing question is a filter rather than a separate view.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useObligations } from "../ui/app-state.tsx";
import { ALL_STATES, CLIENTS, STAFF, staffOf } from "../domain/book.ts";
import { inr, inrShort } from "../domain/dates.ts";
import { Avatar, Empty, PageHead, Pbar, initialsOf } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";

type SortKey = "exposure" | "overdue" | "name" | "turnover";
/** Compliance state is a filter like any other, so it is a select like any
 *  other. It used to be a lone toggle chip sitting among four dropdowns, which
 *  made one of the five narrowing controls look like a different kind of thing
 *  — and it could only ever ask half the question: there was no way to filter
 *  down to the clients who are *clean*. */
type Health = "all" | "arrears" | "clear";
const PAGE = 40;

/** Entity types offered as a filter, in book order. */
const ENTITY_TYPES = ["Individual", "Company", "LLP", "Firm", "Trust", "AOP/BOI", "HUF"];

interface Row {
  id: string;
  name: string;
  pan: string;
  gstin?: string;
  entity: string;
  state: string;
  assigneeId: string;
  turnover: number;
  filed: number;
  pending: number;
  overdue: number;
  exposure: number;
}

export function ClientsPage() {
  const obligations = useObligations();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");
  const [state, setState] = useState("all");
  /* Team → "Open" deep-links here with ?owner=<staffId>. */
  const [params] = useSearchParams();
  const [owner, setOwner] = useState(() => params.get("owner") ?? "all");
  const [health, setHealth] = useState<Health>(() =>
    params.get("health") === "arrears" ? "arrears" : "all",
  );
  /* Alphabetical by default. A plain list should open in the order people can
     predict; "who owes the most" is a question you ask by changing the sort,
     not the state the screen should greet you in. */
  const [sort, setSort] = useState<SortKey>("name");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const c of CLIENTS) {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        pan: c.pan,
        gstin: c.gstin,
        entity: c.profile.entityType === "Company" ? `Company · ${c.profile.companyType}` : c.profile.entityType,
        state: c.state,
        assigneeId: c.assigneeId,
        turnover: c.profile.turnover,
        filed: 0, pending: 0, overdue: 0, exposure: 0,
      });
    }
    for (const o of obligations) {
      const r = map.get(o.clientId);
      if (!r) continue;
      if (o.status === "Filed") r.filed++;
      else if (o.status === "Overdue") { r.overdue++; r.exposure += o.exposure; }
      else if (o.status === "Pending") r.pending++;
    }
    return [...map.values()];
  }, [obligations]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows;
    if (needle) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(needle) ||
          r.pan.toLowerCase().includes(needle) ||
          (r.gstin ?? "").toLowerCase().includes(needle),
      );
    }
    if (entity !== "all") list = list.filter((r) => r.entity.startsWith(entity));
    if (state !== "all") list = list.filter((r) => r.state === state);
    if (owner !== "all") list = list.filter((r) => r.assigneeId === owner);
    if (health === "arrears") list = list.filter((r) => r.overdue > 0);
    else if (health === "clear") list = list.filter((r) => r.overdue === 0);

    const sorted = [...list];
    if (sort === "exposure") sorted.sort((a, b) => b.exposure - a.exposure || b.overdue - a.overdue);
    else if (sort === "overdue") sorted.sort((a, b) => b.overdue - a.overdue || b.exposure - a.exposure);
    else if (sort === "turnover") sorted.sort((a, b) => b.turnover - a.turnover);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [rows, q, entity, state, owner, health, sort]);

  const visible = filtered.slice(0, limit);

  return (
    <div className="page page--wide">
      <PageHead
        title="Clients"
        icon="clients"
        note={
          <>
            <b>{filtered.length.toLocaleString("en-IN")}</b> of {CLIENTS.length.toLocaleString("en-IN")} clients
          </>
        }
      />

      {/* This screen is a list, not a report. The aggregate cards that used to
          sit here (entity-type breakdown, arrears totals, ₹ at risk) answered a
          question nobody asks on the way to finding one client — that analysis
          belongs on the Dashboard. Filters do the narrowing instead. */}
      <div className="filters">
        <div className="field" style={{ width: 280 }}>
          <Icon name="search" size={15} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
            placeholder="Name, PAN or GSTIN"
          />
        </div>
        <select className="plain" value={entity} onChange={(e) => { setEntity(e.target.value); setLimit(PAGE); }}>
          <option value="all">All entities</option>
          {ENTITY_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="plain" value={state} onChange={(e) => { setState(e.target.value); setLimit(PAGE); }}>
          <option value="all">All states</option>
          {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="plain" value={owner} onChange={(e) => { setOwner(e.target.value); setLimit(PAGE); }}>
          <option value="all">All owners</option>
          <option value="none">Unassigned</option>
          {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          className="plain"
          value={health}
          onChange={(e) => { setHealth(e.target.value as Health); setLimit(PAGE); }}
        >
          <option value="all">All clients</option>
          <option value="arrears">In arrears</option>
          <option value="clear">Up to date</option>
        </select>
        <span className="u-spacer" />
        <select className="plain" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="name">Name A–Z</option>
          <option value="overdue">Most overdue</option>
          <option value="turnover">Turnover</option>
          <option value="exposure">Late fees</option>
        </select>
      </div>

      <div className="sheet">
        <table className="ltable">
          <thead>
            <tr>
              <th>Client</th>
              <th>Entity</th>
              <th>State</th>
              <th>Owner</th>
              <th className="u-right">Turnover</th>
              <th style={{ width: 150 }}>Compliance health</th>
              <th className="u-right">Open</th>
              <th className="u-right">At risk</th>
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="is-clickable" onClick={() => nav(`/clients/${r.id}`)}>
                <td>
                  {/* A face on the row: down 640 rows a client is recognised by
                      its mark before its name is read, the same way staff are
                      in the Owner column. */}
                  <Link
                    to={`/clients/${r.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="u-row"
                    style={{ gap: "var(--s3)" }}
                  >
                    <Avatar initials={initialsOf(r.name)} />
                    <span style={{ minWidth: 0 }}>
                      <div className="u-strong u-truncate" style={{ maxWidth: 230 }}>{r.name}</div>
                      <div className="num u-mute" style={{ fontSize: "var(--t-11)", marginTop: 2 }}>
                        {r.pan}{r.gstin ? ` · ${r.gstin}` : ""}
                      </div>
                    </span>
                  </Link>
                </td>
                <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{r.entity}</td>
                <td className="u-mute">{r.state}</td>
                <td>
                  <span className="u-row">
                    <Avatar initials={staffOf(r.assigneeId).initials} />
                    <span className="u-truncate" style={{ maxWidth: 100 }}>{staffOf(r.assigneeId).name}</span>
                  </span>
                </td>
                <td className="u-right num">{r.turnover ? inrShort(r.turnover) : "—"}</td>
                <td><Pbar filed={r.filed} pending={r.pending} overdue={r.overdue} /></td>
                <td className="u-right num">{r.pending + r.overdue}</td>
                <td className="u-right num" style={{ color: r.exposure ? "var(--st-overdue-fg)" : "var(--ink-4)", fontWeight: r.exposure ? 600 : 400 }}>
                  {r.exposure ? `₹${inr(r.exposure)}` : "—"}
                </td>
                <td className="u-faint"><Icon name="chevronRight" size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <Empty title="No clients match these filters" /> : null}
        {limit < filtered.length ? (
          <div className="sheet__foot u-row" style={{ justifyContent: "center" }}>
            <button type="button" className="btn btn--sm" onClick={() => setLimit((l) => l + PAGE * 2)}>
              Show {Math.min(PAGE * 2, filtered.length - limit)} more · {filtered.length - limit} remaining
            </button>
          </div>
        ) : (
          <div className="sheet__foot u-center">Showing all {filtered.length} matching clients</div>
        )}
      </div>
    </div>
  );
}
