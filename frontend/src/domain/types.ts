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

export interface OutboxEntry {
  id: string;
  clientId: string;
  obligationId: string;
  channel: "WhatsApp" | "Email";
  stage: ReminderStage;
  sentAt: string;
  status: "Delivered" | "Read" | "Queued (quiet hours)" | "Failed";
  /** One line for the log table. */
  preview: string;
  /** The message exactly as the client received it. */
  body: string;
  /** Email only. */
  subject: string;
}
