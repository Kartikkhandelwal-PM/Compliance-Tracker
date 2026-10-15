/* "/" to open. Search by name, PAN or GSTIN is a stated Phase-1 requirement; putting it
   in a palette rather than a permanent search field keeps the work surface
   free for data, and gives navigation and search one entry point.

   What it finds: screens, settings and tools, clients (by name, PAN, GSTIN, TAN,
   email or phone), notices (by reference, type or client), staff, and
   compliances. Typing several words matches them in any order, so "traders
   sharma" finds Sharma Traders. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CLIENTS, CLIENT_BY_ID, GSTINS_BY_CLIENT, STAFF, TANS_BY_CLIENT, clientPath, staffOf } from "../domain/book.ts";
import { DEFS } from "../domain/catalog.ts";
import { fmtShort } from "../domain/dates.ts";
import { getNotices, untrackedCodes } from "../domain/engine.ts";
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

/* The real destinations, and nothing else. */
const NAV: Item[] = [
  { group: "Go to", label: "Dashboard", sub: "where the firm stands", icon: "today", to: "/" },
  { group: "Go to", label: "Calendar", sub: "when everything is due", icon: "calendar", to: "/calendar" },
  { group: "Go to", label: "Compliances", sub: "the catalogue", icon: "rules", to: "/compliances" },
  { group: "Go to", label: "Tracker", sub: "every client × every compliance", icon: "matrix", to: "/tracker" },
  { group: "Go to", label: "Clients", sub: "everyone you file for", icon: "clients", to: "/clients" },
  { group: "Go to", label: "Notices", sub: "department notices and reply dates", icon: "notice", to: "/notices" },
  { group: "Go to", label: "Reminders", sub: "what clients were told", icon: "outbox", to: "/reminders" },
  { group: "Go to", label: "Settings", sub: "firm configuration", icon: "settings", to: "/settings" },
];

/* Settings sections and reminder tools, found by what they are about as well as
   by their name ("smtp", "template", "days"). */
const TOOLS: (Item & { keys: string })[] = [
  { group: "Settings and tools", label: "Templates", sub: "WhatsApp and email wording", icon: "outbox", to: "/reminders?tab=templates", keys: "template message wording whatsapp email approved preview" },
  { group: "Settings and tools", label: "Scheduled reminders", sub: "what goes out next", icon: "clock", to: "/reminders?tab=scheduled", keys: "scheduled queue upcoming reminders next" },
  { group: "Settings and tools", label: "Reminder log", sub: "every message sent", icon: "outbox", to: "/reminders", keys: "log sent messages history delivered failed" },
  { group: "Settings and tools", label: "Reminder steps", sub: "Settings · days, time and channels", icon: "clock", to: "/settings?section=reminders", keys: "reminder steps days time channel schedule timing escalation follow-up" },
  { group: "Settings and tools", label: "WhatsApp number", sub: "Settings · business number", icon: "send", to: "/settings?section=whatsapp", keys: "whatsapp number sender business connect rampwin" },
  { group: "Settings and tools", label: "Email sender", sub: "Settings · address and mail server", icon: "outbox", to: "/settings?section=email", keys: "email smtp sender address domain mail server" },
  { group: "Settings and tools", label: "Tracked compliances", sub: "Settings · what you track and remind", icon: "matrix", to: "/settings?section=compliances", keys: "compliances tracked remind client turn off" },
  { group: "Settings and tools", label: "Team and owners", sub: "Settings · staff and default owner", icon: "team", to: "/settings?section=team", keys: "team staff owners default owner assign" },
  { group: "Settings and tools", label: "Bell alerts", sub: "Settings · in-app alerts", icon: "bell", to: "/settings?section=notifications", keys: "alerts notifications bell" },
  { group: "Settings and tools", label: "Firm details", sub: "Settings · your details", icon: "clients", to: "/settings?section=firm", keys: "firm details name address" },
];

/** Every typed word must appear somewhere in the text, in any order. */
const matchesAll = (tokens: string[], text: string) => {
  const t = text.toLowerCase();
  return tokens.every((w) => t.includes(w));
};

/** How many of each kind of result are shown before the rest are summarised. */
const CAP: Record<string, number> = {
  "Go to": 8, "Settings and tools": 6, Clients: 20, Notices: 8, Team: 5, Compliances: 10,
};

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

  const notices = useEngine(getNotices);

  /* Results, and how many matched in all, so a list that was cut short can say
     so instead of quietly stopping. */
  const { results, hidden } = useMemo<{ results: Item[]; hidden: number }>(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { results: NAV, hidden: 0 };

    const found: Record<string, Item[]> = {};
    const add = (it: Item) => { (found[it.group] ??= []).push(it); };

    for (const n of NAV) if (matchesAll(tokens, n.label)) add(n);
    for (const t of TOOLS) if (matchesAll(tokens, `${t.label} ${t.sub ?? ""} ${t.keys}`)) add(t);

    /* One result per client. It matches on name, PAN, any GSTIN or TAN, or any
       contact email or phone; the result shows which of those matched and opens
       the client (with that registration selected, for a GSTIN or TAN). */
    for (const c of CLIENTS) {
      const gst = GSTINS_BY_CLIENT[c.id] ?? [];
      const tan = TANS_BY_CLIENT[c.id] ?? [];
      let sub = "";
      let to = clientPath("Client", c.id);
      if (matchesAll(tokens, `${c.name} ${c.legalName} ${c.pan}`)) {
        sub = c.pan;
      } else {
        const g = gst.find((x) => matchesAll(tokens, x.gstin));
        const t = g ? undefined : tan.find((x) => matchesAll(tokens, x.tan));
        if (g) { sub = `GSTIN ${g.gstin}`; to = clientPath("GstEntity", g.id); }
        else if (t) { sub = `TAN ${t.tan}`; to = clientPath("TdsDeductor", t.id); }
        else {
          const contact = [c, ...gst, ...tan].find((x) => matchesAll(tokens, `${x.email} ${x.phone}`));
          if (!contact) continue;
          sub = matchesAll(tokens, contact.email) ? contact.email : contact.phone;
        }
      }
      add({ group: "Clients", label: c.name, sub, icon: "clients", avatar: initialsOf(c.name), owner: staffOf(c.assigneeId).initials, to });
    }

    for (const n of notices) {
      const client = CLIENT_BY_ID[n.clientId]?.name ?? "";
      if (matchesAll(tokens, `${n.refNo} ${n.type} ${n.section} ${n.dept} ${n.period} ${n.status} ${client} notice`)) {
        add({ group: "Notices", label: `${n.type} · ${client}`, sub: `${n.refNo} · reply by ${fmtShort(n.replyDue)}`, icon: "notice", to: `/notices?open=${encodeURIComponent(n.id)}` });
      }
    }

    for (const st of STAFF) {
      if (matchesAll(tokens, `${st.name} ${st.role} ${st.initials}`)) {
        const owned = CLIENTS.filter((c) => c.assigneeId === st.id).length;
        add({ group: "Team", label: st.name, sub: `${st.role} · ${owned} clients`, icon: "team", avatar: st.initials, to: `/clients?owner=${st.id}` });
      }
    }

    for (const d of DEFS) {
      if (untracked.has(d.code)) continue;
      if (matchesAll(tokens, `${d.form} ${d.code} ${d.head}`)) {
        add({ group: "Compliances", label: d.form, sub: d.head, icon: "rules", to: `/compliances/${encodeURIComponent(d.code)}` });
      }
    }

    const out: Item[] = [];
    let hiddenCount = 0;
    for (const g of ["Go to", "Settings and tools", "Clients", "Notices", "Team", "Compliances"]) {
      const list = found[g] ?? [];
      out.push(...list.slice(0, CAP[g]));
      hiddenCount += Math.max(0, list.length - CAP[g]);
    }
    return { results: out, hidden: hiddenCount };
  }, [q, untracked, notices]);

  useEffect(() => setCursor(0), [q]);

  /* Keep the highlighted row in view as the arrow keys move down a long list. */
  useEffect(() => {
    document.querySelector<HTMLElement>(".cmd__list .cmditem.is-on")?.scrollIntoView({ block: "nearest" });
  }, [cursor, results]);

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
            placeholder="Search clients, notices, staff and compliances, or jump to a screen"
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
              <div style={{ marginTop: 6, fontSize: "var(--t-12)" }}>
                Try a name, PAN, GSTIN, TAN, notice number, email or phone.
              </div>
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
          {hidden > 0 ? (
            <div className="cmd__more">
              Showing the first {results.length} matches. {hidden.toLocaleString("en-IN")} more not shown, so keep typing to narrow it down.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
