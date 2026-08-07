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
import { CLIENT_BY_ID, staffOf } from "../domain/book.ts";
import { fmtLong } from "../domain/dates.ts";
import { SENDER } from "../domain/messages.ts";
import { Drawer } from "./Drawer.tsx";
import { BrandIcon, Icon } from "./Icon.tsx";
import { Logo } from "./Logo.tsx";
import { initialsOf } from "./bits.tsx";

/** A plausible send time; the seed only carries a date. */
function clockFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hour = 9 + (h % 10);
  const min = h % 60;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

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
  if (!entry) return null;
  const e = entry;
  const client = CLIENT_BY_ID[e.clientId];
  const owner = staffOf(client?.assigneeId ?? "none");
  const time = clockFor(e.id);
  const isWa = e.channel === "WhatsApp";

  const statusTag = e.status === "Failed" ? "tag--overdue"
    : e.status.startsWith("Queued") ? "tag--pending"
    : "tag--filed";

  return (
    <Drawer
      open
      onClose={onClose}
      title={<>{isWa ? "WhatsApp" : "Email"} to {client?.name ?? e.clientId}</>}
      subtitle={<>{e.stage} · sent {fmtLong(e.sentAt)} at {time}</>}
      footer={
        <>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            <Icon name="check" size={15} /> Close
          </button>
          {e.status === "Failed" ? (
            <button type="button" className="btn">
              <Icon name="send" size={15} /> Retry send
            </button>
          ) : null}
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
              Sending as <b>{SENDER.name}</b>
              <span className="wasend__badge" title="WhatsApp Business, verified">
                <Icon name="check" size={8} />
              </span>
              {" "}· {SENDER.handle} · on behalf of {owner.name === "Unassigned" ? SENDER.by : owner.name}
            </span>
          </div>

          <div className="wapane__bar">
            <Icon name="chevronLeft" size={16} className="wapane__back" />
            <span className="waav">{initialsOf(client?.name ?? "??")}</span>
            <div className="wapane__who">
              <b>{client?.name ?? e.clientId}</b>
              <span className="num">{client?.phone ?? ""}</span>
            </div>
            <span className="u-spacer" />
            <BrandIcon name="whatsapp" size={16} />
          </div>
          <div className="wapane__thread">
            <div className="wadate">{fmtLong(e.sentAt)}</div>
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
                    : "Held until quiet hours end at 09:00"}
            </div>
          </div>
        </div>
      ) : (
        <div className="mailpane">
          <div className="mailpane__head">
            <BrandIcon name="email" size={18} />
            <span className="mailpane__subject">{e.subject}</span>
          </div>
          <dl className="mailpane__meta">
            <div><dt>From</dt><dd>{SENDER.name} &lt;compliance@kdksoftware.com&gt;</dd></div>
            <div><dt>To</dt><dd>{client?.email ?? ""}</dd></div>
            <div><dt>Cc</dt><dd>{owner.name === "Unassigned" ? "no owner assigned" : `${owner.name}, KDK`}</dd></div>
            <div><dt>Sent</dt><dd className="num">{fmtLong(e.sentAt)} · {time}</dd></div>
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
          <div><dt>Owner</dt><dd>{owner.name}</dd></div>
        </dl>
      </div>
    </Drawer>
  );
}
