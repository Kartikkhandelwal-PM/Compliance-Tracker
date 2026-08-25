/* ============================================================================
   CLIENT / FIRM / DEDUCTOR DETAIL
   ----------------------------------------------------------------------------
   Three things a CA needs on one screen:

     • the profile that drives applicability — editable, because editing it is
       what re-triggers the engine
     • the full obligation timeline for the year, with status and why
     • what has been said to this client, and when

   ONE PAGE, THREE RECORD TYPES. The `type` query param (set by the Clients
   list) says whether `id` is a Client (PAN), a GstEntity (GSTIN, labelled
   "Firm") or a TdsDeductor (TAN) — three unlinked records, never the same
   underlying business by anything the code can verify. The identity header,
   the profile cards and even the ITR-form line only render for the record
   type that actually has them; nothing here assumes the other two exist for
   the business shown.

   The profile panel is placed first and shown as the engine reads it, because
   a wrong turnover slab or a stale QRMP flag is the single most common cause
   of a wrong compliance list.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { RecordType, Obligation } from "../domain/types.ts";
import { useObligations, useOutbox } from "../ui/app-state.tsx";
import { CLIENT_BY_ID, GST_ENTITY_BY_ID, TDS_DEDUCTOR_BY_ID, staffOf } from "../domain/book.ts";
import { decideItrForm, estimatedTax } from "../domain/rules.ts";
import { updateParty } from "../domain/engine.ts";
import { FY_LABEL, FY_OPTIONS, FY_START, HEADS, fyLabel } from "../domain/catalog.ts";
import { TODAY, fmtDate, inr, inrShort } from "../domain/dates.ts";
import {
  Avatar, Countdown, Empty, HeadName, PageHead, SectionHead, Seg, Stat, StatusTag,
} from "../ui/bits.tsx";
import { BrandIcon, Icon } from "../ui/Icon.tsx";
import { ObligationDrawer } from "../ui/ObligationDrawer.tsx";

type Tab = "obligations" | "profile" | "comms";

/** IDs carry no type marker of their own (C/G/D prefixes are a seeding
 *  convenience, not a contract), so a direct visit without `?type=` — a
 *  bookmark, a typed URL — falls back to checking all three maps. The
 *  Clients list always passes `?type=`, so this path is the exception. */
function resolveType(id: string, param: string | null): RecordType {
  if (param === "GstEntity" || param === "TdsDeductor" || param === "Client") return param;
  if (GST_ENTITY_BY_ID[id]) return "GstEntity";
  if (TDS_DEDUCTOR_BY_ID[id]) return "TdsDeductor";
  return "Client";
}

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const ownerType = resolveType(id, params.get("type"));
  const all = useObligations();
  const outbox = useOutbox();
  const [tab, setTab] = useState<Tab>("obligations");
  const [head, setHead] = useState("all");
  const [peek, setPeek] = useState<Obligation | null>(null);
  const [fy, setFy] = useState(FY_START);

  const client = ownerType === "Client" ? CLIENT_BY_ID[id] : undefined;
  const gstEntity = ownerType === "GstEntity" ? GST_ENTITY_BY_ID[id] : undefined;
  const deductor = ownerType === "TdsDeductor" ? TDS_DEDUCTOR_BY_ID[id] : undefined;
  const record = client ?? gstEntity ?? deductor;

  const items = useMemo(
    () => all
      .filter((o) => o.clientId === id && o.fy === fy)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [all, id, fy],
  );

  const comms = useMemo(() => outbox.filter((e) => e.clientId === id), [outbox, id]);

  const counts = useMemo(() => {
    let filed = 0, pending = 0, overdue = 0, na = 0, exposure = 0;
    for (const o of items) {
      if (o.status === "Filed") filed++;
      else if (o.status === "Pending") pending++;
      else if (o.status === "Overdue") { overdue++; exposure += o.exposure; }
      else na++;
    }
    return { filed, pending, overdue, na, exposure };
  }, [items]);

  if (!record) {
    return <div className="page"><Empty title="Record not found" /></div>;
  }

  const itr = client ? decideItrForm(client.profile) : null;
  const idLabel = ownerType === "GstEntity" ? "GSTIN" : ownerType === "TdsDeductor" ? "TAN" : "PAN";
  const idValue = gstEntity ? gstEntity.gstin : deductor ? deductor.tan : (client?.pan ?? "");
  const turnover = client?.profile.turnover ?? gstEntity?.profile.turnover ?? deductor?.profile.turnover ?? 0;
  const typeLabel = ownerType === "GstEntity" ? "GST" : ownerType === "TdsDeductor" ? "TDS" : "ITR";

  const shown = head === "all" ? items : items.filter((o) => o.head === head);

  const upcoming = shown.filter((o) => o.status !== "Filed" && o.status !== "Not Applicable");
  const settled = shown.filter((o) => o.status === "Filed" || o.status === "Not Applicable");

  return (
    <div className="page">
      <PageHead
        title={record.name}
        icon="clients"
        note={<><span className="num">{idValue}</span> · {typeLabel}</>}
        aside={
          <div className="u-row">
            <select
              className="plain"
              value={fy}
              onChange={(e) => setFy(Number(e.target.value))}
              aria-label="Financial year"
            >
              {FY_OPTIONS.map((y) => (
                <option key={y} value={y}>{fyLabel(y)}</option>
              ))}
            </select>
            <Link to={`/clients?type=${ownerType}`} className="btn btn--sm">
              <Icon name="chevronLeft" size={14} /> All {typeLabel} records
            </Link>
          </div>
        }
      />

      {/* ---- Identity ----------------------------------------------------
           Who this is, how to reach them, and who owns them. These were
           scattered before: the registration numbers were squeezed into the
           page subtitle, contact details were buried at the bottom of the
           profile tab, and the client's own ID was not shown anywhere at all. */}
      <div className="cprofile">
        <div className="cprofile__id">
          <span className="cprofile__mono">{record.name.slice(0, 2).toUpperCase()}</span>
          <div className="cprofile__names">
            <b>{record.legalName}</b>
            <span>{record.archetype}</span>
            <span className="u-row" style={{ gap: 6, marginTop: 4 }}>
              <span className="tag tag--neutral">
                {client ? client.profile.entityType : gstEntity ? gstEntity.profile.gstRegType : "Deductor"}
              </span>
              {client?.profile.companyType ? <span className="tag tag--outline">{client.profile.companyType}</span> : null}
              <span className="tag tag--outline">{record.state}</span>
            </span>
          </div>
        </div>

        <dl className="cprofile__facts">
          <div><dt>{idLabel}</dt><dd className="num">{idValue}</dd></div>
          {client?.cin ? <div><dt>CIN</dt><dd className="num">{client.cin}</dd></div> : null}
          {itr ? <div><dt>ITR form</dt><dd className="num">{itr.form}</dd></div> : null}
          <div><dt>Turnover</dt><dd className="num">₹{inr(turnover)}</dd></div>
        </dl>

        <div className="cprofile__side">
          <div className="cprofile__owner">
            <span className="cprofile__k">Owner</span>
            <span className="u-row">
              <Avatar initials={staffOf(record.assigneeId).initials} />
              <span className="u-col" style={{ lineHeight: 1.2 }}>
                <b style={{ fontSize: "var(--t-13)" }}>{staffOf(record.assigneeId).name}</b>
                <span className="u-mute" style={{ fontSize: "var(--t-11)" }}>{staffOf(record.assigneeId).role}</span>
              </span>
            </span>
          </div>
          <div className="cprofile__contact">
            <span className="cprofile__k">Reachable on</span>
            <a href={`mailto:${record.email}`} className="cprofile__ch">
              <BrandIcon name="email" size={14} />
              <span className="u-truncate">{record.email}</span>
            </a>
            <span className="cprofile__ch">
              <BrandIcon name="whatsapp" size={14} />
              <span className="num">{record.phone}</span>
              {/* A tag reporting a fact nobody could change was a dead end —
                  the only way to fix a client wrongly marked opted in (or to
                  record that they've now agreed to it) was to edit the seed
                  data. This is the one place that consent gets recorded, so
                  it has to be a control. A switch, not a clickable tag — a
                  coloured chip that happens to respond to a click reads as a
                  status label, not as something to act on. */}
              <span className="u-row" style={{ marginLeft: "auto", gap: 6 }}>
                <span className="u-mute" style={{ fontSize: "var(--t-11)" }}>
                  {record.whatsapp ? "Opted in" : "Email only"}
                </span>
                <button
                  type="button"
                  className={`switch${record.whatsapp ? " is-on" : ""}`}
                  onClick={() => updateParty(ownerType, record.id, { whatsapp: !record.whatsapp })}
                  aria-pressed={record.whatsapp}
                  aria-label="WhatsApp opt-in"
                  title={record.whatsapp
                    ? "Opted in to WhatsApp. Click to switch this client to email only"
                    : "Email only. Click if this client has agreed to WhatsApp"}
                />
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="stats" style={{ margin: "var(--s4) 0" }}>
        <Stat label="Overdue" value={counts.overdue} tone={counts.overdue ? "overdue" : undefined} icon="alert" sub={counts.exposure ? `${inrShort(counts.exposure)} late fees` : "nothing late"} />
        <Stat label="Pending" value={counts.pending} tone="cool" icon="clock" sub={`upcoming in ${fyLabel(fy)}`} />
        <Stat label="Filed" value={counts.filed} tone="filed" icon="check" sub={fyLabel(fy)} />
        <Stat label="Not applicable" value={counts.na} icon="ban" sub="rule-excluded or overridden" />
      </div>

      <div className="filters">
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "obligations", label: `Obligations (${items.length})` },
            { value: "profile", label: "Compliance profile" },
            { value: "comms", label: `Communications (${comms.length})` },
          ]}
        />
        {tab === "obligations" ? (
          <select className="plain" value={head} onChange={(e) => setHead(e.target.value)}>
            <option value="all">All heads</option>
            {HEADS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        ) : null}
      </div>

      {/* ================= OBLIGATIONS ================= */}
      {tab === "obligations" ? (
        <>
          <SectionHead icon="outbox" title="Open" note={`${upcoming.length} items. Click any row for the rule behind it.`} />
          <div className="sheet">
            <div className="sheet__body">
              {upcoming.length === 0 ? (
                <Empty title="Nothing open">Every applicable compliance for this client is filed or ruled out.</Empty>
              ) : (
                <div className="tl">
                  {upcoming.map((o) => (
                    <button type="button" className="tlrow" key={o.id} onClick={() => setPeek(o)}>
                      <span className={`tlrow__node n-${o.status === "Overdue" ? "overdue" : "pending"}`} />
                      <span className="u-col" style={{ flex: 1, minWidth: 0 }}>
                        <span className="u-row">
                          <b className="num">{o.form}</b>
                          <span className="u-mute">{o.periodLabel}</span>
                        </span>
                        <span className="u-row" style={{ marginTop: 2 }}>
                          <HeadName head={o.head} />
                          <span className="u-faint" style={{ fontSize: "var(--t-11)" }}>{o.rule.ruleRef}</span>
                        </span>
                      </span>
                      <span className="num u-mute u-nowrap">{fmtDate(o.dueDate)}</span>
                      <span style={{ width: 110, textAlign: "right" }}><Countdown due={o.dueDate} /></span>
                      <span style={{ width: 96, textAlign: "right" }} className="num">
                        {o.exposure ? <b style={{ color: "var(--st-overdue-fg)" }}>₹{inr(o.exposure)}</b> : <span className="u-faint">—</span>}
                      </span>
                      <StatusTag status={o.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SectionHead icon="check" title="Settled" note={`${settled.length} filed or not applicable`} />
          <div className="sheet">
            <div className="sheet__body">
              <div className="tl">
                {settled.map((o) => (
                  <button type="button" className="tlrow" key={o.id} onClick={() => setPeek(o)}>
                    <span className={`tlrow__node n-${o.status === "Filed" ? "filed" : "na"}`} />
                    <span className="u-col" style={{ flex: 1, minWidth: 0 }}>
                      <span className="u-row">
                        <b className="num">{o.form}</b>
                        <span className="u-mute">{o.periodLabel}</span>
                        {o.override ? <span className="tag tag--outline">override</span> : null}
                      </span>
                      <span className="u-mute" style={{ fontSize: "var(--t-11)", marginTop: 2 }}>
                        {o.basis}
                        {o.arn ? <> · <span className="num">{o.arn}</span></> : null}
                        {o.filedBy ? ` · ${o.filedBy}` : null}
                      </span>
                    </span>
                    <span className="num u-mute u-nowrap">{o.filedOn ? fmtDate(o.filedOn) : fmtDate(o.dueDate)}</span>
                    <StatusTag status={o.status} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* ================= PROFILE ================= */}
      {tab === "profile" ? (
        <>
          <div className="note" style={{ marginBottom: "var(--s5)" }}>
            These are the fields the rule engine reads. <b>Changing any of them re-runs applicability
            for this record</b>. Compliances can appear or disappear, and scheduled
            reminders are rebuilt to match.
          </div>

          <div className="grid2">
            {client ? (
              <>
                <ProfileCard title="Identity & status">
                  <Row k="Entity / assessee type" v={client.profile.entityType} />
                  {client.profile.companyType ? <Row k="Company type" v={client.profile.companyType} /> : null}
                  <Row k="Residential status" v={client.profile.residential} />
                  <Row k="Is LLP" v={client.profile.isLlp} />
                  <Row k="Holds a DIN" v={client.profile.isDinHolder} />
                  <Row k="Is a director" v={client.profile.isDirector} />
                  <Row k="s.139(4A)–(4D) applies" v={client.profile.section139Special} />
                </ProfileCard>

                <ProfileCard title="Income & audit">
                  <Row k="Estimated total income" v={`₹${inr(client.profile.totalIncome)}`} mono />
                  <Row k="Turnover (preceding FY)" v={`₹${inr(client.profile.turnover)}`} mono />
                  <Row k="Estimated tax liability" v={`₹${inr(estimatedTax(client.profile))}`} mono hint="Approximate. Drives advance-tax applicability and 234A/234C exposure." />
                  <Row k="Tax audit applicable" v={client.profile.taxAuditApplicable} />
                  <Row k="Business / profession income" v={client.profile.hasBusinessIncome} />
                  <Row k="Presumptive scheme opted" v={client.profile.presumptiveOpted} />
                  <Row k="Transfer pricing" v={client.profile.hasTransferPricing} />
                </ProfileCard>

                <ProfileCard title="Income sources">
                  <Row k="House properties" v={client.profile.housePropertyCount} mono />
                  <Row k="Capital gains" v={client.profile.hasCapitalGains} />
                  <Row k="Agricultural income" v={`₹${inr(client.profile.agriculturalIncome)}`} mono />
                  <Row k="Unlisted equity shares" v={client.profile.holdsUnlistedShares} />
                  <Row k="Foreign assets / income" v={client.profile.hasForeignAssets} />
                  <Row k="Partner in a firm" v={client.profile.isPartnerInFirm} />
                </ProfileCard>

                <ProfileCard title="ROC / MCA">
                  <Row k="Deposits / exempt receipts" v={client.profile.hasDeposits} />
                  <Row k="MSME dues beyond 45 days" v={client.profile.msmeDuesOverdue} />
                  <Row k="Claims s.11 exemption" v={client.profile.claimsSection11} />
                </ProfileCard>
              </>
            ) : null}

            {gstEntity ? (
              <ProfileCard title="GST registration">
                <Row k="GSTIN" v={gstEntity.gstin} mono />
                <Row k="Registration type" v={gstEntity.profile.gstRegType} />
                <Row k="QRMP opted" v={gstEntity.profile.gstQrmpOpted} />
                <Row k="State category (QRMP)" v={gstEntity.profile.gstStateCategory} hint="Decides whether quarterly GSTR-3B is due on the 22nd or the 24th" />
                <Row k="Turnover (preceding FY)" v={`₹${inr(gstEntity.profile.turnover)}`} mono />
              </ProfileCard>
            ) : null}

            {deductor ? (
              <>
                <ProfileCard title="TDS / TCS">
                  <Row k="TAN" v={deductor.tan} mono />
                  <Row k="Entity type" v={deductor.profile.entityType} />
                  <Row k="Tax audit applicable (preceding FY)" v={deductor.profile.taxAuditApplicable} />
                  <Row k="Nature of payments made" v={deductor.profile.paymentNatures.join(", ") || "—"} />
                  <Row k="TDS deducted per quarter" v={`₹${inr(deductor.profile.tdsPerQuarter)}`} mono hint="Caps the ₹200/day late fee under s.234E" />
                  <Row k="Turnover (preceding FY)" v={`₹${inr(deductor.profile.turnover)}`} mono hint="Drives the 27EQ (TCS) turnover threshold" />
                </ProfileCard>

                <ProfileCard title="Payroll & other statutory">
                  <Row k="EPF covered" v={deductor.profile.epfCovered} />
                  <Row k="ESI covered" v={deductor.profile.esiCovered} />
                  <Row k="Monthly payroll" v={`₹${inr(deductor.profile.monthlyPayroll)}`} mono />
                  <Row k="Professional tax state" v={deductor.profile.professionalTaxState ?? "Not applicable"} />
                </ProfileCard>
              </>
            ) : null}
          </div>

        </>
      ) : null}

      {/* ================= COMMS ================= */}
      {tab === "comms" ? (
        <div className="sheet">
          {comms.length === 0 ? (
            <Empty title="Nothing sent yet">
              Reminders are triggered from the due dates on this client's obligations. Nothing has met a
              trigger for this client.
            </Empty>
          ) : (
            <table className="ltable ltable--plain">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Channel</th>
                  <th>Stage</th>
                  <th>Message</th>
                  <th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {comms.map((e) => (
                  <tr key={e.id}>
                    <td className="num u-nowrap">{fmtDate(e.sentAt)}</td>
                    <td>
                      <span className="u-row">
                        <Icon name={e.channel === "WhatsApp" ? "send" : "outbox"} size={14} />
                        {e.channel}
                      </span>
                    </td>
                    <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{e.stage}</td>
                    <td className="u-truncate" style={{ maxWidth: 420, fontSize: "var(--t-12)" }}>{e.preview}</td>
                    <td>
                      <span className={`tag ${e.status === "Failed" ? "tag--overdue" : e.status.startsWith("Queued") ? "tag--pending" : "tag--filed"}`}>
                        <i className="tag__dot" />{e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      <ObligationDrawer obligation={peek} onClose={() => setPeek(null)} />

      <p className="u-faint" style={{ fontSize: "var(--t-11)", marginTop: "var(--s8)" }}>
        Applicability last evaluated {fmtDate(TODAY)} against the {FY_LABEL} statutory calendar.
      </p>
    </div>
  );
}

function ProfileCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sheet">
      <div className="sheet__head"><span className="sheet__title">{title}</span></div>
      <div className="sheet__body" style={{ paddingBlock: 0 }}>
        <dl className="deflist" style={{ gridTemplateColumns: "1fr auto" }}>{children}</dl>
      </div>
    </div>
  );
}

function Row({ k, v, mono, hint }: { k: string; v: string | number | boolean; mono?: boolean; hint?: string }) {
  const isBool = typeof v === "boolean";
  return (
    <>
      <dt title={hint}>
        {k}
        {hint ? <Icon name="info" size={11} style={{ marginLeft: 4, verticalAlign: -1, opacity: 0.6 }} /> : null}
      </dt>
      <dd className={mono ? "num u-right" : "u-right"}>
        {isBool
          ? <span className={`tag ${v ? "tag--filed" : "tag--na"}`}><i className="tag__dot" />{v ? "Yes" : "No"}</span>
          : String(v)}
      </dd>
    </>
  );
}
