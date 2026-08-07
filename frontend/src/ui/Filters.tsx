/* ============================================================================
   FILTER PANEL
   ----------------------------------------------------------------------------
   The tracker had seven controls strung across one row — search, period, head,
   owner, status, grouping, sort — which is more chrome than most screens have
   content, and it wrapped to two lines on anything smaller than a desktop.

   Search and sort stay in the row, because they are used constantly and
   changing them is not "filtering". Everything that NARROWS the book moves
   behind one button that carries a count, so the row is short and the number
   of active filters is legible without reading seven dropdowns.

   The owner picker is a real list rather than a <select>: a native option
   cannot carry an avatar, and staff are recognised by their mark long before
   their name is read anywhere else in this product.
   ========================================================================== */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon.tsx";
import { Avatar } from "./bits.tsx";

export function Filters({
  count, onClear, children,
}: {
  /** How many filters are currently narrowing the view. */
  count: number;
  onClear: () => void;
  children: ReactNode;
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
    <div className="fwrap" ref={wrap}>
      <button
        type="button"
        className={`btn${count > 0 ? " btn--onfilter" : ""}${open ? " is-on" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="filter" size={14} />
        Filters
        {count > 0 ? <span className="fwrap__n num">{count}</span> : null}
      </button>

      {open ? (
        <>
          <div className="sheetscrim" onClick={() => setOpen(false)} />
          <div className="fpanel" role="dialog" aria-label="Filters">
            <div className="fpanel__head">
              Narrow the view
              <span className="u-spacer" />
              {count > 0 ? (
                <button type="button" className="fpanel__clear" onClick={onClear}>
                  Clear all
                </button>
              ) : null}
            </div>
            <div className="fpanel__body">{children}</div>
            <div className="fpanel__foot">
              <button type="button" className="btn btn--sm btn--primary" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** One labelled control inside the panel. */
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="frow">
      <span className="frow__k">{label}</span>
      <div className="frow__v">{children}</div>
    </div>
  );
}

/** A pick-one list. Options carry an avatar where they name a person. */
export function FilterPick<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { value: T; label: string; avatar?: string; sub?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="fpick" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`fpick__o${o.value === value ? " is-on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.avatar ? <Avatar initials={o.avatar} /> : null}
          <span className="u-truncate">{o.label}</span>
          {o.sub ? <span className="fpick__sub num">{o.sub}</span> : null}
          {o.value === value ? <Icon name="check" size={13} className="fpick__tick" /> : null}
        </button>
      ))}
    </div>
  );
}
