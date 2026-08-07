/* Workload, and the gap nobody owns. The unassigned row is shown first and
   never collapsed away — work with no owner is the failure mode a tracker is
   supposed to catch. */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useObligations } from "../ui/app-state.tsx";
import { CLIENTS, STAFF, UNASSIGNED } from "../domain/book.ts";
import { TODAY, addDays, inr, inrShort } from "../domain/dates.ts";
import { Avatar, PageHead, SectionHead, Seg, Stat } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";

type Sort = "risk" | "load" | "name";

interface Load {
  id: string;
  name: string;
  role: string;
  initials: string;
  clients: number;
  filed: number;
  pending: number;
  overdue: number;
  dueThisWeek: number;
  exposure: number;
}

export function TeamPage() {
  const obligations = useObligations();
  const nav = useNavigate();
  const [sort, setSort] = useState<Sort>("risk");

  const loads = useMemo<Load[]>(() => {
    const people = [...STAFF, UNASSIGNED];
    const map = new Map<string, Load>(
      people.map((s) => [s.id, {
        id: s.id, name: s.name, role: s.role, initials: s.initials,
        clients: 0, filed: 0, pending: 0, overdue: 0, dueThisWeek: 0, exposure: 0,
      }]),
    );

    for (const c of CLIENTS) {
      const row = map.get(c.assigneeId);
      if (row) row.clients++;
    }

    const weekEnd = addDays(TODAY, 7);
    for (const o of obligations) {
      const row = map.get(o.assigneeId);
      if (!row) continue;
      if (o.status === "Filed") row.filed++;
      else if (o.status === "Overdue") { row.overdue++; row.exposure += o.exposure; }
      else if (o.status === "Pending") {
        row.pending++;
        if (o.dueDate <= weekEnd) row.dueThisWeek++;
      }
    }

    const list = [...map.values()];
    if (sort === "risk") list.sort((a, b) => b.exposure - a.exposure || b.overdue - a.overdue);
    else if (sort === "load") list.sort((a, b) => (b.pending + b.overdue) - (a.pending + a.overdue));
    else list.sort((a, b) => a.name.localeCompare(b.name));

    /* Unassigned always surfaces first when it holds anything. */
    const un = list.find((l) => l.id === "none");
    if (un && (un.overdue > 0 || un.pending > 0)) {
      return [un, ...list.filter((l) => l.id !== "none")];
    }
    return list;
  }, [obligations, sort]);

  const maxLoad = Math.max(1, ...loads.map((l) => l.pending + l.overdue));
  const totals = loads.reduce(
    (a, l) => ({ overdue: a.overdue + l.overdue, exposure: a.exposure + l.exposure, week: a.week + l.dueThisWeek }),
    { overdue: 0, exposure: 0, week: 0 },
  );
  const unassigned = loads.find((l) => l.id === "none");

  return (
    <div className="page">
      <PageHead
        title="Team workload"
        icon="team"
        note={<><b>{totals.week}</b> filings land across the team in the next seven days</>}
        aside={
          <Seg<Sort>
            value={sort}
            onChange={setSort}
            options={[
              { value: "risk", label: "By ₹ at risk" },
              { value: "load", label: "By open items" },
              { value: "name", label: "A–Z" },
            ]}
          />
        }
      />

      <div className="stats" style={{ marginBottom: "var(--s4)" }}>
        <Stat label="People" value={STAFF.length} sub="with an active book" />
        <Stat label="Clients" value={CLIENTS.length} sub="assigned across the team" />
        <Stat label="Overdue" value={totals.overdue} tone={totals.overdue ? "overdue" : undefined} sub="across all owners" />
        <Stat label="Due in 7 days" value={totals.week} tone="soon" sub="team-wide" />
        <Stat
          label="Unowned"
          value={unassigned ? unassigned.pending + unassigned.overdue : 0}
          tone={unassigned && unassigned.overdue > 0 ? "overdue" : undefined}
          sub={`${unassigned?.clients ?? 0} clients have no staff member`}
        />
      </div>

      <SectionHead icon="team" title="By owner" note="bar shows open items relative to the busiest desk" />

      <div className="sheet">
        <div className="sheet__body">
          {loads.map((l) => {
            const open = l.pending + l.overdue;
            const isUnassigned = l.id === "none";
            return (
              <div className="workload" key={l.id}>
                <Avatar initials={l.initials} large />
                <div style={{ width: 170, minWidth: 0 }}>
                  <div className="u-strong u-truncate">{l.name}</div>
                  <div className="u-mute" style={{ fontSize: "var(--t-12)" }}>
                    {isUnassigned ? "needs an owner" : l.role} · <span className="num">{l.clients}</span> clients
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 120 }}>
                  <div
                    style={{
                      height: 22,
                      background: "var(--sunk)",
                      borderRadius: 4,
                      overflow: "hidden",
                      border: "1px solid var(--rule)",
                      display: "flex",
                    }}
                    role="img"
                    aria-label={`${l.pending} pending, ${l.overdue} overdue`}
                  >
                    <span style={{ width: `${(l.pending / maxLoad) * 100}%`, background: "var(--st-pending-solid)" }} />
                    <span style={{ width: `${(l.overdue / maxLoad) * 100}%`, background: "var(--st-overdue-solid)" }} />
                  </div>
                  <div className="u-row" style={{ marginTop: 4, fontSize: "var(--t-11)", color: "var(--ink-3)" }}>
                    <span className="num">{open}</span> open
                    {l.overdue > 0 ? <span style={{ color: "var(--st-overdue-fg)", fontWeight: 600 }}>{l.overdue} overdue</span> : null}
                    {l.dueThisWeek > 0 ? <span style={{ color: "var(--urg-near)" }}>{l.dueThisWeek} due this week</span> : null}
                    <span className="u-faint">{l.filed} filed</span>
                  </div>
                </div>

                <div style={{ width: 120, textAlign: "right" }}>
                  <div className="num" style={{ fontWeight: 600, color: l.exposure ? "var(--st-overdue-fg)" : "var(--ink-4)" }}>
                    {l.exposure ? `₹${inr(l.exposure)}` : "—"}
                  </div>
                  <div className="u-mute" style={{ fontSize: "var(--t-11)" }}>at risk</div>
                </div>

                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => nav(`/clients?owner=${l.id}`)}
                  title={`Open ${l.name}'s book`}
                >
                  Open <Icon name="chevronRight" size={13} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="sheet__foot">
          Total exposure across the team: <b className="num">{inrShort(totals.exposure)}</b>. Reassigning an
          item moves both the work and the reminder ownership.
        </div>
      </div>
    </div>
  );
}
