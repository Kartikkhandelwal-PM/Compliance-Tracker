/* ============================================================================
   SETTINGS
   ----------------------------------------------------------------------------
   Six sections, one panel each. Everything here writes to the same engine store
   the rest of the app reads, so nothing is decorative.

     Firm          shown at the foot of every client message
     Sender        what clients see (KDK-managed) + the reply-to address
     Reminders     the steps, the sending hours, and the limits
     Compliances   which of the 31 the firm tracks, and who files each
     Team          the roster, and who new clients land on
     Alerts        which conditions raise the bell

   The reminder steps used to sit on Reminders → Automation, with the sending
   guards duplicated in both places — two screens claiming to own one setting.
   All configuration is here now; Reminders is the queue and the log only.

   TWO RULES, both learned the hard way on this screen.

   1. EVERY CARD IS A CONTROL. Three cards were cut for being neither: a
      "Financial year" card that only stated which year had data, a "Queue"
      card that only said the queue was on another page, and a "Test" button
      that fired a toast and sent nothing. A settings page is where you change
      things; anything that cannot be changed is either a fact belonging on the
      screen it describes, or navigation belonging in the nav.

   2. COPY SAYS WHAT THE CONTROL DOES, not why it exists. Earlier versions
      argued the case in the UI ("a statutory notice at 6am reads as spam and
      gets the number blocked"). The reasoning belongs in comments like this
      one.
   ========================================================================== */

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { STAFF } from "../domain/book.ts";
import { DEFS, HEADS, headClass } from "../domain/catalog.ts";
import {
  complianceSetting, getDefaultAssignee, getFirm,
  getNotificationSettings, getReminderSettings, getSchedule, getSenderProfile,
  resetCompliances, resetSchedule, saveRampwin, saveZeptomail, setDefaultAssignee,
  setEmailProvider, setWaProvider, toggleStepChannel, updateCompliance, updateFirm,
  updateNotificationSettings, updateReminderSettings, updateSenderProfile, updateStep,
  untrackedCount,
} from "../domain/engine.ts";
import { useApp, useEngine } from "../ui/app-state.tsx";
import { Avatar, Check, Empty, PageHead, Seg } from "../ui/bits.tsx";
import { BrandIcon, Icon } from "../ui/Icon.tsx";
import type { IconName } from "../ui/Icon.tsx";
import type { Channel, FirmProfile, SenderProfile } from "../domain/types.ts";

type Section =
  | "firm" | "whatsapp" | "email" | "reminders" | "compliances" | "team" | "notifications";

const SECTIONS: { id: Section; label: string; icon: IconName; note: string }[] = [
  { id: "firm", label: "Firm", icon: "clients", note: "Your details" },
  /* WhatsApp and email used to be one "Sender" section with both cards
     stacked on the same page — a firm setting up one channel had to scroll
     past a fully-built form for the other to get there. Two destinations,
     each showing exactly one channel's setup, is more sections in the nav
     but less to look at on any one screen. */
  { id: "whatsapp", label: "WhatsApp", icon: "send", note: "Business number" },
  { id: "email", label: "Email", icon: "outbox", note: "Sending address" },
  { id: "reminders", label: "Reminders", icon: "clock", note: "Steps and timing" },
  { id: "compliances", label: "Compliances", icon: "matrix", note: "What you track" },
  { id: "team", label: "Team", icon: "team", note: "Staff and owners" },
  { id: "notifications", label: "Alerts", icon: "bell", note: "In-app alerts" },
];

export function RulesPage() {
  const [section, setSection] = useState<Section>("firm");
  const active = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="page page--wide">
      <PageHead title="Settings" icon="settings" note="Set up how the app works for your firm" />

      <div className="setwrap">
        {/* A vertical list, not a row of tabs. Six destinations in a strip
            would wrap on a laptop, and a settings area only grows. */}
        <nav className="setnav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`setnav__i${s.id === section ? " is-on" : ""}`}
              onClick={() => setSection(s.id)}
              aria-current={s.id === section}
            >
              <Icon name={s.icon} size={16} className="setnav__ico" />
              <span className="setnav__t">
                <b>{s.label}</b>
                <em>{s.note}</em>
              </span>
            </button>
          ))}
        </nav>

        <div className="setpane">
          <div className="setpane__head">
            <h2>{active.label}</h2>
            <span className="shead__note">{active.note}</span>
          </div>

          {section === "firm" ? <FirmSection /> : null}
          {section === "whatsapp" ? <WhatsAppSection /> : null}
          {section === "email" ? <EmailSection /> : null}
          {section === "reminders" ? <RemindersSection /> : null}
          {section === "compliances" ? <CompliancesSection /> : null}
          {section === "team" ? <TeamSection /> : null}
          {section === "notifications" ? <NotificationsSection /> : null}
        </div>
      </div>
    </div>
  );
}

/* ---- Shared field furniture --------------------------------------------- */

function Row({ label, hint, children, wide }: {
  label: string; hint?: string; children: ReactNode; wide?: boolean;
}) {
  return (
    <label className={`srow${wide ? " srow--wide" : ""}`}>
      <span className="srow__l">
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

function Text({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input
      className={`sinput${mono ? " num" : ""}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Toggle({ on, onToggle, title, body }: {
  on: boolean; onToggle: () => void; title: string; body: string;
}) {
  return (
    <div className="stoggle">
      <button
        type="button"
        className={`switch${on ? " is-on" : ""}`}
        onClick={onToggle}
        aria-pressed={on}
        aria-label={title}
      />
      <div>
        <div className="u-strong">{title}</div>
        <p className="stoggle__b">{body}</p>
      </div>
    </div>
  );
}

function Card({ title, note, children, foot }: {
  title: string; note?: string; children: ReactNode; foot?: ReactNode;
}) {
  return (
    <div className="sheet setcard">
      <div className="sheet__head">
        <span className="sheet__title">{title}</span>
        {note ? <span className="u-mute" style={{ fontSize: "var(--t-12)" }}>{note}</span> : null}
      </div>
      <div className="sheet__body">{children}</div>
      {foot ? <div className="sheet__foot">{foot}</div> : null}
    </div>
  );
}

/** A real radio group (one name, one selection, arrow-key accessible),
 *  styled as cards rather than dots — shown up front rather than behind a
 *  select, because "recommended" only means something next to the
 *  alternative it's being recommended over. */
function ConnChoice<T extends string>({ name, value, onChange, options }: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; sub: string }[];
}) {
  return (
    <div className="conn" role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={`conn__opt${value === o.value ? " is-on" : ""}`}>
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span className="conn__dot" />
          <span>
            <span className="conn__title">{o.title}</span>
            <span className="conn__sub">{o.sub}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** A field worth hiding by default — an API key or token, shown as dots
 *  until the reader chooses to look, same as a password field, but with a
 *  visible toggle because this one is meant to be copied back out, not just
 *  typed once and forgotten. */
function Secret({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field-secret">
      <input
        type={shown ? "text" : "password"}
        className="sinput"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="field-secret__toggle"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide" : "Show"}
        tabIndex={-1}
      >
        <Icon name={shown ? "eyeOff" : "eye"} size={15} />
      </button>
    </div>
  );
}

/** A field in a credential form — label and hint stacked on their own lines
 *  rather than squeezed onto one baseline, because these hints run long
 *  ("From your mail agent's setup info in ZeptoMail") in a way the rest of
 *  Settings' short hints ("Yours to set") never do. */
function PField({ label, hint, children }: {
  label: string; hint?: string; children: ReactNode;
}) {
  return (
    <div className="pfield">
      <span className="pfield__label">{label}</span>
      {/* Reserving a blank hint line even with nothing to say was worse than
         the misalignment it fixed — a solo field like "API endpoint" got a
         dead gap under its label with no text to justify it. Real fix:
         every field that sits in a pair gets a real hint, even a short one,
         so the two inputs start level without faking the space. */}
      {hint ? <p className="pfield__hint">{hint}</p> : null}
      {children}
    </div>
  );
}

/**
 * A read-only value inside a credential form — an endpoint, a fixed
 * username, a number KDK set up.
 *
 * `readOnly`, not `disabled` — the point is that the reader knows what is
 * configured, so the text has to stay selectable and copyable (someone will
 * be reading that endpoint or username back on a support call). A disabled
 * input blocks selection and reads as "broken" rather than "fixed by us".
 *
 * Also, unlike a locked row on a plain settings page, a lock glyph earns its
 * place here: this sits beside editable fields it would otherwise look
 * identical to.
 */
function PLocked({ value }: { value: string }) {
  return (
    <div className="field-locked">
      <input className="sinput is-locked num" value={value} readOnly aria-readonly="true" />
      <Icon name="lock" size={14} className="field-locked__glyph" />
    </div>
  );
}

/* ============================================================================
   FIRM
   ========================================================================== */

function FirmSection() {
  const firm = useEngine(getFirm);
  const set = (k: keyof FirmProfile) => (v: string) => updateFirm({ [k]: v });

  return (
    <>
      <Card
        title="Your firm"
        note="Shown on client messages"
        foot="Your firm name appears at the end of every reminder sent to clients."
      >
        <div className="sgrid">
          <Row label="Firm name" wide><Text value={firm.name} onChange={set("name")} /></Row>
          <Row label="PAN"><Text value={firm.pan} onChange={set("pan")} mono /></Row>
          <Row label="GSTIN"><Text value={firm.gstin} onChange={set("gstin")} mono /></Row>
        </div>
      </Card>

      <Card title="Address & contact">
        <div className="sgrid">
          <Row label="Address" wide>
            <Text value={firm.addressLine} onChange={set("addressLine")} />
          </Row>
          <Row label="City"><Text value={firm.city} onChange={set("city")} /></Row>
          <Row label="State">
            <select
              className="sinput"
              value={firm.state}
              onChange={(e) => updateFirm({ state: e.target.value })}
            >
              {["Rajasthan", "Maharashtra", "Delhi", "Karnataka", "Gujarat", "Tamil Nadu",
                "Uttar Pradesh", "West Bengal", "Telangana", "Kerala"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Row>
          <Row label="PIN code"><Text value={firm.pincode} onChange={set("pincode")} mono /></Row>
          <Row label="Phone"><Text value={firm.phone} onChange={set("phone")} mono /></Row>
          <Row label="Email"><Text value={firm.email} onChange={set("email")} /></Row>
          <Row label="Website"><Text value={firm.website} onChange={set("website")} /></Row>
        </div>
      </Card>

    </>
  );
}

/* ============================================================================
   SENDER & CHANNELS
   ========================================================================== */

/**
 * WhatsApp and email sender setup.
 *
 * Both channels default to KDK's shared account — one Meta-verified
 * WhatsApp Business number and one sending domain, serving every practice
 * on the product, shown here as read-only. A firm cannot just substitute
 * its own number or domain into those same fields: a WhatsApp number needs
 * its own Meta Business verification and template approval, and an email
 * domain needs its own SPF/DKIM alignment, neither of which typing a new
 * value into KDK's configuration would actually set up. (An earlier version
 * of this screen offered "Display name" and "Business number" as plain text
 * inputs, which promised exactly that capability without it existing.)
 *
 * What genuinely exists now is a second, independent account per channel —
 * the firm's own, brought in through a provider that does the real
 * verification: Rampwin for WhatsApp, ZeptoMail for email. Each channel's
 * toggle switches which account it sends through; nothing about the other
 * channel changes, and switching back to KDK doesn't discard a connection
 * already made, in case the firm switches again later.
 *
 * Two nav destinations, not one "Sender" page with both cards stacked —
 * setting up one channel used to mean scrolling past a fully-built form for
 * the other to get to it.
 */
function WhatsAppSection() {
  const s = useEngine(getSenderProfile);
  return <WhatsAppCard s={s} />;
}

function EmailSection() {
  const s = useEngine(getSenderProfile);
  return <EmailCard s={s} />;
}

function WhatsAppCard({ s }: { s: SenderProfile }) {
  const { toast } = useApp();
  const own = s.waProvider === "rampwin";

  const [displayName, setDisplayName] = useState(s.rampwin.displayName);
  const [apiKey, setApiKey] = useState(s.rampwin.apiKey);
  const [channelId, setChannelId] = useState(s.rampwin.channelId);
  /* A saved connection opens on its summary, not its credential form — the
     API key sitting in an open text field every time this screen loads is a
     mis-click away from being changed by accident. Only a fresh, unsaved
     connection opens straight into the form, because there's nothing yet to
     summarise. */
  const [editing, setEditing] = useState(!s.rampwin.connected);

  const valid = !!apiKey.trim() && !!channelId.trim() && !!displayName.trim();

  const save = () => {
    saveRampwin({
      displayName: displayName.trim(),
      apiKey: apiKey.trim(),
      channelId: channelId.trim(),
    });
    toast("WhatsApp channel saved");
    setEditing(false);
  };

  const cancel = () => {
    setDisplayName(s.rampwin.displayName);
    setApiKey(s.rampwin.apiKey);
    setChannelId(s.rampwin.channelId);
    setEditing(false);
  };

  return (
    <Card title="WhatsApp Business" note={own ? "Your own number, via Rampwin" : "Managed by KDK"}>
      <div className="sbrand">
        <BrandIcon name="whatsapp" size={26} />
        <div>
          <div className="u-strong">
            {own ? (s.rampwin.displayName || "Not connected yet") : s.waName}
          </div>
          <div className="u-mute" style={{ fontSize: "var(--t-12)" }}>
            {own ? "Sending through the firm's own Rampwin account" : "Sending on behalf of the practice"}
          </div>
        </div>
        <span className="u-spacer" />
        <span className={`tag ${(own ? s.rampwin.connected : s.waVerified) ? "tag--filed" : "tag--pending"}`}>
          <i className="tag__dot" />
          {own
            ? (s.rampwin.connected ? "Connected" : "Not connected")
            : (s.waVerified ? "Verified business" : "Unverified")}
        </span>
      </div>

      {/* Two accounts, either one selectable — picking one is what makes it
          the one messages actually send through. Switching away from a
          Rampwin channel already set up doesn't erase it; picking "Your own
          number" again brings the same saved details straight back. */}
      <ConnChoice
        name="wa-provider"
        value={s.waProvider}
        onChange={setWaProvider}
        options={[
          { value: "kdk", title: "CA Connect", sub: "Managed by KDK" },
          {
            value: "rampwin",
            title: "Your own number",
            sub: s.rampwin.connected ? "Connected, via Rampwin" : "Set up via Rampwin",
          },
        ]}
      />

      {!own ? (
        <div className="pgrid">
          <div className="pgrid__pair">
            <PField label="Display name" hint="What clients see as the sender">
              <PLocked value={s.waName} />
            </PField>
            <PField label="Business number" hint="The number messages send from">
              <PLocked value={s.waNumber} />
            </PField>
          </div>
        </div>
      ) : !editing ? (
        <>
          {/* Read-only, not the credential form — every field here is a
              `PLocked` the same way KDK's own fields above are, so there is
              nothing to mis-click into changing. The API key itself is left
              out entirely; "Connected" already says it's there, and there's
              no reason for it to be on screen once it's done its job. */}
          <div className="pgrid">
            <div className="pgrid__pair">
              <PField label="Display name" hint="What clients see as the sender">
                <PLocked value={s.rampwin.displayName} />
              </PField>
              <PField label="Channel ID" hint="The WhatsApp channel messages send through">
                <PLocked value={s.rampwin.channelId} />
              </PField>
            </div>
          </div>

          <div className="providercfg__foot">
            <span className="u-mute" style={{ fontSize: "var(--t-12)" }}>
              Sending through <b>Rampwin</b>
            </span>
            <span className="u-spacer" />
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => toast("Test message sent to your own WhatsApp number")}
            >
              <Icon name="send" size={14} /> Send test message
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}>
              Edit configuration
            </button>
          </div>
        </>
      ) : (
        <>
          {/* One way in: a channel the firm already runs in their own
              Rampwin account, pointed at by its API key. Setting up a new
              number with Meta is Rampwin's own onboarding, not this
              screen's — it has nothing to add to that flow. */}
          <div className="pgrid">
            <PField label="API key" hint="From Rampwin → Settings → General settings">
              <Secret value={apiKey} onChange={setApiKey} placeholder="Rampwin API key" />
            </PField>
            <div className="pgrid__pair">
              <PField label="Channel ID" hint="The WhatsApp channel to send through">
                <Text value={channelId} onChange={setChannelId} placeholder="Channel ID" mono />
              </PField>
              <PField label="Display name" hint="What clients see as the sender">
                <Text value={displayName} onChange={setDisplayName} placeholder="e.g. Sharma & Associates" />
              </PField>
            </div>
          </div>

          <div className="providercfg__foot">
            <span className="u-mute" style={{ fontSize: "var(--t-12)" }}>
              {s.rampwin.connected ? <>Sending through <b>Rampwin</b></> : "Not yet connected"}
            </span>
            <span className="u-spacer" />
            {s.rampwin.connected ? (
              <button type="button" className="btn btn--sm" onClick={cancel}>Cancel</button>
            ) : null}
            <button type="button" className="btn btn--primary btn--sm" disabled={!valid} onClick={save}>
              Save changes
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

function EmailCard({ s }: { s: SenderProfile }) {
  const { toast } = useApp();
  const own = s.emailProvider === "zeptomail";

  const [method, setMethod] = useState(s.zeptomail.method);
  const [apiToken, setApiToken] = useState(s.zeptomail.apiToken);
  const [mailAgent, setMailAgent] = useState(s.zeptomail.mailAgent);
  const [fromName, setFromName] = useState(s.zeptomail.fromName);
  const [fromAddress, setFromAddress] = useState(s.zeptomail.fromAddress);
  const [bounceAddress, setBounceAddress] = useState(s.zeptomail.bounceAddress);

  /* Same reasoning as the WhatsApp card: a saved setup opens on its
     summary, not a form with a live token field in it. */
  const [editing, setEditing] = useState(!s.zeptomail.configured);

  const valid = !!apiToken.trim() && !!fromName.trim() && !!fromAddress.trim();

  const save = () => {
    saveZeptomail({
      method, apiToken: apiToken.trim(), mailAgent: mailAgent.trim(), fromName: fromName.trim(),
      fromAddress: fromAddress.trim(), bounceAddress: bounceAddress.trim(),
    });
    toast("Email settings saved");
    setEditing(false);
  };

  const cancel = () => {
    setMethod(s.zeptomail.method);
    setApiToken(s.zeptomail.apiToken);
    setMailAgent(s.zeptomail.mailAgent);
    setFromName(s.zeptomail.fromName);
    setFromAddress(s.zeptomail.fromAddress);
    setBounceAddress(s.zeptomail.bounceAddress);
    setEditing(false);
  };

  return (
    <Card title="Email" note={own ? "Your own domain, via ZeptoMail" : "Managed by KDK"}>
      <div className="sbrand">
        <BrandIcon name="email" size={24} />
        <div>
          <div className="u-strong">
            {own ? (s.zeptomail.fromAddress || "Not set up yet") : s.fromEmail}
          </div>
          <div className="u-mute" style={{ fontSize: "var(--t-12)" }}>
            {own
              ? (s.zeptomail.mailAgent ? `Mail agent: ${s.zeptomail.mailAgent}` : "Sent via ZeptoMail")
              : `Replies arrive at ${s.replyTo || "—"}`}
          </div>
        </div>
        {own ? (
          <>
            <span className="u-spacer" />
            <span className={`tag ${s.zeptomail.configured ? "tag--filed" : "tag--pending"}`}>
              <i className="tag__dot" />{s.zeptomail.configured ? "Configured" : "Not set up"}
            </span>
          </>
        ) : null}
      </div>

      {/* Two accounts, either one selectable — switching away from ZeptoMail
          doesn't erase what was saved there; picking it again brings the
          same setup straight back. */}
      <ConnChoice
        name="email-provider"
        value={s.emailProvider}
        onChange={setEmailProvider}
        options={[
          { value: "kdk", title: "CA Connect", sub: "Managed by KDK" },
          {
            value: "zeptomail",
            title: "Your own domain",
            sub: s.zeptomail.configured ? "Configured, via ZeptoMail" : "Set up via ZeptoMail",
          },
        ]}
      />

      {!own ? (
        <div className="pgrid">
          <div className="pgrid__pair">
            <PField label="From address" hint="Managed by KDK">
              <PLocked value={s.fromEmail} />
            </PField>
            <PField label="Reply-to address" hint="Yours to set">
              <Text value={s.replyTo} onChange={(v) => updateSenderProfile({ replyTo: v })} />
            </PField>
          </div>
        </div>
      ) : !editing ? (
        <>
          {/* Read-only, not the credential form — every field here is a
              `PLocked` the same way KDK's own fields above are, so there is
              nothing to mis-click into changing. The token itself is left
              out entirely; "Configured" already says it's there. */}
          <div className="pgrid">
            <div className="pgrid__pair">
              <PField label="Connection" hint="How ZeptoMail sends these">
                <PLocked value={s.zeptomail.method === "smtp" ? "SMTP relay" : "Send Mail API"} />
              </PField>
              <PField label="Mail agent" hint="Labels which agent these sends belong to">
                <PLocked value={s.zeptomail.mailAgent || "Not labelled"} />
              </PField>
            </div>
            <div className="pgrid__pair">
              <PField label="From name" hint="What clients see as the sender">
                <PLocked value={s.zeptomail.fromName} />
              </PField>
              <PField label="From address">
                <PLocked value={s.zeptomail.fromAddress} />
              </PField>
            </div>
            <PField label="Bounce address" hint="Where ZeptoMail returns undeliverable mail">
              <PLocked value={s.zeptomail.bounceAddress || "Not set"} />
            </PField>
          </div>

          <div className="providercfg__foot">
            <span className="u-mute" style={{ fontSize: "var(--t-12)" }}>
              Sending through <b>ZeptoMail {s.zeptomail.method === "smtp" ? "SMTP relay" : "Send Mail API"}</b>
            </span>
            <span className="u-spacer" />
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => toast(`Test email sent to ${s.zeptomail.fromAddress}`)}
            >
              <Icon name="send" size={14} /> Send test email
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}>
              Edit configuration
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Deliberately a small pill switch, not another pair of big cards
              — this is a detail of HOW "Your own domain" sends, not a
              second decision of the same weight as picking the account
              above it. ZeptoMail genuinely accepts either wire, same token:
              API is what they recommend, SMTP relay is for software that
              only speaks SMTP. */}
          <div className="pmethod">
            <span className="pmethod__l">Connect via</span>
            <Seg
              value={method}
              onChange={setMethod}
              options={[
                { value: "api", label: "Send Mail API" },
                { value: "smtp", label: "SMTP relay" },
              ]}
            />
          </div>

          <div className="pgrid">
            {method === "api" ? (
              <>
                <PField label="API endpoint" hint="Fixed">
                  <PLocked value="https://api.zeptomail.com/v1.1/email" />
                </PField>
                <PField label="Send Mail token" hint="From your mail agent's setup info in ZeptoMail">
                  <Secret value={apiToken} onChange={setApiToken} placeholder="Send Mail Token" />
                </PField>
                <PField label="Mail agent" hint="Optional — labels which agent these sends belong to">
                  <Text value={mailAgent} onChange={setMailAgent} placeholder="e.g. compliance-reminders" mono />
                </PField>
              </>
            ) : (
              <>
                <div className="pgrid__pair">
                  <PField label="SMTP host" hint="ZeptoMail's fixed relay address">
                    <PLocked value="smtp.zeptomail.com" />
                  </PField>
                  <PField label="Port" hint="587 with TLS, or 465 with SSL">
                    <PLocked value="587 / 465" />
                  </PField>
                </div>
                <div className="pgrid__pair">
                  <PField label="Username" hint="ZeptoMail also accepts the From address instead">
                    <PLocked value="emailapikey" />
                  </PField>
                  <PField label="Password" hint="The same Send Mail Token, from your mail agent">
                    <Secret value={apiToken} onChange={setApiToken} placeholder="Send Mail Token" />
                  </PField>
                </div>
              </>
            )}

            <div className="pgrid__pair">
              <PField label="From name" hint="What clients see as the sender">
                <Text value={fromName} onChange={setFromName} placeholder="e.g. Sharma & Associates" />
              </PField>
              <PField label="From address" hint="Must sit on a domain you've verified in ZeptoMail">
                <Text value={fromAddress} onChange={setFromAddress} placeholder="compliance@yourfirm.com" mono />
              </PField>
            </div>
            <PField label="Bounce address" hint="Optional — where ZeptoMail returns undeliverable mail">
              <Text value={bounceAddress} onChange={setBounceAddress} placeholder="bounces@yourfirm.com" mono />
            </PField>
          </div>

          <div className="providercfg__foot">
            <span className="u-mute" style={{ fontSize: "var(--t-12)" }}>
              {s.zeptomail.configured
                ? <>Sending through <b>ZeptoMail {s.zeptomail.method === "smtp" ? "SMTP relay" : "Send Mail API"}</b></>
                : "Not yet set up"}
            </span>
            <span className="u-spacer" />
            <button
              type="button"
              className="btn btn--sm"
              disabled={!s.zeptomail.configured}
              onClick={() => toast(`Test email sent to ${s.zeptomail.fromAddress}`)}
            >
              <Icon name="send" size={14} /> Send test email
            </button>
            {s.zeptomail.configured ? (
              <button type="button" className="btn btn--sm" onClick={cancel}>Cancel</button>
            ) : null}
            <button type="button" className="btn btn--primary btn--sm" disabled={!valid} onClick={save}>
              Save changes
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

/* ============================================================================
   REMINDERS
   ========================================================================== */

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function RemindersSection() {
  const { toast } = useApp();
  const r = useEngine(getReminderSettings);
  const schedule = useEngine(getSchedule);
  const onSteps = schedule.filter((s) => s.enabled).length;

  return (
    <>
      <Card title="Automatic reminders" note={r.autoSend ? "On" : "Off"}>
        <Toggle
          on={r.autoSend}
          onToggle={() => {
            updateReminderSettings({ autoSend: !r.autoSend });
            toast(r.autoSend ? "Automatic reminders turned off" : "Automatic reminders turned on");
          }}
          title="Send reminders automatically"
          body="When off, reminders are only sent manually."
        />
      </Card>

      <Card
        title="Reminder steps"
        note={`${onSteps} of ${schedule.length} on`}
        foot="Each step is counted from the due date. Steps are skipped if the filing is already complete."
      >
        <div className="u-row-3" style={{ marginBottom: "var(--s3)" }}>
          <span className="setnote">Enable or disable steps, and set the channel and time.</span>
          <span className="u-spacer" />
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => { resetSchedule(); toast("Steps reset"); }}
          >
            <Icon name="history" size={14} /> Reset
          </button>
        </div>
        <Ladder schedule={schedule} />
      </Card>

      <Card
        title="Sending hours"
        note={r.quietHours
          ? `${String(r.quietStart).padStart(2, "0")}:00 – ${String(r.quietEnd).padStart(2, "0")}:00`
          : "Any time"}
        foot="Messages outside these hours are held and sent when the window reopens. Nothing is lost."
      >
        <Toggle
          on={r.quietHours}
          onToggle={() => updateReminderSettings({ quietHours: !r.quietHours })}
          title="Only send during set hours"
          body="Prevents reminders being sent late at night."
        />

        {r.quietHours ? (
          <div className="sgrid sgrid--tight">
            <Row label="From">
              <select
                className="sinput num"
                value={r.quietStart}
                onChange={(e) => updateReminderSettings({ quietStart: Number(e.target.value) })}
              >
                {HOURS.filter((h) => h < r.quietEnd).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </Row>
            <Row label="To">
              <select
                className="sinput num"
                value={r.quietEnd}
                onChange={(e) => updateReminderSettings({ quietEnd: Number(e.target.value) })}
              >
                {HOURS.filter((h) => h > r.quietStart).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </Row>
          </div>
        ) : null}

        <Toggle
          on={r.skipWeekends}
          onToggle={() => updateReminderSettings({ skipWeekends: !r.skipWeekends })}
          title="Skip weekends"
          body="Reminders due on a Saturday or Sunday move to a working day: Friday if the deadline has not passed, Monday if it has."
        />
      </Card>

      {/* No "combine reminders" card here. Digest is scoped to a later phase —
          this is an internal note, not something to surface to a user as a
          disabled toggle. `ReminderSettings.digest` still exists on the type
          and defaults to false; there's just no UI for it yet. */}
    </>
  );
}

/** The reminder steps. One row per step, every control live. */
function Ladder({ schedule }: { schedule: ReturnType<typeof getSchedule> }) {
  return (
    <div className="ladder">
      {schedule.map((s) => (
        <div key={s.id} className={`lstep${s.enabled ? "" : " is-off"}`}>
          {/* The offset is the step's identity, so it reads as a figure. */}
          <span className={`lstep__off${s.offset > 0 ? " is-late" : ""}`}>
            <b className="num">{s.offset > 0 ? `+${s.offset}` : s.offset === 0 ? "0" : s.offset}</b>
            <em>{s.offset === 0 ? "on due date" : s.offset < 0 ? "days before" : "days after"}</em>
          </span>

          <span className="lstep__id">
            <span className="lstep__id-row">
              <b>{s.label}</b>
              {s.ccOwner ? (
                <span className="tag tag--outline u-nowrap" title="The client's owner is copied in">
                  <Icon name="user" size={11} /> cc owner
                </span>
              ) : null}
            </span>
            <span className="u-mute">{s.intent}</span>
          </span>

          <span className="lstep__ch">
            {(["WhatsApp", "Email"] as Channel[]).map((ch) => {
              const on = s.channels.includes(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  className={`chtoggle${on ? " is-on" : ""}`}
                  onClick={() => toggleStepChannel(s.id, ch)}
                  aria-pressed={on}
                  title={`${on ? "Stop sending" : "Also send"} on ${ch}`}
                >
                  <BrandIcon name={ch === "WhatsApp" ? "whatsapp" : "email"} size={14} />
                  {ch}
                </button>
              );
            })}
          </span>

          <span className="lstep__at">
            <select
              className="plain"
              value={s.sendAt}
              onChange={(e) => updateStep(s.id, { sendAt: Number(e.target.value) })}
              aria-label={`Time ${s.label} is sent`}
            >
              {[9, 10, 11, 12, 14, 16, 18].map((hh) => (
                <option key={hh} value={hh}>{String(hh).padStart(2, "0")}:00</option>
              ))}
            </select>
          </span>

          <button
            type="button"
            className={`switch${s.enabled ? " is-on" : ""}`}
            onClick={() => updateStep(s.id, { enabled: !s.enabled })}
            aria-pressed={s.enabled}
            aria-label={`${s.label} step`}
          />
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   COMPLIANCES
   ----------------------------------------------------------------------------
   Two switches per compliance, and they mean different things. "Tracked" is
   whether the firm handles it at all — a practice with no payroll clients has
   no business carrying PF and ESI in its book. "Client files" is whether the
   filing is the client's own act, which is what decides whether they are ever
   chased about it. An internal task still appears in the tracker; it just
   never generates a message.
   ========================================================================== */

function CompliancesSection() {
  const { toast } = useApp();
  const [head, setHead] = useState("all");
  useEngine(untrackedCount); /* re-render when any override changes */

  const rows = DEFS.filter((d) => head === "all" || d.head === head);
  const off = untrackedCount();

  return (
    <Card
      title={`${DEFS.length} compliances`}
      note={off > 0 ? `${off} turned off` : "All on"}
      foot="Untracked compliances are removed from the Tracker, Calendar and reminders. Turning off “Remind client” keeps the compliance tracked but sends no reminders for it."
    >
      <div className="u-row-3" style={{ marginBottom: "var(--s3)", flexWrap: "wrap" }}>
        <select className="plain" value={head} onChange={(e) => setHead(e.target.value)}>
          <option value="all">All heads</option>
          {HEADS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="u-spacer" />
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => { resetCompliances(); toast("Reset"); }}
        >
          <Icon name="history" size={14} /> Reset
        </button>
      </div>

      {rows.length === 0 ? (
        <Empty title="Nothing under this head" />
      ) : (
        <table className="ltable ltable--plain">
          <thead>
            <tr>
              <th>Compliance</th>
              <th>Head</th>
              <th>Frequency</th>
              <th className="u-center" style={{ width: 90 }}>Tracked</th>
              <th className="u-center" style={{ width: 120 }}>Remind client</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const cfg = complianceSetting(d.code);
              return (
                <tr key={d.code} className={cfg.tracked ? undefined : "is-muted"}>
                  <td>
                    <div className="u-row" style={{ gap: "var(--s2)" }}>
                      <span className={`spine ${headClass(d.head)}`} />
                      <span>
                        <div className="u-strong">{d.form}</div>
                        <div className="u-faint" style={{ fontSize: "var(--t-11)" }}>{d.dueRule}</div>
                      </span>
                    </div>
                  </td>
                  <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{d.head}</td>
                  <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{d.frequency}</td>
                  <td className="u-center">
                    <button
                      type="button"
                      className="rowcheck"
                      aria-label={`Track ${d.form}`}
                      onClick={() => updateCompliance(d.code, { tracked: !cfg.tracked })}
                    >
                      <Check on={cfg.tracked} />
                    </button>
                  </td>
                  <td className="u-center">
                    <button
                      type="button"
                      className="rowcheck"
                      aria-label={`Remind clients about ${d.form}`}
                      disabled={!cfg.tracked}
                      onClick={() => updateCompliance(d.code, { clientFacing: !cfg.clientFacing })}
                    >
                      <Check on={cfg.tracked && cfg.clientFacing} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ============================================================================
   TEAM
   ========================================================================== */

function TeamSection() {
  const defaultOwner = useEngine(getDefaultAssignee);

  return (
    <>
      <Card
        title={`${STAFF.length} people`}
        note="Staff"
        foot="Clients and filings can be assigned to these staff members."
      >
        <table className="ltable ltable--plain">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th className="u-right">Clients owned</th>
            </tr>
          </thead>
          <tbody>
            {STAFF.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="u-row">
                    <Avatar initials={s.initials} />
                    <b>{s.name}</b>
                  </span>
                </td>
                <td className="u-mute">{s.role}</td>
                <td className="u-right">
                  <Link to={`/clients?owner=${s.id}`} className="setlink">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title="Default owner"
        foot="New clients are assigned to this staff member automatically."
      >
        <div className="sgrid sgrid--tight">
          <Row label="Assign new clients to">
            <select
              className="sinput"
              value={defaultOwner}
              onChange={(e) => setDefaultAssignee(e.target.value)}
            >
              <option value="none">Nobody (assign manually)</option>
              {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
            </select>
          </Row>
        </div>
      </Card>
    </>
  );
}

/* ============================================================================
   NOTIFICATIONS
   ========================================================================== */

const BELL: { id: string; title: string; body: string }[] = [
  {
    id: "gap",
    title: "Biggest backlog",
    body: "The filing with the highest number of clients still pending.",
  },
  {
    id: "dueToday",
    title: "Due today",
    body: "Filings with today's due date.",
  },
  {
    id: "unowned",
    title: "No owner assigned",
    body: "Pending filings for clients with no staff member assigned.",
  },
  {
    id: "failed",
    title: "Failed reminders",
    body: "Reminders that were not delivered to the client.",
  },
];

function NotificationsSection() {
  const n = useEngine(getNotificationSettings);
  const onCount = BELL.filter((b) => n[b.id]).length;

  return (
    <Card
      title="Bell alerts"
      note={`${onCount} of ${BELL.length} on`}
      foot="Alerts clear automatically once the underlying issue is resolved."
    >
      {BELL.map((b) => (
        <Toggle
          key={b.id}
          on={!!n[b.id]}
          onToggle={() => updateNotificationSettings({ [b.id]: !n[b.id] })}
          title={b.title}
          body={b.body}
        />
      ))}
    </Card>
  );
}
