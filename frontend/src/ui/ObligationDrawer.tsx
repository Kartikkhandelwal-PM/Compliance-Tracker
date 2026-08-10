/* ============================================================================
   OBLIGATION DRAWER
   ----------------------------------------------------------------------------
   The trust surface. An engine that silently decides ITR-4 instead of ITR-1
   will not be believed, and staff will re-check everything by hand — which is
   the manual work the module exists to remove. So every obligation can be
   opened to see the rule that fired, the profile fields it read, whether the
   decision was rule-driven or overridden by a person, and exactly how the
   penalty figure was arrived at.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Obligation } from "../domain/types.ts";
import { CLIENT_BY_ID, STAFF } from "../domain/book.ts";
import { DEF_BY_CODE } from "../domain/catalog.ts";
import {
  markFiled, markNotApplicable, reassign, reinstate, sendReminders, unmarkFiled,
} from "../domain/engine.ts";
import { fmtLong, inr } from "../domain/dates.ts";
import { Countdown, StatusTag } from "./bits.tsx";
import { Drawer } from "./Drawer.tsx";
import { Icon } from "./Icon.tsx";
import { useApp } from "./app-state.tsx";

export function ObligationDrawer({
  obligation, onClose,
}: { obligation: Obligation | null; onClose: () => void }) {
  const { toast, me } = useApp();
  const [reason, setReason] = useState("");
  const [arn, setArn] = useState("");
  const [asking, setAsking] = useState<"na" | "reinstate" | "filed" | null>(null);

  /* The engine emits a "Due-date route" fact whose value is the statutory rule
     verbatim, which the Record tab already shows. Two copies of the same
     sentence in one panel reads as a bug.

     This must sit ABOVE the `!obligation` early return: hooks run
     unconditionally or React throws "Rendered more hooks than during the
     previous render" the moment the drawer opens. */
  const shownFacts = useMemo(
    () => (obligation?.rule.facts ?? []).filter((f) => !/due[- ]date route/i.test(f.field)),
    [obligation],
  );

  if (!obligation) return null;
  const o = obligation;
  const client = CLIENT_BY_ID[o.clientId];
  const def = DEF_BY_CODE[o.defCode];

  const close = () => {
    setAsking(null);
    setReason("");
    setArn("");
    onClose();
  };

  return (
    <Drawer
      open
      onClose={close}
      title={<><span className="num">{o.form}</span> · {o.periodLabel}</>}
      subtitle={
        <>
          <Link to={`/clients/${client.id}`} onClick={close} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
            {client.name}
          </Link>
        </>
      }
      footer={
        <>
          {o.status !== "Filed" && o.status !== "Not Applicable" ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setAsking("filed")}
            >
              <Icon name="check" size={15} /> Mark as filed
            </button>
          ) : null}
          {def.clientFacing && o.status !== "Filed" && o.status !== "Not Applicable" ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                sendReminders([o.id], client.whatsapp ? ["WhatsApp", "Email"] : ["Email"]);
                toast(`Reminder queued for ${client.name}`);
              }}
            >
              <Icon name="send" size={15} /> Send reminder
            </button>
          ) : null}
          {/* The lasting way back, for when the toast's Undo is long gone —
              someone spots the mistake a week later, or a client says the return
              they reported as filed was rejected.

              Offered only on filings a person recorded. A portal confirmation or
              a KDK filing receipt is evidence from outside this app, and letting
              a button here overrule it would make the status mean nothing. */}
          {o.status === "Filed" && o.basis === "Manually marked" ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                unmarkFiled([o.id]);
                toast(`${o.form} reopened for ${client.name}`);
                close();
              }}
            >
              <Icon name="history" size={15} /> Not filed after all
            </button>
          ) : null}
          <span className="u-spacer" />
          {o.status === "Not Applicable" ? (
            <button type="button" className="btn" onClick={() => setAsking("reinstate")}>
              <Icon name="plus" size={15} /> Add back
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => setAsking("na")}>
              <Icon name="ban" size={15} /> Not applicable
            </button>
          )}
        </>
      }
    >
      {/* ---- Status ------------------------------------------------------
           Everything below is visible at once. An earlier version hid the
           rule, the fee and the record behind a segmented control, which
           meant the one question this panel exists to answer ("why does this
           apply?") took a click to reach. Instead of hiding content, the
           content that was not earning its place was cut: status source,
           reminder stage, the compliance description, PAN, GSTIN and turnover
           all live on screens of their own. */}
      <div className={`obstate${o.status === "Overdue" ? " is-risk" : ""}`}>
        <div className="obstate__row">
          <StatusTag status={o.status} />
          {/* Only while the return is still open. `Countdown` reads the due date
              alone, so on a settled row it announced "Filed · 31 days overdue"
              in red — contradicting both the status beside it and the filing
              date below it. Nothing is overdue once it has been filed. */}
          {o.status === "Pending" || o.status === "Overdue"
            ? <Countdown due={o.dueDate} />
            : null}
          <span className="u-spacer" />
          {o.override
            ? <span className="tag tag--outline">Manual override</span>
            : <span className="tag tag--outline">Rule-driven</span>}
        </div>

        <div className="obstate__grid">
          <div className="obstate__due">
            <span className="obstate__k">Due date</span>
            <b className="num">{fmtLong(o.dueDate)}</b>
            <span className="obstate__rule">{def.dueRule}</span>
          </div>
          <div className="obstate__own">
            <span className="obstate__k">Owner</span>
            <select
              className="plain plain--sm"
              value={o.assigneeId}
              onChange={(e) => { reassign([o.id], e.target.value); toast("Owner updated"); }}
            >
              <option value="none">Unassigned</option>
              {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {o.status === "Overdue" ? (
          <div className="obstate__fee">
            <span className="obstate__k">Late fees accrued</span>
            <b className="num">₹{inr(o.exposure)}</b>
            <span className="obstate__feesub">
              over {o.daysOverdue} {o.daysOverdue === 1 ? "day" : "days"} · {o.exposureFormula}
            </span>
          </div>
        ) : null}

        {o.status === "Filed" ? (
          <div className="obstate__ack">
            <span className="obstate__k">Acknowledgement</span>
            {o.arn
              ? <b className="num">{o.arn}</b>
              : <b className="is-missing">Not recorded</b>}
            <span className="obstate__feesub">
              {o.basis}
              {o.filedOn ? ` · filed ${fmtLong(o.filedOn)}` : ""}
              {o.filedBy ? ` · recorded by ${o.filedBy}` : ""}
            </span>
          </div>
        ) : null}
      </div>

      {/* ---- Why it applies. Always visible: it is the whole point. -------- */}
      <div className="obwhy">
        <div className="obwhy__head">
          <Icon name="rules" size={14} />
          <span>{o.override ? "Changed manually" : "Why this applies"}</span>
          <span className="num obwhy__ref">{o.rule.ruleRef}</span>
        </div>
        <p className="obwhy__rule">
          {o.override ? (
            <>
              <b>{o.override.by}</b> {o.override.action === "excluded" ? "removed" : "added back"} this
              compliance on <span className="num">{fmtLong(o.override.on)}</span>. Reason given:
              “{o.override.reason}”
            </>
          ) : (
            o.rule.condition
          )}
        </p>
        {o.override ? (
          <p className="obwhy__engine">What the rules say: {o.rule.condition}</p>
        ) : null}
        <div className="obwhy__facts">
          {shownFacts.map((f, i) => (
            <span className="fact" key={i}>
              {f.field} <b>{f.value}</b>
            </span>
          ))}
        </div>
      </div>

      <Link to={`/clients/${client.id}`} onClick={close} className="obwhy__link">
        Open {client.name} <Icon name="chevronRight" size={13} />
      </Link>

      {/* ---- Record a filing ----------------------------------------------
           The acknowledgement is asked for here and nowhere else. Marking one
           obligation filed can afford a field; the bulk action on the run
           screen covers hundreds of clients at once and cannot collect a
           different number for each, so requiring one would either stop the
           bulk action being used or get it filled with the same junk value
           hundreds of times. Optional and asked for beats mandatory and
           worked around.

           Who marked it is NOT asked for. The signed-in staff member is
           already known, so it is recorded on every path including bulk. */}
      {asking === "filed" ? (
        <div className="sheet" style={{ marginTop: "var(--s4)" }}>
          <div className="sheet__head">
            <span className="sheet__title">Record this filing</span>
          </div>
          <div className="sheet__body">
            <p className="u-mute" style={{ marginTop: 0, fontSize: "var(--t-13)" }}>
              Recorded against <b>{me.name}</b> and dated today. Late fees stop accruing and any
              scheduled reminder for this return is cancelled.
            </p>
            <label className="u-mute" style={{ fontSize: "var(--t-12)", display: "block", marginBottom: 4 }}>
              Acknowledgement number — optional
            </label>
            <div className="field" style={{ height: 36 }}>
              <input
                autoFocus
                value={arn}
                placeholder={o.head === "GST" ? "ARN, e.g. AA0807260012345" : "ARN, receipt or token number"}
                onChange={(e) => setArn(e.target.value)}
              />
            </div>
            <div className="u-row" style={{ marginTop: "var(--s3)" }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  const ack = arn.trim();
                  markFiled([o.id], { by: me.name, arn: ack || undefined });
                  toast(
                    ack
                      ? `${o.form} filed for ${client.name} · ${ack}`
                      : `${o.form} marked filed for ${client.name}`,
                    { label: "Undo", run: () => { unmarkFiled([o.id]); toast(`${o.form} reopened`); } },
                  );
                  close();
                }}
              >
                {/* Not "Mark as filed" — that is the footer button that opened
                    this prompt, and two controls with one label leaves the
                    reader unsure whether anything has happened yet. */}
                <Icon name="check" size={15} /> Record filing
              </button>
              <button type="button" className="btn" onClick={() => { setArn(""); setAsking(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- Override prompt ---------------------------------------------- */}
      {asking === "na" || asking === "reinstate" ? (
        <div className="sheet" style={{ marginTop: "var(--s4)" }}>
          <div className="sheet__head">
            <span className="sheet__title">
              {asking === "na" ? "Remove this compliance" : "Add this compliance back"}
            </span>
          </div>
          <div className="sheet__body">
            <p className="u-mute" style={{ marginTop: 0, fontSize: "var(--t-13)" }}>
              A reason is required. Overrides are kept separate from rule-driven decisions so
              the engine's own accuracy stays measurable.
            </p>
            <div className="field" style={{ height: 36 }}>
              <input
                autoFocus
                value={reason}
                placeholder="e.g. Registration surrendered in June — confirmed with client"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="u-row" style={{ marginTop: "var(--s3)" }}>
              <button
                type="button"
                className="btn btn--primary"
                disabled={reason.trim().length < 4}
                onClick={() => {
                  if (asking === "na") markNotApplicable([o.id], reason.trim(), me.name);
                  else reinstate([o.id], reason.trim(), me.name);
                  toast(asking === "na" ? "Marked not applicable" : "Compliance reinstated");
                  close();
                }}
              >
                Save override
              </button>
              <button type="button" className="btn" onClick={() => setAsking(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

    </Drawer>
  );
}
