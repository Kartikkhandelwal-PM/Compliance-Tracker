/* ============================================================================
   OWNER SELECT — pick a staff member, with their avatar
   ----------------------------------------------------------------------------
   A native <select> cannot draw an avatar inside its list, which is why every
   owner dropdown in the product used to show staff as plain text while
   everywhere else they are a face. This is the one replacement for all of
   them: the button shows the chosen person's avatar and name, and the list
   shows an avatar beside every option.

   The list opens in a layer of its own, positioned from the button, rather
   than inside it. A drawer scrolls its content and a table can clip its cells;
   a menu drawn inside either would be cut off at the edge of that box.

   Three shapes, one component:
     • set an owner         value is a staff id (or "none")
     • filter by owner      pass `allLabel`; "all" is then a valid value
     • assign to…           value "" shows the placeholder, and choosing
                            someone calls onChange without keeping a value
   ========================================================================== */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STAFF, staffOf } from "../domain/book.ts";
import { Avatar } from "./bits.tsx";
import { Icon } from "./Icon.tsx";

export function OwnerSelect({
  value, onChange, allLabel, noneLabel = "Unassigned", placeholder, size = "md", block, disabled, title, ariaLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Adds an "all" entry with this label, for filters. */
  allLabel?: string;
  /** Wording for the "no owner" entry. */
  noneLabel?: string;
  /** Shown while `value` is empty, for an "Assign to…" control. */
  placeholder?: string;
  size?: "md" | "sm";
  /** Fill the width of the container, for a form field. */
  block?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  /* Place the list under the button, or above it when there is more room
     there, and size it to the room available so it scrolls inside itself
     rather than running off the screen. Re-placed whenever something scrolls,
     so it stays attached to its button instead of closing or drifting. */
  const place = () => {
    if (!btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 14;
    const above = r.top - 14;
    const up = below < 260 && above > below;
    setPos({
      top: up ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - 300)),
      width: Math.max(r.width, 250),
      up,
      maxH: Math.max(160, Math.min(380, (up ? above : below) - 6)),
    });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    const onScroll = (e: Event) => { if (!menu.current?.contains(e.target as Node)) place(); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const close = () => { setOpen(false); setQ(""); };
  const pick = (id: string) => { close(); onChange(id); };

  const current = value === "all" ? null : value === "" ? null : staffOf(value);
  const allRows: { id: string; label: string; initials?: string; sub?: string }[] = [
    ...(allLabel ? [{ id: "all", label: allLabel }] : []),
    { id: "none", label: noneLabel, initials: "—" },
    /* The role is always shown: it is how two people with similar names, or a
       new joiner, are told apart. Same as the Tracker's owner filter. */
    ...STAFF.map((s) => ({ id: s.id, label: s.name, initials: s.initials, sub: s.role })),
  ];
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? allRows.filter((r) => r.label.toLowerCase().includes(needle) || (r.sub ?? "").toLowerCase().includes(needle)) : allRows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, allLabel, noneLabel]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`osel${size === "sm" ? " osel--sm" : ""}${block ? " osel--block" : ""}${open ? " is-open" : ""}${allLabel && value !== "all" ? " is-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current ? (
          <Avatar initials={current.initials} />
        ) : (
          <span className="osel__all"><Icon name="user" size={12} /></span>
        )}
        <span className="osel__name u-truncate">
          {value === "all" ? allLabel : value === "" ? (placeholder ?? "Choose") : value === "none" ? noneLabel : current?.name}
        </span>
        <Icon name="chevronDown" size={13} className="osel__caret" />
      </button>

      {open && pos ? createPortal(
        <>
          <div className="osel__scrim" onClick={close} />
          <div
            ref={menu}
            className={`fmenu osel__menu${pos.up ? " is-up" : ""}`}
            role="listbox"
            aria-label={ariaLabel ?? "Owner"}
            style={{ top: pos.top, left: pos.left, minWidth: pos.width, maxHeight: pos.maxH }}
          >
            <div className="field fmenu__q">
              <Icon name="search" size={14} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search staff"
                aria-label="Search staff"
                autoFocus
              />
            </div>
            {rows.map((r) => (
              <button
                type="button" key={r.id} role="option" aria-selected={r.id === value}
                className={`fmenu__o${r.id === value ? " is-on" : ""}`}
                onClick={() => pick(r.id)}
              >
                {r.initials ? <Avatar initials={r.initials} /> : <span className="osel__all"><Icon name="user" size={12} /></span>}
                <span className="u-truncate">{r.label}</span>
                {r.sub ? <span className="fmenu__sub">{r.sub}</span> : null}
                {r.id === value ? <Icon name="check" size={13} className="fmenu__tick" /> : null}
              </button>
            ))}
            {rows.length === 0 ? <div className="fmenu__empty">Nothing matches “{q}”.</div> : null}
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
}
