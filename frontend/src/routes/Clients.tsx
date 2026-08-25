/* ============================================================================
   CLIENTS — the GST / TDS / ITR book, as one list
   ----------------------------------------------------------------------------
   The book, as a list. That is the whole job.

   This screen used to open on a wall of aggregate cards — entity-type
   breakdown, arrears totals, ₹ at risk — which pushed the actual list below the
   fold. Nobody arriving at "Clients" wants a report; they want to find a client
   or scan the book. Aggregate analysis moved to the Dashboard where it belongs.

   THREE UNLINKED RECORDS, ONE SCREEN. GST, TDS and Income-Tax/ROC come from
   three separate KDK modules with no shared ID — a TDS record carries a TAN,
   never a PAN — so the GST bucket (GstEntity, GSTIN), the TDS bucket
   (TdsDeductor, TAN) and the ITR bucket (Client, PAN — also carrying ROC/MCA,
   Advance Tax and Tax Audit for that PAN) are genuinely different, unrelated
   record types, not three views of one client. The tabs are labelled by
   source module (GST/TDS/ITR) rather than by record shape, since that is the
   vocabulary staff already use. Rather than three separate pages, they share
   this one list and one detail page (see ClientDetail.tsx) behind a type
   tab — chosen over separate screens because most of what a person does here
   (search, filter by owner/state, scan compliance health) is identical across
   the three; only the identifying number and a couple of profile columns
   differ.

   640 ITR rows, 490 GST, 381 TDS here, 10,000+ in production, so the table is
   paged and every narrowing question is a filter rather than a separate view.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { RecordType } from "../domain/types.ts";
import { useApp, useObligations } from "../ui/app-state.tsx";
import {
  ALL_STATES, CLIENTS, GST_ENTITIES, STAFF, TDS_DEDUCTORS, staffOf,
} from "../domain/book.ts";
import { FY_START } from "../domain/catalog.ts";
import { inr, inrShort } from "../domain/dates.ts";
import { Avatar, Empty, PageHead, Pbar, Seg, initialsOf } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";

type SortKey = "exposure" | "overdue" | "name" | "turnover";
/** Compliance state is a filter like any other, so it is a select like any
 *  other. It used to be a lone toggle chip sitting among four dropdowns, which
 *  made one of the five narrowing controls look like a different kind of thing
 *  — and it could only ever ask half the question: there was no way to filter
 *  down to the clients who are *clean*. */
type Health = "all" | "arrears" | "clear";
const PAGE = 40;

/* Labelled by source module (GST / TDS / ITR), not by record shape — matches
   how staff already talk about these, since that is the vocabulary the three
   upstream KDK modules use. "ITR" is a stand-in for the whole PAN bucket: it
   also carries ROC/MCA, Advance Tax and Tax Audit, everything that keys off
   the same PAN as the return itself. */
const TABS: { type: RecordType; label: string; idLabel: string; detailLabel: string }[] = [
  { type: "GstEntity", label: "GST", idLabel: "GSTIN", detailLabel: "Registration" },
  { type: "TdsDeductor", label: "TDS", idLabel: "TAN", detailLabel: "Entity" },
  { type: "Client", label: "ITR", idLabel: "PAN", detailLabel: "Entity" },
];

/** The "detail" filter's own option list, per tab — an entity type for
 *  Client/Deductor, a GST registration type for Firm. Different vocabularies,
 *  same slot in the filter row. */
const DETAIL_OPTIONS: Record<RecordType, string[]> = {
  Client: ["Individual", "Company", "LLP", "Firm", "Trust", "AOP/BOI", "HUF"],
  GstEntity: ["Regular", "Composition", "TDS Deductor", "E-commerce Operator", "ISD", "Non-Resident Taxable"],
  TdsDeductor: ["Individual", "Company", "LLP", "Firm", "Trust", "AOP/BOI", "HUF"],
};

interface Row {
  id: string;
  type: RecordType;
  name: string;
  idValue: string;
  detail: string;
  state: string;
  assigneeId: string;
  turnover: number;
  filed: number;
  pending: number;
  overdue: number;
  exposure: number;
}

function rowsFor(type: RecordType): Row[] {
  const map = new Map<string, Row>();
  if (type === "Client") {
    for (const c of CLIENTS) {
      map.set(c.id, {
        id: c.id, type, name: c.name, idValue: c.pan,
        detail: c.profile.entityType === "Company" ? `Company · ${c.profile.companyType}` : c.profile.entityType,
        state: c.state, assigneeId: c.assigneeId, turnover: c.profile.turnover,
        filed: 0, pending: 0, overdue: 0, exposure: 0,
      });
    }
  } else if (type === "GstEntity") {
    for (const f of GST_ENTITIES) {
      map.set(f.id, {
        id: f.id, type, name: f.name, idValue: f.gstin,
        detail: f.profile.gstQrmpOpted ? `${f.profile.gstRegType} · QRMP` : f.profile.gstRegType,
        state: f.state, assigneeId: f.assigneeId, turnover: f.profile.turnover,
        filed: 0, pending: 0, overdue: 0, exposure: 0,
      });
    }
  } else {
    for (const d of TDS_DEDUCTORS) {
      map.set(d.id, {
        id: d.id, type, name: d.name, idValue: d.tan,
        detail: d.profile.entityType === "Company" ? "Company" : d.profile.entityType,
        state: d.state, assigneeId: d.assigneeId, turnover: d.profile.turnover,
        filed: 0, pending: 0, overdue: 0, exposure: 0,
      });
    }
  }
  return [...map.values()];
}

export function ClientsPage() {
  const obligations = useObligations();
  const { toast } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [type, setType] = useState<RecordType>(() => {
    const t = params.get("type");
    return t === "Client" || t === "TdsDeductor" ? t : "GstEntity";
  });
  const [q, setQ] = useState("");
  const [detailFilter, setDetailFilter] = useState("all");
  const [state, setState] = useState("all");
  /* Team → "Open" deep-links here with ?owner=<staffId>. */
  const [owner, setOwner] = useState(() => params.get("owner") ?? "all");
  const [health, setHealth] = useState<Health>(() =>
    params.get("health") === "arrears" ? "arrears" : "all",
  );
  /* Alphabetical by default. A plain list should open in the order people can
     predict; "who owes the most" is a question you ask by changing the sort,
     not the state the screen should greet you in. */
  const [sort, setSort] = useState<SortKey>("name");
  const [limit, setLimit] = useState(PAGE);

  const tab = TABS.find((t) => t.type === type)!;

  const rows = useMemo(() => {
    const list = rowsFor(type);
    const map = new Map(list.map((r) => [r.id, r]));
    for (const o of obligations) {
      if (o.fy !== FY_START || o.ownerType !== type) continue;
      const r = map.get(o.clientId);
      if (!r) continue;
      if (o.status === "Filed") r.filed++;
      else if (o.status === "Overdue") { r.overdue++; r.exposure += o.exposure; }
      else if (o.status === "Pending") r.pending++;
    }
    return [...map.values()];
  }, [obligations, type]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows;
    if (needle) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(needle) || r.idValue.toLowerCase().includes(needle),
      );
    }
    if (detailFilter !== "all") list = list.filter((r) => r.detail.startsWith(detailFilter));
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
  }, [rows, q, detailFilter, state, owner, health, sort]);

  const visible = filtered.slice(0, limit);
  const total = type === "Client" ? CLIENTS.length : type === "GstEntity" ? GST_ENTITIES.length : TDS_DEDUCTORS.length;

  const switchTab = (t: RecordType) => {
    setType(t);
    setDetailFilter("all");
    setLimit(PAGE);
  };

  /* Sync also runs automatically in the background on its own schedule; this
     button just runs it right now instead of waiting for that. There's no
     live KDK connection behind this prototype, so there's nothing actually
     new to pull — the confirmation always reads as up to date. Broken down
     per module rather than one combined number, since GST, TDS and ITR are
     three separate feeds and a single figure would hide which one actually
     changed. */
  const syncFromKdk = () => {
    toast("Synced: GST 0 new · TDS 0 new · ITR 0 new");
  };

  return (
    <div className="page page--wide">
      <PageHead
        title="Clients"
        icon="clients"
        note={
          <>
            <b>{filtered.length.toLocaleString("en-IN")}</b> of {total.toLocaleString("en-IN")} {tab.label} records
          </>
        }
        aside={
          <div className="u-row">
            {/* GST / TDS / ITR are unrelated records — no shared ID joins them —
                so switching tabs is switching which array the whole screen reads,
                not filtering one list three ways. Placed here, beside the title,
                the same way Calendar's Calendar/Timeline switch sits in its own
                header rather than as a separate row: this choice changes what the
                whole page means, not just one filter within it. */}
            <Seg<RecordType>
              value={type}
              onChange={switchTab}
              options={TABS.map((t) => ({ value: t.type, label: t.label }))}
            />
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
        <div className="field" style={{ width: 280 }}>
          <Icon name="search" size={15} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
            placeholder={`Name or ${tab.idLabel}`}
          />
        </div>
        <select className="plain" value={detailFilter} onChange={(e) => { setDetailFilter(e.target.value); setLimit(PAGE); }}>
          <option value="all">All {tab.detailLabel.toLowerCase()} types</option>
          {DETAIL_OPTIONS[type].map((s) => <option key={s} value={s}>{s}</option>)}
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
          <option value="all">All records</option>
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
              <th>{tab.label}</th>
              <th>{tab.detailLabel}</th>
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
              <tr key={r.id} className="is-clickable" onClick={() => nav(`/clients/${r.id}?type=${r.type}`)}>
                <td>
                  {/* A face on the row: down 640 rows a client is recognised by
                      its mark before its name is read, the same way staff are
                      in the Owner column. */}
                  <Link
                    to={`/clients/${r.id}?type=${r.type}`}
                    onClick={(e) => e.stopPropagation()}
                    className="u-row"
                    style={{ gap: "var(--s3)" }}
                  >
                    <Avatar initials={initialsOf(r.name)} />
                    <span style={{ minWidth: 0 }}>
                      <div className="u-strong u-truncate" style={{ maxWidth: 230 }}>{r.name}</div>
                      <div className="num u-mute" style={{ fontSize: "var(--t-11)", marginTop: 2 }}>
                        {r.idValue}
                      </div>
                    </span>
                  </Link>
                </td>
                <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{r.detail}</td>
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
        {filtered.length === 0 ? <Empty title={`No ${tab.label} records match these filters`} /> : null}
        {limit < filtered.length ? (
          <div className="sheet__foot u-row" style={{ justifyContent: "center" }}>
            <button type="button" className="btn btn--sm" onClick={() => setLimit((l) => l + PAGE * 2)}>
              Show {Math.min(PAGE * 2, filtered.length - limit)} more · {filtered.length - limit} remaining
            </button>
          </div>
        ) : (
          <div className="sheet__foot u-center">Showing all {filtered.length} matching {tab.label} records</div>
        )}
      </div>
    </div>
  );
}
