/* ============================================================================
   REMINDERS
   ----------------------------------------------------------------------------
   One thing: the log of what actually went out. It matters more than it looks —
   "did we tell them?" is the first question asked when a client is hit with a
   late fee, and this is the only screen that can answer it.

   A "Cadence" tab used to sit beside it, holding a five-row table of the
   trigger schedule and two toggles. The table was a spec sheet, not a tool:
   nothing on it could be changed, and its one operative fact (a trigger stops
   itself once the compliance is filed) was already in its own Stop condition
   column. The two toggles were real configuration, so they moved to Settings
   with the rest of the engine's behaviour.
   ========================================================================== */

import { useMemo, useState } from "react";
import { useOutbox } from "../ui/app-state.tsx";
import { CLIENT_BY_ID } from "../domain/book.ts";
import { TODAY, addDays, fmtDate } from "../domain/dates.ts";
import { CountUp, Empty, PageHead, Stat } from "../ui/bits.tsx";
import { BrandIcon, Icon } from "../ui/Icon.tsx";

/* Delivery state is not compliance state, so it gets its own four tones rather
   than borrowing filed/pending/overdue. Read and Delivered in particular must
   never share a colour — the whole question is whether anyone looked. */
const DELIVERY_TAG: Record<string, string> = {
  Read: "tag--read",
  Delivered: "tag--delivered",
  "Queued (quiet hours)": "tag--queued",
  Failed: "tag--overdue",
};
import { MessagePreview } from "../ui/MessagePreview.tsx";
import type { OutboxEntry } from "../domain/types.ts";

export function RemindersPage() {
  const outbox = useOutbox();
  const [channel, setChannel] = useState("all");
  const [when, setWhen] = useState<"all" | "today" | "7" | "30">("all");
  const [q, setQ] = useState("");
  const [peek, setPeek] = useState<OutboxEntry | null>(null);

  const rows = useMemo(() => {
    let list = outbox;
    if (channel !== "all") list = list.filter((e) => e.channel === channel);
    if (when !== "all") {
      const from = when === "today" ? TODAY : addDays(TODAY, when === "7" ? -6 : -29);
      list = list.filter((e) => e.sentAt >= from);
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((e) => {
        const c = CLIENT_BY_ID[e.clientId];
        return c && (c.name.toLowerCase().includes(needle) || c.pan.toLowerCase().includes(needle));
      });
    }
    return list.slice(0, 200);
  }, [outbox, channel, when, q]);

  /* "Reached the client" counted Delivered and Read together and painted them
     one green, which is the one distinction that matters here: a message on
     the handset is not a message anyone has looked at. They are separate
     figures now, and separate colours everywhere they appear. */
  const read = outbox.filter((e) => e.status === "Read").length;
  const delivered = outbox.filter((e) => e.status === "Delivered").length;
  const queued = outbox.filter((e) => e.status.startsWith("Queued")).length;
  const failed = outbox.filter((e) => e.status === "Failed").length;

  return (
    <div className="page page--wide">
      <PageHead
        title="Reminders"
        icon="outbox"
        note={
          <>
            <b>{outbox.length.toLocaleString("en-IN")}</b> sent
            {queued > 0 ? <> · <b>{queued}</b> held for quiet hours</> : null}
            {failed > 0 ? <> · <b>{failed}</b> failed</> : null}
          </>
        }
      />

      {/* Three numbers, not six. "Auto-cancelled", "Held in quiet hours" and
          "Scheduled" are all things the system handles by itself; putting them
          on the page as counters implied they needed watching. What a person
          actually needs to know is: did it go, did it land, and did anything
          fail. */}
      <div className="stats" style={{ marginBottom: "var(--s4)" }}>
        <Stat label="Sent" value={<CountUp n={outbox.length} />} icon="send" sub="messages in the log" />
        <Stat
          label="Read"
          value={<CountUp n={read} />}
          tone="filed"
          icon="tickDouble"
          sub={`${Math.round((read / Math.max(1, outbox.length)) * 100)}% of everything sent`}
        />
        <Stat
          label="Delivered, unread"
          value={<CountUp n={delivered} />}
          tone="cool"
          icon="tick"
          sub="on the handset, not opened"
        />
        <Stat
          label="Failed"
          value={<CountUp n={failed} />}
          tone={failed ? "overdue" : undefined}
          icon="alert"
          sub={failed ? "the client was never told" : "everything got through"}
        />
      </div>

      <div className="filters">
        <div className="field" style={{ width: 260 }}>
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client" />
        </div>
        <div className="seg">
          {["all", "WhatsApp", "Email"].map((c) => (
            <button key={c} type="button" className={channel === c ? "is-on" : ""} onClick={() => setChannel(c)}>
              <span className="u-row" style={{ gap: 5 }}>
                {c === "WhatsApp" ? <BrandIcon name="whatsapp" size={13} /> : null}
                {c === "Email" ? <BrandIcon name="email" size={13} /> : null}
                {c === "all" ? "All channels" : c}
              </span>
            </button>
          ))}
        </div>
        <select
          className="plain"
          value={when}
          onChange={(e) => setWhen(e.target.value as typeof when)}
          aria-label="Sent when"
        >
          <option value="all">Any date</option>
          <option value="today">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <span className="u-spacer" />
        <span className="u-mute num" style={{ fontSize: "var(--t-12)" }}>
          showing {rows.length} of {outbox.length}
        </span>
      </div>

      <div className="sheet">
        {rows.length === 0 ? (
          <Empty title="Nothing sent yet">
            Reminders appear here as triggers fire. You can also send one manually from any
            obligation or filing run.
          </Empty>
        ) : (
          <table className="ltable">
            <thead>
              <tr>
                <th>Sent</th>
                <th>Client</th>
                <th>Channel</th>
                <th>Stage</th>
                <th>Message</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const c = CLIENT_BY_ID[e.clientId];
                return (
                  <tr key={e.id} className="is-clickable" onClick={() => setPeek(e)}>
                    <td className="num u-nowrap u-mute">{fmtDate(e.sentAt)}</td>
                    <td>
                      <div className="u-strong u-truncate" style={{ maxWidth: 200 }}>
                        {c?.name ?? e.clientId}
                      </div>
                    </td>
                    <td>
                      <span className="u-row">
                        <BrandIcon name={e.channel === "WhatsApp" ? "whatsapp" : "email"} size={15} />
                        {e.channel}
                      </span>
                    </td>
                    <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{e.stage}</td>
                    <td className="u-truncate" style={{ maxWidth: 420, fontSize: "var(--t-12)" }}>{e.preview}</td>
                    <td>
                      <span className={`tag ${DELIVERY_TAG[e.status] ?? "tag--neutral"}`}>
                        <i className="tag__dot" />{e.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="sheet__foot">
          Log as at {fmtDate(TODAY)}. Delivery receipts are the record of what the client was
          told and when — kept against the obligation, not just the client.
        </div>
      </div>

      <MessagePreview entry={peek} onClose={() => setPeek(null)} />
    </div>
  );
}
