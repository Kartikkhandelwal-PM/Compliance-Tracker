/* ============================================================================
   NOTICE PIECES — shared by the Notices page, the client tab and the Dashboard
   ----------------------------------------------------------------------------
   A deadline pill that says how long is left (or how late), a row for a
   notice, and the drawer that opens on click: the facts, the five-step life
   cycle, the owner, and what has happened so far.
   ========================================================================== */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CLIENT_BY_ID, GST_ENTITY_BY_ID, TDS_DEDUCTOR_BY_ID, clientPath, staffOf } from "../domain/book.ts";
import { assignNotice, setNoticeOutcome, setNoticeStatus } from "../domain/engine.ts";
import {
  NOTICE_OUTCOMES, NOTICE_STAGES, daysToReply, urgencyOf,
} from "../domain/notices.ts";
import type { NoticeOutcome } from "../domain/notices.ts";
import type { Notice } from "../domain/notices.ts";
import { fmtDate, fmtLong, inr } from "../domain/dates.ts";
import { Avatar } from "./bits.tsx";
import { Drawer } from "./Drawer.tsx";
import { OwnerSelect } from "./OwnerSelect.tsx";
import { Icon } from "./Icon.tsx";
import { useApp } from "./app-state.tsx";

/* No per-notice URL on KDK's side yet. This is a placeholder destination so the
   button has somewhere real to go while that is built, the same arrangement as
   "Open this filing" on a filing. Swap for a URL built from the notice (its
   department and reference number) once KDK provides one. */
const KDK_NOTICE_URL = "https://dev-sc.kdksoftware.co.in/dashboard?sidebarCollapsed=1";

/** Where to act on this notice, and see everything about it, on KDK. */
export function kdkNoticeUrl(_n: Notice): string {
  return KDK_NOTICE_URL;
}

/** The stage's own class, so each stage has its own colour. */
const STAGE_KEY: Record<string, string> = {
  Received: "received", "Under review": "review", "Reply drafted": "drafted", Replied: "replied", Closed: "closed",
};

/** "GSTIN 27…", "TAN MUMS…", "PAN ABC…" for the registration a notice was issued on. */
export function regOf(n: Notice): { label: string; number: string } {
  if (n.regType === "GstEntity") return { label: "GSTIN", number: GST_ENTITY_BY_ID[n.regId]?.gstin ?? "" };
  if (n.regType === "TdsDeductor") return { label: "TAN", number: TDS_DEDUCTOR_BY_ID[n.regId]?.tan ?? "" };
  return { label: "PAN", number: CLIENT_BY_ID[n.regId]?.pan ?? "" };
}

function replyText(n: Notice): string {
  const d = daysToReply(n);
  return d < 0 ? `${-d} ${-d === 1 ? "day" : "days"} overdue` : d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `${d} days left`;
}

/** How long is left to reply, in words. Once replied it shows that instead. */
export function ReplyBy({ n }: { n: Notice }) {
  const u = urgencyOf(n);
  if (u === "done") {
    /* Done: say when, not just that. */
    const on = n.status === "Closed" ? n.closedOn : n.repliedOn;
    return (
      <span className="nt-by is-done">
        <b><Icon name="check" size={12} /> {n.status === "Closed" ? "Closed" : "Replied"}</b>
        {on ? <small>{fmtDate(on)}</small> : null}
      </span>
    );
  }
  const text = replyText(n);
  return (
    <span className={`nt-by is-${u}`}>
      <b>{fmtDate(n.replyDue)}</b>
      <small>{text}</small>
    </span>
  );
}

export function DeptTag({ dept }: { dept: Notice["dept"] }) {
  return <span className={`nt-dept nt-dept--${dept === "Income Tax" ? "it" : dept.toLowerCase()}`}>{dept}</span>;
}

/** A small status pill. Each stage has its own colour, so where a notice
 *  stands reads without reading the word. */
export function StagePill({ n }: { n: Notice }) {
  return <span className={`nt-stage nt-stage--${STAGE_KEY[n.status]}`}><i />{n.status}</span>;
}

/** The row's own hand-off to KDK, so a notice can be opened without opening
 *  the drawer first. The same button the run list uses for a filing. */
function OpenNotice({ n }: { n: Notice }) {
  return (
    <a
      href={kdkNoticeUrl(n)} target="_blank" rel="noopener noreferrer"
      className="btn btn--primary btn--sm"
      onClick={(e) => e.stopPropagation()}
    >
      Open notice <Icon name="external" size={13} />
    </a>
  );
}

/** Notices as table rows. `showClient` is off on a client's own tab. */
export function NoticeTable({
  list, showClient = true, onOpen, empty,
}: {
  list: Notice[];
  showClient?: boolean;
  onOpen: (n: Notice) => void;
  empty: ReactNode;
}) {
  if (list.length === 0) return <div className="nt-empty">{empty}</div>;
  return (
    <table className="ltable nt-table">
      <thead>
        <tr>
          <th>Notice</th>
          {showClient ? <th>Client</th> : <th>Registration</th>}
          <th>Department</th>
          <th>Reply by</th>
          <th>Stage</th>
          <th>Owner</th>
          <th className="u-right">Demand</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {list.map((n) => {
          const reg = regOf(n);
          return (
            <tr key={n.id} className="is-clickable" onClick={() => onOpen(n)}>
              <td>
                <div className="u-strong">{n.type}</div>
                <div className="u-mute num" style={{ fontSize: "var(--t-12)" }}>{n.section} · {n.period}</div>
              </td>
              <td>
                {showClient ? (
                  <>
                    <div className="u-truncate" style={{ maxWidth: 220 }}>{CLIENT_BY_ID[n.clientId]?.name}</div>
                    <div className="u-mute num" style={{ fontSize: "var(--t-12)" }}>{reg.label} {reg.number}</div>
                  </>
                ) : (
                  <span className="num">{reg.label} {reg.number}</span>
                )}
              </td>
              <td><DeptTag dept={n.dept} /></td>
              <td><ReplyBy n={n} /></td>
              <td>
                <StagePill n={n} />
                {/* A closed notice says how it ended, since that is what is
                    left to know about it. */}
                {n.status === "Closed" && n.outcome ? <div className="nt-outcome">{n.outcome}</div> : null}
              </td>
              <td>
                <span className="u-row">
                  <Avatar initials={staffOf(n.assigneeId).initials} />
                  <span className="u-truncate" style={{ maxWidth: 100 }}>{staffOf(n.assigneeId).name}</span>
                </span>
              </td>
              <td className="u-right num">{n.demand ? `₹${inr(n.demand)}` : <span className="u-faint">—</span>}</td>
              <td className="u-right"><OpenNotice n={n} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** What opens when a notice is clicked. */
export function NoticeDrawer({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  const { toast, me } = useApp();
  if (!notice) return null;
  const n = notice;
  const client = CLIENT_BY_ID[n.clientId];
  const reg = regOf(n);
  const step = NOTICE_STAGES.indexOf(n.status);
  const next = NOTICE_STAGES[step + 1];

  return (
    <Drawer
      open
      onClose={onClose}
      title={n.type}
      subtitle={
        <Link
          to={clientPath(n.regType, n.regId)}
          onClick={onClose}
          style={{ display: "inline-flex", alignItems: "center", gap: 2, textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          {client?.name} <Icon name="chevronRight" size={13} />
        </Link>
      }
      footer={
        <>
          {/* The reply itself is made on KDK, where the notice, its documents
              and the department's portal live. Named like "Open this filing" on
              a filing, since it is the same kind of hand-off. */}
          <a href={kdkNoticeUrl(n)} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
            <Icon name="external" size={15} /> Open this notice
          </a>
          {next ? (
            <button
              type="button" className="btn"
              onClick={() => { setNoticeStatus(n.id, next, me.name); toast(`Moved to ${next}`); }}
            >
              <Icon name="arrowRight" size={15} /> Move to {next}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => { setNoticeStatus(n.id, "Under review", me.name); toast("Notice reopened"); }}>
              Reopen
            </button>
          )}
          <span className="u-spacer" />
          <DeptTag dept={n.dept} />
        </>
      }
    >
      <div className="nt-reply">
        <span className="nt-reply__k">Reply by</span>
        <b>{fmtLong(n.replyDue)}</b>
        <span className={`nt-left is-${urgencyOf(n)}`}>{urgencyOf(n) === "done" ? (n.status === "Closed" ? "Closed" : "Replied") : replyText(n)}</span>
      </div>

      <div className="obsect">
        <div className="obsect__head">Stage</div>
        <ol className="nt-steps">
          {NOTICE_STAGES.map((s, i) => (
            <li key={s} className={`nt-stage--${STAGE_KEY[s]}`}>
              <button
                type="button"
                className={`nt-step${i < step ? " is-past" : ""}${i === step ? " is-now" : ""}`}
                onClick={() => { if (i !== step) { setNoticeStatus(n.id, s, me.name); toast(`Moved to ${s}`); } }}
                aria-current={i === step ? "step" : undefined}
              >
                <i className="nt-step__dot">{i < step ? <Icon name="check" size={10} /> : null}</i>
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {n.status === "Closed" ? (
        <div className="obsect">
          <div className="obsect__head">How it ended</div>
          <select
            className="plain"
            value={n.outcome ?? ""}
            onChange={(e) => { setNoticeOutcome(n.id, e.target.value as NoticeOutcome, me.name); toast("Outcome saved"); }}
            aria-label="Outcome"
          >
            <option value="" disabled>Choose the outcome…</option>
            {NOTICE_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ) : null}

      <div className="obsect">
        <div className="obsect__head">Details</div>
        <dl className="obfacts obfacts--two">
          <div><dt>Department</dt><dd>{n.dept}</dd></div>
          <div><dt>Section</dt><dd>{n.section}</dd></div>
          <div><dt>Reference</dt><dd className="num">{n.refNo}</dd></div>
          <div><dt>Period</dt><dd>{n.period}</dd></div>
          <div><dt>Issued on</dt><dd className="num">{reg.label} {reg.number}</dd></div>
          <div><dt>Received</dt><dd className="num">{fmtLong(n.receivedOn)}</dd></div>
          <div><dt>Demand</dt><dd className="num">{n.demand ? `₹${inr(n.demand)}` : "None"}</dd></div>
          <div><dt>Came from</dt><dd>{n.source}</dd></div>
          {n.repliedOn ? <div><dt>Replied on</dt><dd className="num">{fmtLong(n.repliedOn)}</dd></div> : null}
          {n.replyRef ? <div><dt>Reply reference</dt><dd className="num">{n.replyRef}</dd></div> : null}
          {n.closedOn ? <div><dt>Closed on</dt><dd className="num">{fmtLong(n.closedOn)}</dd></div> : null}
        </dl>
      </div>

      <div className="obsect">
        <div className="obsect__head">Owner</div>
        <OwnerSelect
          value={n.assigneeId}
          onChange={(id) => { assignNotice(n.id, id, me.name); toast(`Assigned to ${staffOf(id).name}`); }}
          ariaLabel="Owner"
        />
      </div>

      <div className="obsect">
        <div className="obsect__head">What has happened</div>
        <ol className="nt-hist">
          {[...n.history].reverse().map((e, i) => (
            <li key={i}>
              <span className="nt-hist__dot" />
              <span className="nt-hist__txt"><b>{e.text}</b><small>{e.by} · <span className="num">{fmtDate(e.on)}</span></small></span>
            </li>
          ))}
        </ol>
      </div>
    </Drawer>
  );
}
