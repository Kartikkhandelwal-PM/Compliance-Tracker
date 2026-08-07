/* Shared presentational primitives. Deliberately small — the design leans on
   type, rules and alignment rather than on a large component zoo. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FilingStatus, Head } from "../domain/types.ts";
import { headClass } from "../domain/catalog.ts";
import { countdown, diffDays, inr, TODAY, urgency } from "../domain/dates.ts";
import { Icon } from "./Icon.tsx";

/* ---- Motion helpers ------------------------------------------------------ */

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A figure that counts up to its value on mount and on every change.
 *
 * This is not decoration: the dashboard is rebuilt from the book on every
 * visit, and a number that lands silently gives no signal that it moved. The
 * roll makes "581 → 574" visible without anyone having to remember the old
 * figure. Skipped entirely under prefers-reduced-motion, where it renders the
 * final value on the first frame.
 */
export function CountUp({ n, format }: { n: number; format?: (v: number) => string }) {
  const fmt = format ?? ((v: number) => Math.round(v).toLocaleString("en-IN"));
  const [shown, setShown] = useState(() => (REDUCED ? n : 0));
  const from = useRef(0);

  useEffect(() => {
    if (REDUCED) { setShown(n); return; }
    const start = from.current;
    const t0 = performance.now();
    /* Long climbs get a little longer, but never past 900ms — a KPI that takes
       a second and a half to settle reads as a slow app, not a lively one. */
    const dur = Math.min(900, 380 + Math.abs(n - start) * 0.6);
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = start + (n - start) * eased;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = n;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n]);

  return <>{fmt(shown)}</>;
}

/**
 * Scrolls a detail panel into view when a selection opens it.
 *
 * Picking a date used to reveal its filings somewhere below the fold, so the
 * click appeared to do nothing and people scrolled hunting for the change.
 * `delay` waits out the panel's own open transition, otherwise we scroll to an
 * element that is still zero pixels tall.
 */
export function useRevealOnPick<T extends HTMLElement>(key: string | null, delay = 220) {
  const ref = useRef<T>(null);
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const changed = key !== prev.current;
    prev.current = key;
    if (!key || !changed) return;
    const id = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" });
    }, delay);
    return () => clearTimeout(id);
  }, [key, delay]);

  return ref;
}

/* ---- Status ------------------------------------------------------------- */

const STATUS_CLASS: Record<FilingStatus, string> = {
  Filed: "tag--filed",
  Pending: "tag--pending",
  Overdue: "tag--overdue",
  "Not Applicable": "tag--na",
};

export function StatusTag({ status, label }: { status: FilingStatus; label?: string }) {
  return (
    <span className={`tag ${STATUS_CLASS[status]}`}>
      <i className="tag__dot" />
      {label ?? (status === "Not Applicable" ? "N/A" : status)}
    </span>
  );
}

/* ---- Countdown: urgency, kept separate from status ---------------------- */

export function Countdown({ due, today = TODAY }: { due: string; today?: string }) {
  const u = urgency(due, today);
  return <span className={`cd cd--${u}`}>{countdown(due, today)}</span>;
}

export function DaysBadge({ due, today = TODAY }: { due: string; today?: string }) {
  const n = diffDays(today, due);
  const u = urgency(due, today);
  return (
    <span className={`cd cd--${u}`}>
      {n < 0 ? `T+${-n}` : n === 0 ? "T-0" : `T−${n}`}
    </span>
  );
}

/* ---- Head identity ------------------------------------------------------ */

export function Spine({ head, className = "" }: { head: Head | string; className?: string }) {
  return <i className={`spine ${headClass(head)} ${className}`} />;
}

export function HeadName({ head }: { head: Head | string }) {
  return <span className={`headname ${headClass(head)}`}>{head}</span>;
}

/* ---- People ------------------------------------------------------------- */

/**
 * Staff avatars carry a stable colour so a person is recognisable down a
 * column without reading their initials. The hue is derived from the initials,
 * so the same person is always the same colour on every screen, and it never
 * has to be stored. Six hues, all drawn from the head palette that already
 * passed the colourblind checks; "Unassigned" is deliberately left grey so it
 * reads as an absence rather than as another teammate.
 */
const AVATAR_HUES = ["a-violet", "a-blue", "a-teal", "a-amber", "a-rose", "a-plum"];

function avatarHue(initials: string): string {
  if (!initials || initials === "—") return "a-none";
  let h = 0;
  for (let i = 0; i < initials.length; i++) h = (h * 31 + initials.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

/** Initials for a client, who has a trading name rather than a person's name.
 *  "Sunrise Textiles LLP" → "ST"; "Kavita Sharma" → "KS"; a single word gives
 *  its first two letters so nothing ever renders as one lonely character. */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\w\s&]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function Avatar({ initials, large }: { initials: string; large?: boolean }) {
  return (
    <span className={`avatar ${avatarHue(initials)}${large ? " avatar--lg" : ""}`}>
      {initials}
    </span>
  );
}

/* ---- Progress ----------------------------------------------------------- */

export function Pbar({
  filed, pending, overdue, tall,
}: { filed: number; pending: number; overdue: number; tall?: boolean }) {
  const total = Math.max(1, filed + pending + overdue);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className={`pbar${tall ? " pbar--tall" : ""}`}
      role="img"
      aria-label={`${filed} filed, ${pending} pending, ${overdue} overdue`}
    >
      <i className="f" style={{ width: pct(filed) }} />
      <i className="p" style={{ width: pct(pending) }} />
      <i className="o" style={{ width: pct(overdue) }} />
    </div>
  );
}

/* ---- Figures ------------------------------------------------------------ */

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`num ${className}`}>₹{inr(value)}</span>;
}

export function Stat({
  label, value, sub, tone, onClick, hint, icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "overdue" | "filed" | "soon" | "cool";
  onClick?: () => void;
  hint?: string;
  icon?: import("./Icon.tsx").IconName;
}) {
  const inner = (
    <>
      <div className="stat__top">
        <div className="stat__label">
          {label}
          {hint ? <span title={hint} style={{ display: "inline-flex" }}><Icon name="info" size={12} /></span> : null}
        </div>
        {icon ? (
          <span className="stat__icon">
            <Icon name={icon} size={15} />
          </span>
        ) : null}
      </div>
      <div className={`stat__value${tone ? ` v-${tone}` : ""}`}>{value}</div>
      {sub ? <div className="stat__sub">{sub}</div> : null}
    </>
  );
  return onClick
    ? <button type="button" className={`stat${tone ? ` stat--${tone}` : ""}`} onClick={onClick}>{inner}</button>
    : <div className={`stat${tone ? ` stat--${tone}` : ""}`}>{inner}</div>;
}

/* ---- Layout helpers ----------------------------------------------------- */

export function SectionHead({
  title, note, children, icon,
}: { title: string; note?: ReactNode; children?: ReactNode; icon?: import("./Icon.tsx").IconName }) {
  return (
    <div className="shead">
      {icon ? <span className="shead__icon"><Icon name={icon} size={16} /></span> : null}
      <h2>{title}</h2>
      {note ? <span className="shead__note">{note}</span> : null}
      <span className="shead__line" />
      {children}
    </div>
  );
}

/**
 * Compact page header — title, one short line of state, controls, all on one
 * band. Earlier versions spent ~140px on an eyebrow, a 34px serif title and a
 * three-line paragraph before any data appeared; on a list screen that is most
 * of the fold gone to chrome. `note` is deliberately typed as a short node:
 * if it needs a paragraph, it belongs on the page, not in the header.
 */
export function PageHead({
  title, note, aside, icon,
}: {
  title: string;
  note?: ReactNode;
  aside?: ReactNode;
  /** The destination's own icon, repeated from the rail. Cheap orientation:
   *  arriving mid-scroll or from a deep link, the chip says which of the six
   *  places you are in before the title is read. */
  icon?: import("./Icon.tsx").IconName;
}) {
  return (
    <header className="phead">
      {icon ? <span className="phead__icon"><Icon name={icon} size={20} /></span> : null}
      <h1>{title}</h1>
      {note ? <p className="phead__note">{note}</p> : null}
      <span className="u-spacer" />
      {aside ? <div className="phead__aside">{aside}</div> : null}
    </header>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <p style={{ margin: 0, maxWidth: "52ch", marginInline: "auto" }}>{children}</p> : null}
    </div>
  );
}

export function Check({ on }: { on: boolean }) {
  return (
    <span className={`check${on ? " is-on" : ""}`}>
      <Icon name="check" size={11} />
    </span>
  );
}

export function Seg<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? "is-on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
