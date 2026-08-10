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

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fmtShort } from "../domain/dates.ts";
import { Icon } from "./Icon.tsx";
import { Avatar } from "./bits.tsx";

export interface PillOption {
  value: string;
  label: string;
  /** Initials, for options that name a person. */
  avatar?: string;
  /** A brand or status mark, for options that are recognised by their glyph
   *  faster than by their name — WhatsApp and Gmail above all. */
  icon?: ReactNode;
  /** Secondary text, right-aligned — a role, or a count. */
  sub?: string;
  /** Section this option belongs under. Options carrying a group are rendered
   *  beneath a sticky heading of that name, which is what lets one pill hold
   *  a two-level list (compliance head → the forms inside it) instead of
   *  spending two pills on one question. */
  group?: string;
  /** Renders half a step in, so a child reads as belonging to the row above
   *  rather than as a sibling of it. */
  indent?: boolean;
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

/** Pick one. Options carrying a `group` are rendered under section headings,
 *  and a list past a dozen entries gets its own search box — both so that a
 *  single pill can carry a long, two-level field without becoming a scroll
 *  hunt. */
export function FilterPill<T extends string>({
  field, value, options, onChange, none, searchable,
}: {
  field: string;
  value: T;
  options: PillOption[];
  onChange: (v: T) => void;
  /** The value that means "not filtering" — the pill reads as inactive on it. */
  none: T;
  /** Force the search box on or off; by default it appears past 12 options. */
  searchable?: boolean;
}) {
  const [q, setQ] = useState("");
  const selected = options.find((o) => o.value === value);
  const withSearch = searchable ?? options.length > 12;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(needle)
        || (o.group ?? "").toLowerCase().includes(needle),
    );
  }, [options, q]);

  return (
    <Pill
      field={field}
      summary={selected?.label ?? ""}
      active={value !== none}
      onClear={() => onChange(none)}
    >
      {(close) => (
        <>
          {withSearch ? (
            <div className="field fmenu__q">
              <Icon name="search" size={14} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${field.toLowerCase()}`}
                aria-label={`Search ${field.toLowerCase()}`}
                autoFocus
              />
            </div>
          ) : null}

          {shown.map((o, i) => {
            /* A heading is emitted whenever the group changes, so the same flat
               list renders as sections without the caller having to nest it. */
            const head = o.group && o.group !== shown[i - 1]?.group
              ? <div key={`g-${o.group}`} className="fmenu__group">{o.group}</div>
              : null;
            return (
              <Fragment key={o.value}>
                {head}
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`fmenu__o${o.value === value ? " is-on" : ""}${o.indent ? " is-child" : ""}`}
                  onClick={() => { onChange(o.value as T); close(); }}
                >
                  {o.avatar ? <Avatar initials={o.avatar} /> : null}
                  {o.icon ? <span className="fmenu__ico">{o.icon}</span> : null}
                  <span className="u-truncate">{o.label}</span>
                  {o.sub ? <span className="fmenu__sub">{o.sub}</span> : null}
                  {o.value === value ? <Icon name="check" size={13} className="fmenu__tick" /> : null}
                </button>
              </Fragment>
            );
          })}

          {shown.length === 0 ? <div className="fmenu__empty">Nothing matches “{q}”.</div> : null}
        </>
      )}
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

/**
 * A real date range, not a list of guesses.
 *
 * The presets ("Last 7 days", "Last 30 days") answer the common question and
 * nothing else: the moment someone is reconciling a specific week, or checking
 * what went out either side of a due date, a fixed list of four options cannot
 * express it and they are back to scrolling. Presets stay — they are one click
 * for the case that is genuinely common — but they now sit above two real date
 * fields rather than instead of them.
 */
export function DateRangePill({
  from, to, onChange, presets,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  presets: { label: string; from: string; to: string }[];
}) {
  const active = !!(from || to);
  const summary = from && to
    ? (from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`)
    : from ? `from ${fmtShort(from)}`
    : to ? `to ${fmtShort(to)}`
    : "";

  return (
    <Pill field="Date" summary={summary} active={active} onClear={() => onChange("", "")}>
      {(close) => (
        <div className="drange">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`fmenu__o${from === p.from && to === p.to ? " is-on" : ""}`}
              onClick={() => { onChange(p.from, p.to); close(); }}
            >
              <span className="u-truncate">{p.label}</span>
              {from === p.from && to === p.to
                ? <Icon name="check" size={13} className="fmenu__tick" /> : null}
            </button>
          ))}

          <div className="fmenu__group">Or pick a range</div>
          <div className="drange__row">
            <label className="drange__f">
              <span>From</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => onChange(e.target.value, to)}
              />
            </label>
            <label className="drange__f">
              <span>To</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => onChange(from, e.target.value)}
              />
            </label>
          </div>
        </div>
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
