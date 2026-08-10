/* ============================================================================
   DOMAIN TYPES
   Modelled directly on the four source workbooks:
     • Master Compliance Calendar      → ComplianceDef / Occurrence
     • Applicability & Status Rules    → ClientProfile fields, RuleHit, Status
     • Client Mapping Worked Examples  → Obligation
   ========================================================================== */

export type Head =
  | "GST"
  | "Income Tax"
  | "TDS"
  | "ROC/MCA"
  | "ROC/MCA (LLP)"
  | "Other Statutory";

export type Frequency =
  | "Monthly"
  | "Quarterly"
  | "Half-yearly"
  | "Annual"
  | "Event-based";

/* --- Client profile: every field the rule engine reads --------------------
   Mirrors the "Client Data Points (Profile Fields)" sheet one-for-one. */

export type EntityType =
  | "Individual"
  | "HUF"
  | "Firm"
  | "LLP"
  | "Company"
  | "Trust"
  | "AOP/BOI";

export type CompanyType = "Private" | "Public" | "OPC" | "Small Company" | "Listed";
export type Residential = "Resident" | "RNOR" | "Non-Resident";
export type GstRegType =
  | "Regular"
  | "Composition"
  | "TDS Deductor"
  | "E-commerce Operator"
  | "ISD"
  | "Non-Resident Taxable"
  | "Unregistered";
export type StateCategory = "Category A" | "Category B";
export type PaymentNature =
  | "Salary"
  | "Contractor"
  | "Rent"
  | "Professional Fees"
  | "Interest"
  | "Commission"
  | "Non-Resident";

export interface ClientProfile {
  entityType: EntityType;
  companyType?: CompanyType;
  residential: Residential;
  /** Estimated total income for the year, ₹ */
  totalIncome: number;
  /** Turnover / gross receipts of the preceding FY, ₹ */
  turnover: number;
  housePropertyCount: number;
  agriculturalIncome: number;
  hasCapitalGains: boolean;
  isDirector: boolean;
  holdsUnlistedShares: boolean;
  hasForeignAssets: boolean;
  hasBusinessIncome: boolean;
  presumptiveOpted: boolean;
  isPartnerInFirm: boolean;
  /** Derived from turnover/receipts — drives TDS deduction liability */
  taxAuditApplicable: boolean;
  paymentNatures: PaymentNature[];
  gstRegType: GstRegType;
  gstQrmpOpted: boolean;
  gstStateCategory: StateCategory;
  isLlp: boolean;
  isDinHolder: boolean;
  hasDeposits: boolean;
  msmeDuesOverdue: boolean;
  section139Special: boolean; /* 139(4A)–(4D): trusts, political parties, institutions */
  claimsSection11: boolean;
  hasTransferPricing: boolean;
  epfCovered: boolean;
  esiCovered: boolean;
  professionalTaxState?: string;
  /** Quarterly TDS deducted, ₹ — caps the 234E late fee */
  tdsPerQuarter: number;
  /** Monthly payroll, ₹ — base for PF/ESI interest exposure */
  monthlyPayroll: number;
  /** 0–1. How reliably this client files on time. Drives the simulated
   *  filing history; in production this comes from actual filing records. */
  discipline: number;
}

export interface Client {
  id: string;
  name: string;
  legalName: string;
  pan: string;
  gstin?: string;
  cin?: string;
  state: string;
  assigneeId: string;
  archetype: string;
  profile: ClientProfile;
  /** Whether the client accepts WhatsApp — affects reminder channel */
  whatsapp: boolean;
  email: string;
  phone: string;
}

export interface Staff {
  id: string;
  name: string;
  role: "Partner" | "Senior" | "Article" | "Manager";
  initials: string;
}

/* --- Late fee models ------------------------------------------------------ */

export type LateFee =
  /** ₹X per day of delay, optionally capped */
  | { kind: "perDay"; amount: number; nilAmount?: number; cap?: number | "turnoverPct" | "tdsAmount"; capPct?: number; note: string }
  /** Fixed penalty regardless of delay */
  | { kind: "flat"; amount: number; note: string }
  /** § 234F — slab on total income */
  | { kind: "s234f"; note: string }
  /** Interest at a monthly percentage on a base amount.
   *  `basisPct` scales the base — PF is ~24% of payroll (12% each side),
   *  ESI ~3.25%, so they must not share one rate. */
  | { kind: "interest"; monthlyPct: number; basis: "tdsPerQuarter" | "taxDue" | "contribution"; basisPct?: number; note: string }
  /** Percentage of turnover with an absolute cap — § 271B */
  | { kind: "turnoverPct"; pct: number; cap: number; note: string };

/* --- Compliance definition & generated occurrences ------------------------ */

export interface ComplianceDef {
  code: string;
  head: Head;
  form: string;
  description: string;
  frequency: Frequency;
  /** Human statement of the recurring rule, e.g. "20th of the following month" */
  dueRule: string;
  /** Who it applies to, verbatim from the master calendar */
  applicability: string;
  lateFee: LateFee;
  /** Filing is the client's own act vs. an internal-only task */
  clientFacing: boolean;
}

export interface Occurrence {
  /** `${defCode}::${periodKey}` — stable id for a filing run */
  runId: string;
  defCode: string;
  periodKey: string;
  periodLabel: string;
  dueDate: string; /* ISO yyyy-mm-dd */
}

/* --- Applicability outcome ------------------------------------------------ */

export interface RuleHit {
  /** e.g. "ITR Form Applicability · Priority 4" */
  ruleRef: string;
  /** The condition text, quoted so staff can audit it */
  condition: string;
  /** The profile fields that actually fired, for the "why" panel */
  facts: { field: string; value: string }[];
}

export type FilingStatus = "Filed" | "Pending" | "Overdue" | "Not Applicable";

export type StatusBasis =
  /** The engine itself decided the compliance does not apply. */
  | "Rule-excluded"
  /** A person took it off the client, against what the engine concluded.
      Kept distinct from "Rule-excluded" so the engine's own accuracy stays
      measurable, and so the audit trail never claims the engine made a call
      a human actually made. */
  | "Manually excluded"
  | "Portal verified"
  | "Filed via KDK"
  | "Manually marked"
  | "Due date not passed"
  | "Due date passed";

export interface Obligation {
  id: string;
  clientId: string;
  runId: string;
  defCode: string;
  head: Head;
  form: string;
  periodLabel: string;
  dueDate: string;
  status: FilingStatus;
  basis: StatusBasis;
  rule: RuleHit;
  /** Set when a human overrode the engine */
  override?: { by: string; on: string; reason: string; action: "excluded" | "included" };
  assigneeId: string;
  /** Days past due; 0 or negative when not yet due */
  daysOverdue: number;
  /** Estimated accruing penalty in ₹ — 0 unless overdue */
  exposure: number;
  exposureFormula: string;
  filedOn?: string;
  /** Who recorded the filing. Always set when a person marked it — including
   *  through a bulk action, where it is the only thing that can be captured.
   *  Absent on portal and software confirmations, which have no human author. */
  filedBy?: string;
  /** Portal acknowledgement: ARN, receipt or token number.
   *
   *  Deliberately optional. Marking one client filed can ask for it, but a bulk
   *  action covering 400 clients cannot collect 400 different numbers, and
   *  demanding one would either stop the bulk action being used or get it filled
   *  with junk. So a filed obligation may legitimately have no acknowledgement,
   *  and the record says so rather than pretending otherwise. */
  arn?: string;
  reminderStage: ReminderStage;
}

export type ReminderStage =
  | "Not scheduled"
  | "T-7 scheduled"
  | "T-7 sent"
  | "T-3 sent"
  | "Due-date sent"
  | "Overdue escalation"
  | "Cancelled: resolved"
  | "N/A";

/* --- Aggregates ----------------------------------------------------------- */

export interface FilingRun {
  runId: string;
  def: ComplianceDef;
  periodLabel: string;
  dueDate: string;
  daysOverdue: number;
  total: number;
  filed: number;
  pending: number;
  overdue: number;
  exposure: number;
  clientIds: string[];
}

export type Channel = "WhatsApp" | "Email";

export type DeliveryStatus =
  | "Delivered"
  | "Read"
  | "Queued (quiet hours)"
  /** Held for quiet hours, then dropped because the return was settled before
   *  the hold expired. Kept in the log rather than deleted: "we did not chase
   *  them because they had already filed" is a thing staff need to be able to
   *  see, and a vanished row looks like a system that lost the message. */
  | "Cancelled"
  | "Failed";

export interface OutboxEntry {
  id: string;
  clientId: string;
  obligationId: string;
  channel: Channel;
  stage: ReminderStage;
  /** `yyyy-mm-ddThh:mm`. A date alone cannot separate two sends on the same
   *  day, nor answer whether the client had working hours left to act. */
  sentAt: string;
  status: DeliveryStatus;
  /** Did the scheduler send this, or did a person press the button? Every row
   *  in the log has to be attributable — "the system chased them" and "Priya
   *  chased them" are different answers to the same client question. */
  origin: "Automatic" | "Manual";
  /** Staff id for a manual send; absent when the scheduler sent it. */
  sentBy?: string;
  /** Set on a copy created by Resend, pointing at the row it repeats. */
  resendOf?: string;
  /** How many times this obligation+channel has now gone out. */
  attempt: number;
  /** The compliance def, denormalised so the log can filter by head and form
   *  without joining back through the obligation on every keystroke. */
  defCode: string;
  head: Head;
  form: string;
  /** One line for the log table. */
  preview: string;
  /** The message exactly as the client received it. */
  body: string;
  /** Email only. */
  subject: string;
}

/* ---------------------------------------------------------------------------
   AUTOMATIC REMINDERS
   ---------------------------------------------------------------------------
   The cadence is a ladder of steps hung off the statutory due date. A step is
   an offset, not a date: "three days before, on WhatsApp" holds for every
   compliance in the book, so one ladder drives 31 compliances × 640 clients
   without anyone maintaining a calendar.

   Offsets are signed days relative to the due date — negative before, 0 on the
   day, positive after. `sendAt` is the wall clock the step fires at, inside
   the quiet-hours window.
   ------------------------------------------------------------------------- */

export interface ScheduleStep {
  id: string;
  /** Signed days from the due date. -7 = a week before, +1 = day after. */
  offset: number;
  /** What the client sees this as, and what the log records. */
  stage: ReminderStage;
  label: string;
  /** Why this step exists — shown once, in the automation editor. */
  intent: string;
  channels: Channel[];
  /** Hour of day, 24h, inside quiet hours. */
  sendAt: number;
  enabled: boolean;
  /** Escalation steps also copy the engagement owner. */
  ccOwner?: boolean;
}

/** One future send the ladder implies: a whole filing run × one step.
 *  Aggregated by run, never by client — a 10,000-client book would otherwise
 *  put 10,000 rows on a screen nobody can act on. */
export interface ScheduledSend {
  key: string;
  runId: string;
  defCode: string;
  head: Head;
  form: string;
  periodLabel: string;
  dueDate: string;
  step: ScheduleStep;
  /** When this batch fires. */
  fireAt: string;
  /** Clients still unfiled, and so still in scope when it fires. */
  clientCount: number;
  /** Of those, how many can take WhatsApp. */
  whatsappCount: number;
  obligationIds: string[];
  /** Suppressed by a person — kept visible, struck through, rather than
   *  vanishing, so "why didn't they get chased?" stays answerable. */
  skipped: boolean;
}

export interface ReminderSettings {
  /** Master switch. Off means the ladder still computes and displays, but
   *  nothing leaves the building. */
  autoSend: boolean;
  quietHours: boolean;
  /** The sending window, 24h. Configurable because a practice in one state
   *  keeps different hours from one in another, and because "09:00–20:00" was
   *  a constant in the source that the settings screen claimed to govern. */
  quietStart: number;
  quietEnd: number;
  /** Statutory dates do not move for a Sunday, but a chase can wait for
   *  Monday — nobody assembles working papers on a weekend. */
  skipWeekends: boolean;
  /** One combined message where a client has several items in the same window. */
  digest: boolean;
}

/* ---------------------------------------------------------------------------
   ORGANISATION SETTINGS
   ---------------------------------------------------------------------------
   Who the firm is, and who its messages come from. This is not decoration:
   the sender block is reproduced verbatim at the foot of every reminder, and
   a client who cannot tell whose business account is asking them for money
   will either ignore it or report it.
   ------------------------------------------------------------------------- */

export interface FirmProfile {
  name: string;
  /** ICAI Firm Registration Number. */
  frn: string;
  membershipNo: string;
  pan: string;
  gstin: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
}

export interface SenderProfile {
  /** The WhatsApp Business display name clients see — "CA Connect". */
  waName: string;
  waNumber: string;
  waVerified: boolean;
  fromEmail: string;
  replyTo: string;
}

/** Per-compliance overrides. A firm that does not do payroll should not be
 *  tracking PF and ESI at all, and whether a filing is the client's own act
 *  decides whether they are ever chased about it. */
export interface ComplianceOverride {
  tracked: boolean;
  clientFacing: boolean;
}

/** Which of the bell alerts are raised. Keyed by the notification's own id. */
export type NotificationSettings = Record<string, boolean>;
