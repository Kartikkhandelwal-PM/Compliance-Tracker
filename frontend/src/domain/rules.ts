/* ============================================================================
   RULE ENGINE
   ----------------------------------------------------------------------------
   Two jobs, kept strictly separate:

     1. APPLICABILITY — which compliances attach to a client, and *why*.
        Every decision returns a RuleHit carrying the rule reference, the
        condition text, and the profile fields that actually fired. Nothing in
        this engine is allowed to reach the UI without an explanation attached;
        staff will not trust an ITR-4-vs-ITR-1 call they cannot audit.

     2. EXPOSURE — what a missed deadline costs per day, from the late-fee
        model on each compliance definition.

   Ordering follows the "Applicability & Status Rules" workbook: the ITR ladder
   is priority-ordered, first match wins.
   ========================================================================== */

import type { Client, ClientProfile, ComplianceDef, RuleHit } from "./types.ts";
import { DEF_BY_CODE } from "./catalog.ts";
import { inr } from "./dates.ts";

/* -------------------------------------------------------------------------
   Helpers for building auditable facts
   ------------------------------------------------------------------------- */

type Fact = { field: string; value: string };
const f = (field: string, value: string | number | boolean): Fact => ({
  field,
  value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value),
});
const money = (n: number) => `₹${inr(n)}`;

const CR = 10000000;
const LAKH = 100000;

/* -------------------------------------------------------------------------
   Rough tax estimate — used for advance-tax applicability and 234A/234C
   interest exposure. Deliberately approximate and labelled as such wherever
   it surfaces.
   ------------------------------------------------------------------------- */

export function estimatedTax(p: ClientProfile): number {
  if (p.entityType === "Company") return Math.round(p.totalIncome * 0.2517);
  if (p.entityType === "LLP" || p.entityType === "Firm") return Math.round(p.totalIncome * 0.312);
  if (p.entityType === "Trust") return 0;
  // Individual / HUF — new regime slabs, approximate
  const i = p.totalIncome;
  if (i <= 700000) return 0;
  let t = 0;
  const slabs: [number, number][] = [
    [300000, 0], [700000, 0.05], [1000000, 0.1],
    [1200000, 0.15], [1500000, 0.2], [Infinity, 0.3],
  ];
  let prev = 0;
  for (const [upTo, rate] of slabs) {
    if (i > prev) t += (Math.min(i, upTo) - prev) * rate;
    prev = upTo;
    if (i <= upTo) break;
  }
  return Math.round(t * 1.04);
}

/* =========================================================================
   1 · ITR FORM LADDER — priority-ordered, first match wins
   ========================================================================= */

export interface ItrDecision {
  form: string;
  hit: RuleHit;
}

export function decideItrForm(p: ClientProfile): ItrDecision {
  const ref = (n: number) => `ITR Form Applicability · Priority ${n}`;

  if (p.section139Special) {
    return {
      form: "ITR-7",
      hit: {
        ruleRef: ref(1),
        condition:
          "Required to furnish a return under section 139(4A), (4B), (4C) or (4D) — trusts, political parties, research institutions and similar bodies.",
        facts: [f("Entity type", p.entityType), f("s.139(4A)–(4D) applies", true)],
      },
    };
  }

  if (p.entityType === "Company" && !p.claimsSection11) {
    return {
      form: "ITR-6",
      hit: {
        ruleRef: ref(2),
        condition: "Is a company. Excluded if it claims exemption under section 11 (income from property held for charitable purposes).",
        facts: [f("Entity type", p.entityType), f("Claims s.11 exemption", false)],
      },
    };
  }

  if (p.entityType !== "Individual" && p.entityType !== "HUF" && p.entityType !== "Company") {
    return {
      form: "ITR-5",
      hit: {
        ruleRef: ref(3),
        condition: "Not an individual, HUF or company — firms, LLPs, AOP/BOI. Excluded if required to file ITR-7.",
        facts: [f("Entity type", p.entityType), f("Is LLP", p.isLlp)],
      },
    };
  }

  const itr4Blockers: Fact[] = [];
  if (p.hasCapitalGains) itr4Blockers.push(f("Has capital gains", true));
  if (p.isDirector) itr4Blockers.push(f("Is a director", true));
  if (p.holdsUnlistedShares) itr4Blockers.push(f("Holds unlisted shares", true));
  if (p.hasForeignAssets) itr4Blockers.push(f("Foreign assets / income", true));
  if (p.housePropertyCount > 1) itr4Blockers.push(f("House properties", p.housePropertyCount));

  if (
    p.residential === "Resident" &&
    p.presumptiveOpted &&
    p.hasBusinessIncome &&
    p.totalIncome <= 50 * LAKH &&
    itr4Blockers.length === 0
  ) {
    return {
      form: "ITR-4 (Sugam)",
      hit: {
        ruleRef: ref(4),
        condition:
          "Resident Individual / HUF / non-LLP Firm opting for the presumptive scheme (44AD / 44ADA / 44AE) with total income up to ₹50 lakh. Excluded on capital gains, directorship, unlisted shares, foreign assets, or more than one house property.",
        facts: [
          f("Residential status", p.residential),
          f("Presumptive scheme opted", true),
          f("Total income", money(p.totalIncome)),
          f("House properties", p.housePropertyCount),
        ],
      },
    };
  }

  if (p.hasBusinessIncome) {
    return {
      form: "ITR-3",
      hit: {
        ruleRef: ref(5),
        condition: "Individual or HUF with income from business or profession that does not qualify for ITR-4.",
        facts: [
          f("Has business / profession income", true),
          f("Presumptive scheme opted", p.presumptiveOpted),
          ...itr4Blockers,
        ],
      },
    };
  }

  if (p.hasCapitalGains || p.housePropertyCount > 1 || p.hasForeignAssets || p.holdsUnlistedShares || p.isDirector) {
    return {
      form: "ITR-2",
      hit: {
        ruleRef: ref(6),
        condition: "Individual or HUF with capital gains and/or more than one house property, and no business or profession income.",
        facts: [
          f("Has capital gains", p.hasCapitalGains),
          f("House properties", p.housePropertyCount),
          f("Has business income", false),
        ],
      },
    };
  }

  return {
    form: "ITR-1 (Sahaj)",
    hit: {
      ruleRef: ref(7),
      condition:
        "Resident individual with total income up to ₹50 lakh from salary, one house property and other sources, with agricultural income up to ₹5,000, and no exclusion from ITR-2 / ITR-3 / ITR-4.",
      facts: [
        f("Residential status", p.residential),
        f("Total income", money(p.totalIncome)),
        f("House properties", p.housePropertyCount),
        f("Agricultural income", money(p.agriculturalIncome)),
      ],
    },
  };
}

/* =========================================================================
   2 · APPLICABILITY — which defs attach, and why
   ========================================================================= */

export interface Applicable {
  defCode: string;
  /** Display form — may be more specific than the def (ITR-4, MGT-7A). */
  form: string;
  hit: RuleHit;
}

export function applicableCompliances(c: Client): Applicable[] {
  const p = c.profile;
  const out: Applicable[] = [];
  const add = (defCode: string, hit: RuleHit, form?: string) => {
    const def = DEF_BY_CODE[defCode];
    if (def) out.push({ defCode, form: form ?? def.form, hit });
  };

  /* ---- Income Tax: return + audit ------------------------------------- */
  const itr = decideItrForm(p);
  const auditRoute = p.hasTransferPricing
    ? "ITR-TP"
    : p.taxAuditApplicable || p.entityType === "Company" || p.isLlp
      ? "ITR-AUDIT"
      : "ITR-NONAUDIT";

  add(auditRoute, {
    ruleRef: itr.hit.ruleRef,
    condition: itr.hit.condition,
    facts: [
      ...itr.hit.facts,
      f("Tax audit applicable", p.taxAuditApplicable),
      f("Due-date route", DEF_BY_CODE[auditRoute].dueRule),
    ],
  }, itr.form);

  if (p.taxAuditApplicable) {
    add("TAX-AUDIT", {
      ruleRef: "Income Tax · s.44AB",
      condition: "Assessee liable to tax audit under section 44AB — turnover or gross receipts exceed the prescribed threshold.",
      facts: [f("Turnover (preceding FY)", money(p.turnover)), f("Entity type", p.entityType)],
    });
  }

  const estTax = estimatedTax(p);
  if (estTax > 10000) {
    add("ADV-TAX", {
      ruleRef: "Income Tax · s.208",
      condition: "Advance tax is payable where the estimated tax liability for the year is ₹10,000 or more.",
      facts: [f("Estimated tax liability", money(estTax)), f("Total income", money(p.totalIncome))],
    });
  }

  /* ---- GST ------------------------------------------------------------- */
  const gstFacts = [
    f("GST registration", p.gstRegType),
    f("Turnover (preceding FY)", money(p.turnover)),
    f("QRMP opted", p.gstQrmpOpted),
    f("State category", p.gstStateCategory),
  ];

  if (p.gstRegType === "Regular") {
    if (p.turnover > 5 * CR) {
      add("GSTR-1", {
        ruleRef: "GST Return Type Mapping · Regular > ₹5cr",
        condition: "Regular taxpayer with turnover above ₹5 crore — monthly filing is mandatory, the QRMP option is not available.",
        facts: gstFacts,
      });
      add("GSTR-3B", {
        ruleRef: "GST Return Type Mapping · Regular > ₹5cr",
        condition: "Regular taxpayer with turnover above ₹5 crore — monthly filing is mandatory, the QRMP option is not available.",
        facts: gstFacts,
      });
      add("GSTR-9C", {
        ruleRef: "GST Return Type Mapping · GSTR-9C",
        condition: "Self-certified reconciliation statement is required where turnover exceeds ₹5 crore.",
        facts: gstFacts,
      });
    } else if (p.gstQrmpOpted) {
      add("GSTR-1-QRMP", {
        ruleRef: "GST Return Type Mapping · QRMP",
        condition: "Regular taxpayer with turnover up to ₹5 crore who has opted into QRMP — quarterly GSTR-1 with optional monthly IFF.",
        facts: gstFacts,
      });
      add(p.gstStateCategory === "Category A" ? "GSTR-3B-QRMP-A" : "GSTR-3B-QRMP-B", {
        ruleRef: `GST Return Type Mapping · QRMP ${p.gstStateCategory}`,
        condition: `QRMP taxpayer in a ${p.gstStateCategory} state — quarterly GSTR-3B due on the ${p.gstStateCategory === "Category A" ? "22nd" : "24th"} of the month following the quarter.`,
        facts: [...gstFacts, f("State", c.state)],
      });
    } else {
      add("GSTR-1", {
        ruleRef: "GST Return Type Mapping · Regular ≤ ₹5cr",
        condition: "Regular taxpayer with turnover up to ₹5 crore that has not opted into QRMP — monthly GSTR-1 and GSTR-3B.",
        facts: gstFacts,
      });
      add("GSTR-3B", {
        ruleRef: "GST Return Type Mapping · Regular ≤ ₹5cr",
        condition: "Regular taxpayer with turnover up to ₹5 crore that has not opted into QRMP — monthly GSTR-1 and GSTR-3B.",
        facts: gstFacts,
      });
    }

    if (p.turnover > 2 * CR) {
      add("GSTR-9", {
        ruleRef: "GST Return Type Mapping · GSTR-9",
        condition: "Annual return is mandatory for regular taxpayers with turnover above the notified threshold of ₹2 crore.",
        facts: gstFacts,
      });
    }
  } else if (p.gstRegType === "Composition") {
    add("CMP-08", {
      ruleRef: "GST Return Type Mapping · Composition",
      condition: "Composition scheme taxpayer — quarterly tax payment through CMP-08 and an annual return in GSTR-4.",
      facts: gstFacts,
    });
    add("GSTR-4", {
      ruleRef: "GST Return Type Mapping · Composition",
      condition: "Composition scheme taxpayer — quarterly tax payment through CMP-08 and an annual return in GSTR-4.",
      facts: gstFacts,
    });
  } else if (p.gstRegType === "TDS Deductor") {
    add("GSTR-7", {
      ruleRef: "GST Return Type Mapping · s.51",
      condition: "TDS deductor registered under GST (section 51) — monthly GSTR-7.",
      facts: gstFacts,
    });
  } else if (p.gstRegType === "E-commerce Operator") {
    add("GSTR-8", {
      ruleRef: "GST Return Type Mapping · s.52",
      condition: "E-commerce operator (section 52) — monthly TCS return in GSTR-8.",
      facts: gstFacts,
    });
    if (p.turnover > 5 * CR) {
      add("GSTR-3B", {
        ruleRef: "GST Return Type Mapping · Regular > ₹5cr",
        condition: "The operator also holds a regular registration with turnover above ₹5 crore — monthly GSTR-3B applies.",
        facts: gstFacts,
      });
      add("GSTR-1", {
        ruleRef: "GST Return Type Mapping · Regular > ₹5cr",
        condition: "The operator also holds a regular registration with turnover above ₹5 crore — monthly GSTR-1 applies.",
        facts: gstFacts,
      });
    }
  }

  /* ---- TDS / TCS ------------------------------------------------------- */
  const entityAlwaysDeducts =
    p.entityType === "Company" || p.entityType === "Firm" || p.entityType === "LLP" || p.entityType === "Trust";
  const deductorLiable = entityAlwaysDeducts || p.taxAuditApplicable;

  const deductorFacts = [
    f("Entity type", p.entityType),
    f("Tax audit applicable (preceding FY)", p.taxAuditApplicable),
    f("Payments made", p.paymentNatures.join(", ") || "—"),
  ];

  if (deductorLiable && p.paymentNatures.includes("Salary")) {
    add("24Q", {
      ruleRef: "TDS Return Form Mapping · 24Q",
      condition: "Every employer paying salary that, after deductions, exceeds the basic exemption limit must deduct under section 192 and file Form 24Q quarterly.",
      facts: deductorFacts,
    });
  }

  const nonSalary: string[] = ["Contractor", "Rent", "Professional Fees", "Interest", "Commission"];
  if (deductorLiable && p.paymentNatures.some((n) => nonSalary.includes(n))) {
    add("26Q", {
      ruleRef: "TDS Return Form Mapping · 26Q",
      condition: entityAlwaysDeducts
        ? "Companies, firms and LLPs are always liable to deduct on non-salary payments above the section thresholds — Form 26Q quarterly."
        : "An individual or HUF subject to tax audit in the preceding financial year is liable to deduct on non-salary payments — Form 26Q quarterly.",
      facts: deductorFacts,
    });
  }

  if (p.paymentNatures.includes("Non-Resident")) {
    add("27Q", {
      ruleRef: "TDS Return Form Mapping · 27Q",
      condition: "Any person making a payment to a non-resident, other than salary, must deduct under section 195 and file Form 27Q quarterly.",
      facts: deductorFacts,
    });
  }

  if (p.turnover > 10 * CR) {
    add("27EQ", {
      ruleRef: "TDS Return Form Mapping · 27EQ",
      condition: "A seller is liable to collect tax at source under section 206C(1H) where turnover in the preceding year exceeds ₹10 crore.",
      facts: [f("Turnover (preceding FY)", money(p.turnover))],
    });
  }

  if (out.some((o) => ["24Q", "26Q", "27Q", "27EQ"].includes(o.defCode))) {
    add("TDS-CHALLAN", {
      ruleRef: "Income Tax · s.200(1) r/w Rule 30",
      condition: "Tax deducted or collected must be deposited by the 7th of the following month (30 April for deductions made in March).",
      facts: [f("Quarterly TDS deducted (est.)", money(p.tdsPerQuarter))],
    });
  }

  /* ---- ROC / MCA ------------------------------------------------------- */
  if (p.entityType === "Company") {
    const abridged = p.companyType === "OPC" || p.companyType === "Small Company";
    add("AOC-4", {
      ruleRef: "ROC/MCA Form Applicability · All companies",
      condition: "Baseline annual filing for every company — financial statements in AOC-4 within 30 days of the AGM.",
      facts: [f("Entity type", p.entityType), f("Company type", p.companyType ?? "—")],
    });
    add("MGT-7", {
      ruleRef: abridged
        ? "ROC/MCA Form Applicability · Small company / OPC"
        : "ROC/MCA Form Applicability · All companies",
      condition: abridged
        ? "OPCs and small companies file the abridged annual return in MGT-7A instead of MGT-7."
        : "Annual return in MGT-7 within 60 days of the AGM.",
      facts: [f("Company type", p.companyType ?? "—"), f("Turnover", money(p.turnover))],
    }, abridged ? "MGT-7A" : "MGT-7");

    if (p.hasDeposits) {
      add("DPT-3", {
        ruleRef: "ROC/MCA Form Applicability · DPT-3",
        condition: "A company holding deposits, or receipts treated as not being deposits, files DPT-3 annually by 30 June.",
        facts: [f("Has deposits / exempt receipts", true)],
      });
    }
    if (p.msmeDuesOverdue) {
      add("MSME-1", {
        ruleRef: "ROC/MCA Form Applicability · MSME-1",
        condition: "A company with dues to MSME suppliers outstanding beyond 45 days files the half-yearly MSME-1 return.",
        facts: [f("MSME dues outstanding > 45 days", true)],
      });
    }
  }

  if (p.isLlp) {
    add("LLP-11", {
      ruleRef: "ROC/MCA Form Applicability · LLP",
      condition: "An LLP follows the LLP Act rather than the Companies Act — Form 11 annual return by 30 May and Form 8 by 30 October.",
      facts: [f("Is LLP", true)],
    });
    add("LLP-8", {
      ruleRef: "ROC/MCA Form Applicability · LLP",
      condition: "An LLP follows the LLP Act rather than the Companies Act — Form 11 annual return by 30 May and Form 8 by 30 October.",
      facts: [f("Is LLP", true)],
    });
  }

  if (p.isDinHolder) {
    add("DIR-3-KYC", {
      ruleRef: "ROC/MCA Form Applicability · DIR-3 KYC",
      condition: "Every DIN holder files director KYC by 30 September each year, regardless of the company's own filing position.",
      facts: [f("Holds a DIN", true), f("Is a director", p.isDirector)],
    });
  }

  /* ---- Other statutory -------------------------------------------------- */
  if (p.epfCovered) {
    add("PF-ECR", {
      ruleRef: "Other Statutory · EPF Act",
      condition: "An establishment covered under the EPF Act deposits contributions and uploads the ECR by the 15th of the following month.",
      facts: [f("EPF covered", true), f("Monthly payroll (est.)", money(p.monthlyPayroll))],
    });
  }
  if (p.esiCovered) {
    add("ESI", {
      ruleRef: "Other Statutory · ESI Act",
      condition: "An establishment covered under the ESI Act deposits contributions by the 15th of the following month.",
      facts: [f("ESI covered", true), f("Monthly payroll (est.)", money(p.monthlyPayroll))],
    });
  }
  if (p.professionalTaxState) {
    add("PTAX", {
      ruleRef: "Other Statutory · Professional Tax",
      condition: "Professional tax is a state levy. Rates, forms and periodicity vary — the due date shown is the common annual enrolment date and must be verified against the state's own schedule.",
      facts: [f("PT state", p.professionalTaxState)],
    });
  }

  return out;
}

/* =========================================================================
   3 · EXPOSURE — what a missed deadline costs
   ========================================================================= */

/** GSTR-1 / GSTR-3B late-fee cap follows a turnover slab. */
function gstSlabCap(turnover: number): number {
  if (turnover <= 1.5 * CR) return 2000;
  if (turnover <= 5 * CR) return 5000;
  return 10000;
}

export interface Exposure {
  amount: number;
  formula: string;
  /** ₹ accruing each further day — 0 for flat and capped-out penalties */
  perDay: number;
}

export function estimateExposure(def: ComplianceDef, daysOverdue: number, c: Client): Exposure {
  if (daysOverdue <= 0) return { amount: 0, formula: "Not yet due — no penalty accruing.", perDay: 0 };
  const p = c.profile;
  const lf = def.lateFee;

  switch (lf.kind) {
    case "perDay": {
      let cap: number | undefined;
      if (typeof lf.cap === "number") cap = lf.cap;
      else if (lf.cap === "tdsAmount") cap = Math.max(p.tdsPerQuarter, 1000);
      else if (lf.cap === "turnoverPct") {
        cap = lf.capPct && lf.capPct > 0 ? Math.round(p.turnover * lf.capPct) : gstSlabCap(p.turnover);
      }
      const raw = lf.amount * daysOverdue;
      const amount = cap != null ? Math.min(raw, cap) : raw;
      const capped = cap != null && raw >= cap;
      return {
        amount,
        perDay: capped ? 0 : lf.amount,
        formula: cap != null
          ? `₹${lf.amount}/day × ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} = ₹${inr(raw)}${capped ? ` — capped at ₹${inr(cap)}` : ` (cap ₹${inr(cap)})`}`
          : `₹${lf.amount}/day × ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} = ₹${inr(raw)} — uncapped`,
      };
    }
    case "flat":
      return { amount: lf.amount, perDay: 0, formula: `Flat penalty ₹${inr(lf.amount)} once the due date passes.` };

    case "s234f": {
      const fee = p.totalIncome > 500000 ? 5000 : 1000;
      const months = Math.ceil(daysOverdue / 30);
      const interest = Math.round(estimatedTax(p) * 0.01 * months);
      return {
        amount: fee + interest,
        perDay: 0,
        formula: `s.234F late fee ₹${inr(fee)} (total income ${p.totalIncome > 500000 ? "above" : "up to"} ₹5,00,000) + s.234A interest ₹${inr(interest)} at 1%/month × ${months} on estimated tax of ₹${inr(estimatedTax(p))}.`,
      };
    }
    case "interest": {
      const base =
        lf.basis === "tdsPerQuarter" ? Math.round(p.tdsPerQuarter / 3)
          : lf.basis === "contribution" ? Math.round(p.monthlyPayroll * (lf.basisPct ?? 0.24))
            : Math.round(estimatedTax(p) * 0.15);
      const months = Math.ceil(daysOverdue / 30);
      const amount = Math.round(base * (lf.monthlyPct / 100) * months);
      return {
        amount,
        perDay: Math.round((base * (lf.monthlyPct / 100)) / 30),
        formula: `${lf.monthlyPct}% per month × ${months} ${months === 1 ? "month" : "months"} on ₹${inr(base)} = ₹${inr(amount)}.`,
      };
    }
    case "turnoverPct": {
      const raw = Math.round(p.turnover * lf.pct);
      const amount = Math.min(raw, lf.cap);
      return {
        amount,
        perDay: 0,
        formula: `${(lf.pct * 100).toFixed(2)}% of turnover ₹${inr(p.turnover)} = ₹${inr(raw)}${raw > lf.cap ? ` — capped at ₹${inr(lf.cap)}` : ""}.`,
      };
    }
  }
}
