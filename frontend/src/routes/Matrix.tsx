/* ============================================================================
   COMPLIANCE TRACKER — the whole book against every compliance
   ----------------------------------------------------------------------------
   One grid: clients down, compliances across, status in the cell. This is the
   "am I covered?" screen, and the one place you can see a client's whole
   obligation set and a compliance's whole client set at the same time.

   What changed from the earlier "Matrix":

   1. COLUMNS ARE LEGIBLE. They used to be rotated vertical text with no date,
      so you could not tell GSTR-1 for July from GSTR-1 for August. Each column
      now carries the form code and its due date, stacked, upright.
   2. IT SCROLLS INSTEAD OF TRUNCATING. The old version silently cut to 26
      columns. Now the period window is an explicit choice (month / quarter /
      full year) and everything in that window is reachable by scrolling, with
      the client column and the header row both frozen.
   3. COLUMNS GROUP. By compliance head or by due month, with a spanning header
      row — because "show me all the GST columns together" is how people
      actually read this.
   4. PENALTY IS A COLUMN, NOT THE SORT. Rows sort by what is open or late by
      default; late fees are available as a sort but no longer the headline.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Obligation } from "../domain/types.ts";
import { useApp, useObligations } from "../ui/app-state.tsx";
import { CLIENT_BY_ID, STAFF, staffOf } from "../domain/book.ts";
import { HEADS, headClass } from "../domain/catalog.ts";
import { MONTHS, TODAY, addDays, fmtShort, inrShort, monthLabelLong, parts } from "../domain/dates.ts";
import { Empty, PageHead } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";
import { ClearFilters, FilterPill, FilterPillMulti } from "../ui/Filters.tsx";
import { ObligationDrawer } from "../ui/ObligationDrawer.tsx";

type SortKey = "open" | "late" | "fees" | "name";
type GroupBy = "none" | "head" | "month";
type Window = "month" | "quarter" | "year";
type StatusFilter = "all" | "open" | "late" | "filed";

const ROWS = 50;

const CELL_CLASS: Record<string, string> = {
  Filed: "c-filed",
  Pending: "c-pending",
  Overdue: "c-overdue",
  "Not Applicable": "c-na",
};

interface Column {
  runId: string;
  form: string;
  period: string;
  head: string;
  due: string;
}

export function MatrixPage() {
  const obligations = useObligations();
  const { toast } = useApp();
  const nav = useNavigate();

  const [params] = useSearchParams();
  const [head, setHead] = useState(() => params.get("head") ?? "all");
  /* Empty = every owner. Levelling work means comparing desks, so this is
     a set rather than a single pick. */
  const [owners, setOwners] = useState<string[]>(() => {
    const o = params.get("owner");
    return o ? [o] : [];
  });
  const [status, setStatus] = useState<StatusFilter>(
    () => (params.get("status") as StatusFilter) ?? "all",
  );

  /* Follow the URL under an already-open page — the tracker is the target of
     several alerts and stat cards, each meaning a different slice of it. */
  useEffect(() => {
    const st = params.get("status");
    if (st) setStatus(st as StatusFilter);
    const h = params.get("head");
    if (h) setHead(h);
    const o = params.get("owner");
    if (o) setOwners([o]);
  }, [params]);
  const [win, setWin] = useState<Window>("quarter");
  const [group, setGroup] = useState<GroupBy>("month");
  const [sort, setSort] = useState<SortKey>("late");
  const [q, setQ] = useState("");
  const [peek, setPeek] = useState<Obligation | null>(null);
  const [limit, setLimit] = useState(ROWS);
  const [expanded, setExpanded] = useState(false);

  /* The grid's own scroll container, and a marker just past the last row. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  /* Escape is the expected way out of anything that has taken the viewport,
     and the page behind must not scroll while it has. */
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  /* ---- Columns: every compliance due inside the chosen window ------------ */
  const columns = useMemo<Column[]>(() => {
    const days = win === "month" ? 31 : win === "quarter" ? 92 : 365;
    const from = addDays(TODAY, win === "year" ? -120 : -31);
    const to = addDays(TODAY, days);
    const seen = new Map<string, Column>();
    for (const o of obligations) {
      if (o.dueDate < from || o.dueDate > to) continue;
      if (head !== "all" && o.head !== head) continue;
      if (!seen.has(o.runId)) {
        seen.set(o.runId, {
          runId: o.runId, form: o.form, period: o.periodLabel, head: o.head, due: o.dueDate,
        });
      }
    }
    const list = [...seen.values()];
    /* Sort so the grouping is contiguous — otherwise a spanning header lies. */
    if (group === "head") {
      list.sort((a, b) =>
        HEADS.indexOf(a.head) - HEADS.indexOf(b.head)
        || a.due.localeCompare(b.due)
        || a.form.localeCompare(b.form));
    } else {
      list.sort((a, b) => a.due.localeCompare(b.due) || a.form.localeCompare(b.form));
    }
    return list;
  }, [obligations, head, win, group]);

  const colIndex = useMemo(() => new Map(columns.map((c, i) => [c.runId, i])), [columns]);

  /** Contiguous column spans for the grouping header row. */
  const spans = useMemo(() => {
    if (group === "none") return [];
    const out: { key: string; label: string; span: number; head?: string }[] = [];
    for (const c of columns) {
      const key = group === "head" ? c.head : c.due.slice(0, 7);
      const label = group === "head"
        ? c.head
        : `${MONTHS[parts(c.due).m - 1]} ${parts(c.due).y}`;
      const last = out[out.length - 1];
      if (last && last.key === key) last.span++;
      else out.push({ key, label, span: 1, head: group === "head" ? c.head : undefined });
    }
    return out;
  }, [columns, group]);

  /* ---- Rows ------------------------------------------------------------- */
  const rows = useMemo(() => {
    const map = new Map<string, {
      clientId: string; cells: (Obligation | null)[];
      fees: number; open: number; late: number; filed: number;
    }>();
    for (const o of obligations) {
      const ci = colIndex.get(o.runId);
      if (ci === undefined) continue;
      if (owners.length > 0 && !owners.includes(o.assigneeId)) continue;
      let row = map.get(o.clientId);
      if (!row) {
        row = {
          clientId: o.clientId, cells: Array(columns.length).fill(null),
          fees: 0, open: 0, late: 0, filed: 0,
        };
        map.set(o.clientId, row);
      }
      row.cells[ci] = o;
      row.fees += o.exposure;
      if (o.status === "Overdue") { row.late++; row.open++; }
      else if (o.status === "Pending") row.open++;
      else if (o.status === "Filed") row.filed++;
    }

    let list = [...map.values()];

    if (status === "late") list = list.filter((r) => r.late > 0);
    else if (status === "open") list = list.filter((r) => r.open > 0);
    else if (status === "filed") list = list.filter((r) => r.late === 0 && r.open === 0);

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) => {
        const c = CLIENT_BY_ID[r.clientId];
        return c.name.toLowerCase().includes(needle)
          || c.pan.toLowerCase().includes(needle)
          || (c.gstin ?? "").toLowerCase().includes(needle);
      });
    }

    if (sort === "late") list.sort((a, b) => b.late - a.late || b.open - a.open);
    else if (sort === "open") list.sort((a, b) => b.open - a.open || b.late - a.late);
    else if (sort === "fees") list.sort((a, b) => b.fees - a.fees);
    else list.sort((a, b) => CLIENT_BY_ID[a.clientId].name.localeCompare(CLIENT_BY_ID[b.clientId].name));

    return list;
  }, [obligations, colIndex, columns.length, owners, q, sort, status]);

  const exportCsv = () => {
    const headerRow = ["Client", "PAN", "GSTIN", "Owner", ...columns.map((c) => `${c.form} ${c.period} (due ${c.due})`)];
    const lines = rows.map((r) => {
      const c = CLIENT_BY_ID[r.clientId];
      return [
        c.name, c.pan, c.gstin ?? "", staffOf(c.assigneeId).name,
        ...r.cells.map((cell) => (cell ? cell.status : "—")),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([[headerRow.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `compliance-tracker-${TODAY}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Exported ${rows.length} clients × ${columns.length} compliances`);
  };

  const visible = rows.slice(0, limit);

  const hasMore = limit < rows.length;

  /**
   * Load the next batch when the reader reaches the end of the grid.
   *
   * `root` is the grid's scroll container, not the viewport — `.trkwrap` is
   * what actually scrolls in both the normal and full-screen views, so
   * observing the page would never fire.
   *
   * `limit` IS a dependency, deliberately. An IntersectionObserver reports
   * changes in intersection, so once the marker is in view it stays "in view"
   * and never fires again; rebuilding the observer after each batch re-tests
   * it, which also means a short batch that fails to fill the viewport pulls
   * the next one immediately instead of stalling half-scrolled.
   */
  useEffect(() => {
    if (!hasMore) return;
    const root = wrapRef.current;
    const target = endRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + ROWS);
      },
      /* Fires a little before the true end, so the rows are already there by
         the time the reader gets to them. */
      { root, rootMargin: "300px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [hasMore, limit, expanded]);

  /**
   * The refinement controls, declared ONCE and rendered in two places: the
   * page's own filter row, and the bar of the full-screen view.
   *
   * Full screen used to show the grid with no controls at all — the filter row
   * stayed on the page underneath, covered by the overlay, so the moment you
   * expanded a 640×31 grid you lost every means of narrowing it. Two hand-kept
   * copies would drift the way the reminder guards did when they lived on two
   * screens, so there is one definition and both views render it.
   *
   * One pill per field. On a grid of 640 clients the whole question is WHICH
   * slice you are looking at, so the active narrowing stays legible without
   * opening anything, and clearing one is a single click. Search and sort stay
   * plain — neither narrows the book.
   */
  const filterControls = (
    <>
      <div className="field field--search">
        <Icon name="search" size={15} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(ROWS); }}
          placeholder="Name, PAN or GSTIN"
          aria-label="Search clients"
        />
      </div>
      <FilterPill<Window>
        field="Period"
        value={win}
        none={"quarter" as Window}
        onChange={setWin}
        options={[
          { value: "month", label: "This month" },
          { value: "quarter", label: "Next 3 months" },
          { value: "year", label: "Full year" },
        ]}
      />
      <FilterPill<string>
        field="Head"
        value={head}
        none="all"
        onChange={setHead}
        options={[{ value: "all", label: "All heads" }, ...HEADS.map((h) => ({ value: h, label: h }))]}
      />
      <FilterPillMulti
        field="Owner"
        values={owners}
        onChange={(v) => { setOwners(v); setLimit(ROWS); }}
        searchPlaceholder="Search staff"
        options={[
          { value: "none", label: "Unassigned", avatar: "—" },
          ...STAFF.map((st) => ({ value: st.id, label: st.name, avatar: st.initials, sub: st.role })),
        ]}
      />
      <FilterPill<StatusFilter>
        field="Status"
        value={status}
        none={"all" as StatusFilter}
        onChange={(v) => { setStatus(v); setLimit(ROWS); }}
        options={[
          { value: "all", label: "Any status" },
          { value: "late", label: "Has something late" },
          { value: "open", label: "Has something open" },
          { value: "filed", label: "Fully filed" },
        ]}
      />
      <FilterPill<GroupBy>
        field="Group"
        value={group}
        none={"month" as GroupBy}
        onChange={setGroup}
        options={[
          { value: "month", label: "By month" },
          { value: "head", label: "By head" },
          { value: "none", label: "No grouping" },
        ]}
      />
      <ClearFilters
        count={(head !== "all" ? 1 : 0) + (owners.length > 0 ? 1 : 0) + (status !== "all" ? 1 : 0)
          + (win !== "quarter" ? 1 : 0) + (group !== "month" ? 1 : 0)}
        onClear={() => {
          setHead("all"); setOwners([]); setStatus("all");
          setWin("quarter"); setGroup("month"); setLimit(ROWS);
        }}
      />
      <span className="u-spacer" />
      <select className="plain" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort rows">
        <option value="late">Most late</option>
        <option value="open">Most open</option>
        <option value="fees">Late fees</option>
        <option value="name">Name</option>
      </select>
    </>
  );

  return (
    <div className="page page--wide">
      <PageHead
        title="Compliance tracker"
        icon="matrix"
        note={
          <>
            <b>{visible.length}</b> of {rows.length.toLocaleString("en-IN")} clients ×{" "}
            <b>{columns.length}</b> compliances
          </>
        }
        aside={
          <button type="button" className="btn btn--sm" onClick={exportCsv}>
            <Icon name="download" size={14} /> Export
          </button>
        }
      />

      {/* ---- Filters + grouping ----------------------------------------- */}
      <div className="filters">{filterControls}</div>

      {columns.length === 0 || rows.length === 0 ? (
        <div className="sheet">
          <Empty title="Nothing in this slice">
            No compliances fall inside this window for the current filters — widen the period or clear a filter.
          </Empty>
        </div>
      ) : (
        <>
          {/* Expand sits on the grid's own top-right corner — it acts on this
              module, so it belongs to it rather than to the page header. */}
          <div className={`trkbox${expanded ? " is-expanded" : ""}`}>
            {expanded ? (
              <div className="trkhead">
                <div className="trkbar">
                  <b>Compliance tracker</b>
                  <span className="num">{visible.length} of {rows.length.toLocaleString("en-IN")} clients × {columns.length} compliances</span>
                  <span className="u-spacer" />
                  <button type="button" className="btn btn--sm" onClick={() => setExpanded(false)}>
                    <Icon name="fullscreenExit" size={13} /> Exit full screen
                    <span className="kbd">esc</span>
                  </button>
                </div>
                {/* The same controls as the page, so expanding never costs you
                    the ability to narrow what you are looking at. */}
                <div className="trkfilters">{filterControls}</div>
              </div>
            ) : (
              <button
                type="button"
                className="trkexp"
                onClick={() => setExpanded(true)}
                title="Expand to full screen"
                aria-label="Expand the grid to full screen"
              >
                <Icon name="fullscreen" size={14} />
              </button>
            )}
          <div className="trkwrap" ref={wrapRef}>
            <table className="trk">
              <thead>
                {spans.length > 0 ? (
                  <tr className="trk__spanrow">
                    <th className="trk__corner trk__corner--span" />
                    {spans.map((s, i) => (
                      <th key={`${s.key}-${i}`} colSpan={s.span} className="trk__span">
                        <span>
                          {s.head ? <i className={`trk__dot ${headClass(s.head)}`} /> : null}
                          {s.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                ) : null}
                <tr>
                  <th className="trk__corner">Client</th>
                  {columns.map((c) => {
                    const past = c.due < TODAY;
                    return (
                      <th
                        key={c.runId}
                        className={`trk__col${past ? " is-past" : ""}`}
                        title={`${c.form} · ${c.period} · due ${c.due}`}
                      >
                        <button type="button" onClick={() => nav(`/runs/${encodeURIComponent(c.runId)}`)}>
                          <i className={`trk__spine ${headClass(c.head)}`} />
                          <b>{c.form}</b>
                          <span className="num">{fmtShort(c.due)}</span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const c = CLIENT_BY_ID[r.clientId];
                  return (
                    <tr key={r.clientId}>
                      <td className="trk__name">
                        <button type="button" onClick={() => nav(`/clients/${c.id}`)}>
                          <span className="trk__cname">{c.name}</span>
                          <span className="trk__cmeta num">
                            {c.pan}
                            {r.late > 0 ? <em className="trk__late">{r.late} late</em> : null}
                          </span>
                        </button>
                      </td>
                      {r.cells.map((cell, i) => (
                        <td key={i} className={columns[i].due < TODAY ? "is-past" : undefined}>
                          {cell ? (
                            <button
                              type="button"
                              className={`mxcell ${CELL_CLASS[cell.status]}`}
                              title={`${c.name} · ${cell.form} ${cell.periodLabel} — ${cell.status}`}
                              onClick={() => setPeek(cell)}
                            >
                              <i />
                            </button>
                          ) : (
                            <span className="mxcell" title="Not applicable to this client" />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Crossing this pulls the next batch. Inside the scroller, so it
                moves with the rows rather than with the page. */}
            <div ref={endRef} className="trkend" aria-hidden="true" />
          </div>

          {/* Inside .trkbox, not after it. As a sibling of the box this footer
              sat behind the full-screen overlay, so expanding the grid hid the
              legend AND the "Show more" button — capping the reader at the
              first 50 clients on the one screen built for seeing more. */}
          <div className="trkfoot">
            <span className="u-row" style={{ gap: "var(--s4)", flexWrap: "wrap" }}>
              <span className="u-row"><i className="lg lg--filed" /> Filed</span>
              <span className="u-row"><i className="lg lg--pending" /> Pending</span>
              <span className="u-row"><i className="lg lg--overdue" /> Overdue</span>
              <span className="u-row"><i className="lg lg--na" /> Not applicable</span>
            </span>
            <span className="u-spacer" />
            {limit < rows.length ? (
              <button type="button" className="btn btn--sm" onClick={() => setLimit((l) => l + ROWS)}>
                Show {Math.min(ROWS, rows.length - limit)} more · {rows.length - limit} left
              </button>
            ) : (
              <span className="u-mute" style={{ fontSize: "var(--t-12)" }}>
                Showing all {rows.length.toLocaleString("en-IN")} matching clients
              </span>
            )}
          </div>
          </div>

          <p className="u-faint" style={{ fontSize: "var(--t-11)", marginTop: "var(--s4)" }}>
            {win === "year" ? "Full financial year" : win === "quarter" ? "Next three months" : monthLabelLong(parts(TODAY).y, parts(TODAY).m)}
            {" "}· click a column header to open that compliance, a row to open the client, a cell to see why it applies
            {rows.reduce((a, r) => a + r.fees, 0) > 0
              ? ` · ${inrShort(rows.reduce((a, r) => a + r.fees, 0))} late fees in this slice`
              : ""}
          </p>
        </>
      )}

      <ObligationDrawer obligation={peek} onClose={() => setPeek(null)} />
    </div>
  );
}
