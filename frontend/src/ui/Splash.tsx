/* ============================================================================
   SPLASH
   ----------------------------------------------------------------------------
   The boot screen, and the only place in this product that is allowed to be
   purely expressive.

   It is not a spinner with a logo on it. The motif is the thing the whole
   module exists for: a month of statutory dates, with the four that a CA
   office actually runs on lighting up in order — the 7th (TDS challan), the
   11th (GSTR-1), the 15th (PF/ESI) and the 20th (GSTR-3B). Anyone who files
   for a living reads that rhythm instantly, which is what makes it feel like
   the product's own screen rather than a stock loader.

   Restraint, because it is seen on every boot:
     • ~1.9s, then it leaves. Long enough to land, short enough not to be a toll.
     • Click, tap or any key dismisses it immediately.
     • Under prefers-reduced-motion the composition renders in its final state
       and fades after a beat — no cells popping, no sweep, no counting.
   ========================================================================== */

import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo.tsx";

/** Day-of-month for each grid cell: the 1st sits on a Tuesday, so the month
 *  fills cells 2…32 and the statutory dates land where they visually should. */
const OFFSET = 2;
const CELLS = 35;
/** The four dates the office's month is actually built around. */
const PULSE: Record<number, { d: number; tone: "teal" | "amber" }> = {
  [OFFSET + 6]: { d: 7, tone: "teal" },
  [OFFSET + 10]: { d: 11, tone: "amber" },
  [OFFSET + 14]: { d: 15, tone: "teal" },
  [OFFSET + 19]: { d: 20, tone: "amber" },
};

const REDUCED =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    /* One path out, whether it ran its course or was dismissed — otherwise a
       click during the last 200ms fires onDone twice. */
    const finish = () => {
      if (done.current) return;
      done.current = true;
      setLeaving(true);
      setTimeout(onDone, 420);
    };
    /* 1.9s read as a flicker — the month barely finished lighting up before
       the screen left. The sequence needs its full run: cells in, sweep
       across, four dates landing, lockup, meter. */
    const hold = setTimeout(finish, REDUCED ? 700 : 3400);
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(hold);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [onDone]);

  return (
    <div
      className={`splash${leaving ? " is-leaving" : ""}${REDUCED ? " is-still" : ""}`}
      role="status"
      aria-label="Compliance Tracker is starting"
    >
      <div className="splash__aurora" aria-hidden="true" />

      <div className="splash__stage">
        <div className="splash__cal" aria-hidden="true">
          <div className="splash__dow">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="splash__grid">
            {Array.from({ length: CELLS }, (_, i) => {
              const day = i - OFFSET + 1;
              const outside = day < 1 || day > 31;
              const pulse = PULSE[i];
              return (
                <span
                  key={i}
                  className={
                    "splash__cell"
                    + (outside ? " is-out" : "")
                    + (pulse ? ` is-pulse t-${pulse.tone}` : "")
                  }
                  style={{ "--i": i, "--p": pulse ? Object.keys(PULSE).indexOf(String(i)) : 0 } as React.CSSProperties}
                >
                  {pulse ? <b>{pulse.d}</b> : null}
                </span>
              );
            })}
          </div>
          {/* A hairline that sweeps the grid once, like a month being read. */}
          <span className="splash__sweep" />
        </div>

        <div className="splash__id">
          <span className="splash__mark"><Logo size={46} id="splash" /></span>
          <span className="splash__words">
            <b>Compliance Tracker</b>
            <span>KDK Software</span>
          </span>
        </div>

        <div className="splash__meter"><i /></div>
      </div>
    </div>
  );
}
