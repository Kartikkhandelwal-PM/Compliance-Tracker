/* ============================================================================
   NOTICES — everything a tax department has asked of a client
   ----------------------------------------------------------------------------
   Sorted by reply deadline, because that is the only thing that decides what
   to do first: a notice with three days left outranks one with sixty, whatever
   it is about. The strip at the top says how many are already late, how many
   fall due this week and how many are open at all; each is also a filter.

   Staff only. Notices come in from the KDK ITR, GST and TDS modules and
   nothing on this screen is sent to a client.
   ========================================================================== */

import { Pagination, usePagination } from "../ui/Pagination.tsx";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CLIENT_BY_ID } from "../domain/book.ts";
import { getNotices } from "../domain/engine.ts";
import { daysToReply, isOpen, needsReply, urgencyOf } from "../domain/notices.ts";
import type { Notice } from "../domain/notices.ts";
import { NOTICE_STAGES } from "../domain/notices.ts";
import { useEngine } from "../ui/app-state.tsx";
import { NoticeDrawer, NoticeTable } from "../ui/Notices.tsx";
import { ClearFilters, FilterPillMulti } from "../ui/Filters.tsx";
import { OWNER_OPTIONS } from "../ui/ownerOptions.ts";
import { Icon } from "../ui/Icon.tsx";
import { PageHead } from "../ui/bits.tsx";

type Focus = "all" | "overdue" | "week";


export function NoticesPage() {
  const notices = useEngine(getNotices);
  const [params] = useSearchParams();
  /* A link can open on a slice: ?focus=overdue (the bell's alert) or ?focus=week. */
  const asked = params.get("focus");
  const [focus, setFocus] = useState<Focus>(() => (asked === "overdue" || asked === "week" ? asked : "all"));
  useEffect(() => { if (asked === "overdue" || asked === "week") setFocus(asked); }, [asked]);
  const [q, setQ] = useState("");
  /* Each filter holds a list; empty means "not filtering". */
  const [depts, setDepts] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  /* A link from the Dashboard opens straight on its notice. */
  const [peekId, setPeekId] = useState<string | null>(params.get("open"));
  useEffect(() => { const o = params.get("open"); if (o) setPeekId(o); }, [params]);

  const open = useMemo(() => notices.filter(isOpen), [notices]);
  const overdue = open.filter((n) => urgencyOf(n) === "overdue").length;
  const week = open.filter((n) => needsReply(n) && daysToReply(n) >= 0 && daysToReply(n) <= 7).length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = notices;
    if (focus === "overdue") list = list.filter((n) => urgencyOf(n) === "overdue");
    if (focus === "week") list = list.filter((n) => needsReply(n) && daysToReply(n) >= 0 && daysToReply(n) <= 7);
    if (depts.length) list = list.filter((n) => depts.includes(n.dept));
    if (stages.length) list = list.filter((n) => stages.includes(n.status));
    if (owners.length) list = list.filter((n) => owners.includes(n.assigneeId));
    if (needle) {
      list = list.filter((n) =>
        n.type.toLowerCase().includes(needle)
        || n.refNo.toLowerCase().includes(needle)
        || (CLIENT_BY_ID[n.clientId]?.name ?? "").toLowerCase().includes(needle));
    }
    /* Needs a reply first, soonest deadline first; then replied, then closed. */
    const rank = (n: Notice) => (needsReply(n) ? 0 : n.status === "Replied" ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b) || a.replyDue.localeCompare(b.replyDue));
  }, [notices, focus, q, depts, stages, owners]);

  const pg = usePagination(shown, [focus, q, depts, stages, owners]);
  const peek = peekId ? notices.find((n) => n.id === peekId) ?? null : null;
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); };

  return (
    <div className="page page--wide">
      <PageHead
        title="Notices"
        icon="notice"
        note={<><b>{open.length}</b> open · <b>{notices.length - open.length}</b> closed</>}
      />

      <div className="nt-strip">
          <button type="button" className={`nt-tile is-late${focus === "overdue" ? " is-on" : ""}`} onClick={() => setFocus(focus === "overdue" ? "all" : "overdue")}>
            <span className="nt-tile__k">Reply overdue</span>
            <b className="num">{overdue}</b>
            <small>{overdue ? "Past the reply date and not yet answered" : "Nothing overdue"}</small>
          </button>
          <button type="button" className={`nt-tile${focus === "week" ? " is-on" : ""}`} onClick={() => setFocus(focus === "week" ? "all" : "week")}>
            <span className="nt-tile__k">Reply due in 7 days</span>
            <b className="num">{week}</b>
            <small>Needs a reply this week</small>
          </button>
          <button type="button" className={`nt-tile${focus === "all" ? " is-on" : ""}`} onClick={() => setFocus("all")}>
            <span className="nt-tile__k">All notices</span>
            <b className="num">{notices.length}</b>
            <small>{open.filter(needsReply).length} still need a reply · {notices.length - open.length} closed</small>
          </button>
      </div>

      <div className="filters">
        <div className="field" style={{ width: 280 }}>
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Client, notice or reference" />
        </div>
        <FilterPillMulti
          field="Department" noun="departments" values={depts} onChange={reset(setDepts)}
          options={(["Income Tax", "GST", "TDS"] as const).map((d) => ({ value: d, label: d }))}
        />
        <FilterPillMulti
          field="Stage" noun="stages" values={stages} onChange={reset(setStages)}
          options={NOTICE_STAGES.map((s) => ({ value: s, label: s }))}
        />
        <FilterPillMulti
          field="Owner" noun="owners" values={owners} onChange={reset(setOwners)}
          searchPlaceholder="Search staff" options={OWNER_OPTIONS}
        />
        <ClearFilters
          count={(depts.length ? 1 : 0) + (stages.length ? 1 : 0) + (owners.length ? 1 : 0)}
          onClear={() => { setDepts([]); setStages([]); setOwners([]); }}
        />
      </div>

      <div className="sheet">
        <NoticeTable
          list={pg.items}
          onOpen={(n: Notice) => setPeekId(n.id)}
          empty="No notices match these filters."
        />
        <Pagination pg={pg} noun={shown.length === 1 ? "notice" : "notices"} />
      </div>

      <NoticeDrawer notice={peek} onClose={() => setPeekId(null)} />
    </div>
  );
}
