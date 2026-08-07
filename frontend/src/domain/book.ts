/* ============================================================================
   THE CLIENT BOOK
   ----------------------------------------------------------------------------
   In production these records come from KDK — this module exists only to stand
   in for that feed. Two things matter about it:

   • The ten named archetypes are the exact profiles from the "Client Mapping
     Worked Examples" workbook, so a domain reviewer can look up a client they
     already argued about and check what the engine now says.

   • The remaining book is generated at a size that forces honest design. At
     640 clients no screen can afford one row per client at the top level, which
     is the constraint the real 10,000-client book will impose.

   Everything is seeded, so the same book is produced on every load.
   ========================================================================== */

import type { Client, ClientProfile, PaymentNature, Staff } from "./types.ts";

/* ---- Seeded PRNG (mulberry32) ------------------------------------------- */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STAFF: Staff[] = [
  { id: "s1", name: "Kartik Khandelwal", role: "Partner", initials: "KK" },
  { id: "s2", name: "Rohit Agarwal", role: "Senior", initials: "RA" },
  { id: "s3", name: "Neha Bhatt", role: "Article", initials: "NB" },
  { id: "s4", name: "Sanjay Iyer", role: "Manager", initials: "SI" },
  { id: "s5", name: "Divya Raghavan", role: "Senior", initials: "DR" },
  { id: "s6", name: "Imran Qureshi", role: "Article", initials: "IQ" },
  { id: "s7", name: "Meera Pillai", role: "Manager", initials: "MP" },
];

export const STAFF_BY_ID: Record<string, Staff> = Object.fromEntries(
  STAFF.map((s) => [s.id, s]),
);
export const UNASSIGNED: Staff = { id: "none", name: "Unassigned", role: "Article", initials: "—" };

export function staffOf(id: string): Staff {
  return STAFF_BY_ID[id] ?? UNASSIGNED;
}

/* ---- Geography ----------------------------------------------------------- */
/* QRMP state categories are the notified split that decides whether quarterly
   GSTR-3B is due on the 22nd or the 24th — a real difference staff must get
   right, so it is modelled rather than randomised. */

const STATES: { name: string; code: string; cat: "Category A" | "Category B" }[] = [
  { name: "Maharashtra", code: "27", cat: "Category A" },
  { name: "Karnataka", code: "29", cat: "Category A" },
  { name: "Gujarat", code: "24", cat: "Category A" },
  { name: "Tamil Nadu", code: "33", cat: "Category A" },
  { name: "Telangana", code: "36", cat: "Category A" },
  { name: "Kerala", code: "32", cat: "Category A" },
  { name: "Madhya Pradesh", code: "23", cat: "Category A" },
  { name: "Andhra Pradesh", code: "37", cat: "Category A" },
  { name: "Delhi", code: "07", cat: "Category B" },
  { name: "Uttar Pradesh", code: "09", cat: "Category B" },
  { name: "Rajasthan", code: "08", cat: "Category B" },
  { name: "West Bengal", code: "19", cat: "Category B" },
  { name: "Haryana", code: "06", cat: "Category B" },
  { name: "Punjab", code: "03", cat: "Category B" },
  { name: "Bihar", code: "10", cat: "Category B" },
  { name: "Odisha", code: "21", cat: "Category B" },
];

const PT_STATES = new Set([
  "Maharashtra", "Karnataka", "West Bengal", "Tamil Nadu", "Gujarat",
  "Madhya Pradesh", "Telangana", "Andhra Pradesh", "Kerala", "Odisha", "Bihar",
]);

/* ---- Name pools ---------------------------------------------------------- */

const FIRST = [
  "Ramesh", "Priya", "Anand", "Sunita", "Vikram", "Kavita", "Rahul", "Deepa",
  "Suresh", "Anita", "Manoj", "Rekha", "Arun", "Shalini", "Nitin", "Pooja",
  "Sanjay", "Meera", "Ajay", "Nisha", "Rajesh", "Swati", "Gopal", "Aarti",
  "Harish", "Lata", "Kiran", "Vandana", "Mohan", "Sneha", "Prakash", "Jyoti",
  "Naveen", "Ritu", "Ashok", "Bhavna", "Dinesh", "Geeta", "Farhan", "Zoya",
  "Imran", "Sadia", "Joseph", "Elizabeth", "Karan", "Tanvi", "Yash", "Ishita",
];

const LAST = [
  "Sharma", "Mehta", "Kumar", "Sethi", "Agarwal", "Bhatt", "Iyer", "Raghavan",
  "Qureshi", "Pillai", "Desai", "Nair", "Reddy", "Chopra", "Malhotra", "Bansal",
  "Joshi", "Kulkarni", "Patel", "Shah", "Gupta", "Verma", "Sinha", "Rao",
  "Menon", "Trivedi", "Chatterjee", "Banerjee", "Mistry", "Dutta", "Saxena", "Khanna",
];

const BIZ_A = [
  "Sunrise", "Metro", "BrightTech", "QuickCart", "Prime", "Global", "Apex", "Sterling",
  "Orbit", "Crescent", "Vertex", "Pinnacle", "Nova", "Harbour", "Summit", "Cobalt",
  "Meridian", "Anchor", "Beacon", "Cascade", "Trident", "Zenith", "Aurora", "Ridgeline",
  "Silverline", "Ironwood", "Blueprint", "Northstar", "Evergreen", "Redwood",
];
const BIZ_B = [
  "Traders", "Enterprises", "Industries", "Textiles", "Logistics", "Metals", "Foods",
  "Chemicals", "Motors", "Infratech", "Systems", "Exports", "Agro", "Pharma",
  "Retail", "Packaging", "Engineering", "Consulting", "Realty", "Electricals",
];

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

const PAN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function makePan(r: () => number, fourth: string, surname: string): string {
  const l = () => PAN_LETTERS[Math.floor(r() * 26)];
  const d = () => String(Math.floor(r() * 10));
  return `${l()}${l()}${l()}${fourth}${surname[0].toUpperCase()}${d()}${d()}${d()}${d()}${l()}`;
}

function makeGstin(r: () => number, stateCode: string, pan: string): string {
  return `${stateCode}${pan}1Z${PAN_LETTERS[Math.floor(r() * 26)]}`;
}

function makeCin(r: () => number, stateCode: string): string {
  const d = (n: number) => String(Math.floor(r() * Math.pow(10, n))).padStart(n, "0");
  return `U${d(5)}${stateCode === "27" ? "MH" : stateCode === "07" ? "DL" : "KA"}20${d(2)}PTC${d(6)}`;
}

/* =========================================================================
   ARCHETYPES — the ten worked examples, profile-for-profile
   ========================================================================= */

interface Archetype {
  key: string;
  label: string;
  weight: number;
  profile: (r: () => number, stateCat: "Category A" | "Category B", state: string) => ClientProfile;
  naming: "person" | "prop" | "company" | "llp" | "firm" | "trust";
}

const base = (over: Partial<ClientProfile>): ClientProfile => ({
  entityType: "Individual",
  residential: "Resident",
  totalIncome: 800000,
  turnover: 0,
  housePropertyCount: 1,
  agriculturalIncome: 0,
  hasCapitalGains: false,
  isDirector: false,
  holdsUnlistedShares: false,
  hasForeignAssets: false,
  hasBusinessIncome: false,
  presumptiveOpted: false,
  isPartnerInFirm: false,
  taxAuditApplicable: false,
  paymentNatures: [],
  gstRegType: "Unregistered",
  gstQrmpOpted: false,
  gstStateCategory: "Category A",
  isLlp: false,
  isDinHolder: false,
  hasDeposits: false,
  msmeDuesOverdue: false,
  section139Special: false,
  claimsSection11: false,
  hasTransferPricing: false,
  epfCovered: false,
  esiCovered: false,
  tdsPerQuarter: 0,
  monthlyPayroll: 0,
  discipline: 0.8,
  ...over,
});

const between = (r: () => number, lo: number, hi: number) => Math.round(lo + r() * (hi - lo));

const ARCHETYPES: Archetype[] = [
  {
    key: "salaried",
    label: "Salaried individual — ITR-1",
    weight: 20,
    naming: "person",
    profile: (r, cat) => base({
      totalIncome: between(r, 450000, 2400000),
      housePropertyCount: r() < 0.15 ? 2 : 1,
      hasCapitalGains: r() < 0.18,
      gstStateCategory: cat,
      discipline: 0.72 + r() * 0.26,
    }),
  },
  {
    key: "presumptive-prop",
    label: "Proprietor, presumptive 44AD — ITR-4",
    weight: 15,
    naming: "prop",
    profile: (r, cat, state) => {
      const turnover = between(r, 1500000, 14000000);
      return base({
        totalIncome: Math.round(turnover * (0.06 + r() * 0.05)),
        turnover,
        hasBusinessIncome: true,
        presumptiveOpted: true,
        gstRegType: "Regular",
        gstQrmpOpted: r() < 0.72,
        gstStateCategory: cat,
        professionalTaxState: PT_STATES.has(state) ? state : undefined,
        discipline: 0.55 + r() * 0.4,
      });
    },
  },
  {
    key: "professional",
    label: "Professional, tax audit — ITR-3",
    weight: 10,
    naming: "prop",
    profile: (r, cat, state) => {
      const turnover = between(r, 9000000, 34000000);
      return base({
        totalIncome: Math.round(turnover * (0.28 + r() * 0.14)),
        turnover,
        hasBusinessIncome: true,
        presumptiveOpted: false,
        taxAuditApplicable: true,
        paymentNatures: ["Contractor", "Rent", "Professional Fees"] as PaymentNature[],
        tdsPerQuarter: between(r, 45000, 320000),
        gstRegType: "Regular",
        gstQrmpOpted: r() < 0.6,
        gstStateCategory: cat,
        professionalTaxState: PT_STATES.has(state) ? state : undefined,
        epfCovered: r() < 0.35,
        monthlyPayroll: between(r, 120000, 700000),
        discipline: 0.6 + r() * 0.35,
      });
    },
  },
  {
    key: "composition",
    label: "Composition dealer — CMP-08 / GSTR-4",
    weight: 7,
    naming: "prop",
    profile: (r, cat, state) => {
      const turnover = between(r, 900000, 7000000);
      return base({
        totalIncome: Math.round(turnover * (0.07 + r() * 0.04)),
        turnover,
        hasBusinessIncome: true,
        presumptiveOpted: true,
        gstRegType: "Composition",
        gstStateCategory: cat,
        professionalTaxState: PT_STATES.has(state) ? state : undefined,
        discipline: 0.45 + r() * 0.4,
      });
    },
  },
  {
    key: "firm",
    label: "Partnership firm — ITR-5",
    weight: 9,
    naming: "firm",
    profile: (r, cat, state) => {
      const turnover = between(r, 12000000, 90000000);
      return base({
        entityType: "Firm",
        totalIncome: Math.round(turnover * (0.08 + r() * 0.06)),
        turnover,
        hasBusinessIncome: true,
        taxAuditApplicable: turnover > 10000000,
        paymentNatures: ["Salary", "Contractor", "Rent"] as PaymentNature[],
        tdsPerQuarter: between(r, 90000, 900000),
        gstRegType: "Regular",
        gstQrmpOpted: turnover <= 50000000 && r() < 0.5,
        gstStateCategory: cat,
        epfCovered: true,
        esiCovered: r() < 0.6,
        monthlyPayroll: between(r, 400000, 2600000),
        professionalTaxState: PT_STATES.has(state) ? state : undefined,
        discipline: 0.6 + r() * 0.35,
      });
    },
  },
  {
    key: "llp",
    label: "LLP — Form 11 / Form 8",
    weight: 9,
    naming: "llp",
    profile: (r, cat, state) => {
      const turnover = between(r, 20000000, 140000000);
      return base({
        entityType: "LLP",
        isLlp: true,
        isDinHolder: true,
        totalIncome: Math.round(turnover * (0.07 + r() * 0.06)),
        turnover,
        hasBusinessIncome: true,
        taxAuditApplicable: true,
        paymentNatures: ["Salary", "Contractor", "Professional Fees"] as PaymentNature[],
        tdsPerQuarter: between(r, 150000, 1400000),
        gstRegType: "Regular",
        gstQrmpOpted: turnover <= 50000000 && r() < 0.55,
        gstStateCategory: cat,
        epfCovered: true,
        esiCovered: r() < 0.7,
        monthlyPayroll: between(r, 600000, 4000000),
        professionalTaxState: PT_STATES.has(state) ? state : undefined,
        discipline: 0.65 + r() * 0.3,
      });
    },
  },
  {
    key: "pvt-small",
    label: "OPC / small company — MGT-7A",
    weight: 8,
    naming: "company",
    profile: (r, cat, state) => {
      const turnover = between(r, 4000000, 38000000);
      return base({
        entityType: "Company",
        companyType: r() < 0.45 ? "OPC" : "Small Company",
        isDirector: true,
        isDinHolder: true,
        holdsUnlistedShares: true,
        totalIncome: Math.round(turnover * (0.07 + r() * 0.05)),
        turnover,
        hasBusinessIncome: true,
        taxAuditApplicable: turnover > 10000000,
        paymentNatures: ["Salary", "Contractor", "Rent"] as PaymentNature[],
        tdsPerQuarter: between(r, 60000, 500000),
        gstRegType: "Regular",
        gstQrmpOpted: r() < 0.6,
        gstStateCategory: cat,
        hasDeposits: r() < 0.5,
        msmeDuesOverdue: r() < 0.3,
        epfCovered: r() < 0.8,
        esiCovered: r() < 0.5,
        monthlyPayroll: between(r, 250000, 1600000),
        professionalTaxState: PT_STATES.has(state) ? state : undefined,
        discipline: 0.6 + r() * 0.35,
      });
    },
  },
  {
    key: "pvt-large",
    label: "Private company > ₹5cr — monthly GST, GSTR-9C",
    weight: 12,
    naming: "company",
    profile: (r, cat, state) => {
      const turnover = between(r, 60000000, 900000000);
      return base({
        entityType: "Company",
        companyType: "Private",
        isDirector: true,
        isDinHolder: true,
        holdsUnlistedShares: true,
        totalIncome: Math.round(turnover * (0.06 + r() * 0.06)),
        turnover,
        hasBusinessIncome: true,
        taxAuditApplicable: true,
        hasTransferPricing: r() < 0.12,
        paymentNatures: (r() < 0.3
          ? ["Salary", "Contractor", "Rent", "Professional Fees", "Non-Resident"]
          : ["Salary", "Contractor", "Rent", "Professional Fees"]) as PaymentNature[],
        tdsPerQuarter: between(r, 600000, 9000000),
        gstRegType: "Regular",
        gstQrmpOpted: false,
        gstStateCategory: cat,
        hasDeposits: r() < 0.6,
        msmeDuesOverdue: r() < 0.4,
        epfCovered: true,
        esiCovered: true,
        monthlyPayroll: between(r, 2000000, 22000000),
        professionalTaxState: PT_STATES.has(state) ? state : undefined,
        discipline: 0.7 + r() * 0.28,
      });
    },
  },
  {
    key: "ecommerce",
    label: "E-commerce operator — GSTR-8",
    weight: 3,
    naming: "company",
    profile: (r, cat, state) => {
      const turnover = between(r, 80000000, 600000000);
      return base({
        entityType: "Company",
        companyType: "Private",
        isDirector: true,
        isDinHolder: true,
        holdsUnlistedShares: true,
        totalIncome: Math.round(turnover * 0.05),
        turnover,
        hasBusinessIncome: true,
        taxAuditApplicable: true,
        paymentNatures: ["Salary", "Contractor", "Commission"] as PaymentNature[],
        tdsPerQuarter: between(r, 500000, 6000000),
        gstRegType: "E-commerce Operator",
        gstStateCategory: cat,
        hasDeposits: r() < 0.5,
        epfCovered: true,
        esiCovered: true,
        monthlyPayroll: between(r, 1800000, 12000000),
        professionalTaxState: PT_STATES.has(state) ? state : undefined,
        discipline: 0.72 + r() * 0.25,
      });
    },
  },
  {
    key: "trust",
    label: "Charitable trust — ITR-7",
    weight: 3,
    naming: "trust",
    profile: (r, cat, state) => base({
      entityType: "Trust",
      section139Special: true,
      claimsSection11: true,
      totalIncome: between(r, 2000000, 40000000),
      turnover: between(r, 2000000, 40000000),
      taxAuditApplicable: r() < 0.6,
      paymentNatures: ["Salary", "Contractor"] as PaymentNature[],
      tdsPerQuarter: between(r, 40000, 400000),
      gstStateCategory: cat,
      epfCovered: r() < 0.6,
      esiCovered: r() < 0.4,
      monthlyPayroll: between(r, 200000, 1400000),
      professionalTaxState: PT_STATES.has(state) ? state : undefined,
      discipline: 0.5 + r() * 0.4,
    }),
  },
  {
    key: "gst-tds",
    label: "GST TDS deductor — GSTR-7",
    weight: 2,
    naming: "company",
    profile: (r, cat, state) => base({
      entityType: "Company",
      companyType: "Public",
      isDirector: true,
      isDinHolder: true,
      totalIncome: between(r, 20000000, 120000000),
      turnover: between(r, 100000000, 700000000),
      hasBusinessIncome: true,
      taxAuditApplicable: true,
      paymentNatures: ["Salary", "Contractor"] as PaymentNature[],
      tdsPerQuarter: between(r, 800000, 5000000),
      gstRegType: "TDS Deductor",
      gstStateCategory: cat,
      epfCovered: true,
      esiCovered: true,
      monthlyPayroll: between(r, 3000000, 15000000),
      professionalTaxState: PT_STATES.has(state) ? state : undefined,
      discipline: 0.75 + r() * 0.2,
    }),
  },
  {
    key: "aop",
    label: "AOP / BOI — ITR-5",
    weight: 2,
    naming: "firm",
    profile: (r, cat, state) => base({
      entityType: "AOP/BOI",
      totalIncome: between(r, 1500000, 20000000),
      turnover: between(r, 5000000, 45000000),
      hasBusinessIncome: true,
      taxAuditApplicable: r() < 0.5,
      paymentNatures: ["Contractor", "Rent"] as PaymentNature[],
      tdsPerQuarter: between(r, 30000, 300000),
      gstRegType: r() < 0.7 ? "Regular" : "Unregistered",
      gstQrmpOpted: r() < 0.6,
      gstStateCategory: cat,
      professionalTaxState: PT_STATES.has(state) ? state : undefined,
      discipline: 0.5 + r() * 0.4,
    }),
  },
];

/* =========================================================================
   THE TEN WORKED EXAMPLES — verbatim from the domain review workbook
   ========================================================================= */

const WORKED: { name: string; legalName: string; archetype: string; state: string; staff: string; over: Partial<ClientProfile> }[] = [
  {
    name: "Ramesh Sharma", legalName: "Ramesh Sharma", archetype: "salaried",
    state: "Maharashtra", staff: "s3",
    over: { totalIncome: 1450000, housePropertyCount: 1, discipline: 0.95 },
  },
  {
    name: "Priya Enterprises", legalName: "Priya Mehta", archetype: "presumptive-prop",
    state: "Delhi", staff: "s2",
    over: { totalIncome: 980000, turnover: 12200000, presumptiveOpted: true, hasBusinessIncome: true, gstRegType: "Regular", gstQrmpOpted: false, gstStateCategory: "Category B", discipline: 0.28 },
  },
  {
    name: "Anand & Associates", legalName: "Anand Kumar", archetype: "professional",
    state: "Karnataka", staff: "s3",
    over: { totalIncome: 5600000, turnover: 18500000, taxAuditApplicable: true, presumptiveOpted: false, gstQrmpOpted: true, gstStateCategory: "Category A", discipline: 0.82 },
  },
  {
    name: "Sunrise Traders LLP", legalName: "Sunrise Traders LLP", archetype: "llp",
    state: "West Bengal", staff: "s2",
    over: { turnover: 30000000, totalIncome: 2400000, gstQrmpOpted: true, gstStateCategory: "Category B", discipline: 0.44 },
  },
  {
    name: "BrightTech Private Limited", legalName: "BrightTech Private Limited", archetype: "pvt-large",
    state: "Karnataka", staff: "s2",
    over: { turnover: 80000000, totalIncome: 6400000, gstStateCategory: "Category A", discipline: 0.86 },
  },
  {
    name: "Metro OPC Private Limited", legalName: "Metro OPC Private Limited", archetype: "pvt-small",
    state: "Maharashtra", staff: "s3",
    over: { companyType: "OPC", turnover: 22000000, totalIncome: 1900000, gstStateCategory: "Category A", discipline: 0.61 },
  },
  {
    name: "QuickCart E-commerce Pvt Ltd", legalName: "QuickCart E-commerce Private Limited", archetype: "ecommerce",
    state: "Telangana", staff: "s2",
    over: { turnover: 240000000, gstStateCategory: "Category A", discipline: 0.9 },
  },
  {
    name: "Sethi Composition Traders", legalName: "Sunita Sethi", archetype: "composition",
    state: "Rajasthan", staff: "s3",
    over: { turnover: 4200000, totalIncome: 380000, gstStateCategory: "Category B", discipline: 0.35 },
  },
  {
    name: "Sacred Learning Trust", legalName: "Sacred Learning Trust", archetype: "trust",
    state: "Tamil Nadu", staff: "s2",
    over: { totalIncome: 18000000, turnover: 18000000, taxAuditApplicable: true, discipline: 0.52 },
  },
  {
    name: "Prime Metals & Minerals Ltd", legalName: "Prime Metals & Minerals Limited", archetype: "pvt-large",
    state: "Gujarat", staff: "s2",
    over: { turnover: 150000000, totalIncome: 11000000, hasTransferPricing: false, gstStateCategory: "Category A", discipline: 0.58 },
  },
];

/* =========================================================================
   BUILD
   ========================================================================= */

const CLIENT_COUNT = 640;

function buildClients(): Client[] {
  const r = rng(20260806);
  const out: Client[] = [];

  const stateOf = (name: string) => STATES.find((s) => s.name === name) ?? STATES[0];
  const arcOf = (key: string) => ARCHETYPES.find((a) => a.key === key)!;

  /* --- the ten worked examples, in order, as C001…C010 ------------------ */
  WORKED.forEach((w, i) => {
    const st = stateOf(w.state);
    const arc = arcOf(w.archetype);
    const profile: ClientProfile = { ...arc.profile(r, st.cat, st.name), ...w.over, gstStateCategory: (w.over.gstStateCategory ?? st.cat) };
    const surname = w.legalName.split(" ").pop() || "X";
    const fourth = profile.entityType === "Company" ? "C" : profile.entityType === "Firm" ? "F" : profile.entityType === "LLP" ? "F" : profile.entityType === "Trust" ? "T" : "P";
    const pan = makePan(r, fourth, surname);
    out.push({
      id: `C${String(i + 1).padStart(3, "0")}`,
      name: w.name,
      legalName: w.legalName,
      pan,
      gstin: profile.gstRegType === "Unregistered" ? undefined : makeGstin(r, st.code, pan),
      cin: profile.entityType === "Company" ? makeCin(r, st.code) : undefined,
      state: st.name,
      assigneeId: w.staff,
      archetype: arc.label,
      profile,
      whatsapp: true,
      email: `${w.legalName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.in`,
      phone: `+91 9${String(Math.floor(r() * 900000000) + 100000000)}`,
    });
  });

  /* --- the rest of the book -------------------------------------------- */
  const pool: Archetype[] = [];
  ARCHETYPES.forEach((a) => {
    for (let i = 0; i < a.weight; i++) pool.push(a);
  });

  for (let i = WORKED.length; i < CLIENT_COUNT; i++) {
    const arc = pick(r, pool);
    const st = pick(r, STATES);
    const profile = arc.profile(r, st.cat, st.name);
    const first = pick(r, FIRST);
    const last = pick(r, LAST);

    let name: string;
    let legalName: string;
    switch (arc.naming) {
      case "person":
        name = `${first} ${last}`;
        legalName = name;
        break;
      case "prop":
        name = `${last} ${pick(r, BIZ_B)}`;
        legalName = `${first} ${last}`;
        break;
      case "company":
        name = `${pick(r, BIZ_A)} ${pick(r, BIZ_B)} Pvt Ltd`;
        legalName = name.replace("Pvt Ltd", "Private Limited");
        break;
      case "llp":
        name = `${pick(r, BIZ_A)} ${pick(r, BIZ_B)} LLP`;
        legalName = name;
        break;
      case "trust":
        name = `${pick(r, BIZ_A)} ${pick(r, ["Charitable Trust", "Educational Trust", "Welfare Trust"])}`;
        legalName = name;
        break;
      default:
        name = `${last} & ${pick(r, LAST)}`;
        legalName = `${name} (Partnership Firm)`;
    }

    const surname = arc.naming === "person" || arc.naming === "prop" ? last : name.split(" ")[0];
    const fourth = profile.entityType === "Company" ? "C"
      : profile.entityType === "Firm" || profile.entityType === "LLP" ? "F"
        : profile.entityType === "Trust" ? "T"
          : profile.entityType === "AOP/BOI" ? "A" : "P";
    const pan = makePan(r, fourth, surname);

    /* ~6% of the book is deliberately unassigned — the gap a team view has to
       surface, not hide. */
    const assigneeId = r() < 0.06 ? "none" : pick(r, STAFF).id;

    out.push({
      id: `C${String(i + 1).padStart(3, "0")}`,
      name,
      legalName,
      pan,
      gstin: profile.gstRegType === "Unregistered" ? undefined : makeGstin(r, st.code, pan),
      cin: profile.entityType === "Company" ? makeCin(r, st.code) : undefined,
      state: st.name,
      assigneeId,
      archetype: arc.label,
      profile: { ...profile, gstStateCategory: st.cat },
      whatsapp: r() < 0.88,
      email: `${legalName.toLowerCase().replace(/[^a-z]+/g, ".").slice(0, 26)}@example.in`,
      phone: `+91 9${String(Math.floor(r() * 900000000) + 100000000)}`,
    });
  }

  return out;
}

export const CLIENTS: Client[] = buildClients();
export const CLIENT_BY_ID: Record<string, Client> = Object.fromEntries(
  CLIENTS.map((c) => [c.id, c]),
);
export const WORKED_EXAMPLE_IDS = WORKED.map((_, i) => `C${String(i + 1).padStart(3, "0")}`);
export const ALL_STATES = STATES.map((s) => s.name);
