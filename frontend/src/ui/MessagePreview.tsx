/* ============================================================================
   MESSAGE PREVIEW
   ----------------------------------------------------------------------------
   "Did we tell them, and what exactly did we say?" is the first question asked
   when a client is hit with a late fee, and a truncated cell in a log table
   does not answer it. This shows the message as the client received it: a
   WhatsApp bubble in a phone-ish frame, or an email with its real headers.

   The rendering is channel-accurate on purpose. Staff recognise a WhatsApp
   thread instantly and can tell at a glance whether the wording was right.
   ========================================================================== */

import type { OutboxEntry } from "../domain/types.ts";
import { staffOf } from "../domain/book.ts";
import { dateOf, fmtAgoIfFresh, fmtLong, fmtTime } from "../domain/dates.ts";
import { ownerOf, resendEntries } from "../domain/engine.ts";
import { getSender } from "../domain/messages.ts";
import { useApp, useEngine } from "./app-state.tsx";
import { Drawer } from "./Drawer.tsx";
import { BrandIcon, Icon } from "./Icon.tsx";
import { Logo } from "./Logo.tsx";
import { initialsOf } from "./bits.tsx";

/**
 * WhatsApp's own receipt grammar, which every client already reads fluently:
 * one grey tick means it reached the server, two grey ticks mean it reached
 * the handset, and two blue ticks mean it was opened. A single "check" glyph
 * for all three — which is what this used to draw — threw away the only part
 * anyone looks at.
 */
function Receipt({ status }: { status: OutboxEntry["status"] }) {
  if (status === "Failed") {
    return <Icon name="alert" size={12} className="wabubble__failed" />;
  }
  if (status.startsWith("Queued")) {
    return <Icon name="clock" size={12} className="wabubble__tick" />;
  }
  /* Never left the building, so it must not carry delivery ticks — falling
     through to the double tick claimed a message had reached a client who was
     deliberately never sent it. */
  if (status === "Cancelled") {
    return <Icon name="ban" size={12} className="wabubble__tick" />;
  }
  return (
    <Icon
      name="tickDouble"
      size={14}
      className={status === "Read" ? "wabubble__read" : "wabubble__tick"}
    />
  );
}

export function MessagePreview({
  entry, onClose,
}: { entry: OutboxEntry | null; onClose: () => void }) {
  const { toast, me } = useApp();
  /* Read live rather than imported as a constant — Settings edits the sender's
     display name, number and addresses, and this panel is where a partner
     checks what that actually looks like to a client. */
  const sender = useEngine(getSender);
  if (!entry) return null;
  const e = entry;
  const client = ownerOf(e);
  const owner = staffOf(client?.assigneeId ?? "none");
  /* The real send time, off the entry. This used to be a hash of the row id
     dressed up as a clock, because the log only carried a date — so the same
     message showed a different "time" than the row it came from, and two
     chases on one day were indistinguishable. */
  const time = fmtTime(e.sentAt);
  const ago = fmtAgoIfFresh(e.sentAt);
  const isWa = e.channel === "WhatsApp";

  const statusTag = e.status === "Failed" ? "tag--overdue"
    : e.status.startsWith("Queued") ? "tag--pending"
    : "tag--filed";

  return (
    <Drawer
      open
      onClose={onClose}
      title={<>{isWa ? "WhatsApp" : "Email"} to {client?.name ?? e.clientId}</>}
      subtitle={
        <>
          {e.stage} · {fmtLong(dateOf(e.sentAt))} at {time}{ago ? <> · {ago}</> : null}
          {e.attempt > 1 ? <> · attempt {e.attempt}</> : null}
        </>
      }
      footer={
        <>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            <Icon name="check" size={15} /> Close
          </button>
          {/* Live, not decorative. This was a dead button — the one action the
              panel most obviously needed, wired to nothing. */}
          <button
            type="button"
            className={e.status === "Failed" ? "btn btn--danger" : "btn"}
            onClick={() => {
              const n = resendEntries([e.id], me.id);
              toast(n > 0
                ? `${e.status === "Failed" ? "Retrying" : "Re-sent"} to ${client?.name ?? "client"}`
                : "That filing has since closed. Nothing sent.");
              onClose();
            }}
          >
            <Icon name="send" size={15} /> {e.status === "Failed" ? "Retry send" : "Send again"}
          </button>
          <span className="u-spacer" />
          <span className={`tag ${statusTag}`}><i className="tag__dot" />{e.status}</span>
        </>
      }
    >
      {isWa ? (
        <div className="wapane">
          {/* A chat header names the person you are TALKING TO. This showed
              our own account instead, which is not a screen that exists in
              WhatsApp — so the thread read as a mock-up rather than a record.
              The bar is the client now, with their avatar and number, exactly
              as it appears on the CA Connect handset. Who is sending is stated
              once, above the phone, where it belongs. */}
          <div className="wasend">
            <span className="wasend__mark"><Logo size={18} id="wasend" /></span>
            <span>
              Sending as <b>{sender.name}</b>
              <span className="wasend__badge" title="WhatsApp Business, verified">
                <Icon name="check" size={8} />
              </span>
              {" "}· {sender.handle} · on behalf of {owner.name === "Unassigned" ? sender.by : owner.name}
            </span>
          </div>

          {/* The chat header carries what WhatsApp's does — back, the contact's
              avatar and name, and the call/video/menu actions. Without the
              action icons the bar read as a caption above a quotation rather
              than as the top of a conversation. */}
          <div className="wapane__bar">
            <Icon name="chevronLeft" size={18} className="wapane__back" />
            <span className="waav">{initialsOf(client?.name ?? "??")}</span>
            <div className="wapane__who">
              <b>{client?.name ?? e.clientId}</b>
              <span className="num">{client?.phone ?? ""}</span>
            </div>
            <span className="u-spacer" />
            <span className="wapane__acts">
              <Icon name="video" size={17} />
              <Icon name="phone" size={16} />
              <Icon name="dots" size={17} />
            </span>
          </div>

          <div className="wapane__thread">
            {/* Every real WhatsApp thread opens with this. It is the single
                most recognisable thing on the screen. */}
            <div className="wae2e">
              <Icon name="lock" size={9} />
              Messages are end-to-end encrypted. Only people in this chat can read them.
            </div>
            <div className="wadate">{fmtLong(dateOf(e.sentAt))}</div>
            <div className="wabubble">
              {e.body.split("\n").map((ln, i) =>
                ln ? <p key={i}>{ln}</p> : <span key={i} className="wabubble__gap" />)}
              <span className="wabubble__meta">
                <span className="num">{time}</span>
                <Receipt status={e.status} />
              </span>
            </div>
            <div className="wapane__note">
              {e.status === "Read"
                ? "Read by the client"
                : e.status === "Delivered"
                  ? "Delivered to the handset, not opened yet"
                  : e.status === "Failed"
                    ? "Never delivered. The number may be wrong or WhatsApp is not registered on it."
                    : e.status === "Cancelled"
                      ? "Not sent. The return was filed while this was held for the sending window."
                      : "Held until the sending window opens"}
            </div>
          </div>

          {/* Inert, and deliberately so — this is a record of a sent message,
              not a place to type. But a thread that simply stops where the
              last bubble ends does not look like a phone. */}
          <div className="wacompose" aria-hidden="true">
            <Icon name="smile" size={18} />
            <span className="wacompose__box">Message</span>
            <Icon name="attach" size={18} />
            <Icon name="camera" size={18} />
            <span className="wacompose__mic"><Icon name="mic" size={16} /></span>
          </div>
        </div>
      ) : (
        <div className="mailpane">
          <div className="mailpane__head">
            <BrandIcon name="email" size={18} />
            <span className="mailpane__subject">{e.subject}</span>
          </div>
          <dl className="mailpane__meta">
            <div><dt>From</dt><dd>{sender.name} &lt;{sender.fromEmail}&gt;</dd></div>
            <div><dt>To</dt><dd>{client?.email ?? ""}</dd></div>
            {/* Only the escalation and final-notice steps cc the engagement
                owner — every earlier step in the ladder, and every manual
                chase, goes to the client alone. */}
            <div><dt>Cc</dt><dd>{e.kind === "p7" || e.kind === "p30"
              ? (owner.name === "Unassigned" ? "no owner assigned" : owner.name)
              : "—"}</dd></div>
            <div><dt>Sent</dt><dd className="num">{fmtLong(dateOf(e.sentAt))} · {time}</dd></div>
          </dl>
          <div className="mailpane__body">
            {e.body.split("\n").map((ln, i) => (ln ? <p key={i}>{ln}</p> : null))}
          </div>
        </div>
      )}

      <div className="obsect">
        <div className="obsect__head">Delivery</div>
        <dl className="obfacts obfacts--two">
          <div><dt>Channel</dt><dd>{e.channel}</dd></div>
          <div><dt>Trigger</dt><dd>{e.stage}</dd></div>
          <div><dt>Compliance</dt><dd>{e.form}</dd></div>
          <div><dt>Owner</dt><dd>{owner.name}</dd></div>
          {/* "The system chased them" and "Priya chased them" are different
              answers to the same client question, so the log records which. */}
          <div>
            <dt>Sent by</dt>
            <dd>{e.origin === "Automatic" ? "The cadence, unattended" : staffOf(e.sentBy ?? "none").name}</dd>
          </div>
          <div><dt>Attempt</dt><dd className="num">{e.attempt}</dd></div>
        </dl>
      </div>
    </Drawer>
  );
}
