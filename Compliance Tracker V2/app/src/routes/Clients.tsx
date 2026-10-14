/* ============================================================================
   CLIENTS — one list, one row per PAN
   ----------------------------------------------------------------------------
   The book, as a list. That is the whole job.

   This screen used to open on a wall of aggregate cards — entity-type
   breakdown, arrears totals, ₹ at risk — which pushed the actual list below the
   fold. Nobody arriving at "Clients" wants a report; they want to find a client
   or scan the book. Aggregate analysis moved to the Dashboard where it belongs.

   ONE ROW PER CLIENT. A client is a PAN; its GSTINs and TANs belong to it
   (see the note in types.ts). This screen used to be three tabs, GST, TDS and
   ITR, each its own list, so a company with three GSTINs and a TAN showed up
   five times under the same name. Now it is one row: the Registrations column
   says what it holds, the health bar and the counts cover every filing under
   the PAN, and the registration filter does what the tabs used to ("only
   clients with GST"). Search still finds a client by any GSTIN or TAN.

   640 clients here, 10,000+ in production, so the table is paged and every
   narrowing question is a filter rather than a separate view.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { EntityType } from "../domain/types.ts";
import { useApp, useObligations } from "../ui/app-state.tsx";
import {
  ALL_STATES, CLIENTS, GSTINS_BY_CLIENT, TANS_BY_CLIENT, parentClientId, staffOf,
} from "../domain/book.ts";
import { FY_START } from "../domain/catalog.ts";
import { inr, inrShort } from "../domain/dates.ts";
import { Avatar, Empty, PageHead, Pbar, initialsOf } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";
import { FilterPillMulti } from "../ui/Filters.tsx";
import { OWNER_OPTIONS } from "../ui/ownerOptions.ts";

type SortKey = "exposure" | "overdue" | "name" | "turnover";
/** Compliance state is a filter like any other, so it is a select like any
 *  other. It used to be a lone toggle chip sitting among four dropdowns, which
 *  made one of the five narrowing controls look like a different kind of thing
 *  — and it could only ever ask half the question: there was no way to filter
 *  down to the clients who are *clean*. */
type Health = "all" | "arrears" | "clear";
/** What the old GST / TDS / ITR tabs used to answer, as one filter. */
type RegFilter = "all" | "gst" | "tds" | "both" | "multi" | "itr";
const PAGE = 40;

const ENTITY_OPTIONS: EntityType[] = ["Individual", "Company", "LLP", "Firm", "Trust", "AOP/BOI", "HUF"];

const REG_OPTIONS: { value: RegFilter; label: string }[] = [
  { value: "all", label: "Any registration" },
  { value: "gst", label: "Has GST" },
  { value: "tds", label: "Has TDS" },
  { value: "both", label: "Has GST and TDS" },
  { value: "multi", label: "Multiple GSTINs or TANs" },
  { value: "itr", label: "Income tax only" },
];

interface Row {
  id: string;
  name: string;
  pan: string;
  entity: EntityType;
  detail: string;
  state: string;
  assigneeId: string;
  turnover: number;
  gstins: string[];
  tans: string[];
  filed: number;
  pending: number;
  overdue: number;
  exposure: number;
}

function baseRows(): Row[] {
  return CLIENTS.map((c) => ({
    id: c.id, name: c.name, pan: c.pan, entity: c.profile.entityType,
    detail: c.profile.entityType === "Company" ? `Company · ${c.profile.companyType}` : c.profile.entityType,
    state: c.state, assigneeId: c.assigneeId, turnover: c.profile.turnover,
    gstins: (GSTINS_BY_CLIENT[c.id] ?? []).map((g) => g.gstin),
    tans: (TANS_BY_CLIENT[c.id] ?? []).map((t) => t.tan),
    filed: 0, pending: 0, overdue: 0, exposure: 0,
  }));
}

/** Old links (and bookmarks) carried `?type=GstEntity` / `TdsDeductor` from
 *  the tab days; they land on the matching registration filter. */
function initialReg(params: URLSearchParams): RegFilter {
  const reg = params.get("reg");
  if (REG_OPTIONS.some((o) => o.value === reg)) return reg as RegFilter;
  const t = params.get("type");
  return t === "GstEntity" ? "gst" : t === "TdsDeductor" ? "tds" : "all";
}

export function ClientsPage() {
  const obligations = useObligations();
  const { toast } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  /* Entity type, state and owner each take several values; empty means all. */
  const [entities, setEntities] = useState<string[]>([]);
  const [reg, setReg] = useState<RegFilter>(() => initialReg(params));
  const [states, setStates] = useState<string[]>([]);
  /* Team → "Open" deep-links here with ?owner=<staffId>. */
  const [owners, setOwners] = useState<string[]>(() => (params.get("owner") ? [params.get("owner")!] : []));
  const [health, setHealth] = useState<Health>(() =>
    params.get("health") === "arrears" ? "arrears" : "all",
  );
  /* Alphabetical by default. A plain list should open in the order people can
     predict; "who owes the most" is a question you ask by changing the sort,
     not the state the screen should greet you in. */
  const [sort, setSort] = useState<SortKey>("name");
  const [limit, setLimit] = useState(PAGE);

  /* Every filing under the PAN counts toward its client's row, whichever
     GSTIN or TAN it is filed under. */
  const rows = useMemo(() => {
    const list = baseRows();
    const map = new Map(list.map((r) => [r.id, r]));
    for (const o of obligations) {
      if (o.fy !== FY_START) continue;
      const r = map.get(parentClientId(o.ownerType, o.clientId));
      if (!r) continue;
      if (o.status === "Filed") r.filed++;
      else if (o.status === "Overdue") { r.overdue++; r.exposure += o.exposure; }
      else if (o.status === "Pending") r.pending++;
    }
    return list;
  }, [obligations]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows;
    if (needle) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(needle)
          || r.pan.toLowerCase().includes(needle)
          || r.gstins.some((g) => g.toLowerCase().includes(needle))
          || r.tans.some((t) => t.toLowerCase().includes(needle)),
      );
    }
    if (entities.length) list = list.filter((r) => entities.includes(r.entity));
    if (reg === "gst") list = list.filter((r) => r.gstins.length > 0);
    else if (reg === "tds") list = list.filter((r) => r.tans.length > 0);
    else if (reg === "both") list = list.filter((r) => r.gstins.length > 0 && r.tans.length > 0);
    else if (reg === "multi") list = list.filter((r) => r.gstins.length > 1 || r.tans.length > 1);
    else if (reg === "itr") list = list.filter((r) => r.gstins.length === 0 && r.tans.length === 0);
    if (states.length) list = list.filter((r) => states.includes(r.state));
    if (owners.length) list = list.filter((r) => owners.includes(r.assigneeId));
    if (health === "arrears") list = list.filter((r) => r.overdue > 0);
    else if (health === "clear") list = list.filter((r) => r.overdue === 0);

    const sorted = [...list];
    if (sort === "exposure") sorted.sort((a, b) => b.exposure - a.exposure || b.overdue - a.overdue);
    else if (sort === "overdue") sorted.sort((a, b) => b.overdue - a.overdue || b.exposure - a.exposure);
    else if (sort === "turnover") sorted.sort((a, b) => b.turnover - a.turnover);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [rows, q, entities, reg, states, owners, health, sort]);

  const visible = filtered.slice(0, limit);
  const gstinTotal = useMemo(() => rows.reduce((n, r) => n + r.gstins.length, 0), [rows]);
  const tanTotal = useMemo(() => rows.reduce((n, r) => n + r.tans.length, 0), [rows]);

  /* Sync also runs automatically in the background on its own schedule; this
     button just runs it right now instead of waiting for that. There's no
     live KDK connection behind this prototype, so there's nothing actually
     new to pull — the confirmation always reads as up to date. */
  const syncFromKdk = () => {
    toast("Synced: 0 new clients · 0 new GSTINs · 0 new TANs");
  };

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setLimit(PAGE); };

  return (
    <div className="page page--wide">
      <PageHead
        title="Clients"
        icon="clients"
        note={
          <>
            <b>{filtered.length.toLocaleString("en-IN")}</b> of {rows.length.toLocaleString("en-IN")} clients
            {" · "}{gstinTotal.toLocaleString("en-IN")} GSTINs · {tanTotal.toLocaleString("en-IN")} TANs
          </>
        }
        aside={
          <div className="u-row">
            <select className="plain" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
              <option value="name">Sort: Name A–Z</option>
              <option value="overdue">Sort: Most overdue</option>
              <option value="turnover">Sort: Turnover</option>
              <option value="exposure">Sort: Late fees</option>
            </select>
            <button type="button" className="btn btn--sm" onClick={syncFromKdk}>
              <Icon name="sync" size={14} /> Sync from KDK
            </button>
          </div>
        }
      />

      {/* This screen is a list, not a report. The aggregate cards that used to
          sit here (entity-type breakdown, arrears totals, ₹ at risk) answered a
          question nobody asks on the way to finding one client — that analysis
          belongs on the Dashboard. Filters do the narrowing instead. */}
      <div className="filters">
        <div className="field" style={{ width: 240 }}>
          <Icon name="search" size={15} />
          <input
            value={q}
            onChange={(e) => reset(setQ)(e.target.value)}
            placeholder="Name, PAN, GSTIN or TAN"
          />
        </div>
        <FilterPillMulti
          field="Entity type" noun="types" values={entities} onChange={reset(setEntities)}
          options={ENTITY_OPTIONS.map((e) => ({ value: e, label: e }))}
        />
        <select className="plain" value={reg} onChange={(e) => reset(setReg)(e.target.value as RegFilter)}>
          {REG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <FilterPillMulti
          field="State" noun="states" values={states} onChange={reset(setStates)}
          searchPlaceholder="Search states" options={ALL_STATES.map((s) => ({ value: s, label: s }))}
        />
        <FilterPillMulti
          field="Owner" noun="owners" values={owners} onChange={reset(setOwners)}
          searchPlaceholder="Search staff" options={OWNER_OPTIONS}
        />
        <select className="plain" value={health} onChange={(e) => reset(setHealth)(e.target.value as Health)}>
          <option value="all">All clients</option>
          <option value="arrears">In arrears</option>
          <option value="clear">Up to date</option>
        </select>
      </div>

      <div className="sheet">
        <table className="ltable">
          <thead>
            <tr>
              <th>Client</th>
              <th>Entity</th>
              <th>Registrations</th>
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
                        {r.pan}
                      </div>
                    </span>
                  </Link>
                </td>
                <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{r.detail}</td>
                <td>
                  {/* ITR is implied by the PAN, so only GST and TDS are counted.
                      The numbers themselves are in the tooltip. */}
                  <span className="regchips">
                    <span className="regchip regchip--Client" title={`PAN ${r.pan}`}>ITR</span>
                    {r.gstins.length ? (
                      <span className="regchip regchip--GstEntity" title={r.gstins.join("\n")}>
                        GST{r.gstins.length > 1 ? <b>{r.gstins.length}</b> : null}
                      </span>
                    ) : null}
                    {r.tans.length ? (
                      <span className="regchip regchip--TdsDeductor" title={r.tans.join("\n")}>
                        TDS{r.tans.length > 1 ? <b>{r.tans.length}</b> : null}
                      </span>
                    ) : null}
                  </span>
                </td>
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
