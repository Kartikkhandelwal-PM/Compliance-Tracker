/* ============================================================================
   TEMPLATES — exactly what the client receives
   ----------------------------------------------------------------------------
   The one question this answers: "what will the client actually get?" So
   there are no placeholders, settings or workflow details here. Pick WhatsApp
   or Email, pick a point in the sequence (7 days before, due date, late...)
   and a compliance, and the message is shown as the client reads it: a
   WhatsApp chat or an email, with that compliance's real form name, period
   and due date filled in.

   The wording comes from the reminder copy deck (domain/templates.ts); the
   compliances come from the live catalogue, so every compliance a client can
   be reminded about is covered.
   ========================================================================== */

import { useMemo, useState } from "react";
import type { Channel } from "../domain/types.ts";
import { DEFS, OCCURRENCES } from "../domain/catalog.ts";
import { TODAY, fmtLong } from "../domain/dates.ts";
import { Link } from "react-router-dom";
import { complianceSetting, getTemplateApprovals, submitTemplates } from "../domain/engine.ts";
import { emailFrom, getSender } from "../domain/messages.ts";
import { TEMPLATES } from "../domain/templates.ts";
import type { Template } from "../domain/templates.ts";
import { useApp, useEngine } from "../ui/app-state.tsx";
import { BrandIcon, Icon } from "../ui/Icon.tsx";
import { Seg } from "../ui/bits.tsx";

const CLIENT = "Sharma Traders Pvt Ltd";

interface Option {
  code: string;
  form: string;
  head: string;
  period: string;
  due: string;
}

/** Whether the firm currently sends reminders for this compliance. Read live
 *  from Settings, since the catalogue's default is only the starting point. */
function remindersOn(code: string): boolean {
  const c = complianceSetting(code);
  return c.tracked && c.clientFacing;
}

/** One example per compliance: its next real occurrence, so the period and
 *  due date are ones that exist. Every compliance is listed, including the
 *  ones whose reminders are switched off, since the wording is the same and
 *  turning them on is a Settings change. */
function buildOptions(): Option[] {
  const out: Option[] = [];
  for (const d of DEFS) {
    const occ = OCCURRENCES.filter((o) => o.defCode === d.code).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const o = occ.find((x) => x.dueDate >= TODAY) ?? occ[occ.length - 1];
    if (!o) continue;
    out.push({ code: d.code, form: d.form, head: d.head, period: o.periodLabel, due: fmtLong(o.dueDate) });
  }
  return out;
}

function fill(text: string, v: Record<string, string>) {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (_, k) => v[k] ?? "");
}

/** Highlights each {{placeholder}}, so what changes per client stands out. */
function withTokens(line: string) {
  return line.split(/(\{\{[a-z_]+\}\})/g).map((part, i) =>
    /^\{\{[a-z_]+\}\}$/.test(part) ? <mark key={i} className="tpl-tok">{part}</mark> : part,
  );
}

const VARIABLE_LABELS: Record<string, string> = {
  client_name: "Client name", firm_name: "Your firm", form: "Compliance", period: "Period",
  due_date: "Due date", days_overdue: "Days overdue", ack_no: "Reference number",
};

export function TemplatesTab() {
  const { toast } = useApp();
  const sender = useEngine(getSender);
  const approvals = useEngine(getTemplateApprovals);
  const options = useMemo(buildOptions, []);
  const heads = useMemo(() => [...new Set(options.map((o) => o.head))], [options]);

  const [channel, setChannel] = useState<Channel>("WhatsApp");
  const list = TEMPLATES.filter((t) => t.channel === channel);
  const [stage, setStage] = useState<string>(list[0].stage);
  const [code, setCode] = useState(options.find((o) => o.form.includes("GSTR-3B"))?.code ?? options[0].code);

  const sel: Template = list.find((t) => t.stage === stage) ?? list[0];
  const opt = options.find((o) => o.code === code) ?? options[0];
  const isWa = channel === "WhatsApp";

  /* Who the client actually hears from. A firm's own number or domain is used
     only once it is ready (number connected, domain verified); until then
     everything goes through CA Connect, so that is what is shown. */
  const waOwn = sender.waProvider === "rampwin";
  const waReady = waOwn && sender.rampwin.connected;
  const waName = waReady ? sender.rampwin.displayName : sender.name;
  const mail = emailFrom(sender);
  const mailOwn = mail.chosen !== "kdk";
  const mailReady = mailOwn && mail.ready;
  const mailFrom = mail.from;
  const waList = TEMPLATES.filter((t) => t.channel === "WhatsApp");
  const stateOf = (id: string) => approvals[id] ?? "Not submitted";
  const approved = waList.filter((t) => stateOf(t.id) === "Approved").length;
  const unsent = waList.filter((t) => stateOf(t.id) === "Not submitted");
  const pending = waList.filter((t) => stateOf(t.id) === "Pending").length;
  /* Read on every render: this component already re-renders when settings
     change (it subscribes through `sender` above), and the answer depends on
     the compliance picked, which a cached engine read would not notice. */
  const sendingOn = remindersOn(code);

  const vals = {
    client_name: CLIENT, firm_name: sender.by, form: opt.form, period: opt.period, due_date: opt.due,
    days_overdue: String(Math.max(1, sel.daysLate)), ack_no: "AB2610204518",
  };
  const subject = fill(sel.subject, vals);
  const body = fill(sel.body, vals);
  const used = [...new Set([...(sel.subject + sel.body).matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]))];

  const switchChannel = (c: Channel) => {
    setChannel(c);
    const next = TEMPLATES.filter((t) => t.channel === c);
    setStage((next.find((t) => t.stage === stage) ?? next[0]).stage);
  };

  const copy = () => {
    void navigator.clipboard?.writeText(isWa ? body : `${subject}\n\n${body}`);
    toast("Message copied");
  };

  return (
    <div className="tp">
      <div className="tp-top">
        <Seg<Channel>
          value={channel}
          onChange={switchChannel}
          options={[
            { value: "WhatsApp", label: <span className="tp-seg"><BrandIcon name="whatsapp" size={16} />WhatsApp</span> },
            { value: "Email", label: <span className="tp-seg"><BrandIcon name="email" size={16} />Email</span> },
          ]}
        />
        <label className="tp-pick">
          <span>Compliance</span>
          <select className="plain" value={code} onChange={(e) => setCode(e.target.value)}>
            {heads.map((h) => (
              <optgroup key={h} label={h}>
                {options.filter((o) => o.head === h).map((o) => (
                  <option key={o.code} value={o.code}>{o.form}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <span className="u-spacer" />
        <button type="button" className="btn btn--sm" onClick={copy}>
          <Icon name="copy" size={14} /> Copy message
        </button>
      </div>

      {/* Who it is sent from, and (for a firm's own WhatsApp number) whether
          WhatsApp has approved the templates on that account. */}
      <div className="tp-from">
        <span className="tp-from__ic">
          {isWa ? <BrandIcon name="whatsapp" size={20} /> : <BrandIcon name="email" size={20} />}
        </span>
        <span className="tp-from__who">
          <small>Sent from</small>
          <b>{isWa ? waName : mailFrom}</b>
        </span>
        <span className="tp-from__kind">
          {isWa ? (waReady ? "Your own number" : "Shared CA Connect number") : mailReady ? (mail.chosen === "smtp" ? "Your own mail server" : "Your own address") : "Shared address"}
        </span>

        {isWa && waReady ? (
          <span className="tp-from__status">
            {approved === waList.length ? (
              <span className="tp-ok"><Icon name="check" size={14} /> All {waList.length} templates approved</span>
            ) : (
              <span className="tp-wait">
                {approved} of {waList.length} approved{pending > 0 ? ` · waiting on ${pending}` : ""}
              </span>
            )}
            {unsent.length > 0 ? (
              <button type="button" className="btn btn--sm btn--primary" onClick={() => {
                submitTemplates(unsent.map((t) => t.id));
                toast(`${unsent.length} ${unsent.length === 1 ? "template" : "templates"} sent for approval`);
              }}>
                <Icon name="send" size={14} /> Send {unsent.length === waList.length ? "all" : unsent.length} for approval
              </button>
            ) : null}
          </span>
        ) : null}

        {isWa && waOwn && !waReady ? (
          <span className="tp-from__note">
            Your own number is not connected yet, so messages go through CA Connect until it is.
            {" "}<Link to="/settings" className="cd-link">Connect it in Settings</Link>
          </span>
        ) : null}
        {!isWa && mailOwn && !mailReady ? (
          <span className="tp-from__note">
            {mail.chosen === "smtp"
              ? "Your mail server is not connected yet, so emails go from the shared address until it is."
              : "Your own domain is not verified yet, so emails go from the shared address until it is."}
            {" "}<Link to="/settings" className="cd-link">{mail.chosen === "smtp" ? "Connect it in Settings" : "Verify it in Settings"}</Link>
          </span>
        ) : null}
      </div>

      {/* The sequence a client moves through, in order. Picking a step shows
          the message sent at that point. */}
      <ol className="tp-seq" aria-label="When it is sent">
        {list.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={`tp-step${t.stage === sel.stage ? " is-on" : ""}${t.daysLate > 0 ? " is-late" : ""}${t.stage === "done" ? " is-done" : ""}`}
              onClick={() => setStage(t.stage)}
            >
              <i className="tp-step__dot" />
              <b>{t.name}</b>
              <small>{t.timing}</small>
            </button>
          </li>
        ))}
      </ol>

      <div className="tp-pair">
        {/* The approved wording, with what changes per client highlighted. */}
        <section className="tp-card">
          <header className="tp-card__head">
            <b>Template</b>
            <small>The approved wording</small>
          </header>
          <div className="tp-raw">
            {!isWa && sel.subject ? (
              <div className="tp-raw__subject"><small>Subject</small><p>{withTokens(sel.subject)}</p></div>
            ) : null}
            {sel.body.split("\n").map((ln, i) => (ln ? <p key={i}>{withTokens(ln)}</p> : <span key={i} className="tp-raw__gap" />))}
          </div>
          <div className="tp-vars">
            <span className="tp-vars__k">Filled in for each client</span>
            <ul>
              {used.map((k) => (
                <li key={k}>
                  <mark className="tpl-tok">{`{{${k}}}`}</mark>
                  <span className="tp-vars__what">{VARIABLE_LABELS[k] ?? k}</span>
                  <span className="tp-vars__eg">{vals[k as keyof typeof vals]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The same message, filled in, drawn as the client sees it. */}
        <section className="tp-card">
          <header className="tp-card__head">
            <b>What the client sees</b>
            <small>{isWa ? "On WhatsApp" : "In their inbox"}</small>
          </header>
          <div className="tp-well">
            {isWa ? (
              <div className="tp-phone">
                <div className="wapane">
                  <div className="wapane__bar">
                    <Icon name="chevronLeft" size={18} className="wapane__back" />
                    <span className="waav">ST</span>
                    <div className="wapane__who">
                      <b>{CLIENT}</b>
                      <span className="num">from {waName}</span>
                    </div>
                  </div>
                  <div className="wapane__thread">
                    <div className="wabubble">
                      {body.split("\n").map((ln, i) =>
                        ln ? <p key={i}>{ln}</p> : <span key={i} className="wabubble__gap" />)}
                      <span className="wabubble__meta"><span className="num">10:00</span></span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="tp-mail mailpane">
                <div className="mailpane__head">
                  <BrandIcon name="email" size={18} />
                  <span className="mailpane__subject">{subject}</span>
                </div>
                <dl className="mailpane__meta">
                  <div><dt>From</dt><dd>{mailFrom}</dd></div>
                  <div><dt>To</dt><dd>{CLIENT}</dd></div>
                  {sel.cc ? <div><dt>Cc</dt><dd>{sel.cc}</dd></div> : null}
                </dl>
                <div className="mailpane__body">
                  {body.split("\n").map((ln, i) => (ln ? <p key={i}>{ln}</p> : null))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {!sendingOn ? (
        <p className="tp-note">Reminders for {opt.form} are switched off in Settings, so this is not sent today.</p>
      ) : !sel.live ? (
        <p className="tp-note">Planned. This message is not sent yet.</p>
      ) : sel.offByDefault ? (
        <p className="tp-note">Switched off unless you turn it on in Settings.</p>
      ) : null}
    </div>
  );
}
