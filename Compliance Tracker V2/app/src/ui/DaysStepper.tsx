/* ============================================================================
   DAYS STEPPER — change how many days before or after the due date a step goes
   ----------------------------------------------------------------------------
   Shows a whole number of days with minus and plus, and says which side of the
   due date it is on ("days before" / "days late"). The side is fixed by the
   step: a first reminder is always before the due date and a missed notice is
   always after, so only the number moves.

   The limits come from the engine (the step's own range and its neighbours),
   and the buttons stop at them. There is no way to type a value that would put
   the steps out of order. Typing is still allowed; it is clamped on leaving the
   box.
   ========================================================================== */

import { useEffect, useState } from "react";

export function DaysStepper({
  offset, min, max, onChange, disabled, ariaLabel, whyNotMore, whyNotLess, compact, plain,
}: {
  /** Signed days from the due date: negative before, positive after. */
  offset: number;
  min: number;
  max: number;
  onChange: (offset: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /** Shown on the button and under the box when that direction is blocked. */
  whyNotMore?: string;
  whyNotLess?: string;
  /** Leaves out the "days before / late" words, when the row already says it. */
  compact?: boolean;
  /** Just the number box: no minus and plus buttons. Typing is clamped on leaving the box. */
  plain?: boolean;
}) {
  const dir = offset < 0 ? -1 : 1;
  const days = Math.abs(offset);
  const [text, setText] = useState(String(days));
  useEffect(() => { setText(String(days)); }, [days]);

  const clamp = (o: number) => Math.min(max, Math.max(min, o));
  const set = (o: number) => { const c = clamp(o); if (c !== offset) onChange(c); };
  const commit = () => {
    const n = Number(text);
    if (!Number.isFinite(n) || text.trim() === "") { setText(String(days)); return; }
    set(dir * Math.round(Math.abs(n)));
    setText(String(Math.abs(clamp(dir * Math.round(Math.abs(n))))));
  };

  const canMore = clamp(offset + dir) !== offset;   // further from the due date
  const canLess = clamp(offset - dir) !== offset;   // closer to it

  return (
    <span className={`dstep${compact ? " dstep--compact" : ""}${plain ? " dstep--plain" : ""}${disabled ? " is-disabled" : ""}`} role="group" aria-label={ariaLabel ?? "Days"}>
      <span className="dstep__tip" title={!disabled && !canLess ? whyNotLess : undefined}><button type="button" className="dstep__b" onClick={() => set(offset - dir)} disabled={disabled || !canLess} aria-label="One day fewer">
        <span aria-hidden>−</span>
      </button></span>
      <input
        className="dstep__n num"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
        aria-label={ariaLabel ?? "Days"}
        title={plain ? `${Math.min(Math.abs(min), Math.abs(max))} to ${Math.max(Math.abs(min), Math.abs(max))} days ${offset < 0 ? "before" : "after"} the due date${whyNotMore || whyNotLess ? `. ${whyNotMore ?? whyNotLess}` : ""}` : undefined}
      />
      <span className="dstep__tip" title={!disabled && !canMore ? whyNotMore : undefined}><button type="button" className="dstep__b" onClick={() => set(offset + dir)} disabled={disabled || !canMore} aria-label="One day more">
        <span aria-hidden>+</span>
      </button></span>
      {compact ? null : <span className="dstep__side">{offset < 0 ? "days before" : "days late"}</span>}
    </span>
  );
}
