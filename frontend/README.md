# Compliance Tracker — v2

A ground-up rebuild. Run it:

```bash
cd app
npm install
npm run dev
```

The earlier build in `../frontend/` is untouched, so the two can be compared side by side.

---

## Why this is not a re-skin

The previous version was a noun-list app — Dashboard / Clients / Grid / Calendar / Team /
Settings — in a generic SaaS skin (purple accent, KPI card row, donut chart, lozenges). That
information architecture describes the *data model*. It does not describe the *work*.

An Indian CA office runs on a monthly pulse: the 7th (TDS challan), 10th (GSTR-7/8), 11th
(GSTR-1), 15th (PF/ESI), 20th (GSTR-3B), then the annual walls at 31 Jul, 30 Sep, 31 Oct.
Nobody opens one client and browses their obligations. They say *"GSTR-3B for July is due on
the 20th — who hasn't filed?"*

So the atomic object here is the **filing run**: one form × one period × N clients.

---

## Four principles, and what each one changed

**1 · The run is the primary object.**
`RunList` is the workhorse component; `RunDetail` is the batch workspace with multi-select,
bulk mark-filed, bulk remind and bulk reassign. This is also what makes the design survive a
10,000-client book — the top-level row count is bounded by the statutory calendar, not by the
size of the firm.

**2 · Money is the priority signal.**
Every compliance definition carries a real penalty model (₹200/day u/s 234E capped at the TDS
amount, ₹100/day uncapped for AOC-4, the GSTR-1/3B turnover-slab caps, § 234F slabs plus 234A
interest, § 271B's 0.5%-of-turnover capped at ₹1.5L). `estimateExposure()` turns days-overdue
into rupees, and the triage list sorts by that rather than by date. Sorting purely by date
puts a ₹200 GSTR-7 above a ₹1.5L tax-audit penalty.

**3 · Colour is reserved exclusively for compliance state.**
All chrome — nav, surfaces, borders, buttons, text — is achromatic warm ink on warm paper. The
only saturated colour in the product means filed / pending / overdue / N-A. If the navigation
is purple *and* status is coloured, colour stops carrying information. A single blue exists for
focus rings and links, as an accessibility affordance rather than decoration.

Status and urgency are encoded **separately and orthogonally**: the tag says where something
stands, the countdown ramp says how soon. A run that is half-filed and due tomorrow needs both
readable at once.

**4 · Every applicability is explainable in one click.**
`applicableCompliances()` never returns a decision without a `RuleHit` carrying the rule
reference, the condition text, and the profile fields that fired. The obligation drawer shows
all three, plus whether the decision was rule-driven or overridden by a person, plus the exact
arithmetic behind the penalty figure. An engine that silently decides ITR-4 instead of ITR-1
gets re-checked by hand, which is the manual work the module exists to remove.

---

## Visual system

Three typographic voices, each with a job:

| Voice | Used for |
|---|---|
| Serif (`ui-serif`/Georgia) | page and section titles only |
| Sans (system UI stack) | all interface text and controls |
| Mono, tabular figures | **every** number: money, dates, counts, PAN, GSTIN, form codes |

Numbers are monospaced and tabular throughout so they align down a column — which is the entire
point of a ledger. The ground is a warm off-white (`#FAF8F4`) rather than the cold blue-grey
every dashboard uses; structure comes from hairline rules rather than floating cards. Full
dark theme, re-tuned rather than inverted.

**The runway** (`ui/Runway.tsx`) is the one chart in the product and the signature element: a
60-day time strip where bar height is the open items landing that day. It makes the office's
monthly pulse the first thing you see. A donut of filed-vs-pending hides that completely.

---

## Structure

```
src/
  styles/tokens.css     design tokens, light + dark
  styles/app.css        the component system
  domain/
    types.ts            modelled on the four source workbooks
    dates.ts            ISO/UTC date maths, ₹ in Indian notation
    catalog.ts          31 compliance definitions; occurrences GENERATED from
                        the recurring rules, not typed from the flat 136-row list
    rules.ts            ITR priority ladder, GST/TDS/ROC mapping, exposure maths
    book.ts             the client book (stands in for KDK's feed)
    engine.ts           applies rules to book; mutations + aggregation
  ui/                   primitives, runway, drawers, command palette
  routes/               Today, Runs, RunDetail, Calendar, Clients, ClientDetail,
                        Matrix, Team, Rules, Reminders
```

**Navigation is grouped by activity, not by table:** Work (Today, Filing runs, Calendar, Team) ·
Book (Clients, Matrix) · Engine (Rule engine, Reminders). The firm's total penalty exposure sits
at the foot of the rail on every screen.

`Rules` is a first-class screen rather than a settings tab, because §3.2 of the scope requires
conditions to be "visible and adjustable" — and it shows a **live count of how many clients each
rung of the ITR ladder actually catches**, so a rule that catches nobody is visible as either
wrong or dead.

---

## Data

`today` is pinned to **2026-08-06**, which lands the demo in a realistic mid-August state: the
31 Jul ITR and TDS Q1 deadlines are six days past, GSTR-1 for July is due on the 11th and
GSTR-3B on the 20th.

- 640 clients, seeded and deterministic. The first ten (`C001`–`C010`) are the exact archetypes
  from *Client Mapping Worked Examples.xlsx* — Ramesh Sharma, Priya Enterprises, Anand &
  Associates, Sunrise Traders LLP, BrightTech, Metro OPC, QuickCart, Sethi Composition Traders,
  Sacred Learning Trust, Prime Metals — so a domain reviewer can look up a client they already
  argued about and check what the engine now says. Priya's GSTR-1 (11 Aug) and GSTR-3B (20 Aug)
  come out matching that workbook exactly.
- 640 clients rather than 10 is deliberate: it forces honest aggregation. At that size no screen
  can afford one row per client at the top level, which is the constraint the real book imposes.
- 24,529 obligations across 121 live runs; ~580 overdue carrying ~₹18L of exposure.
- Filing history is simulated from a per-client discipline score and a stable hash, so nothing
  shifts between renders. In production, status comes from the three real sources in the scope:
  portal verification, KDK's filing modules, manual marking.

## Verification

`npm run build` typechecks and builds clean. All 11 routes were SSR-smoke-tested and render
with real content. Engine output was checked directly against the source workbooks. **Not**
visually verified in a browser in the session that built it — no browser automation was
available, so the rendered result is worth a look before it goes in front of anyone.

## Known gaps

No backend, auth or persistence — mutations live in memory and reset on reload, per the
deliberate decision to settle the product flow first. Thresholds, section references and
penalty models are drafting inputs and need domain sign-off. Portal verification (status
priority 2) remains blocked on whether the GST/IT/MCA APIs already exist inside KDK.
