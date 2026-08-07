/* ============================================================================
   FILTER PILLS  —  a refinement bar
   ----------------------------------------------------------------------------
   One pill per field, modelled on the tasks page in the Task Management
   redesign. A pill reads as its own field name until it is set, then reads as
   "Field: value" with an inline clear.

   Two things this buys over both of the shapes it replaces — seven native
   <select>s, and a single "Filters" button with a count:

     • The active narrowing is legible without opening anything. On a grid of
       640 clients the whole question is *which* slice you are looking at, and
       a badge reading "3" does not answer it.
     • Clearing one filter is a single click, not open-dialog → find row →
       reset → close.

   Options carry an avatar where they name a person. A native <option> cannot,
   which is why owner filters used to be the one place in this product where
   staff appeared as plain text.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon.tsx";
import { Avatar } from "./bits.tsx";

export interface PillOption {
  value: string;
  label: string;
  /** Initials, for options that name a person. */
  avatar?: string;
  /** Secondary text, right-aligned — a role, or a count. */
  sub?: string;
}

/** Shared shell: the button, its active styling, and the menu it opens. */
function Pill({
  field, summary, active, onClear, children,
}: {
  field: string;
  summary: string;
  active: boolean;
  onClear: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fpill" ref={wrap}>
      <button
        type="button"
        className={`fpill__btn${active ? " is-active" : ""}${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="u-truncate">
          {active ? <><span className="fpill__f">{field}:</span> {summary}</> : field}
        </span>
        {active ? (
          /* A nested <button> is invalid HTML, so the clear is a span that
             stops the click before it reaches the pill and reopens the menu. */
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${field}`}
            className="fpill__x"
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault(); e.stopPropagation(); onClear(); setOpen(false);
              }
            }}
          >
            <Icon name="close" size={11} />
          </span>
        ) : (
          <Icon name="chevronDown" size={13} className={`fpill__caret${open ? " is-up" : ""}`} />
        )}
      </button>

      {open ? (
        <>
          <div className="sheetscrim" onClick={() => setOpen(false)} />
          <div className="fmenu" role="listbox" aria-label={field}>
            {children(() => setOpen(false))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Pick one. */
export function FilterPill<T extends string>({
  field, value, options, onChange, none,
}: {
  field: string;
  value: T;
  options: PillOption[];
  onChange: (v: T) => void;
  /** The value that means "not filtering" — the pill reads as inactive on it. */
  none: T;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Pill
      field={field}
      summary={selected?.label ?? ""}
      active={value !== none}
      onClear={() => onChange(none)}
    >
      {(close) => options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="option"
          aria-selected={o.value === value}
          className={`fmenu__o${o.value === value ? " is-on" : ""}`}
          onClick={() => { onChange(o.value as T); close(); }}
        >
          {o.avatar ? <Avatar initials={o.avatar} /> : null}
          <span className="u-truncate">{o.label}</span>
          {o.sub ? <span className="fmenu__sub">{o.sub}</span> : null}
          {o.value === value ? <Icon name="check" size={13} className="fmenu__tick" /> : null}
        </button>
      ))}
    </Pill>
  );
}

/**
 * Pick many, with its own search box.
 *
 * Owner is the field where "which one" is usually the wrong question —
 * levelling work means comparing two or three desks against each other, which
 * a single-select turns into three round trips. Seven staff is also just past
 * the point where scanning beats typing, so the list filters as you type.
 */
export function FilterPillMulti({
  field, values, options, onChange, searchPlaceholder = "Search",
}: {
  field: string;
  /** Empty means "not filtering" — every option is in play. */
  values: string[];
  options: PillOption[];
  onChange: (v: string[]) => void;
  searchPlaceholder?: string;
}) {
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(needle) || (o.sub ?? "").toLowerCase().includes(needle),
    );
  }, [options, q]);

  const summary = values.length === 1
    ? options.find((o) => o.value === values[0])?.label ?? "1 selected"
    : `${values.length} people`;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <Pill field={field} summary={summary} active={values.length > 0} onClear={() => onChange([])}>
      {() => (
        <>
          <div className="field fmenu__q">
            <Icon name="search" size={14} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoFocus
            />
          </div>

          {shown.map((o) => {
            const on = values.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                className={`fmenu__o${on ? " is-on" : ""}`}
                onClick={() => toggle(o.value)}
              >
                {/* A checkbox, because these accumulate — a tick alone would
                    read as "one of these". */}
                <span className={`fcheck${on ? " is-on" : ""}`}>
                  {on ? <Icon name="check" size={11} /> : null}
                </span>
                {o.avatar ? <Avatar initials={o.avatar} /> : null}
                <span className="u-truncate">{o.label}</span>
                {o.sub ? <span className="fmenu__sub">{o.sub}</span> : null}
              </button>
            );
          })}

          {shown.length === 0 ? <div className="fmenu__empty">No one matches “{q}”.</div> : null}
        </>
      )}
    </Pill>
  );
}

/** Clears every pill at once. Only rendered when something is actually set. */
export function ClearFilters({ count, onClear }: { count: number; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <button type="button" className="fclear" onClick={onClear}>
      <Icon name="close" size={12} />
      Clear {count === 1 ? "filter" : `all ${count}`}
    </button>
  );
}
