/* Every filing run in the year, filterable. Grouped by due month so the
   statutory rhythm stays visible rather than dissolving into a flat list. */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useObligations } from "../ui/app-state.tsx";
import { buildRuns } from "../domain/engine.ts";
import { HEADS } from "../domain/catalog.ts";
import { TODAY, addDays, monthLabelLong, parts } from "../domain/dates.ts";
import { PageHead, Seg } from "../ui/bits.tsx";
import { RunList } from "../ui/RunList.tsx";
import { Icon } from "../ui/Icon.tsx";

type Window = "open" | "overdue" | "30d" | "all";
type SortKey = "date" | "exposure" | "open";

export function RunsPage() {
  const obligations = useObligations();
  const [params, setParams] = useSearchParams();
  const [head, setHead] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("date");
  const [q, setQ] = useState("");

  const win = (params.get("filter") as Window) || "open";
  const formFilter = params.get("form");

  const setWin = (w: Window) => {
    const next = new URLSearchParams(params);
    if (w === "open") next.delete("filter");
    else next.set("filter", w);
    setParams(next, { replace: true });
  };

  const allRuns = useMemo(() => buildRuns(obligations), [obligations]);

  const runs = useMemo(() => {
    const to30 = addDays(TODAY, 30);
    let list = allRuns;

    if (win === "overdue") list = list.filter((r) => r.overdue > 0);
    else if (win === "open") list = list.filter((r) => r.overdue > 0 || (r.pending > 0 && r.dueDate >= addDays(TODAY, -1)));
    else if (win === "30d") list = list.filter((r) => r.dueDate >= TODAY && r.dueDate <= to30);

    if (head !== "all") list = list.filter((r) => r.def.head === head);
    if (formFilter) list = list.filter((r) => r.def.code === formFilter);

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (r) => r.def.form.toLowerCase().includes(needle) || r.periodLabel.toLowerCase().includes(needle),
      );
    }

    const sorted = [...list];
    if (sort === "exposure") sorted.sort((a, b) => b.exposure - a.exposure);
    else if (sort === "open") sorted.sort((a, b) => (b.pending + b.overdue) - (a.pending + a.overdue));
    else sorted.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return sorted;
  }, [allRuns, win, head, formFilter, q, sort]);

  const grouped = useMemo(() => {
    if (sort !== "date") return null;
    const map = new Map<string, typeof runs>();
    for (const r of runs) {
      const key = r.dueDate.slice(0, 7);
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()];
  }, [runs, sort]);

  const totalOpen = runs.reduce((a, r) => a + r.pending + r.overdue, 0);

  return (
    <div className="page">
      <PageHead
        title="All filings"
        icon="runs"
        note={
          <>
            <b>{runs.length}</b> filings · <b>{totalOpen.toLocaleString("en-IN")}</b> open items
          </>
        }
        aside={
          <Seg<SortKey>
            value={sort}
            onChange={setSort}
            options={[
              { value: "date", label: "By date" },
              { value: "exposure", label: "By ₹ at risk" },
              { value: "open", label: "By volume" },
            ]}
          />
        }
      />

      <div className="filters">
        <div className="field" style={{ width: 240 }}>
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by form or period" />
        </div>

        <Seg<Window>
          value={win}
          onChange={setWin}
          options={[
            { value: "open", label: "Live" },
            { value: "overdue", label: "In arrears" },
            { value: "30d", label: "Next 30 days" },
            { value: "all", label: "Full year" },
          ]}
        />

        <select className="plain" value={head} onChange={(e) => setHead(e.target.value)}>
          <option value="all">All compliance heads</option>
          {HEADS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>

        {formFilter ? (
          <button
            type="button"
            className="chip is-on"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("form");
              setParams(next, { replace: true });
            }}
          >
            {formFilter} <Icon name="close" size={12} className="chip__x" />
          </button>
        ) : null}
      </div>

      {grouped ? (
        grouped.map(([key, list]) => {
          const { y, m } = parts(`${key}-01`);
          return (
            <div key={key} style={{ marginBottom: "var(--s6)" }}>
              <div className="shead" style={{ marginTop: 0 }}>
                <h2 style={{ fontSize: "var(--t-16)" }}>{monthLabelLong(y, m)}</h2>
                <span className="shead__note num">{list.length} runs</span>
                <span className="shead__line" />
              </div>
              <RunList runs={list} />
            </div>
          );
        })
      ) : (
        <RunList head defaultSort="due" runs={runs} emptyTitle="No runs match these filters" />
      )}
    </div>
  );
}
