/* ============================================================================
   REMINDERS
   ----------------------------------------------------------------------------
   Two tabs, both operational:

     Log         what went out, and did it land
     Scheduled   what is about to go out, and can I stop it

   Configuration is NOT here. An earlier version added an "Automation" tab
   holding the cadence ladder and the sending guards, which then duplicated the
   same guards already on Settings — two screens claiming to own one setting.
   All of it now lives on Settings → Reminders, and this page is only the queue
   and the record.
   ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp, useEngine, useOutbox } from "../ui/app-state.tsx";
import { CLIENT_BY_ID, staffOf } from "../domain/book.ts";
import { HEADS } from "../domain/catalog.ts";
import {
  NOW, getReminderSettings, releaseQueued, resendEntries, retryFailed, runScheduler,
  scheduledSends, sendScheduledNow, skipScheduled,
} from "../domain/engine.ts";
import {
  TODAY, addDays, dateOf, fmtAgo, fmtAgoIfFresh, fmtDate, fmtDateTime, fmtShort, fmtStampShort, fmtTime,
} from "../domain/dates.ts";
import { Avatar, Check, CountUp, Empty, PageHead, Seg, Stat } from "../ui/bits.tsx";
import { ClearFilters, DateRangePill, FilterPill, type PillOption } from "../ui/Filters.tsx";
import { exportXlsx } from "../ui/exportXlsx.ts";
import { BrandIcon, Icon } from "../ui/Icon.tsx";
import { MessagePreview } from "../ui/MessagePreview.tsx";
import type { OutboxEntry } from "../domain/types.ts";

/* Delivery state is not compliance state, so it gets its own four tones rather
   than borrowing filed/pending/overdue. Read and Delivered in particular must
   never share a colour — the whole question is whether anyone looked. */
const DELIVERY_TAG: Record<string, string> = {
  Read: "tag--read",
  Delivered: "tag--delivered",
  "Queued (quiet hours)": "tag--queued",
  /* Cancelled is not a failure — the client filed, so the chase was correctly
     dropped. Neutral grey, never the red that would have staff investigating a
     system working exactly as intended. */
  Cancelled: "tag--neutral",
  Failed: "tag--overdue",
};

/* ---------------------------------------------------------------------------
   DEEP LINKS
   ---------------------------------------------------------------------------
   Anything that links here can name the slice it means, so arriving from
   "18 reminders failed to send" lands on those 18 rather than on 408 rows the
   reader then has to filter by hand. Short URL tokens rather than the internal
   status strings — `?status=held` reads, `?status=Queued%20(quiet%20hours)`
   does not.
   ------------------------------------------------------------------------- */

const STATUS_PARAM: Record<string, string> = {
  failed: "Failed",
  held: "Queued (quiet hours)",
  read: "Read",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

type Tab = "log" | "scheduled";

export function RemindersPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "scheduled" ? "scheduled" : "log");
  const outbox = useOutbox();

  /* A link that changes the tab while this page is already open has to move
     it — mounting state alone only covers arriving from elsewhere. */
  useEffect(() => {
    const t = params.get("tab");
    if (t === "scheduled" || t === "log") setTab(t);
  }, [params]);
  const upcoming = useEngine(() => scheduledSends(45));

  const failed = outbox.filter((e) => e.status === "Failed").length;
  const live = upcoming.filter((s) => !s.skipped).length;

  return (
    <div className="page page--wide">
      <PageHead
        title="Reminders"
        icon="outbox"
        note={
          <>
            <b>{outbox.length.toLocaleString("en-IN")}</b> sent ·{" "}
            <b>{live}</b> queued
            {failed > 0 ? <> · <b>{failed}</b> failed</> : null}
          </>
        }
        aside={
          <Link to="/settings" className="btn btn--sm">
            <Icon name="settings" size={14} /> Reminder settings
          </Link>
        }
      />

      <div className="filters">
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "log", label: `Log (${outbox.length})` },
            { value: "scheduled", label: `Scheduled (${live})` },
          ]}
        />
      </div>

      {tab === "log" ? <LogTab /> : null}
      {tab === "scheduled" ? <ScheduledTab /> : null}
    </div>
  );
}

/* ============================================================================
   LOG  —  what actually went out
   ========================================================================== */

function LogTab() {
  const outbox = useOutbox();
  const { toast, me } = useApp();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<string>(() => params.get("channel") ?? "all");
  /* Head and form were two pills asking one question. They are now one value:
     `all`, `head:GST` (everything under a head) or `def:GSTR3B` (one form). */
  const [scope, setScope] = useState(() => params.get("scope") ?? "all");
  const [status, setStatus] = useState(
    () => STATUS_PARAM[params.get("status") ?? ""] ?? "all",
  );
  const [sender, setSender] = useState(() => params.get("sender") ?? "all");
  const [from, setFrom] = useState(() => params.get("from") ?? "");
  const [to, setTo] = useState(() => params.get("to") ?? "");

  /* Follow the URL when it changes under an already-open page. */
  useEffect(() => {
    const s = params.get("status");
    if (s && STATUS_PARAM[s]) setStatus(STATUS_PARAM[s]);
    const c = params.get("channel");
    if (c) setChannel(c);
    const sc = params.get("scope");
    if (sc) setScope(sc);
  }, [params]);
  const [peek, setPeek] = useState<OutboxEntry | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  /* Only the compliances that actually appear in the log, grouped under their
     head. A filter offering 31 forms when the log holds 14 is a list of dead
     ends, and a flat list of 14 forms hides which tax they belong to. */
  const scopeOptions = useMemo(() => {
    const byHead = new Map<string, Map<string, string>>();
    for (const e of outbox) {
      let forms = byHead.get(e.head);
      if (!forms) byHead.set(e.head, (forms = new Map()));
      forms.set(e.defCode, e.form);
    }
    const out: PillOption[] = [{ value: "all", label: "All compliances" }];
    for (const hd of HEADS) {
      const forms = byHead.get(hd);
      if (!forms) continue;
      out.push({ value: `head:${hd}`, label: `All of ${hd}`, group: hd });
      for (const [code, form] of [...forms].sort((a, b) => a[1].localeCompare(b[1]))) {
        out.push({ value: `def:${code}`, label: form, group: hd, indent: true });
      }
    }
    return out;
  }, [outbox]);

  /* Real people, with their faces. "A person" as a filter value cannot answer
     "what did Priya send last week", which is the actual question a partner
     asks about manual chases. */
  const senderOptions = useMemo(() => {
    const ids = new Set(outbox.map((e) => e.sentBy).filter(Boolean) as string[]);
    return [
      { value: "all", label: "Anyone" },
      { value: "auto", label: "Automatic", icon: <Icon name="bolt" size={14} /> },
      ...[...ids].map((id) => ({
        value: `s:${id}`,
        label: staffOf(id).name,
        avatar: staffOf(id).initials,
        sub: staffOf(id).role,
      })),
    ];
  }, [outbox]);

  const rows = useMemo(() => {
    let list = outbox;
    if (channel !== "all") list = list.filter((e) => e.channel === channel);
    if (scope.startsWith("head:")) {
      const hd = scope.slice(5);
      list = list.filter((e) => e.head === hd);
    } else if (scope.startsWith("def:")) {
      const code = scope.slice(4);
      list = list.filter((e) => e.defCode === code);
    }
    if (status !== "all") list = list.filter((e) => e.status === status);
    if (sender === "auto") list = list.filter((e) => e.origin === "Automatic");
    else if (sender.startsWith("s:")) {
      const id = sender.slice(2);
      list = list.filter((e) => e.sentBy === id);
    }
    if (from) list = list.filter((e) => dateOf(e.sentAt) >= from);
    if (to) list = list.filter((e) => dateOf(e.sentAt) <= to);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((e) => {
        const c = CLIENT_BY_ID[e.clientId];
        return (c && (c.name.toLowerCase().includes(needle) || c.pan.toLowerCase().includes(needle)))
          || e.form.toLowerCase().includes(needle);
      });
    }
    return list.slice(0, 250);
  }, [outbox, channel, scope, status, sender, from, to, q]);

  /* "Reached the client" counted Delivered and Read together and painted them
     one green, which is the one distinction that matters here: a message on
     the handset is not a message anyone has looked at. */
  const read = outbox.filter((e) => e.status === "Read").length;
  const delivered = outbox.filter((e) => e.status === "Delivered").length;
  const queued = outbox.filter((e) => e.status.startsWith("Queued")).length;
  const failed = outbox.filter((e) => e.status === "Failed").length;

  const filterCount = (channel !== "all" ? 1 : 0) + (scope !== "all" ? 1 : 0)
    + (status !== "all" ? 1 : 0) + (sender !== "all" ? 1 : 0) + (from || to ? 1 : 0);

  const clearAll = () => {
    setChannel("all"); setScope("all"); setStatus("all"); setSender("all");
    setFrom(""); setTo("");
  };

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id));

  const exportXlsxFile = async () => {
    const headers = ["Sent", "Time", "Client", "PAN", "Compliance", "Head",
      "Channel", "Trigger", "Origin", "Sent by", "Delivery", "Attempt", "Message"];
    const dataRows = rows.map((e) => {
      const c = CLIENT_BY_ID[e.clientId];
      return [
        fmtDate(dateOf(e.sentAt)), fmtTime(e.sentAt), c?.name ?? e.clientId, c?.pan ?? "",
        e.form, e.head, e.channel, e.stage, e.origin,
        e.sentBy ? staffOf(e.sentBy).name : "Scheduler", e.status, e.attempt, e.preview,
      ];
    });
    await exportXlsx({ filename: `reminders-${TODAY}.xlsx`, headers, rows: dataRows });
    toast(`Exported ${rows.length} reminders`);
  };

  return (
    <>
      <div className="stats" style={{ marginBottom: "var(--s4)" }}>
        <Stat label="Sent" value={<CountUp n={outbox.length} />} icon="send" sub="All time" />
        <Stat
          label="Read"
          value={<CountUp n={read} />}
          tone="filed"
          icon="tickDouble"
          sub={`${Math.round((read / Math.max(1, outbox.length)) * 100)}% of all sent`}
        />
        <Stat label="Delivered, unread" value={<CountUp n={delivered} />} tone="cool" icon="tick" sub="Not yet opened" />
        {/* Both cards are the way into their own slice — which is why the bulk
            repair for each lives under the filtered view rather than standing
            permanently above the unfiltered one. */}
        <Stat
          label="Held"
          value={<CountUp n={queued} />}
          tone={queued ? "soon" : undefined}
          icon="clock"
          onClick={queued ? () => setStatus("Queued (quiet hours)") : undefined}
          sub={queued ? "awaiting sending window" : "None"}
        />
        <Stat
          label="Failed"
          value={<CountUp n={failed} />}
          tone={failed ? "overdue" : undefined}
          icon="alert"
          onClick={failed ? () => setStatus("Failed") : undefined}
          sub={failed ? "Not delivered" : "All delivered"}
        />
      </div>

      {/* Five controls, not eight. Head and Compliance asked one question and
          are now one grouped pill; the four date presets became a real range;
          and the reminder-stage pill went entirely — it was engine vocabulary
          ("T-3 sent") offered as though it were a way anyone searches. */}
      <div className="filters">
        <div className="field field--search">
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, PAN or form"
            aria-label="Search the reminder log"
          />
          {q ? (
            <button type="button" className="field__x" onClick={() => setQ("")} aria-label="Clear search">
              <Icon name="close" size={13} />
            </button>
          ) : null}
        </div>
        <FilterPill<string>
          field="Compliance" value={scope} none="all" onChange={setScope}
          options={scopeOptions}
        />
        <FilterPill<string>
          field="Channel" value={channel} none="all" onChange={setChannel}
          options={[
            { value: "all", label: "All channels" },
            { value: "WhatsApp", label: "WhatsApp", icon: <BrandIcon name="whatsapp" size={15} /> },
            { value: "Email", label: "Email", icon: <BrandIcon name="email" size={15} /> },
          ]}
        />
        <FilterPill<string>
          field="Delivery" value={status} none="all" onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "Read", label: "Read" },
            { value: "Delivered", label: "Delivered, not read" },
            { value: "Queued (quiet hours)", label: "Held" },
            { value: "Cancelled", label: "Cancelled, already filed" },
            { value: "Failed", label: "Failed" },
          ]}
        />
        <FilterPill<string>
          field="Sent by" value={sender} none="all" onChange={setSender}
          options={senderOptions}
        />
        <DateRangePill
          from={from}
          to={to}
          onChange={(f, t) => { setFrom(f); setTo(t); }}
          presets={[
            { label: "Today", from: TODAY, to: TODAY },
            { label: "Last 7 days", from: addDays(TODAY, -6), to: TODAY },
            { label: "Last 30 days", from: addDays(TODAY, -29), to: TODAY },
            { label: "This month", from: `${TODAY.slice(0, 7)}-01`, to: TODAY },
          ]}
        />
        <ClearFilters count={filterCount} onClear={clearAll} />
        <span className="u-spacer" />
        <span className="u-mute num" style={{ fontSize: "var(--t-12)" }}>
          {rows.length} of {outbox.length}
        </span>
        <button type="button" className="btn btn--sm" onClick={exportXlsxFile}>
          <Icon name="download" size={14} /> Export
        </button>
      </div>

      {/* ---- Bulk actions, and only where they are the thing being looked at.
          A standing "Retry all 18 failed" button shouts a number at everyone
          who opens the log, including the nine people in ten who came to
          answer "did we tell them?". Failures are surfaced by the Failed card
          above, which filters to them; the bulk repair then appears here,
          against a screen already showing only what it would act on. That way
          the destructive-ish action is never one stray click from a full
          200-row view. */}
      {(picked.size > 0 || (status === "Failed" && rows.length > 0)
        || (status.startsWith("Queued") && rows.length > 0)) ? (
        <div className="actionbar">
          {picked.size > 0 ? (
            <>
              <span className="actionbar__n num">{picked.size} selected</span>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={() => {
                  const n = resendEntries([...picked], me.id);
                  setPicked(new Set());
                  toast(n > 0 ? `Re-sent ${n} ${n === 1 ? "message" : "messages"}` : "Those filings are already complete");
                }}
              >
                <Icon name="send" size={14} /> Re-send selected
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPicked(new Set())}>
                Clear
              </button>
            </>
          ) : status === "Failed" ? (
            <>
              <span className="actionbar__n">
                <b>{failed}</b> were not delivered
              </span>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  const n = retryFailed(me.id);
                  toast(n > 0 ? `Retrying ${n} ${n === 1 ? "message" : "messages"}` : "Those filings are already complete");
                }}
              >
                <Icon name="send" size={14} /> Retry all
              </button>
            </>
          ) : (
            <>
              <span className="actionbar__n">
                <b>{queued}</b> awaiting the sending window
              </span>
              <button
                type="button"
                className="btn btn--sm"
                /* Both numbers are reported. Saying only "released 40" when 6 of
                   them were dropped hides the more interesting half — that six
                   clients filed while the messages were held, so they were not
                   chased. */
                onClick={() => {
                  const { sent, cancelled } = releaseQueued();
                  const one = (n: number) => (n === 1 ? "message" : "messages");
                  toast(
                    cancelled > 0
                      ? `Sent ${sent} ${one(sent)} · cancelled ${cancelled} already filed`
                      : `Released ${sent} held ${one(sent)}`,
                  );
                }}
              >
                <Icon name="clock" size={14} /> Send now
              </button>
            </>
          )}
          <span className="u-spacer" />
          <span className="u-faint" style={{ fontSize: "var(--t-12)" }}>
            Re-sent messages are recorded as repeat attempts.
          </span>
        </div>
      ) : null}

      <div className="sheet">
        {rows.length === 0 ? (
          <Empty title="Nothing matches">
            Try clearing a filter or widening the date range.
          </Empty>
        ) : (
          <table className="ltable">
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  <button
                    type="button"
                    className="rowcheck"
                    aria-label={allPicked ? "Clear selection" : "Select all shown"}
                    onClick={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)))}
                  >
                    <Check on={allPicked} />
                  </button>
                </th>
                <th>Sent</th>
                <th>Client</th>
                <th>Compliance</th>
                <th>Channel</th>
                <th>Trigger</th>
                <th>By</th>
                <th>Delivery</th>
                <th style={{ width: 44 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const c = CLIENT_BY_ID[e.clientId];
                const on = picked.has(e.id);
                return (
                  <tr
                    key={e.id}
                    className={`is-clickable${on ? " is-selected" : ""}`}
                    onClick={() => setPeek(e)}
                  >
                    <td className="tight" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        type="button"
                        className="rowcheck"
                        aria-label={`Select message to ${c?.name ?? e.clientId}`}
                        onClick={() => toggle(e.id)}
                      >
                        <Check on={on} />
                      </button>
                    </td>
                    {/* Date AND time. A log that only carries the date cannot
                        separate two chases on the same day, and cannot answer
                        whether the client still had working hours to act. */}
                    <td className="u-nowrap">
                      <div className="num">{fmtStampShort(e.sentAt)}</div>
                      {fmtAgoIfFresh(e.sentAt) ? (
                        <div className="u-faint" style={{ fontSize: "var(--t-11)" }}>{fmtAgoIfFresh(e.sentAt)}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="u-strong u-truncate" style={{ maxWidth: 190 }}>
                        {c?.name ?? e.clientId}
                      </div>
                      {e.attempt > 1 ? (
                        <span className="u-faint num" style={{ fontSize: "var(--t-11)" }}>
                          attempt {e.attempt}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <div className="u-truncate" style={{ maxWidth: 180 }}>{e.form}</div>
                      <div className="u-faint" style={{ fontSize: "var(--t-11)" }}>{e.head}</div>
                    </td>
                    <td>
                      <span className="u-row">
                        <BrandIcon name={e.channel === "WhatsApp" ? "whatsapp" : "email"} size={15} />
                        {e.channel}
                      </span>
                    </td>
                    <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{e.stage}</td>
                    <td>
                      {e.origin === "Automatic" ? (
                        <span className="tag tag--outline" title="Sent automatically">
                          <Icon name="bolt" size={11} /> Auto
                        </span>
                      ) : (
                        <span className="u-row" title={staffOf(e.sentBy ?? "none").name}>
                          <Avatar initials={staffOf(e.sentBy ?? "none").initials} />
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`tag ${DELIVERY_TAG[e.status] ?? "tag--neutral"}`}>
                        <i className="tag__dot" />{e.status.startsWith("Queued") ? "Held" : e.status}
                      </span>
                    </td>
                    {/* The action cell centres its own button rather than
                        inheriting the row's left alignment, which left the
                        glyph floating against the previous column's edge. */}
                    <td className="cell-act" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        type="button"
                        className="rowact"
                        title={e.status === "Failed" ? "Retry this message" : "Send this again"}
                        aria-label={e.status === "Failed" ? "Retry this message" : "Send this again"}
                        onClick={() => {
                          const n = resendEntries([e.id], me.id);
                          toast(n > 0
                            ? `Re-sent to ${c?.name ?? "client"}`
                            : "That filing is already complete");
                        }}
                      >
                        <Icon name="send" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="sheet__foot">
          Updated {fmtDateTime(NOW)}.
        </div>
      </div>

      <MessagePreview entry={peek} onClose={() => setPeek(null)} />
    </>
  );
}

/* ============================================================================
   SCHEDULED  —  what is about to go out
   ----------------------------------------------------------------------------
   Aggregated per filing run × step, never per client. "GSTR-1 July, follow-up,
   240 clients" is one row a person can act on; 240 rows is a screen nobody can
   read and, at 10,000 clients, one nothing can render.
   ========================================================================== */

function ScheduledTab() {
  const { toast, me } = useApp();
  const sends = useEngine(() => scheduledSends(45));
  const settings = useEngine(getReminderSettings);
  const [head, setHead] = useState("all");

  const rows = useMemo(
    () => (head === "all" ? sends : sends.filter((s) => s.head === head)),
    [sends, head],
  );

  const live = sends.filter((s) => !s.skipped);
  const messages = live.reduce(
    (a, s) => a + s.clientCount * s.step.channels.length, 0,
  );
  const next = live[0];

  return (
    <>
      <div className="stats" style={{ marginBottom: "var(--s4)" }}>
        <Stat
          label="Batches queued"
          value={<CountUp n={live.length} />}
          icon="clock"
          tone="cool"
          sub="next 45 days"
        />
        <Stat
          label="Messages"
          value={<CountUp n={messages} />}
          icon="send"
          sub="To be sent"
        />
        <Stat
          label="Next batch"
          value={next ? fmtTime(next.fireAt) : "—"}
          icon="bolt"
          sub={next ? `${fmtShort(dateOf(next.fireAt))} · ${next.form}` : "nothing queued"}
        />
        <Stat
          label="Automatic sending"
          value={settings.autoSend ? "On" : "Paused"}
          tone={settings.autoSend ? "filed" : "overdue"}
          icon={settings.autoSend ? "check" : "ban"}
          sub={settings.autoSend ? "Enabled" : "No reminders will be sent"}
        />
      </div>

      {!settings.autoSend ? (
        <div className="note note--warn" style={{ marginBottom: "var(--s4)" }}>
          <Icon name="alert" size={15} />
          <span>
            Automatic sending is <b>off</b>. Reminders below will not be sent until it is
            re-enabled in <Link to="/settings">Settings</Link>.
          </span>
        </div>
      ) : null}

      <div className="filters">
        <FilterPill<string>
          field="Head" value={head} none="all" onChange={setHead}
          options={[{ value: "all", label: "All heads" }, ...HEADS.map((hd) => ({ value: hd, label: hd }))]}
        />
        <ClearFilters count={head !== "all" ? 1 : 0} onClear={() => setHead("all")} />
        <span className="u-spacer" />
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            const n = runScheduler();
            toast(n > 0
              ? `Sent ${n} ${n === 1 ? "message" : "messages"}`
              : "No reminders are due");
          }}
        >
          <Icon name="bolt" size={14} /> Send anything due
        </button>
      </div>

      <div className="sheet">
        {rows.length === 0 ? (
          <Empty title="Nothing queued">
            No reminders scheduled in the next 45 days. Check the reminder steps in Settings.
          </Empty>
        ) : (
          <table className="ltable">
            <thead>
              <tr>
                <th>Fires</th>
                <th>Step</th>
                <th>Compliance</th>
                <th>Due</th>
                <th className="u-right">Clients</th>
                <th>Channels</th>
                <th style={{ width: 150 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.key}
                  className={s.skipped ? "is-skipped" : undefined}
                  title={s.step.channels.includes("WhatsApp")
                    ? `${s.whatsappCount.toLocaleString("en-IN")} of ${s.clientCount.toLocaleString("en-IN")} clients accept WhatsApp; the rest get email only`
                    : undefined}
                >
                  <td className="u-nowrap">
                    <div className="num u-strong">{fmtStampShort(s.fireAt)}</div>
                    <div className="u-faint" style={{ fontSize: "var(--t-11)" }}>{fmtAgo(s.fireAt)}</div>
                  </td>
                  <td>
                    <div className="u-strong">{s.step.label}</div>
                    <div className="u-faint num" style={{ fontSize: "var(--t-11)" }}>
                      {s.step.offset === 0 ? "on the day"
                        : s.step.offset < 0 ? `${-s.step.offset}d before`
                        : `${s.step.offset}d after`}
                    </div>
                  </td>
                  <td>
                    <div className="u-truncate u-strong" style={{ maxWidth: 210 }}>{s.form}</div>
                    <div className="u-faint" style={{ fontSize: "var(--t-11)" }}>
                      {s.periodLabel} · {s.head}
                    </div>
                  </td>
                  <td className="num u-nowrap u-mute">{fmtShort(s.dueDate)}</td>
                  <td className="u-right num u-strong">{s.clientCount.toLocaleString("en-IN")}</td>
                  {/* Marks only. The WhatsApp figure that used to sit beside the
                      glyph was the count of clients who had opted in — a second,
                      smaller number in a row that already has a Clients column,
                      and it read as though the batch were split into two sizes.
                      It survives as the tooltip, where it answers the question
                      only when the question is actually asked. */}
                  <td>
                    <span className="u-row" style={{ gap: 6 }}>
                      {s.step.channels.map((ch) => (
                        <BrandIcon
                          key={ch}
                          name={ch === "WhatsApp" ? "whatsapp" : "email"}
                          size={16}
                        />
                      ))}
                      <span className="u-visually-hidden">
                        {s.step.channels.join(" and ")}
                      </span>
                    </span>
                  </td>
                  <td className="tight">
                    <span className="u-row" style={{ justifyContent: "flex-end", gap: 4 }}>
                      {s.skipped ? (
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => { skipScheduled(s.key, false); toast("Batch restored to the queue"); }}
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn--sm"
                            title="Send now instead of waiting"
                            onClick={() => {
                              const n = sendScheduledNow(s.key, me.id);
                              toast(n > 0
                                ? `Sent ${n} ${n === 1 ? "message" : "messages"} for ${s.form}`
                                : "All clients have already filed");
                            }}
                          >
                            <Icon name="send" size={13} /> Send now
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--icon btn--ghost"
                            title="Skip this batch"
                            aria-label={`Skip ${s.step.label} for ${s.form}`}
                            onClick={() => { skipScheduled(s.key, true); toast(`Skipped ${s.step.label} for ${s.form}`); }}
                          >
                            <Icon name="ban" size={14} />
                          </button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="sheet__foot">
          Counts update as clients file. Clients who file before a batch is sent are excluded from it.
        </div>
      </div>
    </>
  );
}
