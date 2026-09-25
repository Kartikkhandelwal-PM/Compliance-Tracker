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
import type { Channel, Obligation, TaxBasis } from "../domain/types.ts";
import { STAFF } from "../domain/book.ts";
import { DEF_BY_CODE } from "../domain/catalog.ts";
import {
  TAX_BASIS_LABEL, TAX_BASIS_OPTIONS, markFiled, markNotApplicable, ownerOf, reassign, reinstate,
  sendReminders, setNote, setTaxBasis, unmarkFiled,
} from "../domain/engine.ts";
import { fmtLong, inr } from "../domain/dates.ts";
import { Countdown, StatusTag } from "./bits.tsx";
import { Drawer } from "./Drawer.tsx";
import { Icon } from "./Icon.tsx";
import { useApp, useObligations } from "./app-state.tsx";

/** The reasons that came up often enough in practice to list instead of
 *  retyping. "Other" drops back to the free-text box below. */
const NA_REASONS = [
  "Registration surrendered. Confirmed with the client.",
  "Client filed directly through their own consultant this period.",
  "Not applicable. Turnover below threshold, verified from books.",
  "Duplicate registration; obligation tracked under the other GSTIN.",
];

/* No live per-filing URL yet — this is a placeholder destination so the
   button has somewhere real to go while KDK's side is built. Swap for a
   URL built from the filing once that exists. */
const KDK_FILING_URL = "https://dev-sc.kdksoftware.co.in/dashboard?sidebarCollapsed=1";

export function ObligationDrawer({
  obligation, onClose,
}: { obligation: Obligation | null; onClose: () => void }) {
  const { toast, me } = useApp();
  const [reason, setReason] = useState("");
  const [naChoice, setNaChoice] = useState("");
  const [arn, setArn] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [asking, setAsking] = useState<"na" | "reinstate" | "filed" | "note" | null>(null);

  /* `obligation` is a snapshot handed in by whichever screen opened the
     drawer, and that caller has no reason to refresh its own reference
     every time the store changes underneath it. Re-reading the live copy by
     id here is what makes an action taken IN the drawer (reassign, note,
     override) show up immediately instead of only after it's closed and
     reopened. */
  const live = useObligations();

  /* The engine emits a "Due-date route" fact whose value is the statutory rule
     verbatim, which the Record tab already shows. Two copies of the same
     sentence in one panel reads as a bug.

     This must sit ABOVE the `!obligation` early return: hooks run
     unconditionally or React throws "Rendered more hooks than during the
     previous render" the moment the drawer opens. */
  const current = obligation && (live.find((x) => x.id === obligation.id) ?? obligation);
  const shownFacts = useMemo(
    () => (current?.rule.facts ?? []).filter((f) => !/due[- ]date route/i.test(f.field)),
    [current],
  );

  if (!current) return null;
  const o = current;
  const client = ownerOf(o);
  const def = DEF_BY_CODE[o.defCode];
  const reminderChannels: Channel[] = [
    ...(client.whatsapp ? (["WhatsApp"] as const) : []),
    ...(client.emailEnabled ? (["Email"] as const) : []),
  ];

  const close = () => {
    setAsking(null);
    setReason("");
    setNaChoice("");
    setArn("");
    setNoteDraft("");
    onClose();
  };

  return (
    <Drawer
      open
      onClose={close}
      title={<><span className="num">{o.form}</span> · {o.periodLabel}</>}
      subtitle={
        <>
          <Link
            to={`/clients/${client.id}?type=${o.ownerType}`}
            onClick={close}
            style={{ display: "inline-flex", alignItems: "center", gap: 2, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            {client.name} <Icon name="chevronRight" size={13} />
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
              disabled={reminderChannels.length === 0}
              title={reminderChannels.length === 0
                ? "This client has opted out of both WhatsApp and email"
                : undefined}
              onClick={() => {
                sendReminders([o.id], reminderChannels);
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
            <button type="button" className="btn" onClick={() => { setNaChoice(""); setReason(""); setAsking("na"); }}>
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

        {/* Tax liability is a separate figure from the late fee above — it's
            what's owed, not a penalty for being late, so it's shown whatever
            the status is. Only TDS carries a choice of how it's arrived at;
            ITR's is a single number with nothing to switch. */}
        {o.taxLiability > 0 ? (
          <div className="obstate__tax">
            <span className="obstate__k">Tax liability</span>
            <b className="num">₹{inr(o.taxLiability)}</b>
            {o.taxBasis ? (
              <select
                className="plain plain--sm"
                value={o.taxBasis}
                onChange={(e) => {
                  setTaxBasis(o.id, e.target.value as TaxBasis);
                  toast("Tax liability basis updated");
                }}
              >
                {(TAX_BASIS_OPTIONS[o.ownerType] ?? []).map((k) => (
                  <option key={k} value={k}>{TAX_BASIS_LABEL[k]}</option>
                ))}
              </select>
            ) : (
              <span className="obstate__feesub">Estimated from the client's profile</span>
            )}
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

      {/* The client itself is already one click away, in the subtitle up in
          the header — a second link to the same place down here would just
          repeat it. Only actions that are NEW belong in this row. */}
      <div className="u-row" style={{ marginTop: "var(--s4)", flexWrap: "wrap" }}>
        <a href={KDK_FILING_URL} target="_blank" rel="noopener noreferrer" className="btn">
          <Icon name="external" size={14} /> Open this filing
        </a>
        {/* No note yet: a button is enough, the same weight as the one above —
            the full card below is earned by having something to show, not
            offered empty as a place to look for one. */}
        {!o.note ? (
          <button
            type="button"
            className="btn"
            onClick={() => { setNoteDraft(""); setAsking("note"); }}
          >
            <Icon name="info" size={14} /> Add note
          </button>
        ) : null}
      </div>

      {/* ---- Note ---------------------------------------------------------
           One note per filing, not a log — matches the override reason,
           which is also a single current value rather than a history. Shown
           as a full card only once there is a note to show. */}
      {o.note ? (
        <div className="obwhy" style={{ marginTop: "var(--s3)" }}>
          <div className="obwhy__head">
            <Icon name="info" size={14} />
            <span>Note</span>
            <span className="u-spacer" />
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => { setNoteDraft(o.note?.text ?? ""); setAsking("note"); }}
            >
              Edit
            </button>
          </div>
          <p className="obwhy__rule">
            {o.note.text}
            <span className="u-mute" style={{ display: "block", fontSize: "var(--t-11)", marginTop: 4 }}>
              {o.note.by} · {fmtLong(o.note.on)}
            </span>
          </p>
        </div>
      ) : null}

      {asking === "note" ? (
        <div className="sheet" style={{ marginTop: "var(--s4)" }}>
          <div className="sheet__head">
            <span className="sheet__title">{o.note ? "Edit note" : "Add note"}</span>
          </div>
          <div className="sheet__body">
            <div className="field">
              <textarea
                autoFocus
                rows={3}
                value={noteDraft}
                placeholder="Anything worth flagging about this filing for this client"
                onChange={(e) => setNoteDraft(e.target.value)}
              />
            </div>
            <div className="u-row" style={{ marginTop: "var(--s3)" }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setNote(o.id, noteDraft, me.name);
                  toast(noteDraft.trim() ? "Note saved" : "Note cleared");
                  setAsking(null);
                }}
              >
                Save note
              </button>
              {o.note ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => { setNote(o.id, "", me.name); toast("Note cleared"); setAsking(null); }}
                >
                  Remove note
                </button>
              ) : null}
              <button type="button" className="btn" onClick={() => setAsking(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

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
              Acknowledgement number (optional)
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
            {asking === "na" ? (
              <div className="field" style={{ height: 36, marginBottom: 8 }}>
                <select
                  value={naChoice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNaChoice(v);
                    setReason(v === "other" ? "" : v);
                  }}
                >
                  <option value="" disabled>Select a reason…</option>
                  {NA_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  <option value="other">Other — type manually</option>
                </select>
              </div>
            ) : null}
            {asking === "reinstate" || naChoice === "other" ? (
              <div className="field" style={{ height: 36 }}>
                <input
                  autoFocus
                  value={reason}
                  placeholder={asking === "reinstate"
                    ? "e.g. Registration surrendered in June, confirmed with client"
                    : "Type the reason"}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            ) : null}
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
              <button type="button" className="btn" onClick={() => { setAsking(null); setNaChoice(""); setReason(""); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </Drawer>
  );
}
