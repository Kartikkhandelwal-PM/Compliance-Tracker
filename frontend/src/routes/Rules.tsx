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
  complianceSetting, getDefaultAssignee, getFirm, getNotificationSettings,
  getReminderSettings, getSchedule, getSenderProfile, resetCompliances, resetSchedule,
  setDefaultAssignee, toggleStepChannel, updateCompliance, updateFirm,
  updateNotificationSettings, updateReminderSettings, updateSenderProfile,
  updateStep, untrackedCount,
} from "../domain/engine.ts";
import { useApp, useEngine } from "../ui/app-state.tsx";
import { Avatar, Check, Empty, PageHead } from "../ui/bits.tsx";
import { BrandIcon, Icon } from "../ui/Icon.tsx";
import type { IconName } from "../ui/Icon.tsx";
import type { Channel, FirmProfile } from "../domain/types.ts";

type Section = "firm" | "sender" | "reminders" | "compliances" | "team" | "notifications";

const SECTIONS: { id: Section; label: string; icon: IconName; note: string }[] = [
  { id: "firm", label: "Firm", icon: "clients", note: "Your details" },
  { id: "sender", label: "Sender", icon: "send", note: "WhatsApp and email" },
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
          {section === "sender" ? <SenderSection /> : null}
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

/**
 * A value the firm can see but not change.
 *
 * `readOnly`, not `disabled` — the point is that the reader knows what is
 * configured, so the text has to stay selectable and copyable (someone will be
 * reading that WhatsApp number out on a support call). A disabled input blocks
 * selection and reads as "broken" rather than "fixed by us". The sunk fill is
 * the only signal it needs; a lock glyph on every row was noise.
 */
function Locked({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <input
      className={`sinput is-locked${mono ? " num" : ""}`}
      value={value}
      readOnly
      aria-readonly="true"
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
          <Row label="Firm Registration No." hint="FRN">
            <Text value={firm.frn} onChange={set("frn")} mono />
          </Row>
          <Row label="Membership no.">
            <Text value={firm.membershipNo} onChange={set("membershipNo")} mono />
          </Row>
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
 * Sender.
 *
 * WhatsApp is NOT the firm's to configure. Messages go out on KDK's own
 * "CA Connect" WhatsApp Business account — one Meta-verified number serving
 * every practice on the product. A firm cannot substitute its own: that would
 * need its own Meta Business verification, API access and per-template
 * approval. An earlier version offered "Display name" and "Business number" as
 * text inputs, which promised a capability the product does not have.
 *
 * The same is true of the From address — it belongs to KDK's sending domain,
 * and changing it would break SPF/DKIM alignment and land the mail in spam.
 *
 * So this screen shows what clients see, and edits the one thing the firm
 * genuinely owns: where replies go.
 */
function SenderSection() {
  const s = useEngine(getSenderProfile);

  return (
    <>
      <Card
        title="WhatsApp Business"
        note="Managed by KDK"
        foot="This number is set up for you and can't be changed here. Contact KDK to send from your own WhatsApp number instead."
      >
        <div className="sbrand">
          <BrandIcon name="whatsapp" size={26} />
          <div>
            <div className="u-strong">{s.waName}</div>
            <div className="u-mute" style={{ fontSize: "var(--t-12)" }}>
              Sending on behalf of the practice
            </div>
          </div>
          <span className="u-spacer" />
          <span className={`tag ${s.waVerified ? "tag--filed" : "tag--pending"}`}>
            <i className="tag__dot" />{s.waVerified ? "Verified business" : "Unverified"}
          </span>
        </div>

        <div className="sgrid">
          <Row label="Display name" hint="What clients see as the sender">
            <Locked value={s.waName} />
          </Row>
          <Row label="Business number">
            <Locked value={s.waNumber} mono />
          </Row>
        </div>
      </Card>

      <Card
        title="Email"
        foot="This address is set up for you and can't be changed here. Replies are yours to route."
      >
        <div className="sbrand">
          <BrandIcon name="email" size={24} />
          <div>
            <div className="u-strong">{s.fromEmail}</div>
            <div className="u-mute" style={{ fontSize: "var(--t-12)" }}>
              Replies arrive at {s.replyTo || "—"}
            </div>
          </div>
        </div>

        <div className="sgrid">
          <Row label="From address" hint="Managed by KDK">
            <Locked value={s.fromEmail} />
          </Row>
          <Row label="Reply-to address" hint="Yours to set">
            <Text value={s.replyTo} onChange={(v) => updateSenderProfile({ replyTo: v })} />
          </Row>
        </div>
      </Card>
    </>
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
