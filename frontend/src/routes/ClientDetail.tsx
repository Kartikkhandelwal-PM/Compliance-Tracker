/* ============================================================================
   CLIENT DETAIL
   ----------------------------------------------------------------------------
   Three things a CA needs on one screen:

     • the profile that drives applicability — editable, because editing it is
       what re-triggers the engine
     • the full obligation timeline for the year, with status and why
     • what has been said to this client, and when

   The profile panel is placed first and shown as the engine reads it, because
   a wrong turnover slab or a stale QRMP flag is the single most common cause
   of a wrong compliance list.
   ========================================================================== */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Obligation } from "../domain/types.ts";
import { useObligations, useOutbox } from "../ui/app-state.tsx";
import { CLIENT_BY_ID, staffOf } from "../domain/book.ts";
import { decideItrForm, estimatedTax } from "../domain/rules.ts";
import { HEADS } from "../domain/catalog.ts";
import { TODAY, fmtDate, inr, inrShort } from "../domain/dates.ts";
import {
  Avatar, Countdown, Empty, HeadName, PageHead, SectionHead, Seg, Stat, StatusTag,
} from "../ui/bits.tsx";
import { BrandIcon, Icon } from "../ui/Icon.tsx";
import { ObligationDrawer } from "../ui/ObligationDrawer.tsx";

type Tab = "obligations" | "profile" | "comms";


export function ClientDetailPage() {
  const { id = "" } = useParams();
  const all = useObligations();
  const outbox = useOutbox();
  const [tab, setTab] = useState<Tab>("obligations");
  const [head, setHead] = useState("all");
  const [peek, setPeek] = useState<Obligation | null>(null);

  const client = CLIENT_BY_ID[id];

  const items = useMemo(
    () => all.filter((o) => o.clientId === id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [all, id],
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

  if (!client) {
    return <div className="page"><Empty title="Client not found" /></div>;
  }

  const p = client.profile;
  const itr = decideItrForm(p);
  const shown = head === "all" ? items : items.filter((o) => o.head === head);

  const upcoming = shown.filter((o) => o.status !== "Filed" && o.status !== "Not Applicable");
  const settled = shown.filter((o) => o.status === "Filed" || o.status === "Not Applicable");

  return (
    <div className="page">
      <PageHead
        title={client.name}
        icon="clients"
        note={<span className="num">{client.pan}</span>}
        aside={
          <Link to="/clients" className="btn btn--sm">
            <Icon name="chevronLeft" size={14} /> All clients
          </Link>
        }
      />

      {/* ---- Identity ----------------------------------------------------
           Who this is, how to reach them, and who owns them. These were
           scattered before: the registration numbers were squeezed into the
           page subtitle, contact details were buried at the bottom of the
           profile tab, and the client's own ID was not shown anywhere at all. */}
      <div className="cprofile">
        <div className="cprofile__id">
          <span className="cprofile__mono">{client.name.slice(0, 2).toUpperCase()}</span>
          <div className="cprofile__names">
            <b>{client.legalName}</b>
            <span>{client.archetype}</span>
            <span className="u-row" style={{ gap: 6, marginTop: 4 }}>
              <span className="tag tag--neutral">{p.entityType}</span>
              {p.companyType ? <span className="tag tag--outline">{p.companyType}</span> : null}
              <span className="tag tag--outline">{client.state}</span>
            </span>
          </div>
        </div>

        <dl className="cprofile__facts">
          <div><dt>PAN</dt><dd className="num">{client.pan}</dd></div>
          <div><dt>GSTIN</dt><dd className="num">{client.gstin ?? "Not registered"}</dd></div>
          {client.cin ? <div><dt>CIN</dt><dd className="num">{client.cin}</dd></div> : null}
          <div><dt>ITR form</dt><dd className="num">{itr.form}</dd></div>
          <div><dt>Turnover</dt><dd className="num">₹{inr(p.turnover)}</dd></div>
        </dl>

        <div className="cprofile__side">
          <div className="cprofile__owner">
            <span className="cprofile__k">Owner</span>
            <span className="u-row">
              <Avatar initials={staffOf(client.assigneeId).initials} />
              <span className="u-col" style={{ lineHeight: 1.2 }}>
                <b style={{ fontSize: "var(--t-13)" }}>{staffOf(client.assigneeId).name}</b>
                <span className="u-mute" style={{ fontSize: "var(--t-11)" }}>{staffOf(client.assigneeId).role}</span>
              </span>
            </span>
          </div>
          <div className="cprofile__contact">
            <span className="cprofile__k">Reachable on</span>
            <a href={`mailto:${client.email}`} className="cprofile__ch">
              <BrandIcon name="email" size={14} />
              <span className="u-truncate">{client.email}</span>
            </a>
            <span className="cprofile__ch">
              <BrandIcon name="whatsapp" size={14} />
              <span className="num">{client.phone}</span>
              {client.whatsapp
                ? <span className="tag tag--filed" style={{ marginLeft: "auto" }}><i className="tag__dot" />Opted in</span>
                : <span className="tag tag--na" style={{ marginLeft: "auto" }}>Email only</span>}
            </span>
          </div>
        </div>
      </div>

      <div className="stats" style={{ margin: "var(--s4) 0" }}>
        <Stat label="Overdue" value={counts.overdue} tone={counts.overdue ? "overdue" : undefined} icon="alert" sub={counts.exposure ? `${inrShort(counts.exposure)} late fees` : "nothing late"} />
        <Stat label="Pending" value={counts.pending} tone="cool" icon="clock" sub="upcoming this year" />
        <Stat label="Filed" value={counts.filed} tone="filed" icon="check" sub="this financial year" />
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
                      <span className="u-mute" style={{ fontSize: "var(--t-11)", marginTop: 2 }}>{o.basis}</span>
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
            for this client</b>. Compliances can appear or disappear, and scheduled reminders are
            rebuilt to match.
          </div>

          <div className="grid2">
            <ProfileCard title="Identity & status">
              <Row k="Entity / assessee type" v={p.entityType} />
              {p.companyType ? <Row k="Company type" v={p.companyType} /> : null}
              <Row k="Residential status" v={p.residential} />
              <Row k="Is LLP" v={p.isLlp} />
              <Row k="Holds a DIN" v={p.isDinHolder} />
              <Row k="Is a director" v={p.isDirector} />
              <Row k="s.139(4A)–(4D) applies" v={p.section139Special} />
            </ProfileCard>

            <ProfileCard title="Income & audit">
              <Row k="Estimated total income" v={`₹${inr(p.totalIncome)}`} mono />
              <Row k="Turnover (preceding FY)" v={`₹${inr(p.turnover)}`} mono />
              <Row k="Estimated tax liability" v={`₹${inr(estimatedTax(p))}`} mono hint="Approximate. Drives advance-tax applicability and 234A/234C exposure." />
              <Row k="Tax audit applicable" v={p.taxAuditApplicable} />
              <Row k="Business / profession income" v={p.hasBusinessIncome} />
              <Row k="Presumptive scheme opted" v={p.presumptiveOpted} />
              <Row k="Transfer pricing" v={p.hasTransferPricing} />
            </ProfileCard>

            <ProfileCard title="Income sources">
              <Row k="House properties" v={p.housePropertyCount} mono />
              <Row k="Capital gains" v={p.hasCapitalGains} />
              <Row k="Agricultural income" v={`₹${inr(p.agriculturalIncome)}`} mono />
              <Row k="Unlisted equity shares" v={p.holdsUnlistedShares} />
              <Row k="Foreign assets / income" v={p.hasForeignAssets} />
              <Row k="Partner in a firm" v={p.isPartnerInFirm} />
            </ProfileCard>

            <ProfileCard title="GST">
              <Row k="Registration type" v={p.gstRegType} />
              <Row k="QRMP opted" v={p.gstQrmpOpted} />
              <Row k="State category (QRMP)" v={p.gstStateCategory} hint="Decides whether quarterly GSTR-3B is due on the 22nd or the 24th" />
              <Row k="GSTIN" v={client.gstin ?? "—"} mono />
            </ProfileCard>

            <ProfileCard title="TDS / TCS">
              <Row k="Nature of payments made" v={p.paymentNatures.join(", ") || "—"} />
              <Row k="TDS deducted per quarter" v={`₹${inr(p.tdsPerQuarter)}`} mono hint="Caps the ₹200/day late fee under s.234E" />
            </ProfileCard>

            <ProfileCard title="Other statutory">
              <Row k="EPF covered" v={p.epfCovered} />
              <Row k="ESI covered" v={p.esiCovered} />
              <Row k="Monthly payroll" v={`₹${inr(p.monthlyPayroll)}`} mono />
              <Row k="Professional tax state" v={p.professionalTaxState ?? "Not applicable"} />
              <Row k="MSME dues beyond 45 days" v={p.msmeDuesOverdue} />
              <Row k="Deposits / exempt receipts" v={p.hasDeposits} />
            </ProfileCard>
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
        Applicability last evaluated {fmtDate(TODAY)} against the FY 2026-27 statutory calendar.
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
