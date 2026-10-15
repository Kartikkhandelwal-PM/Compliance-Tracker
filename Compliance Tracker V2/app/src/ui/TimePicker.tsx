/* ============================================================================
   TIME PICKER — set a time of day, by typing it or picking it
   ----------------------------------------------------------------------------
   The box takes a typed time ("2:30 pm", "14:30", "9") and shows it as
   "2:30 PM". Clicking it opens a small picker with three columns — hour,
   minute (every 5) and AM / PM — so no time needs to be typed.

   The value is hours as a number (14.5 = 2:30 PM), which is what the reminder
   schedule stores. Only times inside the sending window can be picked: the
   rest are greyed in the columns, and a typed time outside it is moved to the
   nearest allowed one.

   The picker opens in a layer of its own, positioned from the box, so a table
   that clips its cells cannot cut it off.
   ========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.tsx";

/** "2:30 PM" for 14.5. */
export function fmtClock(at: number): string {
  const total = Math.round(at * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Reads what was typed. Without AM or PM, picks whichever reading falls
 *  inside the allowed window ("2" is 2 PM in a 9-to-8 day). */
function parse(text: string, ok: (mins: number) => boolean): number | null {
  const m = text.trim().toLowerCase().replace(/\./g, "").match(/^(\d{1,2})(?:[:\s]?(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59 || h > 24) return null;
  const mark = m[3]?.[0];
  const reads: number[] = [];
  if (mark === "a") reads.push(h % 12);
  else if (mark === "p") reads.push((h % 12) + 12);
  else if (h > 12 || h === 0) reads.push(h % 24);
  else reads.push(h, h === 12 ? 0 : h + 12);
  const hit = reads.find((r) => ok(r * 60 + min)) ?? reads[0];
  return hit + min / 60;
}

export function TimePicker({
  value, onChange, from, to, disabled, ariaLabel, wholeHours, hint,
}: {
  /** Hours as a number, 24h: 14.5 is 2:30 PM. */
  value: number;
  onChange: (hours: number) => void;
  /** The sending window: earliest allowed, and the hour it closes (exclusive). */
  from: number;
  to: number;
  disabled?: boolean;
  ariaLabel?: string;
  /** Whole hours only (9:00, 10:00): the minute column is just :00 and typed minutes are rounded. */
  wholeHours?: boolean;
  /** Line under the columns. Defaults to the sending window; null hides it. */
  hint?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(fmtClock(value));
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => { setText(fmtClock(value)); }, [value]);

  const lo = Math.round(from * 60);
  /* Last allowed minute. With whole hours the last allowed time is the whole hour
     before the closing one, so a clamped value is still a whole hour. */
  const hi = wholeHours ? (Math.round(to) - 1) * 60 : Math.round(to * 60) - 1;
  const ok = (mins: number) => mins >= lo && mins <= hi;
  const clamp = (mins: number) => Math.min(hi, Math.max(lo, mins));

  const mins = Math.round(value * 60);
  const h24 = Math.floor(mins / 60);
  const mm = mins % 60;
  const pm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const snap = (m: number) => (wholeHours ? Math.round(m / 60) * 60 : m);
  const commit = (m: number) => { const c = clamp(snap(m)); if (c !== mins) onChange(c / 60); };

  const pick = (nh12: number, nmm: number, npm: boolean) => {
    const base = ((nh12 % 12) + (npm ? 12 : 0)) * 60 + nmm;
    if (ok(base)) { commit(base); return; }
    /* The pick lands outside the window (a minute that is too late for the
       last hour, say): move to the closest time that is allowed. */
    commit(base);
  };

  const finishTyping = () => {
    const parsed = parse(text, ok);
    if (parsed === null) { setText(fmtClock(value)); return; }
    commit(Math.round(parsed * 60));
    setText(fmtClock(clamp(snap(Math.round(parsed * 60))) / 60));
  };

  const place = () => {
    if (!box.current) return;
    const r = box.current.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 300 && r.top > 300;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.min(r.left, window.innerWidth - 270), up });
  };
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  /* Bring the chosen hour and minute into view when it opens. */
  useLayoutEffect(() => {
    if (!open || !pos) return;
    pop.current?.querySelectorAll<HTMLElement>(".tpk__col .is-on").forEach((el) => el.scrollIntoView({ block: "center" }));
  }, [open, !!pos]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = wholeHours ? [0] : Array.from({ length: 12 }, (_, i) => i * 5);
  const hourOk = (h: number) => minutes.some((m) => ok(((h % 12) + (pm ? 12 : 0)) * 60 + m));
  const minuteOk = (m: number) => ok(((h12 % 12) + (pm ? 12 : 0)) * 60 + m);
  const markOk = (p: boolean) => hours.some((h) => minutes.some((m) => ok(((h % 12) + (p ? 12 : 0)) * 60 + m)));

  return (
    <div className={`tpk${disabled ? " is-disabled" : ""}`} ref={box}>
      <Icon name="clock" size={14} />
      <input
        className="tpk__in"
        value={text}
        disabled={disabled}
        aria-label={ariaLabel ?? "Time"}
        onFocus={(e) => { setOpen(true); e.currentTarget.select(); }}
        onChange={(e) => setText(e.target.value)}
        onBlur={finishTyping}
        onKeyDown={(e) => { if (e.key === "Enter") { finishTyping(); setOpen(false); (e.target as HTMLInputElement).blur(); } }}
      />
      {open && pos && !disabled ? createPortal(
        <div
          ref={pop}
          className="tpk__pop"
          style={{ top: pos.top, left: pos.left, transform: pos.up ? "translateY(-100%)" : undefined }}
          role="dialog"
          aria-label="Pick a time"
        >
          <div className="tpk__cols">
            <div className="tpk__col" aria-label="Hour">
              <small>Hour</small>
              {hours.map((h) => (
                <button key={h} type="button" className={h === h12 ? "is-on" : ""} disabled={!hourOk(h)} onClick={() => pick(h, hourOk(h) && !minuteOk(mm) ? minutes.find((m) => ok(((h % 12) + (pm ? 12 : 0)) * 60 + m)) ?? mm : mm, pm)}>
                  {h}
                </button>
              ))}
            </div>
            <div className="tpk__col" aria-label="Minute">
              <small>Min</small>
              {minutes.map((m) => (
                <button key={m} type="button" className={m === mm ? "is-on" : ""} disabled={!minuteOk(m)} onClick={() => pick(h12, m, pm)}>
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
            <div className="tpk__col tpk__col--mark" aria-label="AM or PM">
              <small>&nbsp;</small>
              {[false, true].map((p) => (
                <button key={String(p)} type="button" className={p === pm ? "is-on" : ""} disabled={!markOk(p)} onClick={() => pick(h12, mm, p)}>
                  {p ? "PM" : "AM"}
                </button>
              ))}
            </div>
          </div>
          {hint === null ? null : <p className="tpk__hint">{hint ?? `Sent between ${fmtClock(from)} and ${fmtClock(to)}`}</p>}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
