/* ============================================================================
   CLIENT DETAIL — one PAN and everything registered under it
   ----------------------------------------------------------------------------
   A client is a PAN. Under it sit its income-tax and ROC filings (on the PAN
   itself), any number of GSTINs and any number of TANs. This page shows all
   of it in one place:

     • a header with what is common to the whole client: identity, PAN, owner,
       and the client's main contact. The owner is set once and copied to
       every GSTIN and TAN; contact details are each registration's own.
     • tabs: Overview, Income tax and ROC, GST, TDS, Messages. Each tab
       carries its own status dot, so a late branch GSTIN shows on the GST
       tab without opening it.
     • Overview draws the client as a tree, PAN → Income tax / GST → each
       GSTIN / TDS → each TAN, with every node clickable, then lists what is
       due next across all of them.
     • GST and TDS open on all of that client's GSTINs (or TANs) together,
       with a pill per registration to narrow to one. One registration shows
       its contact, its filings and the profile the rule engine reads.

   The selection lives in `?reg=` so a link from anywhere else (a tracker
   row, a drawer, search) can open the client with the right GSTIN or TAN
   already selected — see `clientPath()` in book.ts.
   ========================================================================== */

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import type { Client, FilingStatus, GstEntity, Head, Obligation, Party, RecordType, TdsDeductor } from "../domain/types.ts";
import { useApp, useEngine, useObligations, useOutbox } from "../ui/app-state.tsx";
import { NoticeDrawer, NoticeTable } from "../ui/Notices.tsx";
import { isOpen } from "../domain/notices.ts";
import {
  CLIENT_BY_ID, GSTINS_BY_CLIENT, GST_ENTITY_BY_ID, TANS_BY_CLIENT, TDS_DEDUCTOR_BY_ID,
  clientPath, staffOf,
} from "../domain/book.ts";
import { decideItrForm, estimatedTax } from "../domain/rules.ts";
import { getNotices, updateClientParty, updateParty } from "../domain/engine.ts";
import { FY_LABEL, FY_OPTIONS, FY_START, fyLabel } from "../domain/catalog.ts";
import { TODAY, addDays, fmtDate, inr, inrShort } from "../domain/dates.ts";
import {
  Countdown, Empty, HeadName, PageHead, Pbar, SectionHead, Seg, StatusTag, initialsOf,
} from "../ui/bits.tsx";
import { BrandIcon, Icon } from "../ui/Icon.tsx";
import type { IconName } from "../ui/Icon.tsx";
import { ObligationDrawer } from "../ui/ObligationDrawer.tsx";
import { HeadArt, HeadIcon } from "../ui/HeadArt.tsx";
import { Drawer } from "../ui/Drawer.tsx";
import { OwnerSelect } from "../ui/OwnerSelect.tsx";

/* ---- Registrations ------------------------------------------------------- */

/** One registration the client holds — the PAN itself, a GSTIN or a TAN.
 *  `id` is the record id obligations are filed under. */
interface Reg {
  kind: RecordType;
  id: string;
  /** PAN / GSTIN / TAN */
  number: string;
  /** "Income tax and ROC", "Gujarat", "Pune branch" */
  title: string;
  sub: string;
  party: Party;
}

/** What is selected: a fixed view or one registration's record id. */
type Node = "overview" | "structure" | "gst" | "tds" | "notices" | "messages" | string;
type TabKey = "overview" | "structure" | "itr" | "gst" | "tds" | "notices" | "messages";

interface Tally {
  filed: number;
  pending: number;
  overdue: number;
  na: number;
  exposure: number;
  /** The soonest filing not yet due — overdue ones are counted separately. */
  next?: Obligation;
}

function tally(list: Obligation[]): Tally {
  const t: Tally = { filed: 0, pending: 0, overdue: 0, na: 0, exposure: 0 };
  for (const o of list) {
    if (o.status === "Filed") t.filed++;
    else if (o.status === "Pending") t.pending++;
    else if (o.status === "Overdue") { t.overdue++; t.exposure += o.exposure; }
    else t.na++;
    if (o.status === "Pending" && o.dueDate >= TODAY && (!t.next || o.dueDate < t.next.dueDate)) t.next = o;
  }
  return t;
}

/** One dot per node: red when something is late, blue when work is open,
 *  green when everything is filed, grey when nothing applies this year. */
function tone(t: Tally): "overdue" | "pending" | "filed" | "na" {
  if (t.overdue) return "overdue";
  if (t.pending) return "pending";
  if (t.filed) return "filed";
  return "na";
}

const KIND_LABEL: Record<RecordType, string> = { Client: "PAN", GstEntity: "GSTIN", TdsDeductor: "TAN" };
const KIND_HEAD: Record<RecordType, { cls: string; mark: string; name: string }> = {
  Client: { cls: "head-it", mark: "IT", name: "Income tax" },
  GstEntity: { cls: "head-gst", mark: "G", name: "GST" },
  TdsDeductor: { cls: "head-tds", mark: "T", name: "TDS" },
};

function regsOf(client: Client): { itr: Reg; gst: Reg[]; tds: Reg[] } {
  return {
    itr: {
      kind: "Client", id: client.id, number: client.pan, title: "Income tax and ROC",
      sub: "Filed on the PAN", party: client,
    },
    gst: (GSTINS_BY_CLIENT[client.id] ?? []).map((g: GstEntity) => ({
      kind: "GstEntity" as const, id: g.id, number: g.gstin, title: g.state,
      sub: `${g.label} · ${g.profile.gstRegType}${g.profile.gstQrmpOpted ? " · QRMP" : ""}`, party: g,
    })),
    tds: (TANS_BY_CLIENT[client.id] ?? []).map((d: TdsDeductor) => ({
      kind: "TdsDeductor" as const, id: d.id, number: d.tan, title: d.label, sub: d.state, party: d,
    })),
  };
}

/** A registration with the client's own email and phone is "same as client". */
function sameContact(a: Party, b: Party): boolean {
  return a.email === b.email && a.phone === b.phone;
}

/** One person reminders can go to, with every registration that uses them.
 *  Identified by email + phone: the same person entered twice is one contact. */
interface Contact {
  key: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: boolean;
  emailEnabled: boolean;
  usedBy: Reg[];
}

function contactKey(p: Party): string {
  return `${p.email}|${p.phone}`;
}

function contactsOf(client: Client, regs: { itr: Reg; gst: Reg[]; tds: Reg[] }): Contact[] {
  const map = new Map<string, Contact>();
  for (const r of [regs.itr, ...regs.gst, ...regs.tds]) {
    const p = r.party;
    const k = contactKey(p);
    const c = map.get(k);
    if (c) c.usedBy.push(r);
    else {
      map.set(k, {
        key: k, name: p.contactName ?? client.legalName, email: p.email, phone: p.phone,
        whatsapp: p.whatsapp, emailEnabled: p.emailEnabled, usedBy: [r],
      });
    }
  }
  return [...map.values()];
}

/* ---- Page ---------------------------------------------------------------- */

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const all = useObligations();
  const outbox = useOutbox();
  const { toast } = useApp();
  const [peek, setPeek] = useState<Obligation | null>(null);
  const [fy, setFy] = useState(FY_START);
  /* The registration whose contact is being changed, if any. */
  const [switching, setSwitching] = useState<Reg | null>(null);
  const [noticePeek, setNoticePeek] = useState<string | null>(null);
  const allNotices = useEngine(getNotices);

  const client = CLIENT_BY_ID[id];

  /* Every record id under this PAN, mapped to its registration — the join
     that lets one filter pick up obligations from all of them. */
  const regs = useMemo(() => (client ? regsOf(client) : null), [client]);
  const regById = useMemo(() => {
    const m = new Map<string, Reg>();
    if (regs) for (const r of [regs.itr, ...regs.gst, ...regs.tds]) m.set(r.id, r);
    return m;
  }, [regs]);

  const items = useMemo(
    () => all
      .filter((o) => o.fy === fy && regById.has(o.clientId))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [all, fy, regById],
  );
  const byReg = useMemo(() => {
    const m = new Map<string, Obligation[]>();
    for (const o of items) {
      const list = m.get(o.clientId);
      if (list) list.push(o);
      else m.set(o.clientId, [o]);
    }
    return m;
  }, [items]);
  const comms = useMemo(() => outbox.filter((e) => regById.has(e.clientId)), [outbox, regById]);
  /* Open ones first, soonest reply date first; closed ones after. */
  const clientNotices = useMemo(
    () => allNotices
      .filter((n) => n.clientId === id)
      .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || a.replyDue.localeCompare(b.replyDue)),
    [allNotices, id],
  );

  /* An old link to a GSTIN or TAN's own page (from before clients were
     merged) lands on its client with that registration selected. */
  if (!client) {
    const g = GST_ENTITY_BY_ID[id];
    const d = TDS_DEDUCTOR_BY_ID[id];
    if (g) return <Navigate to={clientPath("GstEntity", g.id)} replace />;
    if (d) return <Navigate to={clientPath("TdsDeductor", d.id)} replace />;
    return <div className="page"><Empty title="Client not found" /></div>;
  }
  if (!regs) return null;

  const raw = params.get("reg") ?? "overview";
  const node: Node = raw === "itr" ? client.id
    : raw === "overview" || raw === "structure" || raw === "notices" || raw === "messages" || regById.has(raw) ? raw
      : raw === "gst" && regs.gst.length ? raw
        : raw === "tds" && regs.tds.length ? raw
          : "overview";
  const tab: TabKey = node === "overview" || node === "structure" || node === "notices" || node === "messages" || node === "gst" || node === "tds" ? node
    : node === client.id ? "itr"
      : regById.get(node)?.kind === "GstEntity" ? "gst" : "tds";

  const select = (n: Node) => {
    /* A GST or TDS tab with a single registration opens straight on it —
       an "all GSTINs" view of one GSTIN would be the same page twice. */
    if (n === "gst" && regs.gst.length === 1) n = regs.gst[0].id;
    if (n === "tds" && regs.tds.length === 1) n = regs.tds[0].id;
    const next = new URLSearchParams(params);
    if (n === "overview") next.delete("reg");
    else next.set("reg", n === client.id ? "itr" : n);
    setParams(next, { replace: true });
  };

  const of = (regId: string) => byReg.get(regId) ?? [];
  const gstItems = regs.gst.flatMap((r) => of(r.id));
  const tdsItems = regs.tds.flatMap((r) => of(r.id));
  const itr = decideItrForm(client.profile);
  const contacts = contactsOf(client, regs);

  const copy = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    toast(`${label} copied`);
  };

  return (
    <div className="page page--wide">
      <PageHead
        title={client.name}
        icon="clients"
        note={<><span className="num">{client.pan}</span> · {client.profile.entityType}</>}
        aside={
          <div className="u-row">
            <select
              className="plain fysel"
              value={fy}
              onChange={(e) => setFy(Number(e.target.value))}
              aria-label="Financial year"
            >
              {FY_OPTIONS.map((y) => (
                <option key={y} value={y}>{fyLabel(y)}</option>
              ))}
            </select>
            <Link to="/clients" className="btn btn--sm">
              <Icon name="chevronLeft" size={14} /> All clients
            </Link>
          </div>
        }
      />

      {/* ---- Common details --------------------------------------------
           What holds for the whole client whichever tab is open below. */}
      <div className="cprofile">
        <div className="cprofile__id">
          <span className="cprofile__mono">{client.name.slice(0, 2).toUpperCase()}</span>
          <div className="cprofile__names">
            {/* The page title already says the name. The legal name is only
                worth repeating when it differs (a trading name over a
                registered one); otherwise the description leads. */}
            {client.legalName.trim().toLowerCase() !== client.name.trim().toLowerCase() ? (
              <>
                <b>{client.legalName}</b>
                <span>{client.archetype}</span>
              </>
            ) : (
              <b className="cprofile__desc">{client.archetype}</b>
            )}
            <span className="u-row" style={{ gap: 6, marginTop: 4 }}>
              <span className="tag tag--neutral">{client.profile.entityType}</span>
              {client.profile.companyType ? <span className="tag tag--outline">{client.profile.companyType}</span> : null}
            </span>
            {/* A company's CIN is 21 characters, too long for a cell in the
                grid, so it sits here with the rest of who they are. */}
            {client.cin ? (
              <span className="cprofile__cinline">
                <small>CIN</small>
                <button type="button" className="cd-copy num" onClick={() => copy("CIN", client.cin!)} title="Copy CIN">
                  {client.cin} <Icon name="copy" size={11} />
                </button>
              </span>
            ) : null}
          </div>
        </div>

        <dl className="cprofile__facts">
          <div>
            <dt>PAN</dt>
            <dd className="num">
              <button type="button" className="cd-copy" onClick={() => copy("PAN", client.pan)} title="Copy PAN">
                {client.pan} <Icon name="copy" size={12} />
              </button>
            </dd>
          </div>
          <div><dt>ITR form</dt><dd className="num">{itr.form}</dd></div>
          <div><dt>Turnover</dt><dd className="num">₹{inr(client.profile.turnover)}</dd></div>
          <div><dt>GSTINs</dt><dd className="num">{regs.gst.length}</dd></div>
          <div><dt>TANs</dt><dd className="num">{regs.tds.length}</dd></div>
          <div><dt>State</dt><dd title={client.state}>{client.state}</dd></div>
        </dl>

        <div className="cprofile__side">
          <div className="cprofile__owner">
            <span className="cprofile__k">Owner</span>
            {/* Sets who is responsible for this client and every GSTIN and
                TAN under it from now on. Obligations already assigned keep
                their owner; RunDetail's "Assign to…" reassigns those. */}
            <OwnerSelect
              value={client.assigneeId}
              onChange={(id) => {
                updateClientParty(client.id, { assigneeId: id });
                toast(`Owner changed to ${staffOf(id).name}`);
              }}
              ariaLabel="Change owner"
            />
          </div>
          <div className="cprofile__contact">
            <span className="cprofile__k cd-k">
              Main contact
              <button type="button" className="cd-link" onClick={() => setSwitching(regs.itr)}>Change</button>
            </span>
            {client.contactName ? <span className="cd-reghead__who">{client.contactName}</span> : null}
            {/* The PAN's own contact: income-tax and ROC reminders go here.
                Each GSTIN and TAN keeps its own, shown on its tab. */}
            <ChannelSwitches kind="Client" party={client} />
          </div>
        </div>
      </div>

      {/* ---- Tabs -------------------------------------------------------
           One contained bar: the selected tab lifts out as a white chip, so
           where you are reads at a glance. Head tabs are plain text with a
           count; their status is on the Overview, not repeated here. */}
      <div className="cd-tabs" role="tablist">
        <TabBtn on={tab === "overview"} onClick={() => select("overview")} icon="clients" label="Overview" />
        <TabBtn on={tab === "structure"} onClick={() => select("structure")} icon="tree" label="Structure" />
        <span className="cd-tabs__sep" aria-hidden />
        <TabBtn
          on={tab === "itr"} onClick={() => select(client.id)}
          art="itr" label="Income tax and ROC"
        />
        {regs.gst.length ? (
          <TabBtn
            on={tab === "gst"} onClick={() => select("gst")}
            art="gst" label="GST" count={regs.gst.length}
          />
        ) : null}
        {regs.tds.length ? (
          <TabBtn
            on={tab === "tds"} onClick={() => select("tds")}
            art="tds" label="TDS" count={regs.tds.length}
          />
        ) : null}
        <span className="cd-tabs__sep" aria-hidden />
        <TabBtn on={tab === "notices"} onClick={() => select("notices")} icon="notice" label="Notices" count={clientNotices.length} />
        <TabBtn on={tab === "messages"} onClick={() => select("messages")} icon="send" label="Messages" count={comms.length} />
      </div>

      {/* ---- Tab content ------------------------------------------------ */}
      {tab === "overview" ? (
        <OverviewPane
          client={client} regs={regs} of={of}
          gstItems={gstItems} tdsItems={tdsItems}
          onSelect={select} onPeek={setPeek} regById={regById} items={items}
        />
      ) : tab === "structure" ? (
        <StructurePane
          client={client} regs={regs} of={of}
          gstItems={gstItems} tdsItems={tdsItems} onSelect={select}
        />
      ) : tab === "notices" ? (
        <div className="sheet">
          <NoticeTable
            list={clientNotices}
            showClient={false}
            onOpen={(n) => setNoticePeek(n.id)}
            empty="No notices for this client."
          />
        </div>
      ) : tab === "messages" ? (
        <MessagesPane comms={comms} regById={regById} />
      ) : tab === "itr" ? (
        <>
          <HeadBanner
            art="itr" cls="Client" title="Income tax and ROC"
            sub={<>{itr.form} · <button type="button" className="cd-copy num" onClick={() => copy("PAN", client.pan)}>PAN {client.pan} <Icon name="copy" size={12} /></button></>}
            t={tally(of(client.id))}
          />
          <RegPane key={client.id} reg={regs.itr} list={of(client.id)} client={client} onPeek={setPeek} onCopy={copy} onSwitch={setSwitching} />
        </>
      ) : (
        <>
          {tab === "gst" ? (
            <HeadBanner
              art="gst" cls="GstEntity" title="GST"
              sub={`${regs.gst.length} ${regs.gst.length === 1 ? "GSTIN" : "GSTINs"} under this PAN`}
              t={tally(gstItems)}
            />
          ) : (
            <HeadBanner
              art="tds" cls="TdsDeductor" title="TDS"
              sub={`${regs.tds.length} ${regs.tds.length === 1 ? "TAN" : "TANs"} · quarterly returns`}
              t={tally(tdsItems)}
            />
          )}
          {/* One pill per GSTIN (or TAN), plus "All". Hidden when there is
              only one, since the tab already opens straight on it. */}
          {(tab === "gst" ? regs.gst : regs.tds).length > 1 ? (
            <div className="cd-pills" role="tablist">
              <button
                type="button"
                className={`cd-pill${node === tab ? " is-on" : ""}`}
                onClick={() => select(tab)}
              >
                <b>All {tab === "gst" ? "GSTINs" : "TANs"}</b>
              </button>
              {(tab === "gst" ? regs.gst : regs.tds).map((r) => (
                <button
                  type="button" key={r.id}
                  className={`cd-pill${node === r.id ? " is-on" : ""}`}
                  onClick={() => select(r.id)}
                >
                  <i className={`cd-dot cd-dot--${tone(tally(of(r.id)))}`} />
                  <b>{r.title}</b>
                  <small className="num">{r.number}</small>
                </button>
              ))}
            </div>
          ) : null}
          {node === "gst" || node === "tds" ? (
            <GroupPane
              key={node}
              kind={node === "gst" ? "GstEntity" : "TdsDeductor"}
              list={node === "gst" ? gstItems : tdsItems}
              regs={node === "gst" ? regs.gst : regs.tds}
              client={client} regById={regById} of={of} onSelect={select} onPeek={setPeek}
            />
          ) : (
            <RegPane
              key={node}
              reg={regById.get(node)!} list={of(node)} client={client}
              onPeek={setPeek} onCopy={copy} onSwitch={setSwitching}
            />
          )}
        </>
      )}

      <ObligationDrawer obligation={peek} onClose={() => setPeek(null)} />
      <NoticeDrawer notice={noticePeek ? allNotices.find((n) => n.id === noticePeek) ?? null : null} onClose={() => setNoticePeek(null)} />
      {switching ? (
        <ContactDrawer
          key={switching.id}
          reg={switching}
          contacts={contacts}
          onClose={() => setSwitching(null)}
          onDone={(name) => {
            toast(`Reminders for ${switching.kind === "Client" ? "the PAN" : `${KIND_LABEL[switching.kind]} ${switching.number}`} will now go to ${name}`);
            setSwitching(null);
          }}
        />
      ) : null}

      <p className="u-faint" style={{ fontSize: "var(--t-11)", marginTop: "var(--s8)" }}>
        Applicability last evaluated {fmtDate(TODAY)} against the {FY_LABEL} statutory calendar.
      </p>
    </div>
  );
}

/* ---- Small pieces -------------------------------------------------------- */

function HeadMark({ kind, size }: { kind: RecordType; size?: "lg" | "sm" }) {
  const h = KIND_HEAD[kind];
  return <span className={`cd-mark ${h.cls}${size ? ` cd-mark--${size}` : ""}`}>{h.mark}</span>;
}

function TabBtn({
  on, onClick, label, icon, art, count,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  icon?: IconName;
  /** The head's small illustration, for the Income tax / GST / TDS tabs. */
  art?: "itr" | "gst" | "tds";
  count?: number;
}) {
  return (
    <button type="button" role="tab" aria-selected={on} className={`cd-tab${on ? " is-on" : ""}`} onClick={onClick}>
      {art ? <HeadIcon kind={art} /> : icon ? <Icon name={icon} size={15} /> : null}
      {label}
      {count !== undefined ? <span className="cd-tab__n num">{count}</span> : null}
    </button>
  );
}

/** Email and WhatsApp for one record, each with its reminder switch.
 *  Turning a channel off is what stops that channel's reminders for this
 *  record (see `whatsapp` / `emailEnabled` in engine.ts). */
function ChannelSwitches({ kind, party }: { kind: RecordType; party: Party }) {
  return (
    <>
      <span className="cprofile__ch">
        <BrandIcon name="email" size={14} />
        <a href={`mailto:${party.email}`} className="u-truncate" style={{ color: "inherit", flex: 1 }} title={party.email}>
          {party.email}
        </a>
        <button
          type="button"
          className={`switch${party.emailEnabled ? " is-on" : ""}`}
          style={{ marginLeft: "auto", flexShrink: 0 }}
          onClick={() => updateParty(kind, party.id, { emailEnabled: !party.emailEnabled })}
          aria-pressed={party.emailEnabled}
          aria-label="Email reminders"
          title={party.emailEnabled ? "Email reminders are on. Click to turn them off" : "Email reminders are off. Click to turn them on"}
        />
      </span>
      <span className="cprofile__ch">
        <BrandIcon name="whatsapp" size={14} />
        <span className="num u-truncate" style={{ flex: 1 }} title={party.phone}>{party.phone}</span>
        <button
          type="button"
          className={`switch${party.whatsapp ? " is-on" : ""}`}
          style={{ marginLeft: "auto", flexShrink: 0 }}
          onClick={() => updateParty(kind, party.id, { whatsapp: !party.whatsapp })}
          aria-pressed={party.whatsapp}
          aria-label="WhatsApp reminders"
          title={party.whatsapp ? "WhatsApp reminders are on. Click to turn them off" : "WhatsApp reminders are off. Click to turn them on"}
        />
      </span>
    </>
  );
}

/** "Income tax and ROC", "GST · Kerala", "TDS · Pune branch" */
function regName(r: Reg): string {
  return r.kind === "Client" ? "Income tax and ROC" : `${KIND_HEAD[r.kind].name} · ${r.title}`;
}

/** Who a registration's reminders go to, by name. */
function contactName(r: Reg, client: Client): string {
  if (r.kind !== "Client" && sameContact(r.party, client)) return "Main contact";
  return r.party.contactName ?? client.legalName;
}


/* ---- Overview ---------------------------------------------------------------
   A dashboard for one client, not a second structure view (that is the
   Structure tab). Top to bottom:

     1. One card per head (Income tax and ROC, GST, TDS) with its own
        illustration: how that head stands and what is due next. A head the
        client is not registered for shows a quiet empty card.
     2. What needs action: delayed, due this week, coming up. */

function OverviewPane({
  client, regs, of, gstItems, tdsItems, onSelect, onPeek, regById, items,
}: {
  client: Client;
  regs: { itr: Reg; gst: Reg[]; tds: Reg[] };
  of: (id: string) => Obligation[];
  gstItems: Obligation[];
  tdsItems: Obligation[];
  onSelect: (n: Node) => void;
  onPeek: (o: Obligation) => void;
  regById: Map<string, Reg>;
  items: Obligation[];
}) {
  const itr = decideItrForm(client.profile);
  const qrmp = regs.gst.filter((r) => GST_ENTITY_BY_ID[r.id]?.profile.gstQrmpOpted).length;

  return (
    <>
      <div className="cd-heads">
        <HeadCard
          art="itr" cls="Client" title="Income tax and ROC"
          sub={`${itr.form} · filed on the PAN`}
          t={tally(of(client.id))} onOpen={() => onSelect(client.id)}
        />
        <HeadCard
          art="gst" cls="GstEntity" title="GST"
          sub={regs.gst.length
            ? `${regs.gst.length} ${regs.gst.length === 1 ? "GSTIN" : "GSTINs"} · ${qrmp === regs.gst.length ? "quarterly (QRMP)" : qrmp ? "monthly and QRMP" : "monthly"}`
            : "Not registered for GST"}
          t={regs.gst.length ? tally(gstItems) : undefined} onOpen={() => onSelect("gst")}
        />
        <HeadCard
          art="tds" cls="TdsDeductor" title="TDS"
          sub={regs.tds.length ? `${regs.tds.length} ${regs.tds.length === 1 ? "TAN" : "TANs"} · quarterly returns` : "No TAN"}
          t={regs.tds.length ? tally(tdsItems) : undefined} onOpen={() => onSelect("tds")}
        />
      </div>

      <ActionBoard items={items} regById={regById} onPeek={onPeek} />
    </>
  );
}

/* ---- What needs action ------------------------------------------------------
   Three columns by urgency, so the whole picture is visible at once and the
   reader can work left to right: what is already late, what falls due this
   week, what is coming in the next 30 days. Each filing opens its drawer,
   where it can be marked filed or the client reminded. */

const BOARD_SHOW = 4;

function ActionBoard({
  items, regById, onPeek,
}: {
  items: Obligation[];
  regById: Map<string, Reg>;
  onPeek: (o: Obligation) => void;
}) {
  const week = addDays(TODAY, 7);
  const month = addDays(TODAY, 30);
  const delayed = items
    .filter((o) => o.status === "Overdue")
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.exposure - a.exposure);
  const thisWeek = items
    .filter((o) => o.status === "Pending" && o.dueDate >= TODAY && o.dueDate <= week)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const comingUp = items
    .filter((o) => o.status === "Pending" && o.dueDate > week && o.dueDate <= month)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const fees = delayed.reduce((n, o) => n + o.exposure, 0);

  return (
    <section className="cd-board">
      <header className="cd-board__head">
        <b>What needs action</b>
        <small>Click a filing to mark it filed or remind the client</small>
      </header>
      <div className="cd-board__cols">
        <BoardCol
          tone="overdue" title="Delayed" list={delayed}
          note={fees ? `₹${inr(fees)} in late fees` : "Past the due date"}
          empty="Nothing delayed" regById={regById} onPeek={onPeek}
        />
        <BoardCol
          tone="soon" title="Due this week" list={thisWeek}
          note={`Till ${fmtDate(week)}`}
          empty="Nothing due this week" regById={regById} onPeek={onPeek}
        />
        <BoardCol
          tone="pending" title="Coming up" list={comingUp}
          note="Next 30 days"
          empty="Nothing in the next 30 days" regById={regById} onPeek={onPeek}
        />
      </div>
    </section>
  );
}

function BoardCol({
  tone: colTone, title, note, list, empty, regById, onPeek,
}: {
  tone: "overdue" | "soon" | "pending";
  title: string;
  note: string;
  list: Obligation[];
  empty: string;
  regById: Map<string, Reg>;
  onPeek: (o: Obligation) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, BOARD_SHOW);
  return (
    <div className={`cd-col cd-col--${colTone}`}>
      <div className="cd-col__head">
        <i className={`cd-dot cd-dot--${colTone}`} />
        <b>{title}</b>
        <span className="cd-col__n num">{list.length}</span>
        <small>{note}</small>
      </div>
      {list.length === 0 ? (
        <div className="cd-col__empty"><Icon name="check" size={14} /> {empty}</div>
      ) : (
        <div className="cd-col__list">
          {shown.map((o) => {
            const reg = regById.get(o.clientId);
            return (
              <button type="button" key={o.id} className="cd-row" onClick={() => onPeek(o)}>
                <span className="cd-node__txt">
                  <b><span className="num">{o.form}</span></b>
                  <small>{o.periodLabel} · {reg ? regName(reg) : o.head}</small>
                </span>
                <span className="cd-row__when">
                  <b className={colTone === "overdue" ? "cd-st-late" : "num"}>
                    {colTone === "overdue" ? `${o.daysOverdue}d late` : fmtDate(o.dueDate)}
                  </b>
                  {colTone === "overdue" && o.exposure ? <small className="num">₹{inr(o.exposure)}</small> : null}
                </span>
              </button>
            );
          })}
          {list.length > BOARD_SHOW ? (
            <button type="button" className="cd-col__more" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show ${list.length - BOARD_SHOW} more`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ---- Head banner --------------------------------------------------------------
   The Overview's head card, widened, at the top of the Income tax, GST and
   TDS tabs: the same illustration and figures, so a tab opens on how that
   head stands before the list of filings. */

function HeadBanner({
  art, cls, title, sub, t,
}: {
  art: "itr" | "gst" | "tds";
  cls: RecordType;
  title: string;
  sub: ReactNode;
  t: Tally;
}) {
  const open = t.pending + t.overdue;
  return (
    <section className={`cd-banner cd-head--${cls}`}>
      <HeadArt kind={art} />
      <div className="cd-banner__main">
        <div className="cd-banner__title">
          <b>{title}</b>
          <small>{sub}</small>
        </div>
        <Pbar filed={t.filed} pending={t.pending} overdue={t.overdue} />
      </div>
      <dl className="cd-banner__figs">
        <div className={t.overdue ? "is-late" : undefined}>
          <dt>Late</dt>
          <dd className="num">{t.overdue}</dd>
          {t.exposure ? <small className="num">₹{inr(t.exposure)}</small> : null}
        </div>
        <div><dt>Open</dt><dd className="num">{open}</dd></div>
        <div><dt>Filed</dt><dd className="num">{t.filed}</dd></div>
        <div className="cd-banner__next">
          <dt>Next due</dt>
          <dd>{t.next ? <><span className="num">{t.next.form}</span><small className="num">{fmtDate(t.next.dueDate)}</small></> : <span className="u-faint">—</span>}</dd>
        </div>
      </dl>
    </section>
  );
}

function HeadCard({
  art, cls, title, sub, t, onOpen,
}: {
  art: "itr" | "gst" | "tds";
  cls: RecordType;
  title: string;
  sub: string;
  /** Absent when the client holds no registration for this head. */
  t?: Tally;
  onOpen: () => void;
}) {
  if (!t) {
    return (
      <div className={`cd-head cd-head--${cls} is-empty`}>
        <span className="cd-head__top">
          <HeadArt kind={art} muted />
          <span className="cd-head__txt">
            <b>{title}</b>
            <small>{sub}</small>
          </span>
        </span>
      </div>
    );
  }
  const open = t.pending + t.overdue;
  return (
    <button type="button" className={`cd-head cd-head--${cls}`} onClick={onOpen}>
      <span className="cd-head__top">
        <HeadArt kind={art} />
        <span className="cd-head__txt">
          <b>{title}</b>
          <small>{sub}</small>
        </span>
        <span className="cd-head__go">Open <Icon name="chevronRight" size={13} /></span>
      </span>
      <span className="cd-head__figs">
        <span className={t.overdue ? "cd-st-late" : undefined}><b className="num">{t.overdue}</b> late</span>
        <span><b className="num">{open}</b> open</span>
        <span><b className="num">{t.filed}</b> filed</span>
      </span>
      <Pbar filed={t.filed} pending={t.pending} overdue={t.overdue} />
      <span className="cd-head__next">
        {t.next ? (
          <>Next <b className="num">{t.next.form}</b> · {fmtDate(t.next.dueDate)}</>
        ) : open ? "Only late filings open" : "Nothing more due this year"}
      </span>
    </button>
  );
}

/* ---- Structure: the client drawn as a tree ----------------------------------
   Left to right: the client, then its three heads, then each GSTIN or TAN.
   Reading sideways lets a head with four GSTINs simply grow downward while
   a head with one stays short, with nothing left hanging in empty space.
   Every card opens what it names; contacts are changed inside a
   registration, not here. */

const ITR_HEADS: Head[] = ["Income Tax", "ROC/MCA", "ROC/MCA (LLP)", "Other Statutory"];

function StructurePane({
  client, regs, of, gstItems, tdsItems, onSelect,
}: {
  client: Client;
  regs: { itr: Reg; gst: Reg[]; tds: Reg[] };
  of: (id: string) => Obligation[];
  gstItems: Obligation[];
  tdsItems: Obligation[];
  onSelect: (n: Node) => void;
}) {
  const itrList = of(client.id);
  const itrHeads = ITR_HEADS
    .map((h) => ({ h, t: tally(itrList.filter((o) => o.head === h)) }))
    .filter((x) => x.t.filed + x.t.pending + x.t.overdue + x.t.na > 0);

  const rows: { kind: RecordType; art: "itr" | "gst" | "tds"; title: string; sub: string; t?: Tally; node: Node; kids: ReactNode[] }[] = [
    {
      kind: "Client", art: "itr", title: "Income tax", sub: "With ROC",
      t: tally(itrList), node: client.id,
      kids: itrHeads.map(({ h, t }) => (
        <button type="button" key={h} className="cd-tr__leaf" onClick={() => onSelect(client.id)}>
          <i className={`cd-dot cd-dot--${tone(t)}`} />
          <span className="cd-node__txt">
            <b>{h}</b>
            <small>{t.next ? `Next ${t.next.form} · ${fmtDate(t.next.dueDate)}` : `${t.filed} filed this year`}</small>
          </span>
          <LeafStatus t={t} />
        </button>
      )),
    },
    {
      kind: "GstEntity", art: "gst", title: "GST",
      sub: regs.gst.length ? `${regs.gst.length} ${regs.gst.length === 1 ? "GSTIN" : "GSTINs"}` : "Not registered",
      t: regs.gst.length ? tally(gstItems) : undefined, node: "gst",
      kids: regs.gst.map((r) => <RegLeaf key={r.id} r={r} t={tally(of(r.id))} client={client} onSelect={onSelect} />),
    },
    {
      kind: "TdsDeductor", art: "tds", title: "TDS",
      sub: regs.tds.length ? `${regs.tds.length} ${regs.tds.length === 1 ? "TAN" : "TANs"}` : "No TAN",
      t: regs.tds.length ? tally(tdsItems) : undefined, node: "tds",
      kids: regs.tds.map((r) => <RegLeaf key={r.id} r={r} t={tally(of(r.id))} client={client} onSelect={onSelect} />),
    },
  ];

  return (
    <div className="cd-tr">
      <div className="cd-tr__rootcol">
        <div className="cd-tr__root">
          <div className="cd-tr__rootlead">
            <span className="cd-tr__rootav">{initialsOf(client.name)}</span>
            <b>{client.name}</b>
            <span className="cd-tr__pan num">PAN {client.pan}</span>
            <small>{client.profile.entityType} · {client.state}</small>
          </div>
        </div>
      </div>

      <div className="cd-tr__heads">
        {rows.map((row) => (
          <div className="cd-tr__row" key={row.kind}>
            {row.t ? (
              <button type="button" className={`cd-tr__head cd-head--${row.kind}`} onClick={() => onSelect(row.node)}>
                <HeadIcon kind={row.art} />
                <span className="cd-node__txt">
                  <b>{row.title}</b>
                  <small>{row.sub}</small>
                </span>
                <LeafStatus t={row.t} />
              </button>
            ) : (
              <div className="cd-tr__head is-empty">
                <HeadIcon kind={row.art} />
                <span className="cd-node__txt"><b>{row.title}</b><small>{row.sub}</small></span>
              </div>
            )}
            {row.kids.length ? <div className="cd-tr__kids">{row.kids}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "2 late" in red, or "12 open", or a green tick, as a small pill. */
function LeafStatus({ t }: { t: Tally }) {
  const open = t.pending + t.overdue;
  if (t.overdue) return <span className="cd-pillst is-late num">{t.overdue} late</span>;
  if (open) return <span className="cd-pillst num">{open} open</span>;
  if (t.filed) return <span className="cd-pillst is-ok"><Icon name="check" size={11} /> Filed</span>;
  return <span className="cd-pillst is-none">None due</span>;
}

function RegLeaf({ r, t, client, onSelect }: { r: Reg; t: Tally; client: Client; onSelect: (n: Node) => void }) {
  const who = contactName(r, client);
  return (
    <button type="button" className="cd-tr__leaf" onClick={() => onSelect(r.id)}>
      <i className={`cd-dot cd-dot--${tone(t)}`} />
      <span className="cd-node__txt">
        <b>{r.title} <span className="cd-tr__num num">{r.number}</span></b>
        <small>{who}{t.next ? ` · next ${fmtDate(t.next.dueDate)}` : ""}</small>
      </span>
      <LeafStatus t={t} />
    </button>
  );
}

/* ---- Change who a registration's reminders go to ------------------------- */

function ContactDrawer({
  reg, contacts, onClose, onDone,
}: {
  reg: Reg;
  contacts: Contact[];
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const current = contactKey(reg.party);
  const [pick, setPick] = useState<string>(current);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const isNew = pick === "new";
  const valid = isNew ? name.trim() !== "" && /\S+@\S+\.\S+/.test(email) && phone.trim().length >= 10 : pick !== current;

  const apply = () => {
    if (isNew) {
      updateParty(reg.kind, reg.id, {
        contactName: name.trim(), email: email.trim(), phone: phone.trim(), whatsapp: true, emailEnabled: true,
      });
      onDone(name.trim());
      return;
    }
    const c = contacts.find((x) => x.key === pick);
    if (!c) return;
    updateParty(reg.kind, reg.id, {
      contactName: c.name, email: c.email, phone: c.phone, whatsapp: c.whatsapp, emailEnabled: c.emailEnabled,
    });
    onDone(c.name);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Change contact"
      subtitle={reg.kind === "Client" ? `Income tax and ROC · PAN ${reg.number}` : `${KIND_HEAD[reg.kind].name} · ${reg.title} · ${reg.number}`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!valid} onClick={apply}>Use this contact</button>
        </>
      }
    >
      <p className="cd-drawer__lead">
        Future reminders for this registration go to the contact you choose. Messages already sent are not affected.
      </p>
      <div className="cd-pick" role="radiogroup">
        {contacts.map((c) => (
          <button
            type="button" key={c.key} role="radio" aria-checked={pick === c.key}
            className={`cd-pick__opt${pick === c.key ? " is-on" : ""}`}
            onClick={() => setPick(c.key)}
          >
            <span className="cd-pick__radio" />
            <span className="cd-contact__av">{initialsOf(c.name)}</span>
            <span className="cd-node__txt">
              <b>{c.name}{c.key === current ? <span className="tag tag--outline" style={{ marginLeft: 8 }}>Current</span> : null}</b>
              <small>{c.email} · <span className="num">{c.phone}</span></small>
              <small className="cd-pick__uses">
                Handles {c.usedBy.map((r) => (r.kind === "Client" ? "income tax" : `${KIND_HEAD[r.kind].name} ${r.title}`)).join(", ")}
              </small>
            </span>
          </button>
        ))}
        <button
          type="button" role="radio" aria-checked={isNew}
          className={`cd-pick__opt${isNew ? " is-on" : ""}`}
          onClick={() => setPick("new")}
        >
          <span className="cd-pick__radio" />
          <span className="cd-contact__av cd-contact__av--add"><Icon name="plus" size={14} /></span>
          <span className="cd-node__txt"><b>Add a new contact</b><small>Someone not yet on this client</small></span>
        </button>
      </div>
      {isNew ? (
        <div className="cd-newc">
          <label>Name<input className="sinput" value={name} onChange={(e) => setName(e.target.value)} placeholder="Himanshu Verma (accounts)" /></label>
          <label>Email<input className="sinput" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.in" /></label>
          <label>Mobile (WhatsApp)<input className="sinput num" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></label>
        </div>
      ) : null}
    </Drawer>
  );
}

/* ---- GST / TDS: every GSTIN or every TAN together ------------------------ */

function GroupPane({
  kind, list, regs, client, regById, of, onSelect, onPeek,
}: {
  kind: RecordType;
  list: Obligation[];
  regs: Reg[];
  client: Client;
  regById: Map<string, Reg>;
  of: (id: string) => Obligation[];
  onSelect: (n: Node) => void;
  onPeek: (o: Obligation) => void;
}) {
  const label = KIND_LABEL[kind];
  return (
    <>
      <div className="sheet" style={{ marginBottom: "var(--s5)" }}>
        <table className="ltable ltable--plain">
          <thead>
            <tr>
              <th>{label}</th>
              <th>{kind === "GstEntity" ? "State" : "Location"}</th>
              <th>Contact</th>
              <th style={{ width: 150 }}>Compliance health</th>
              <th className="u-right">Open</th>
              <th className="u-right">At risk</th>
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {regs.map((r) => {
              const rt = tally(of(r.id));
              const same = sameContact(r.party, client);
              return (
                <tr key={r.id} className="is-clickable" onClick={() => onSelect(r.id)}>
                  <td className="num u-strong">{r.number}</td>
                  <td>{r.title}<div className="u-mute" style={{ fontSize: "var(--t-11)" }}>{r.sub}</div></td>
                  <td style={{ fontSize: "var(--t-12)" }}>
                    {same ? <span className="u-mute">Same as client</span> : (
                      <>
                        <div className="u-truncate" style={{ maxWidth: 220 }}>{r.party.contactName ?? r.party.email}</div>
                        <div className="u-mute u-truncate" style={{ maxWidth: 220 }}>{r.party.email}</div>
                      </>
                    )}
                  </td>
                  <td><Pbar filed={rt.filed} pending={rt.pending} overdue={rt.overdue} /></td>
                  <td className="u-right num">{rt.pending + rt.overdue}</td>
                  <td className="u-right num" style={{ color: rt.exposure ? "var(--st-overdue-fg)" : "var(--ink-4)" }}>
                    {rt.exposure ? `₹${inr(rt.exposure)}` : "—"}
                  </td>
                  <td className="u-faint"><Icon name="chevronRight" size={14} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Filings list={list} regById={regById} showReg onPeek={onPeek} />
    </>
  );
}

/* ---- One registration ---------------------------------------------------- */

type RegTab = "filings" | "profile";

function RegPane({
  reg, list, client, onPeek, onCopy, onSwitch,
}: {
  reg: Reg;
  list: Obligation[];
  client: Client;
  onPeek: (o: Obligation) => void;
  onCopy: (label: string, value: string) => void;
  onSwitch: (r: Reg) => void;
}) {
  const [tab, setTab] = useState<RegTab>("filings");
  const t = tally(list);
  const label = KIND_LABEL[reg.kind];
  const same = sameContact(reg.party, client);

  return (
    <>
      {reg.kind !== "Client" ? (
      <div className="cd-reghead">
        <div className="cd-reghead__id">
          <HeadMark kind={reg.kind} size="lg" />
          <span className="cd-node__txt">
            <b>{`${KIND_HEAD[reg.kind].name} · ${reg.title}`}</b>
            <small>
              <button type="button" className="cd-copy num" onClick={() => onCopy(label, reg.number)} title={`Copy ${label}`}>
                {label} {reg.number} <Icon name="copy" size={12} />
              </button>
              {" · "}{reg.sub}
            </small>
          </span>
        </div>

        {/* This registration's own contact. Reminders for its filings go
            here, not to the client's main contact, when the two differ. */}
        {(
          <div className="cd-reghead__contact">
            <span className="cprofile__k cd-k">
              Contact
              {same ? <span className="tag tag--outline">Same as client</span> : null}
              <button type="button" className="cd-link" onClick={() => onSwitch(reg)}>Change contact</button>
            </span>
            {reg.party.contactName ? <span className="cd-reghead__who">{reg.party.contactName}</span> : null}
            <ChannelSwitches kind={reg.kind} party={reg.party} />
          </div>
        )}
      </div>
      ) : null}

      <div className="cd-subbar">
        <Seg<RegTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "filings", label: `Filings (${list.length})` },
            { value: "profile", label: "Profile" },
          ]}
        />
        <span className="u-spacer" />
        {reg.kind !== "Client" ? <span className="cd-subbar__sum">
          <b className={t.overdue ? "cd-late" : undefined}>{t.overdue} overdue</b>
          {t.exposure ? <> · {inrShort(t.exposure)} late fees</> : null}
          {" · "}{t.pending} pending · {t.filed} filed
          {t.next ? <> · next due <b className="num">{fmtDate(t.next.dueDate)}</b></> : null}
        </span> : null}
      </div>

      {tab === "filings" ? <Filings list={list} onPeek={onPeek} /> : <ProfilePanel reg={reg} client={client} />}
    </>
  );
}

/* ---- Filings list (Open + Settled) --------------------------------------- */

function Filings({
  list, regById, showReg, onPeek,
}: {
  list: Obligation[];
  regById?: Map<string, Reg>;
  showReg?: boolean;
  onPeek: (o: Obligation) => void;
}) {
  const upcoming = list.filter((o) => o.status === "Pending" || o.status === "Overdue");
  const settled = list.filter((o) => o.status === "Filed" || o.status === "Not Applicable");
  return (
    <>
      <SectionHead icon="outbox" title="Open" note={`${upcoming.length} items. Click any row for the rule behind it.`} />
      <div className="sheet">
        <div className="sheet__body">
          {upcoming.length === 0 ? (
            <Empty title="Nothing open">Every applicable compliance here is filed or ruled out.</Empty>
          ) : (
            <div className="tl">
              {upcoming.map((o) => (
                <OpenRow key={o.id} o={o} reg={showReg ? regById?.get(o.clientId) : undefined} onPeek={onPeek} />
              ))}
            </div>
          )}
        </div>
      </div>

      <SectionHead icon="check" title="Settled" note={`${settled.length} filed or not applicable`} />
      <div className="sheet">
        <div className="sheet__body">
          {settled.length === 0 ? (
            <Empty title="Nothing settled yet" />
          ) : (
            <div className="tl">
              {settled.map((o) => {
                const reg = showReg ? regById?.get(o.clientId) : undefined;
                return (
                  <button type="button" className="tlrow" key={o.id} onClick={() => onPeek(o)}>
                    <span className={`tlrow__node n-${o.status === "Filed" ? "filed" : "na"}`} />
                    <span className="u-col" style={{ flex: 1, minWidth: 0 }}>
                      <span className="u-row">
                        <b className="num">{o.form}</b>
                        <span className="u-mute">{o.periodLabel}</span>
                        {reg ? <RegTag reg={reg} /> : null}
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function OpenRow({ o, reg, onPeek }: { o: Obligation; reg?: Reg; onPeek: (o: Obligation) => void }) {
  return (
    <button type="button" className="tlrow" onClick={() => onPeek(o)}>
      <span className={`tlrow__node n-${o.status === "Overdue" ? "overdue" : "pending"}`} />
      <span className="u-col" style={{ flex: 1, minWidth: 0 }}>
        <span className="u-row">
          <b className="num">{o.form}</b>
          <span className="u-mute">{o.periodLabel}</span>
          {reg ? <RegTag reg={reg} /> : null}
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
      <StatusTag status={o.status as FilingStatus} />
    </button>
  );
}

/** Which GSTIN or TAN a row is filed under, in mixed lists. */
function RegTag({ reg }: { reg: Reg }) {
  if (reg.kind === "Client") return <span className="tag tag--outline">PAN</span>;
  return (
    <span className="tag tag--outline num" title={`${KIND_LABEL[reg.kind]} ${reg.number}`}>
      {reg.kind === "GstEntity" ? reg.number.slice(0, 2) + " · " + reg.title : reg.title}
    </span>
  );
}

/* ---- Profile: the fields the rule engine reads --------------------------- */

function ProfilePanel({ reg, client }: { reg: Reg; client: Client }) {
  const g = reg.kind === "GstEntity" ? GST_ENTITY_BY_ID[reg.id] : undefined;
  const d = reg.kind === "TdsDeductor" ? TDS_DEDUCTOR_BY_ID[reg.id] : undefined;
  return (
    <>
      <div className="note" style={{ marginBottom: "var(--s5)" }}>
        These are the fields the rule engine reads. <b>Changing any of them re-runs applicability
        for this {KIND_LABEL[reg.kind]}</b>. Compliances can appear or disappear, and scheduled
        reminders are rebuilt to match.
      </div>

      <div className="grid2">
        {reg.kind === "Client" ? (
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
          </>
        ) : null}

        {g ? (
          <ProfileCard title="GST registration">
            <Row k="GSTIN" v={g.gstin} mono />
            <Row k="Place of business" v={`${g.label} · ${g.state}`} />
            <Row k="Registration type" v={g.profile.gstRegType} />
            <Row k="QRMP opted" v={g.profile.gstQrmpOpted} />
            <Row k="State category (QRMP)" v={g.profile.gstStateCategory} hint="Decides whether quarterly GSTR-3B is due on the 22nd or the 24th" />
            <Row k="Turnover (preceding FY)" v={`₹${inr(g.profile.turnover)}`} mono hint="This GSTIN's own turnover, not the whole PAN's" />
          </ProfileCard>
        ) : null}

        {d ? (
          <>
            <ProfileCard title="TDS / TCS">
              <Row k="TAN" v={d.tan} mono />
              <Row k="Location" v={`${d.label} · ${d.state}`} />
              <Row k="Entity type" v={d.profile.entityType} />
              <Row k="Tax audit applicable (preceding FY)" v={d.profile.taxAuditApplicable} />
              <Row k="Nature of payments made" v={d.profile.paymentNatures.join(", ") || "—"} />
              <Row k="TDS deducted per quarter" v={`₹${inr(d.profile.tdsPerQuarter)}`} mono hint="Caps the ₹200/day late fee under s.234E" />
              <Row k="Turnover (preceding FY)" v={`₹${inr(d.profile.turnover)}`} mono hint="Drives the 27EQ (TCS) turnover threshold" />
            </ProfileCard>
            <ProfileCard title="Payroll">
              <Row k="Monthly payroll" v={`₹${inr(d.profile.monthlyPayroll)}`} mono />
              <Row k="EPF covered" v={d.profile.epfCovered} />
              <Row k="ESI covered" v={d.profile.esiCovered} />
              <Row k="Professional tax state" v={d.profile.professionalTaxState ?? "—"} />
            </ProfileCard>
          </>
        ) : null}
      </div>
    </>
  );
}

function ProfileCard({ title, children }: { title: string; children: ReactNode }) {
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

/* ---- Messages: everything sent, across all registrations ----------------- */

function MessagesPane({
  comms, regById,
}: {
  comms: ReturnType<typeof useOutbox>;
  regById: Map<string, Reg>;
}) {
  return (
    <div className="sheet">
      {comms.length === 0 ? (
        <Empty title="Nothing sent yet">
          Reminders are triggered from the due dates on this client's filings. Nothing has met a
          trigger for this client.
        </Empty>
      ) : (
        <table className="ltable ltable--plain">
          <thead>
            <tr>
              <th>Sent</th>
              <th>Channel</th>
              <th>Filed under</th>
              <th>Stage</th>
              <th>Message</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {comms.map((e) => {
              const reg = regById.get(e.clientId);
              return (
                <tr key={e.id}>
                  <td className="num u-nowrap">{fmtDate(e.sentAt)}</td>
                  <td>
                    <span className="u-row">
                      <Icon name={e.channel === "WhatsApp" ? "send" : "outbox"} size={14} />
                      {e.channel}
                    </span>
                  </td>
                  <td className="num u-nowrap" style={{ fontSize: "var(--t-12)" }}>
                    {reg ? <><span className="u-mute">{KIND_LABEL[reg.kind]}</span> {reg.number}</> : "—"}
                  </td>
                  <td className="u-mute" style={{ fontSize: "var(--t-12)" }}>{e.stage}</td>
                  <td className="u-truncate" style={{ maxWidth: 360, fontSize: "var(--t-12)" }}>{e.preview}</td>
                  <td>
                    <span className={`tag ${e.status === "Failed" ? "tag--overdue" : e.status.startsWith("Queued") ? "tag--pending" : "tag--filed"}`}>
                      <i className="tag__dot" />{e.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
