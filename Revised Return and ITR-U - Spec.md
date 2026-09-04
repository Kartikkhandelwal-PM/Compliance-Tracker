# Revised Return and ITR-U: New Compliance Cards

This is a spec for two new cards on the Income Tax side of the Compliances module, written so
the top section can be copied straight into the BRD (Module 3: Compliances) once it's reviewed,
and the bottom section can go to the developer as-is. The existing BRD and the app code have
already been shared with the developer, so this document proposes the change without editing
either.

---

## Part 1: For the BRD (Module 3: Compliances)

### Purpose

Alongside the existing ITR cards (ITR non-audit, ITR audit cases, Tax Audit Report, and
Transfer Pricing), the Compliances screen gets two more:

- **Revised Return** — clients who can still correct an ITR they've already filed.
- **Updated Return (ITR-U)** — clients who can still file or correct a return, even years after
  the normal window has closed.

Both work like every other card in this module: a count of clients, a drill down to the exact
dates, and a client list under each date. The one difference is what decides who belongs on the
card, and that's worth spelling out because, unlike every other card in this catalogue, it
isn't decided from the client's profile (entity type, turnover, and so on) alone. It also looks
at what actually happened to that client's original ITR this year.

### Revised Return card

- **Who's on it**: any client whose original return for the year was filed, and for whom the
  window to revise it (section 139(5): up to three months before the end of the assessment
  year, or before the assessment is completed, whichever is earlier — 31 December of the
  assessment year in practice) is still open.
- **Who's left off**: a client whose original return hasn't been filed at all isn't shown here —
  there's nothing to revise yet.
- **Once the window closes**: the client drops out of the "clients it applies to" count for that
  year, the same way any other rule-excluded compliance does elsewhere in this document.

### Updated Return (ITR-U) card

- **Who's on it**: every client within the 48-month window under section 139(8A), counted from
  the end of the relevant assessment year — **whether or not the original return was filed**.
  This is wider than the Revised Return card on purpose: ITR-U covers both "never filed" and
  "filed but needs correcting."
- **What the system can't check**: the law also blocks ITR-U in specific cases the app has no
  data for today — a return that is or becomes a loss return, one that would increase a refund
  or reduce tax already paid, cases under search, survey or prosecution, and a year where an
  ITR-U has already been filed. The card doesn't try to exclude these; it shows everyone inside
  the 48-month window, and the reviewer rules the exceptions out manually using the note below.

### "Why this applies" (opened the same way as every other compliance, by clicking a client's
row — see Filing Run Detail, and the drawer described under Module 3's compliance rules)

- **Revised Return, window open**: states that the original return was filed, the form it was
  filed under, the date it was filed, and the date the revision window closes, plus how many
  days remain.
- **Revised Return, window closed**: states the window closed on 31 December, that the return
  can no longer be revised, and points out that an updated return (ITR-U) may still be possible.
- **ITR-U, original return filed**: states the return was filed for that year and can still be
  updated within 48 months, then lists the exclusions the reviewer needs to rule out manually
  (loss return, refund increase, search/survey/prosecution, ITR-U already filed for the year).
- **ITR-U, original return not filed**: states no return was filed for that year through the
  normal or belated window, that an updated return can still be filed within 48 months, and the
  same exclusion checklist.
- In both ITR-U cases, the note also shows the additional tax band that applies if filed today —
  25%, 50%, 60% or 70% of tax plus interest, depending on how many of the 48 months have already
  passed — so the reviewer has a sense of cost before opening the conversation with the client.

### What doesn't change

Both cards behave exactly like every other card in this module otherwise: same financial year
picker, same grouping under the "Income Tax" head, same drill down from card to dates to client
list, same manual "mark filed" / "mark not applicable" actions on a client row. Neither one
sends the client an automatic WhatsApp or email chase the way GSTR-3B or the original ITR does
— see the note on that below.

---

## Part 2: For the developer

The existing pipeline (`applicableClientCompliances()` in `rules.ts`, feeding `buildFor()` in
`engine.ts`) decides applicability purely from a client's profile, then simulates a generic
Filed/Pending/Overdue history with a per-day late fee. Neither of these two compliances fits
that:

1. **Applicability depends on another obligation's outcome.** Whether a client belongs on the
   Revised Return or ITR-U card depends on the status of their *original* ITR obligation for the
   same year (filed or not, and when) — something that doesn't exist yet at the point
   `applicableClientCompliances()` runs today.
2. **There's no real late fee.** Missing the window doesn't accrue a penalty the way a missed
   GSTR-3B does — it just closes the door. Simulating "Overdue" for either of these would be
   actively misleading.
3. **ITR-U's due date is up to 4 years out.** Left in the standard pipeline, it would either
   never fire in the near-term chase ladder (harmless but pointless) or, for Revised Return,
   whose window closes 31 December *this year*, it would genuinely trigger the automatic
   WhatsApp/email cadence built for hard statutory deadlines — wrong, since revising is
   optional, not a deadline.

**Recommended approach**: keep both as ordinary `ComplianceDef` entries (so they get a card, a
detail page, and the drawer for free), but generate their `Obligation` rows through a second,
derived pass, and exclude both from the automatic chase ladder.

### 1. `frontend/src/domain/catalog.ts`

Add two entries to `DEFS`, right after `ITR-TP` so they sit with the rest of the ITR forms:

- `ITR-REVISED` — head `"Income Tax"`, form `"Revised Return (ITR)"`, `frequency: "Annual"`,
  `dueRule`: "31 December following the financial year, or before assessment is completed, if
  earlier", `lateFee: { kind: "flat", amount: 0, note: "No independent penalty for revising —
  interest under sections 234A/234B/234C can still apply on any additional tax admitted." }`,
  `clientFacing: true`.
- `ITR-U` — head `"Income Tax"`, form `"Updated Return (ITR-U)"`, `frequency: "Annual"`,
  `dueRule`: "Within 48 months from the end of the relevant assessment year", `lateFee: { kind:
  "flat", amount: 0, note: "No late fee as such — filing carries additional tax under section
  140B (25%/50%/60%/70% of tax plus interest, depending on when within the 48 months it's
  filed) and is blocked in some cases (loss return, refund increase, search/survey,
  prosecution, ITR-U already filed). Verify eligibility on the portal before filing." }`,
  `clientFacing: true`.

In `occurrencesForFY()`, add one `once(...)` call per def, same `AY${fyStart}-...` period
key/label as the existing ITR entries, tagged `fy: fyStart` so both land in the same
FY-selector bucket as the original return they derive from:

- `ITR-REVISED` due date: `iso(fyStart, 12, 31)`.
- `ITR-U` due date: `iso(fyStart + 5, 3, 31)` — 48 months after the assessment year's end,
  `iso(fyStart + 1, 3, 31)`.

### 2. `frontend/src/domain/rules.ts`

Add two pure functions next to `decideItrForm`, reusing the file's existing `f()` / `money()`
helpers so the output is a `RuleHit` exactly like every other applicability decision in this
file:

- `revisedReturnApplicability(original: Obligation, revisionDeadline: string, today: string):
  { open: boolean; hit: RuleHit }` — condition text cites s.139(5); facts: original form,
  filed-on date, revision deadline, days remaining (or "window closed on …" once passed).
- `itrUApplicability(original: Obligation, windowClose: string, today: string): { open: boolean;
  hit: RuleHit }` — condition text branches on whether `original.status === "Filed"` (two
  sentences: "no return was filed" vs. "the filed return can still be updated"), always ending
  with the exclusions caveat. Facts: original status, assessment year, window-closes-on date,
  days remaining, and the additional-tax tier (25/50/60/70%, from months elapsed since the AY
  end — reuse the `Math.ceil(daysOverdue / 30)` style already used for the `s234f`/`interest`
  late-fee math in this file).

### 3. `frontend/src/domain/engine.ts`

- Add `ORIGINAL_ITR_CODES = new Set(["ITR-NONAUDIT", "ITR-NONAUDIT-BIZ", "ITR-AUDIT",
  "ITR-TP"])`.
- Add `buildDerivedItr(fy, clientObls, occByDef)`: index `clientObls` by `clientId` for the
  original-ITR codes, then for each client with an original obligation:
  - If the `ITR-REVISED` occurrence exists and `original.status === "Filed"`: build one
    `Obligation` — `status: "Pending"` / `basis: "Due date not passed"` while the window's
    open, `status: "Not Applicable"` / `basis: "Rule-excluded"` once it's closed. Skip entirely
    if the original was never filed.
  - If the `ITR-U` occurrence exists: build one `Obligation` unconditionally, same open/closed
    handling, never gated on the original's status. Reuse the existing stable-hash pattern
    (`h(id)`) for a small chance of already-`"Filed"`, so demo data doesn't look uniformly
    untouched.
  - Both: `exposure: 0`, `exposureFormula` set to the def's `lateFee.note`, `reminderStage:
    "N/A"`.
- In `build()`: capture `buildFor(CLIENTS, ...)`'s return value per FY, pass it into
  `buildDerivedItr`, and push its output alongside the rest.
- In `chaseable()`: add an explicit `if (o.defCode === "ITR-REVISED" || o.defCode === "ITR-U")
  return false;`, with a short comment explaining why — these are optional windows, not
  chase-ladder deadlines, and without this guard Revised Return's near-term 31 December due
  date would otherwise pull it into the automatic WhatsApp/email cadence built for hard
  statutory deadlines.

### No other UI changes needed

`Compliances.tsx` renders one card per `DEFS` entry generically, grouped by `head`;
`ComplianceDetail.tsx` and `RunDetail.tsx` derive everything from `defCode`/`Obligation`; and
`ObligationDrawer.tsx`'s "Why this applies" block reads `o.rule.condition` / `o.rule.facts` off
whatever obligation is passed in — all already form-agnostic. Adding the two defs and their
derived obligations is enough for both cards to appear, drill down, and show the reasoning on
click, exactly like every existing ITR card.

### Verification

- Typecheck/build the frontend to confirm the new fields satisfy `ComplianceDef` / `Obligation`
  / `RuleHit`.
- Run the app, open Compliances, confirm two new cards appear under "Income Tax" with plausible
  client counts.
- Click into each: confirm the dates table and the "nothing/late" split make sense (neither
  should ever show "Overdue").
- Open a client's obligation row for each and confirm the drawer's "Why this applies" text for
  the three cases: original filed and window open, original filed and window closed, and (ITR-U
  only) original never filed.
- Confirm neither shows up in the Outbox or Scheduled tabs (the chase-ladder exclusion holding).
