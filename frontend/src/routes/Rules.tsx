/* ============================================================================
   SETTINGS
   ----------------------------------------------------------------------------
   Only things a person can actually change.

   This screen used to open on two tabs — the ITR priority ladder and the
   status precedence ladder — each a read-only table of the engine's decision
   logic. They documented how the backend resolves a form and a status, which
   is a specification for whoever builds the engine, not a control anyone in a
   CA office can operate. Nothing on either table could be edited, so the page
   answered a question no user was asking and offered no action when they were
   done reading.

   The one place that logic is genuinely wanted is while looking at a single
   obligation — "why does this apply to this client?" — and it is already
   answered there: every obligation carries the rule that produced it, with the
   profile fields that fired, in its own drawer.

   What remains is the reminder engine's two guards, which are real
   configuration: they change what the firm sends.
   ========================================================================== */

import { useState } from "react";
import { PageHead } from "../ui/bits.tsx";

export function RulesPage() {
  const [quietHours, setQuietHours] = useState(true);
  const [digestCap, setDigestCap] = useState(true);

  return (
    <div className="page page--wide">
      <PageHead
        title="Settings"
        icon="bolt"
        note="Limits on what the reminder engine sends"
      />

      <div className="note" style={{ marginBottom: "var(--s5)" }}>
        Neither of these changes <b>when</b> a reminder fires — that follows the statutory due
        date — only whether it goes out as its own message, and at what hour.
      </div>

      <div className="grid2">
        <div className="sheet">
          <div className="sheet__body">
            <div className="u-row-3" style={{ alignItems: "flex-start" }}>
              <button
                type="button"
                className={`switch${quietHours ? " is-on" : ""}`}
                onClick={() => setQuietHours((v) => !v)}
                aria-pressed={quietHours}
                aria-label="Quiet hours"
              />
              <div>
                <div className="u-strong">Quiet hours · 09:00 – 20:00</div>
                <p className="u-mute" style={{ margin: "4px 0 0", fontSize: "var(--t-13)" }}>
                  Sends falling outside the window are queued and released at 09:00, not dropped.
                  A statutory reminder at 6am reads as spam and gets the number blocked.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="sheet">
          <div className="sheet__body">
            <div className="u-row-3" style={{ alignItems: "flex-start" }}>
              <button
                type="button"
                className={`switch${digestCap ? " is-on" : ""}`}
                onClick={() => setDigestCap((v) => !v)}
                aria-pressed={digestCap}
                aria-label="Digest instead of repeat messages"
              />
              <div>
                <div className="u-strong">Digest instead of repeat messages</div>
                <p className="u-mute" style={{ margin: "4px 0 0", fontSize: "var(--t-13)" }}>
                  Where a client has several compliances due in the same window, send one combined
                  message rather than one per obligation. A company with GSTR-1, GSTR-3B, PF and
                  ESI in the same week would otherwise get four separate chases.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
