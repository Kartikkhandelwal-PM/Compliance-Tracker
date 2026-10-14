/* "/" to open. Search by name, PAN or GSTIN is a stated Phase-1 requirement; putting it
   in a palette rather than a permanent search field keeps the work surface
   free for data, and gives navigation and search one entry point. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RecordType } from "../domain/types.ts";
import { CLIENTS, GST_ENTITIES, TDS_DEDUCTORS, staffOf } from "../domain/book.ts";
import { DEFS } from "../domain/catalog.ts";
import { untrackedCodes } from "../domain/engine.ts";
import { useEngine } from "./app-state.tsx";
import { Icon } from "./Icon.tsx";
import { Avatar, initialsOf } from "./bits.tsx";
import type { IconName } from "./Icon.tsx";

interface Item {
  group: string;
  label: string;
  sub?: string;
  icon: IconName;
  to: string;
  /** Clients are recognised by face before name, so results carry one. */
  avatar?: string;
  /** Whose client it is — the second thing you check before opening it. */
  owner?: string;
}

/* The six real destinations plus Settings, and nothing else. This list had
   drifted badly: it still offered "Today" (renamed Dashboard), "Matrix"
   (renamed Tracker), "Team" (removed from the product) and "Rule engine"
   (whose ladders were deleted) — so a quarter of the palette navigated to
   names that no longer exist or screens nobody can reach from the rail. */
const NAV: Item[] = [
  { group: "Go to", label: "Dashboard", sub: "where the firm stands", icon: "today", to: "/" },
  { group: "Go to", label: "Calendar", sub: "when everything is due", icon: "calendar", to: "/calendar" },
  { group: "Go to", label: "Compliances", sub: "the catalogue", icon: "rules", to: "/compliances" },
  { group: "Go to", label: "Tracker", sub: "every client × every compliance", icon: "matrix", to: "/tracker" },
  { group: "Go to", label: "Clients", sub: "everyone you file for", icon: "clients", to: "/clients" },
  { group: "Go to", label: "Reminders", sub: "what clients were told", icon: "outbox", to: "/reminders" },
  { group: "Go to", label: "Settings", sub: "firm configuration", icon: "settings", to: "/settings" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const untracked = useEngine(untrackedCodes);
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return NAV;

    const out: Item[] = NAV.filter((n) => n.label.toLowerCase().includes(needle));

    /* Client, Firm and Deductor are unrelated records with their own id
       (PAN/GSTIN/TAN) — searched together here since the palette's job is
       "find the record", not "find it within one bucket", but each result
       still links to its own type so the detail page opens on the right one. */
    const books: [RecordType, { id: string; name: string; legalName: string; assigneeId: string }[], string][] = [
      ["Client", CLIENTS, "pan"],
      ["GstEntity", GST_ENTITIES, "gstin"],
      ["TdsDeductor", TDS_DEDUCTORS, "tan"],
    ];
    for (const [type, list, idField] of books) {
      for (const c of list as (typeof list[number] & Record<string, string>)[]) {
        if (out.length > 40) break;
        const idValue: string = c[idField] ?? "";
        if (
          c.name.toLowerCase().includes(needle) ||
          c.legalName.toLowerCase().includes(needle) ||
          idValue.toLowerCase().includes(needle)
        ) {
          out.push({
            group: "Clients",
            label: c.name,
            sub: idValue,
            icon: "clients",
            avatar: initialsOf(c.name),
            owner: staffOf(c.assigneeId).initials,
            to: `/clients/${c.id}?type=${type}`,
          });
        }
      }
    }

    for (const d of DEFS) {
      if (out.length > 55) break;
      if (untracked.has(d.code)) continue;
      if (d.form.toLowerCase().includes(needle) || d.code.toLowerCase().includes(needle)) {
        out.push({
          group: "Compliances",
          label: d.form,
          sub: d.head,
          icon: "rules",
          to: `/compliances/${encodeURIComponent(d.code)}`,
        });
      }
    }

    return out;
  }, [q, untracked]);

  useEffect(() => setCursor(0), [q]);

  if (!open) return null;

  const go = (i: Item) => {
    nav(i.to);
    onClose();
  };

  let lastGroup = "";

  return (
    <div className="cmdwrap" onClick={onClose}>
      <div className="cmd" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cmd__input">
          <Icon name="search" size={19} style={{ color: "var(--ink-3)" }} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search clients by name, PAN, GSTIN or TAN, or jump to a screen"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter" && results[cursor]) { e.preventDefault(); go(results[cursor]); }
              if (e.key === "Escape") onClose();
            }}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmd__list">
          {results.length === 0 ? (
            <div style={{ padding: "var(--s6)", textAlign: "center", color: "var(--ink-3)", fontSize: "var(--t-13)" }}>
              Nothing matches “{q}”.
            </div>
          ) : (
            results.map((r, i) => {
              const head = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              return (
                <div key={`${r.to}-${i}`}>
                  {head ? <div className="cmd__group">{head}</div> : null}
                  <button
                    type="button"
                    className={`cmditem${i === cursor ? " is-on" : ""}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r)}
                  >
                    {r.avatar
                      ? <Avatar initials={r.avatar} />
                      : <Icon name={r.icon} size={15} style={{ color: "var(--ink-3)" }} />}
                    <span className="u-truncate">{r.label}</span>
                    {r.sub ? <span className="cmditem__sub">{r.sub}</span> : null}
                    {r.owner ? (
                      <span className="cmditem__owner" title="Owner">
                        <Avatar initials={r.owner} />
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
