/* ============================================================================
   COMPLIANCES — the master list, up front
   ----------------------------------------------------------------------------
   This is reference information about each compliance itself: which head it
   belongs to, how often it recurs, the rule that sets its due date, who it
   applies to and what it costs when missed. It was previously buried in
   Settings under the name "Compliance rules", which was wrong twice over: it
   is not configuration, and it is not a rule engine. It is the catalogue of
   what the practice actually files.

   It is the top of a three-step drill, which is how people describe the job:

       compliance  →  its dates  →  the clients on that date
       (this page)    (ComplianceDetail)   (RunDetail)
   ========================================================================== */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useObligations } from "../ui/app-state.tsx";
import { DEFS, HEADS, headClass } from "../domain/catalog.ts";
import { inrShort } from "../domain/dates.ts";
import { Empty, PageHead } from "../ui/bits.tsx";
import { Icon } from "../ui/Icon.tsx";

type GroupBy = "head" | "frequency" | "none";

export function CompliancesPage() {
  const obligations = useObligations();
  const [q, setQ] = useState("");
  const [head, setHead] = useState("all");
  const [group, setGroup] = useState<GroupBy>("head");

  /* The group headers park directly under the filter bar, which is itself
     sticky. Its height is not a constant — it wraps to a second line on a
     narrow window — so measure it into --filters-h instead of hardcoding an
     offset that would let the two overlap. */
  const pageRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const bar = filtersRef.current;
    const page = pageRef.current;
    if (!bar || !page) return;
    const measure = () =>
      page.style.setProperty("--filters-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  /* Live coverage per compliance definition. */
  const stats = useMemo(() => {
    const m = new Map<string, { clients: Set<string>; open: number; overdue: number; fees: number; dates: Set<string> }>();
    for (const o of obligations) {
      let s = m.get(o.defCode);
      if (!s) {
        s = { clients: new Set(), open: 0, overdue: 0, fees: 0, dates: new Set() };
        m.set(o.defCode, s);
      }
      if (o.status === "Not Applicable") continue;
      s.clients.add(o.clientId);
      s.dates.add(o.dueDate);
      if (o.status === "Pending") s.open++;
      if (o.status === "Overdue") { s.overdue++; s.fees += o.exposure; }
    }
    return m;
  }, [obligations]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return DEFS.filter((d) => {
      if (head !== "all" && d.head !== head) return false;
      if (!needle) return true;
      return d.form.toLowerCase().includes(needle)
        || d.description.toLowerCase().includes(needle)
        || d.code.toLowerCase().includes(needle);
    });
  }, [q, head]);

  /* Contiguous groups for the section headers. */
  const groups = useMemo(() => {
    if (group === "none") return [{ key: "all", label: "", defs: filtered }];
    const m = new Map<string, typeof filtered>();
    for (const d of filtered) {
      const key = group === "head" ? d.head : d.frequency;
      const list = m.get(key);
      if (list) list.push(d);
      else m.set(key, [d]);
    }
    const order = group === "head" ? HEADS : ["Monthly", "Quarterly", "Half-yearly", "Annual", "Event-based"];
    return [...m.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([key, defs]) => ({ key, label: key, defs }));
  }, [filtered, group]);

  return (
    <div className="page page--wide" ref={pageRef}>
      <PageHead
        title="Compliances"
        icon="rules"
        note={<><b>{filtered.length}</b> of {DEFS.length} compliance types</>}
      />

      <div className="filters" ref={filtersRef}>
        <div className="field" style={{ width: 260 }}>
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Form, code or description" />
        </div>
        <select className="plain" value={head} onChange={(e) => setHead(e.target.value)} aria-label="Compliance head">
          <option value="all">All heads</option>
          {HEADS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select className="plain" value={group} onChange={(e) => setGroup(e.target.value as GroupBy)} aria-label="Group by">
          <option value="head">Group by head</option>
          <option value="frequency">Group by frequency</option>
          <option value="none">No grouping</option>
        </select>
        <span className="u-spacer" />
        <span className="shead__note">Open a compliance to see all its dates</span>
      </div>

      {filtered.length === 0 ? (
        <div className="sheet"><Empty title="No compliance matches that">Try a different form code or clear the head filter.</Empty></div>
      ) : (
        groups.map((g) => (
          <section key={g.key} style={{ marginBottom: "var(--s5)" }}>
            {g.label ? (
              <div className="grouphead">
                {group === "head" ? <i className={`grouphead__dot ${headClass(g.label)}`} /> : null}
                {g.label}
                <span className="grouphead__n">{g.defs.length}</span>
              </div>
            ) : null}

            <div className="cmpgrid">
              {g.defs.map((d) => {
                const s = stats.get(d.code);
                const clients = s?.clients.size ?? 0;
                const overdue = s?.overdue ?? 0;
                return (
                  <Link
                    key={d.code}
                    to={`/compliances/${encodeURIComponent(d.code)}`}
                    className={`cmpcard${overdue > 0 ? " has-risk" : ""}`}
                  >
                    <div className="cmpcard__top">
                      <i className={`cmpcard__spine ${headClass(d.head)}`} />
                      <div className="cmpcard__id">
                        <b>{d.form}</b>
                        <span>{d.description}</span>
                      </div>
                      <Icon name="chevronRight" size={14} className="cmpcard__chev" />
                    </div>

                    <dl className="cmpcard__facts">
                      <div>
                        <dt>Frequency</dt>
                        <dd>{d.frequency}</dd>
                      </div>
                      <div>
                        <dt>Due</dt>
                        <dd>{d.dueRule}</dd>
                      </div>
                      <div>
                        <dt>Applies to</dt>
                        <dd>{d.applicability}</dd>
                      </div>
                    </dl>

                    <div className="cmpcard__foot">
                      <span className="num"><b>{clients.toLocaleString("en-IN")}</b> clients</span>
                      <span className="num"><b>{s?.dates.size ?? 0}</b> dates</span>
                      <span className="u-spacer" />
                      {overdue > 0 ? (
                        <span className="pill-late num">
                          {overdue} late{s && s.fees > 0 ? ` · ${inrShort(s.fees)}` : ""}
                        </span>
                      ) : (
                        <span className="u-faint" style={{ fontSize: "var(--t-11)" }}>nothing late</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
