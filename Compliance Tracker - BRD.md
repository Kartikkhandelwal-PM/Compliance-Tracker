# Compliance Tracker: Business Requirements Document

| | |
|---|---|
| **Version** | 0.2 (Draft) |
| **Date** | 25 August 2026 |
| **Prepared by** | KDK Software |
| **Status** | Draft. All 11 modules drafted, for review. Supersedes version 0.1. |

## Objective

The Compliance Tracker is a module that lets a CA firm or tax practitioner see, for every
client, which statutory compliances apply to them, what's upcoming, what's overdue, and
what's already filed, in one place, with automatic client reminders, instead of tracking it
across spreadsheets and manual follow-ups.

## About this document

This document specifies the product screen by screen, in the order a user moves through the
app. Each module lists every element on that screen, what it does, where every click leads,
what every colour means, and every validation or edge case. Screenshots of every screen are
attached once the whole document is finalized.

**Note:** This design has not yet been approved by management or stakeholders. Once feedback
is received, this document and the underlying product will be revised accordingly.

## Modules in this document

Below are the modules covered in this document, in the order a user moves through the app:

1. Dashboard
2. Calendar
3. Compliances (and Compliance Detail)
4. Tracker
5. Clients (and Client Detail)
6. Reminders
7. Settings
8. Filing Run Detail
9. Obligation Detail Panel
10. Message Preview
11. Shared Chrome (the navigation menu and top bar, used on every screen)

---

## Rule Engine Reference

The client-mapping rules, the due dates and calendar, the late-fee formulas, and the full list
of compliances KDK tracks or can track are documented together in a single reference document.

**Reference document:** _[link to be added]_

---

## Module 1: Dashboard

### 1.1 Purpose

The first screen after opening the app. It answers one question: **what needs attention, and
when**, across the whole firm or just the signed-in staff member's own clients.

### 1.2 Layout, top to bottom

1. Page header
2. Hero card (filing runway for the next 7 days) and a 2×2 KPI tile grid, side by side
3. Two chart cards, side by side: status donut, late-fee-by-head bars
4. Filing runway strip (30-day bar chart) with an expandable day-detail panel
5. Work queue card (3 tabs: In arrears / This week / Next 45 days)

### 1.3 Page header

- The title says "Dashboard", with the same icon used for it in the left-side menu, so the
  user always knows which of the 7 sections they're on.
- Below the title, today's date is shown in full (e.g. "Wednesday, 12 August 2026").
- On the right of the header is a two-button switch: **"Whole firm"** and **"My clients"**.
  Clicking either one switches to it immediately.
  - **Whole firm** is selected by default.
  - **My clients** filters everything on the page: the hero card, all 4 KPI tiles, both
    charts, the 30-day strip, and all 3 queue tabs, down to only the filings assigned to the
    signed-in user. Nothing on the page is left out of this filter.
  - This choice is not saved. It resets to "Whole firm" every time the page is reloaded.

### 1.4 Hero card: "Due in the next 7 days"

This is the largest element on the page. **The whole card is one clickable area.** Clicking
anywhere on it, including the bars inside it, opens the **Calendar** page. The individual day
bars are not separate click targets; only the card as a whole is.

- Main number: how many filings are still Pending and due between today and 7 days from now
  (both days included). This number animates up or down when it changes (see section 1.9, Number
  animation).
- Line under the number: "filings across **[number of compliances]** compliances ·
  **[number due today]** land today". If nothing is due today, it says "none land today"
  instead.
- Below that, a row of 7 small bars, one for each of the next 7 days, starting with today:
  - A bar's height shows how busy that day is compared to the busiest of the 7 days.
  - If a day has nothing due, it has **no bar at all**, not even a thin sliver.
  - Each bar is coloured to show urgency (the same 5-colour scale used everywhere in this
    document, see section 1.9): today and tomorrow use the "due very soon" colour, day 2-3 use "due
    soon", and days 4-7 use "due later". (The other two colours in that scale, for things
    already overdue or due much later, never appear in this 7-day strip.)
  - Under each bar: the count for that day (blank if zero), then the day name, "today" for
    the first bar, otherwise a short weekday name like "Mon" or "Tue".
- At the bottom of the card: "Open the calendar →".

### 1.5 KPI tiles (2×2 grid, right of the hero)

All four tiles are buttons, each one takes the user somewhere when clicked, and lifts up
slightly on hover to show that. Each tile's number also animates up or down when it changes
(section 1.9).

- **"In arrears"**
  - Number: how many filings are Overdue right now.
  - Colour: the overdue colour (see section 1.9), used for the icon and the number.
  - Icon: a warning triangle.
  - Line under the number: "**[number of clients]** clients · **[total late fee]** late
    fees", the fee shortened (e.g. "₹18L").
  - Hovering the ⓘ next to the tile's title shows: "Filings past their statutory due date.
    The late-fee figure is estimated from each compliance's own penalty rule."
  - Clicking the tile opens **Tracker**, already filtered to show only overdue filings.
- **"Open"**
  - Number: how many filings are Pending (open, not yet due).
  - Colour: the pending colour (blue).
  - Icon: an outbox/tray glyph.
  - Line under the number: "pending, not yet due".
  - Clicking the tile opens **Tracker**, already filtered to show only open filings.
- **"Filed this month"**
  - Number: how many filings were marked Filed **during the current month**, no matter which
    month they were originally due in. So a filing that was overdue from March but got
    completed this month is counted here.
  - Colour: the filed colour (green).
  - Icon: a check mark.
  - Line under the number: "completed in **[current month]**, any due date".
  - **Note:** this wording is deliberate. The Calendar page has its own "Filed" figure that
    counts a different thing (filings due this month that are done, whichever month they were
    actually filed in), so the two numbers can legitimately differ and each one says clearly
    what it's counting.
  - Clicking the tile does not leave the page. It opens the **"Filed this month" drawer** over
    the current screen. See section 1.8.
- **"Unowned"**
  - Number: how many open filings (Pending or Overdue) have no staff member assigned to them.
  - Colour: plain grey, no special colour.
  - Icon: a person glyph.
  - Line under the number: "open items with no staff" if the number is above zero, otherwise
    "everything is owned".
  - Hovering the ⓘ next to the tile's title shows: "Open items on clients with no assigned
    staff member."
  - Clicking the tile opens **Clients**, already filtered to clients with no owner.

### 1.6 Chart card 1: "Where every obligation stands" (status donut)

- A ring-shaped chart with one coloured segment per status, with a small gap between segments
  so two segments of a similar colour don't blend into one.
- The four segments and their colours (see section 1.9): Filed (green), Pending (blue), Overdue
  (red), Not applicable (grey). If a status has zero filings, its segment is left out
  completely rather than shown as a sliver.
- In the centre of the ring: a percentage, labelled "closed". This is Filed divided by (Filed
  + Pending + Overdue), rounded to a whole number. **"Not applicable" filings are left out of
  this calculation entirely**; they don't count as closed, because they were never live
  filings to begin with.
  - This is deliberately not called "filed on time". Early in the financial year the
    percentage is naturally low just because most of the year hasn't happened yet, not because
    the firm is behind, and "filed on time" would have implied the opposite.
- Below the ring, a legend with one line per status: a coloured dot, the status name, the
  count (written with commas the way large numbers are usually shown, e.g. "16,450"), and what
  percentage of the total that status makes up. (Unlike the centre figure, this percentage
  includes Not applicable in the total.)
- This chart is not clickable. It's for information only.

### 1.7 Chart card 2: "Late fees by head, estimated"

- One horizontal bar for each compliance head, Income Tax, TDS, ROC/MCA, GST, ROC/MCA (LLP),
  Other Statutory, always shown in that exact order, never alphabetical and never reordered
  by value. This order was chosen and checked so that people with colour blindness can still
  tell every bar apart; don't reorder the list without re-checking that.
- A bar's length shows that head's total estimated late fee across every Overdue filing under
  it, compared to whichever head has the largest amount.
- If a head has zero late fees, it's left out of the chart completely, not shown as an empty
  bar.
- If nothing is overdue at all (or, under "My clients", nothing is overdue for that person),
  the whole chart is replaced with the text: "No exposure by head. Nothing overdue."
- Each bar is filled with that head's own fixed colour (see section 1.9), the same colour used for
  that head everywhere else in the product.
- At the end of each bar, the amount is shown in short form (e.g. "₹13L").
- This chart is not clickable. It's for information only.
- The late-fee formula differs by compliance: some charge per day, some a flat amount, some a
  percentage of turnover. Each bar reflects that compliance's own penalty rule.

### 1.8 "Filed this month" drawer (opened from the KPI tile in section 1.5)

- A panel that slides in from the side. Its title reads "Filed in **[Month Year]**" and it
  opens showing the current month.
- Under the title: "**[how many]** filings · **[how many]** clients", and if any
  exist, "· **[count without an ARN]** without an acknowledgement". If there were no filings
  that month, it says "Nothing completed in this month" instead.
- The main list shows one row per **filing** (one form, one period), not one row per client,
  because a firm can have far too many clients to list them all usefully here. Each row shows
  a coloured line for the compliance head, the form name, the period, the head, the due date,
  and how many were filed.
- **Clicking a row** expands it in place, showing up to the first 40 clients in that filing
  (each with their name and ARN, or "no ARN" if there isn't one). Only one row can be open at
  a time; opening a second one closes the first automatically.
- If a filing has more than 40 clients, the expanded list ends with "+**[how many]**
  more, use Export for the full list" instead of showing the rest.
- **Clicking a client's name** in the expanded list takes the user to that client's own page
  and closes the drawer.
- The drawer can be closed four ways: the **×** icon next to the title, the **Close** button
  in the footer, clicking anywhere outside the drawer, or pressing the Escape key.
- Other footer buttons:
  - **◄ [Month]** and **[Month] ►**: move to the next month before or after that actually has
    at least one filing in it (months with nothing filed are skipped over automatically, so
    the user is never taken to an empty screen). If there's no earlier or later month with
    filings, that button is greyed out.
  - **Export**: greyed out if there are no filings that month. Otherwise downloads an Excel
    file with a coloured, frozen header row, named `filed-YYYY-MM.xlsx`, with a column each
    for Compliance, Head, Period, Due date, Client, PAN, Filed on, Status source,
    Acknowledgement, and Recorded by. This covers every filing that month, not just the 40
    shown on screen. A message confirms "Exported **[how many]** filings" once done.

### 1.9 Shared colour/behaviour reference used throughout this module

*(This is defined once here because Dashboard is the first screen to use it. Later modules
just point back to this section instead of repeating it. The colour names below describe what
each colour looks like; for the exact shade to use, match the running prototype.)*

**Status colours.** What a filing's own status looks like:

| Status | Meaning | Colour |
|---|---|---|
| Filed | closed, nothing owed | Green |
| Pending | open, not yet due | Blue |
| Overdue | open, past due date | Red |
| Not applicable | excluded, rule- or manually-driven | Grey |

**Urgency colours.** A separate scale from status, showing how soon something is due. A
Pending filing can be shown in any of these colours depending on how close its due date is.
Once a filing is Overdue, it always uses the Overdue status colour above instead; urgency
colour only applies before something becomes overdue.

| Band | Meaning | Colour |
|---|---|---|
| now | due today or tomorrow (1 day or less) | Dark orange |
| near | due in 2-3 days | Orange |
| soon | due in 4-7 days | Amber/yellow |
| calm | due in 8+ days | Light grey |
| past | already past due | Red (same red as the Overdue status) |

**Head colours.** Fixed per compliance head, used identically everywhere:

| Head | Colour |
|---|---|
| Income Tax | Blue |
| TDS | Teal green |
| ROC/MCA | Orange |
| GST | Purple |
| ROC/MCA (LLP) | Pink |
| Other Statutory | Grey |

**Number animation.** When a number on this page changes, it doesn't just jump to the new
value. It counts up or down to it over less than a second, so the change is visible instead of
silent (going from "581" to "574" without this would look like nothing happened). If the
user's device has "reduce motion" turned on, the number just shows its final value straight
away instead.

**Time format.** Everywhere a specific clock time is displayed (a message's send time in the
Reminders log, Module 6; a timestamp on Message Preview, Module 10; "sent 2 hours ago"-style
notes), it is shown as a 12-hour clock, e.g. "2:32 PM". This is separate from the hour-of-day
pickers in Settings (Module 7, section 7.6), which stay as a plain 24-hour list ("09:00",
"14:00", and so on) since those are for setting an exact schedule, not for reading a moment
back.

### 1.10 Filing runway (30-day strip)

- Covers 30 days: the 7 days before today, plus today and the 22 days after. A week of
  arrears behind, three weeks of what's coming ahead.
- Header line: "**[how many]** days · **[how many]** open items", and if any
  are overdue, "· **[how many]** in arrears" (counting only overdue items on the past
  days shown in this strip).
- A colour-coded key for the same 5 urgency colours used throughout this document (arrears /
  due in 1 day / due in 3 days / due in 7 days / due later).
- One bar per day. A bar's height shows how many open (Pending or Overdue) items are due that
  day, scaled so a very busy day doesn't make a quiet day disappear next to it; any day with
  at least one item due still shows a small visible bar, and a day with nothing due shows no
  bar.
- Bar colour: for a day before today, the bar is the "overdue" colour if anything on it is
  still unfiled, otherwise a neutral grey. For today or a future day, the bar uses the same
  5-colour urgency scale as everywhere else in this document.
- Weekends (Saturday and Sunday) get a small marking behind the bar, on top of whatever colour
  the bar already is.
- Today's bar is marked differently from the rest, and its label says "today" instead of a
  date number.
- **Hovering over a bar** (or reaching it with the keyboard) shows a small pop-up: the date,
  then either "nothing due" or the open count, plus the overdue count if there is one. The
  pop-up follows the bar and always stays visible on screen; it disappears when the user moves
  away, scrolls, or resizes the window.
- **Clicking a day** opens a panel just below the strip listing every filing due that day,
  using the same list style as section 1.11. **Clicking that same day again**, or its panel's own
  Close button, closes the panel. Only one day's panel can be open at a time.
- On a phone-sized screen, the day strip and the date labels below it scroll sideways
  together. On a larger screen they simply fit the full width; no scrolling needed.

### 1.11 Work queue card (3 tabs)

- There are 3 tabs above one list: **In arrears**, **This week**, and **Next 45 days**. Only
  one tab is open at a time. **Clicking a tab switches the list below it** to match that tab.
  - **In arrears** shows every filing that has at least one overdue client. The filing with
    the most overdue clients is shown first. If two filings are tied, the one due earliest
    comes first. Only the top 12 are shown here; the complete list is on the Tracker page.
  - **This week** shows every filing that is still open and due within the next 7 days. The
    one due soonest is shown first.
  - **Next 45 days** shows every filing that is still open and due between 8 and 45 days from
    now, soonest first. Only the top 14 are shown here.
- Each tab shows a small number next to its name: the total count for that tab, even for the
  rows not shown on screen.
- The number on the **In arrears** tab turns red whenever it is more than zero, so it stands
  out even while looking at one of the other tabs.
- Hovering over a tab shows a short explanation of what that tab means.
- On the right side of the tab bar, an "Open tracker" link always takes the user to the full
  Tracker page, no matter which tab is open.
- Below the tabs is a list of filings. (This same list style is used on several other screens
  in this document; it's described here in full, and later sections just point back to it.)
  - Each row shows, left to right: a coloured line marking the compliance type, the compliance
    name and its period, the due date, how many are still open, a small progress bar, and the
    estimated late fee.
  - The due date also shows a coloured countdown underneath it (e.g. "3 days left" in orange,
    or "12 days overdue" in red), same colours as section 1.9.
  - The progress bar has 3 parts: filed (green), pending (blue), and overdue (red), sized to
    match how many clients are in each.
  - Clicking the **Compliance**, **Due**, **Open**, or **Late fees** column heading sorts the
    list by that column. Clicking the same heading again reverses the order. **Open** and
    **Late fees** start with the biggest number first; the others start from the earliest/first.
  - **Clicking anywhere on a row** opens that filing's own page.
  - If a tab has nothing to show, a short message explains why, for example "Nothing in
    arrears" when every overdue filing has already been filed or excluded.

---

## Module 2: Calendar

### 2.1 Purpose

Shows every statutory due date as an actual calendar, either as a month grid or as one
ordered list for the whole financial year. This is the screen a firm plans its week from.

### 2.2 Layout, top to bottom

1. Page header (view switch, financial year picker, "Today" button)
2. Filters row (head, owner, day state)
3. A strip of all 12 months in the financial year, with previous/next arrows
4. "Month at a glance" (4 boxes, only shown for a financial year that has begun)
5. Either the month grid or the year timeline, depending on which view is selected
6. A day panel (if a date is picked) or a plain list of everything due that month (if not)
7. A small note about where the dates come from

### 2.3 Page header

- Title: "Calendar", with its icon repeated from the left-side menu.
- Note line under the title:
  - For a financial year that has begun: "**[how many]** filings in
    **[Month Year]** · **[how many]** open", both for whichever month is currently
    selected.
  - For the year ahead, which hasn't begun yet: "statutory due dates only, client filings
    begin once the year starts". See section 2.12 for what this means.
- On the right of the header:
  - A two-button switch: **"Calendar"** and **"Timeline"**. Clicking either one switches the
    view below immediately (see section 2.7 and section 2.8).
  - A dropdown listing every financial year the firm has used the product, oldest first, plus
    the year ahead. This list grows by one year automatically every time a new financial year
    starts, so a firm never loses access to an earlier year. The current year is selected by
    default. Every year already begun has real client filings behind it; only the year ahead
    does not (again, see section 2.12). Changing it clears any picked day.
  - A **"Today"** button. Clicking it jumps back to the current financial year and the current
    month, and clears any picked day, no matter where the user currently is.

### 2.4 Filters row

- **Head** dropdown: "All heads" or one specific compliance head (Income Tax, TDS, GST, and so
  on). Changing it clears any picked day.
- **Owner** dropdown: "Any owner", "Unassigned", or a specific staff member's name. Changing it
  clears any picked day. This dropdown is greyed out for the year ahead, which has no real
  client data yet, since ownership only exists on real filings; hovering it then explains why.
- **Day state** dropdown: "All days", "With arrears", or "Nothing late". Changing it clears
  any picked day. Like Owner, this is greyed out for the year ahead, for the same reason, with
  the same kind of explanation on hover.
- A **"Clear filters"** button appears only once at least one of the three filters above is
  not on its default setting. Clicking it resets Head, Owner, and Day state all at once, and
  clears any picked day.
- On the right: a running count, "**[how many]** filings across **[financial year]**", reflecting whichever filters are currently active.

### 2.5 Month strip

- A left arrow, 12 month buttons (April through March), and a right arrow, all in one row.
- The left arrow is disabled on April (the first month of the financial year); the right
  arrow is disabled on March (the last month). Clicking either arrow moves one month and
  clears any picked day.
- **Clicking a month button** jumps straight to that month and clears any picked day.
- The month currently being viewed is visually highlighted.
- For a financial year that has begun, each month button also shows a small number: how many
  items are open that month, or a dash if there are none. Hovering the button shows the full
  month name and that same open count. For the year ahead, no number is shown, since there's
  no client data to count yet.
- A month with at least one overdue item gets a small red highlight on its own number, the
  same way an at-risk day does in the grid (section 2.7), so the busiest months to worry about stand
  out at a glance along the strip.

### 2.6 "Month at a glance" (4 boxes)

Shown only for a financial year that has begun; hidden completely for the year ahead, since
none of these numbers would mean anything before a real client book exists. **None of these
four boxes are clickable.**

- **"Landing this month"**: how many items are open (Pending or Overdue) with a due date in
  the selected month. Colour: the pending colour (blue). Underneath: "**[how many]**
  filings across **[month]**".
- **"In arrears"**: how many items in the selected month are Overdue. Colour: the overdue
  colour (red) if the number is above zero, otherwise no special colour. Underneath: "past
  due · **[late fee amount]** late fees" if above zero, otherwise "nothing late this month".
- **"Filed"**: how many items due in the selected month have already been filed. Colour: the
  filed colour (green). Underneath: "of **[how many are filed or still open]** due in
  **[month]**", so the box always shows filed as a share of that month's own workload. (This
  is a
  different question from the Dashboard's "Filed this month" tile, which counts filings
  completed this month no matter when they were originally due. The two numbers can
  legitimately differ.)
- **"Busiest date"**: the single date in the selected month with the most open items. Colour:
  the "soon" urgency colour (amber/yellow). Underneath: "**[how many]** filings land that
  day", or "no dates this month" if the month has nothing due at all.

### 2.7 Calendar (grid) view

- A standard month grid: a row naming the days of the week, then 6 rows of 7 days, always 42
  days total (so the grid always has the same shape, even for a short month). Days from the
  previous or next month that fill out the first or last row are shown too, but dimmed.
- Each day cell can carry up to three special states, and combinations of them all show at
  once:
  - **Weekend** (Saturday or Sunday): a slightly shaded background, unless the day is also
    outside the current month, in which case the "outside the month" look takes over instead.
  - **Has arrears** (at least one overdue item due that day): a soft red-tinted background.
  - **Today**: the date number is shown inside a solid filled circle instead of plain text.
  - **Selected** (the day currently picked, see below): a coloured border around the whole
    cell.
- **Clicking the date number** picks that day, opening the day panel below the grid (section 2.10).
  Clicking the same date number again un-picks it, closing the panel. Only one day can be
  picked at a time; picking a new day automatically closes whichever day panel was open
  before.
- Hovering or focusing the date number shows a plain text tooltip with the full date, and
  either how many filings and how many are open, or "nothing due".
- Next to the date number, if anything is due that day: a small badge with the open count. If
  any of those are overdue, the badge turns red and shows "**[how many]** late"
  instead.
- Below the date, **up to 3 compliance chips**, one per filing due that day, each showing a
  coloured line for its head, the form's short name, and (for a financial year that has begun)
  a count of how many are still open. If a chip's filing has any overdue clients,
  the whole chip is tinted the overdue colour instead of its normal neutral look.
  - **Clicking a chip** goes straight to that filing's own page. This is a separate click
    target from the date number above it. It does **not** pick the day or open the day panel.
  - **Hovering or focusing a chip** shows the shared hover detail card described in section 2.9.
- If a day has more than 3 filings, a **"+[how many] more"** button appears below
  the three chips.
  **Clicking it** picks that day and opens the day panel (section 2.10), the same panel the date
  number opens, but this button always opens it, even if that day is already picked (unlike
  the date number, it never toggles the panel closed).
- Below the grid, a legend lists every compliance head with its colour, plus one more entry
  explaining the red background: "day carries arrears".

### 2.8 Timeline view

- One long list covering the whole financial year, starting 30 days before today, in date
  order, ignoring month boundaries entirely. (This is the difference from the grid: the grid
  answers "what does this month look like", the timeline answers "what's coming, in order",
  which matters because the grid otherwise cuts the year's busiest dates in half at a month
  boundary.)
- Rows fade into view as the user scrolls down to them, the first time only. This motion is
  switched off if the user's device has "reduce motion" turned on.
- Each date with at least one filing gets its own row group: the date (day number, month,
  weekday name), a "Today" tag if it's the current date, a coloured countdown (e.g. "due in 3
  days"), and, for a financial year that has begun, how many are open and, if any, how many
  are late.
- Under each date, one row per filing due that day: a coloured line for its head, the form
  name, the period, and, for a financial year that has begun, a small 3-colour progress bar
  plus either the open count or, if any are overdue, the overdue count in red and bold.
  - **Clicking a row** goes straight to that filing's own page.
  - **Hovering a row** shows the same hover detail card as the grid (section 2.9).
- If nothing matches the current filters, the list is replaced with "Nothing scheduled: no
  statutory dates match the current filters."

### 2.9 Hover detail card (grid chips and timeline rows)

A small card that appears near whatever chip or row is being hovered or focused. It is
**not clickable itself**; the click happens on the chip or row underneath it.

- The form name, then a line underneath with the period, the head, and how often it recurs.
- The due date.
- For a financial year that has begun: how many clients it applies to, how many have filed,
  how many are still pending, and, if any, how many are overdue (shown in red). If any late
  fees have built up, a line below shows the estimated amount.
- For the year ahead: "No client book for this year" instead of any numbers.
- At the bottom: "Open this compliance →", describing where the underlying click goes.

### 2.10 Day panel or month list

Only one of these two is shown at a time, directly below the grid or timeline.

- **If a day is picked** (section 2.7): a panel showing the full date, a note with the filing count,
  open count, and estimated amount at risk (or "nothing due" if there's nothing that day), a
  **Clear** button that un-picks the day and closes the panel, and underneath, the full
  sortable filing list in the same style as Module 1, section 1.11.
- **If no day is picked**: a heading "Everything due in **[month]**" with a count of matching
  filings (adding "matching your filters" if any filter is active), and underneath, the same
  kind of sortable filing list, covering the whole month instead of one day.

### 2.11 Footer note

A small line beneath everything else: "Dates come from the recurring statutory rules, not a
typed list. CBIC/CBDT extensions and state-specific professional tax dates are not applied
automatically."

**Note:** this is a real limitation, not filler text. The calendar will not, on its own,
reflect a government deadline extension or a state-specific professional tax date until that
rule is added to the underlying calendar logic.

### 2.12 The year ahead, before it has a client book

The financial year picker (section 2.3) offers every year the firm has used the product, plus
the year immediately ahead, seeded early so its statutory due dates are visible before the
year begins. Every year that has actually begun, past or current, has real clients and
filings behind it. Only the year ahead does not yet: it still shows a correct statutory
calendar (every due date is generated the same way), just with no client data attached, since
that year hasn't started. Specifically, for that year:

- The **Owner** and **Day state** filters are greyed out (section 2.4), since both depend on real
  client filings.
- The "Month at a glance" boxes (section 2.6) are hidden entirely.
- Month buttons (section 2.5), day badges, and compliance chips (section 2.7) show no counts, since there's
  nothing to count.
- The hover detail card (section 2.9) says "No client book for this year" instead of showing numbers.
- If **Day state** was already set to "With arrears" before switching to that year, the
  calendar will show nothing at all for as long as that filter stays on, since "arrears" can
  only ever come from real client filings, and switching it back to "All days" brings the
  statutory dates back immediately.

---

## Module 3: Compliances

This module covers two screens: the Compliances list, and the Compliance Detail screen
reached by opening one compliance from it.

### 3.1 Purpose

This is the catalogue of every compliance the firm can be asked to file: its own recurring
schedule, who it applies to, and what it costs when missed. It is reference information about
the compliance itself, not about any one client's status. It's the first step of a 3-step
path the whole product follows: **a compliance, then its dates, then the clients on that
date**. Clicking a compliance here leads to a screen listing every date it falls due (this
module, section 3.7 onward); clicking one of those dates leads to Filing Run Detail, covered in its
own module later in this document, which lists every client due that date.

### 3.2 Layout, top to bottom (list screen)

1. Page header
2. Filters row (search, head, group by)
3. Compliance cards, grouped into sections

### 3.3 Page header

- Title: "Compliances", with its icon repeated from the left-side menu.
- Note line: "**[how many match]** of **[the total]** compliance types".
- On the right: a **financial year** dropdown, listing every year the firm has used the
  product plus the year ahead, the same list Calendar offers (section 2.3). The current year
  is selected by default. Every count on every card (section 3.6) reflects whichever year is
  picked here: due dates and even the rule itself can change from one year to the next, so
  there is no single "consolidated, every year at once" view to fall back on; the list always
  shows one specific year's state.

### 3.4 Filters row

This bar stays pinned to the top of the screen while the list below it scrolls.

- A search box, placeholder "Form, code or description". Typing filters the list to
  compliances whose form name, description, or code contains what was typed, matched anywhere
  in the text, not just the start.
- A **head** dropdown: "All heads" or one specific head.
- A **group by** dropdown: "Group by head" (the default), "Group by frequency", or "No
  grouping".
- On the right: "Open a compliance to see all its dates", a plain hint, not a control.
- A compliance the firm has switched off entirely in Settings never appears in this list, no
  matter what the filters are set to; it isn't part of the firm's catalogue at all.
- If nothing matches the current filters, the list is replaced with "No compliance matches
  that: try a different form code or clear the head filter."

### 3.5 Grouping and sections

- When grouped (by head or by frequency), each group gets its own heading: for "by head", a
  coloured dot plus the head's name; for "by frequency", just the name (Monthly, Quarterly,
  Half-yearly, Annual, Event-based). Each heading also shows a count of how many compliances
  are in that group.
- Groups are always shown in a fixed order (the same head order used throughout this document,
  or Monthly → Quarterly → Half-yearly → Annual → Event-based for frequency), never
  alphabetically.
- With "No grouping" selected, every matching compliance appears in one plain list with no
  section headings at all.

### 3.6 Compliance cards

Each compliance is shown as a card. **The whole card is one clickable area**, leading to that
compliance's detail screen (section 3.7 onward). It also lifts up slightly on hover to show that.

- Top of the card: a coloured line for the compliance's head, the form's short name in bold,
  its plain-language description underneath, and a chevron on the right.
- Three facts: **Frequency** (how often it recurs), **Due** (the rule that sets its due date,
  in plain words, e.g. "20th of the following month"), and **Applies to** (who it applies to,
  in plain words).
- At the bottom, all for the year picked in the page header (section 3.3): how many clients it
  applies to, how many distinct due dates it has, and then either:
  - a red pill showing how many clients are overdue on it that year, plus the estimated late
    fee if there is one, or
  - if none are overdue, the plain text "nothing late".
- If any client is overdue on this compliance in the selected year, the whole card gets a soft
  red background tint, the same treatment used for at-risk cards throughout this document.

### 3.7 Compliance Detail screen

Reached by clicking any compliance card (section 3.6), any grid chip or timeline row on
Calendar, or the "Compliance" column on any filing list elsewhere in this document. This
screen shows one compliance's entire recurring schedule for a chosen financial year: every
period it falls due, each with its own due date and its own filed/pending/overdue split, so
it's clear at a glance which periods are clean and which are carrying arrears. If the code in
the address doesn't match anything in the catalogue, the screen shows "Compliance not found:
nothing in the catalogue matches this code," with a link back to the full list.

### 3.8 Page header and "about" block

- Title: the compliance's form name (e.g. "GSTR-3B"). Note line: its plain-language
  description. On the right: a **financial year** dropdown, listing every year the firm has
  used the product plus the year ahead, the same list Calendar offers (section 2.3), followed
  by a "← All compliances" button, back to section 3.3. The current year is selected by
  default. Changing it re-runs section 3.9 and 3.10 for the newly picked year.
- Underneath, four short facts in one row:
  - **Head**, with the same coloured dot used everywhere else for that head.
  - **Frequency**, how often this compliance recurs (e.g. Monthly, Quarterly, Annual).
  - **Due date rule**, in plain words.
  - **Filed by**, either "Client files; firm sends reminders" or "Filed by the firm",
    depending on whether this is one the client is responsible for filing themselves.
- Below that, two longer facts side by side:
  - **Applies to**, in plain words.
  - **If missed**, the plain-language description of what the late fee or penalty is.

### 3.9 Summary stats (4 boxes)

Plainer versions of the boxes used elsewhere in this document: no icon, and **none of them are
clickable.**

- **"Dates this year"**: how many periods this compliance has in the selected financial year.
  Underneath: the financial year label.
- **"Clients it applies to"**: the highest number of clients it has applied to in any single
  period of the selected year. Underneath: "at its widest period".
- **"Filed"**: total filed count added up across every period in the selected year. Colour:
  the filed colour (green). Underneath: "across all periods".
- **"Overdue"**: total overdue count added up across every period in the selected year.
  Colour: the overdue colour (red) if above zero. Underneath: the total estimated late fee, or
  "nothing late" if there is none. For a past year this is naturally always zero, since
  nothing from a closed year is still awaiting action.

### 3.10 Every date, as a table

One row per period in the selected financial year (e.g. one row for "July 2026", one for
"August 2026", and so on). **Clicking anywhere on a row** goes to that period's own Filing Run
Detail screen, covered in its own module later in this document.

- **Period**: the period label, also its own separate link to the same destination as the
  rest of the row.
- **Due date**: the statutory due date for that period.
- **Countdown**: if the period is currently overdue, a red tag showing exactly how overdue it
  is (e.g. "12 days overdue"); otherwise the plain coloured countdown used throughout this
  document (e.g. "due in 3 days").
- **Progress**: the same 3-colour bar (filed green, pending blue, overdue red) used throughout
  this document.
- **Filed**: how many clients have filed, right-aligned.
- **Open**: how many are still pending or overdue combined, right-aligned.
- **Late fees**: the estimated amount, right-aligned, in bold red if above zero; "nil" if the
  due date has already passed with nothing owed; a dash if the due date hasn't arrived yet and
  nothing is owed.
- If this compliance has no periods at all in the selected financial year, the table is
  replaced with "No dates in this financial year: this compliance has no occurrences seeded
  for [financial year]."
- Otherwise, underneath the table: "Pick a period to see every client on that date and where
  each one stands."

---

## Module 4: Tracker

Called **Tracker** in the left-side menu, though the screen's own title reads "Compliance
tracker."

### 4.1 Purpose

One grid: clients down the side, compliances across the top, and each client's status in the
cell where their row meets a column. This is the "am I covered?" screen: the only place a
client's whole set of obligations, and a compliance's whole set of clients, can both be seen
at once.

### 4.2 Layout, top to bottom

1. Page header (count, Export button)
2. Filter bar
3. The grid itself, with a full-screen option
4. A colour legend and "show more" control
5. A one-line note about what each part of the grid does

### 4.3 Page header

- Title on screen: "Compliance tracker". Note line: "**[how many rows are loaded]** of **[the total that match]** clients
  × **[how many]** compliances".
- On the right: a **financial year** dropdown, listing every year the firm has used the
  product plus the year ahead, the same list Calendar offers (section 2.3), defaulting to the
  current year, then an **Export** button. See section 4.9.

### 4.4 Filter bar

This introduces a control used on several screens in this document: the **filter pill**.
Described here in full; later sections just point back to it.

- A pill is a button that shows just its field name until something is chosen (e.g.
  "Period"). Once something is chosen, it shows "Field: value" instead, with a small **×** to
  clear just that one field.
- **Clicking a pill** opens a small menu below it listing every option for that field.
  **Clicking an option** applies it immediately and closes the menu. Pressing Escape, or
  clicking anywhere outside the open menu, closes it without changing anything.
- If a field has more than 12 options, the menu also gets its own search box at the top, so
  typing narrows the list instead of scrolling through it.
- One field, **Owner**, allows more than one choice at once: each option gets its own checkbox
  instead of a single tick, and the pill's label then reads "**[how many]** people"
  once 2 or more are picked, or shows the one name if only one is picked.
- **Clicking a pill's own ×** clears just that field, leaving every other filter as it was.

On this screen, the filter bar has, left to right:

- A plain search box (not a pill, always shown), placeholder "Name, PAN or GSTIN". Typing
  narrows the grid to clients whose name, PAN, or GSTIN contains what was typed.
- **Period** pill: "This month" / "Next 3 months" (the default) / "Full year", all three
  relative to today. Shown only while the header's year dropdown (section 4.3) is set to the
  current financial year, since "this month" or "the next 3 months" has no meaning for a year
  that isn't the one happening right now. As soon as a different year is picked, the pill
  disappears and the grid always shows that whole year's columns instead; picking the current
  year again brings the pill back, still set to whatever it was last on.
- **Head** pill: "All heads" (default) or one specific head.
- **Owner** pill: pick any number of staff members, or none for everyone. "Unassigned" is one
  of the choices.
- **Status** pill: "Any status" (default) / "Has something late" / "Has something open" /
  "Fully filed". This judges a client's whole row at once, not one cell.
- **Group** pill: "By month" (default) / "By head" / "No grouping". Changes how the columns
  are grouped; see section 4.5.
- A **"Clear all"** button, shown only once at least one of the pills above is not on its
  default setting. It shows how many are active (e.g. "Clear all 3") and clicking it resets
  every one of them at once.
- On the right, a plain **Sort** dropdown (not a pill, always shown): "Most late" (the
  default) / "Most open" / "Late fees" / "Name". This only changes the order rows are shown
  in; it never removes a client from the grid.
- Changing the year dropdown (section 4.3), **Period**, **Owner**, or **Status** also resets
  the grid back to showing only the first 50 rows again (see section 4.7), since a different
  slice of the book should always start from the top.
- If either no columns or no rows match the current filters, the grid is replaced with
  "Nothing in this slice: no compliances fall inside this window for the current filters.
  Widen the period or clear a filter."

### 4.5 Column grouping and headers

- Each column is one filing run (one form, one period) with a due date inside the chosen
  Period window (section 4.4).
- Columns are always ordered by due date, then by form name; if grouped by head, they're
  ordered by head first instead.
- With "By month" or "By head" grouping chosen, a wide heading spans every column in that
  group, sitting in its own row above the column headers (the month name, or the head's name
  with its coloured dot). "No grouping" removes that row entirely.
- Each column's own header shows a coloured line for its head, the form's short name, and its
  due date. **Clicking a column header** goes straight to that compliance's Filing Run Detail
  page, covered in its own module later in this document.
- A column whose due date has already passed gets a subtle shading down its whole length, so
  an old column reads differently from a current one at a glance.
- The **Client** column on the far left, and the header row at the top, both stay in place
  while the rest of the grid scrolls underneath them, in either direction.

### 4.6 The grid itself

- One row per client matching the current filters. **Clicking a row's client name** goes to
  that client's own page, covered in its own module later in this document.
- Under the client's name: their PAN, and, if they have anything overdue, how many, in the
  overdue colour.
- Each cell is a small coloured square: one of the four status colours used throughout this
  document (Filed green, Pending blue, Overdue red, Not applicable grey).
- If a compliance genuinely does not apply to a client, that cell is left empty instead of
  coloured, with a hover tooltip reading "Not applicable to this client." This is different
  from a status of "Not applicable" (which does get the grey colour): an empty cell means no
  obligation was ever created for that client and that column at all, while a grey cell means
  one was created and then excluded.
- **Clicking a coloured cell** opens the shared obligation detail panel for that one client
  and compliance, without leaving the grid. That panel is covered in its own module later in
  this document.
- **Hovering a cell** shows a plain tooltip: the client's name, the form, the period, and the
  status.

### 4.7 Legend and "show more"

- Below the grid, a colour key for the four statuses, same colours as used throughout this
  document.
- Rows load 50 at a time. Scrolling near the bottom of what's loaded automatically loads the
  next 50 on its own, so the grid keeps filling in while scrolling. A
  **"Show [how many] more · [how many] left"** button is also always available
  for a manual nudge. Once every matching row has loaded, that button is replaced with
  "Showing all **[how many]** matching clients."
- A small note underneath states which time window is active in plain words (e.g. "Next three
  months"), a one-line reminder of what each click does ("click a column header to open that
  compliance, a row to open the client, a cell to see why it applies"), and, if there are any,
  the total estimated late fees across everything currently shown.

### 4.8 Full-screen mode

- A small button in the grid's own top-right corner expands it to fill the whole screen, since
  the grid itself is often wider and taller than the page.
- While full-screen, the same title, count, and filter bar (section 4.4) are repeated at the top, so
  none of the filtering is lost by expanding.
- **Clicking "Exit full screen"**, or pressing Escape, returns to the normal page layout. The
  rest of the page cannot scroll while full-screen is open.

### 4.9 Exporting to Excel

**Clicking Export** (in the page header, section 4.3) downloads every client currently
matching the filters, not only the ones already loaded on screen, as an Excel file with a
coloured, frozen header row. One row per client, with columns for Client, PAN, GSTIN, Owner,
and then one column per compliance shown on the grid, each holding that client's status for
it (or a dash where it doesn't apply). The file is named
`compliance-tracker-[today's date].xlsx`. A message confirms how many clients and compliances
were exported.

---

## Module 5: Clients

This module covers two screens: the Clients list, and the Client Detail screen reached by
opening one client from it.

### 5.1 Purpose

The list screen is the whole client book, searchable and filterable, nothing else. The detail
screen is everything about one client: the profile that decides which compliances apply to
them, their full obligation history for the year, and every message they've been sent.

### 5.2 Layout, top to bottom (list screen)

1. Page header
2. Filters row
3. The client table
4. "Show more" control

### 5.3 Page header

- Title: "Clients", with its icon repeated from the left-side menu.
- Note line: "**[how many match]** of **[the total]** clients".

### 5.4 Filters row

- A plain search box, placeholder "Name, PAN or GSTIN". Typing narrows the list to clients
  whose name, PAN, or GSTIN contains what was typed.
- **Entity** dropdown: "All entities" or one specific type (Individual, Company, LLP, Firm,
  Trust, AOP/BOI, HUF).
- **State** dropdown: "All states" or one specific Indian state.
- **Owner** dropdown: "All owners", "Unassigned", or one specific staff member.
- **Compliance health** dropdown: "All clients" / "In arrears" / "Up to date".
- On the right, a **Sort** dropdown: "Name A-Z" (the default) / "Most overdue" / "Turnover" /
  "Late fees".
- Changing any of the five filters above resets the list back to showing only the first 40
  rows again (see section 5.6). There is no single "clear all" button here; each dropdown is reset on
  its own, back to "All ...".

### 5.5 The client table

**Clicking anywhere on a row** goes to that client's own page (section 5.7 onward). The client's name
is also its own separate link to the same destination.

- **Client**: a small avatar with the client's initials, their trading name, and underneath,
  their PAN and GSTIN (if they have one).
- **Entity**, **State**: plain text.
- **Owner**: the assigned staff member's avatar and name.
- **Turnover**: right-aligned, shortened (e.g. "₹13L"), or a dash if none is on record.
- **Compliance health**: the same 3-colour progress bar (filed green, pending blue, overdue
  red) used throughout this document.
- **Open**: right-aligned, pending plus overdue combined.
- **At risk**: right-aligned, the estimated late fee in bold red, or a dash if there is none.

### 5.6 Loading more clients

The table starts by showing the first 40 matching clients. A **"Show [how many] more · [how many] remaining"** button loads 80 more at a time. Once
every matching client has loaded, that button is replaced with "Showing all **[how many]**
matching clients." If nothing matches the current filters: "No clients match
these filters."

### 5.7 Client Detail screen

Reached from the client table (section 5.5) or from a client's name anywhere else in this
document. If the client can't be found, the screen shows "Client not found."

- Title: the client's trading name. Note line: their PAN. On the right: a **financial year**
  dropdown, listing every year the firm has used the product plus the year ahead, the same
  list Calendar offers (section 2.3), followed by a "← All clients" button, back to section
  5.3. The current year is selected by default. Changing it re-runs the summary stats
  (section 5.9) and the Obligations tab (section 5.11) for the newly picked year; the
  Compliance profile and Communications tabs are unaffected, since neither is scoped to a
  single year.

### 5.8 Identity block

- A large initials mark, the client's full legal name in bold, and underneath, a
  plain-language description of their business type (e.g. "Proprietor, presumptive scheme").
- Three small tags: entity type, company type (only shown for companies), and state.
- A list of facts: **PAN**; **GSTIN** (or "Not registered" if they have none); **CIN** (only
  shown if the client has one); **ITR form** (the income tax return form this client is
  expected to file, worked out from their profile); **Turnover**.
- On the right, two blocks:
  - **Owner**: the assigned staff member's avatar, name, and role.
  - **Reachable on**: the client's email (clicking it opens a new email to them) and WhatsApp
    number, plus
    a switch showing whether they've opted into WhatsApp reminders. **This switch is the one
    editable control on this whole screen.** Clicking it flips the client between "Opted in"
    and "Email only", and it's the only place this consent gets recorded, so it doubles as
    both the current state and the control that changes it. Hovering it explains what clicking
    it will do next, worded differently depending on the current state.

### 5.9 Summary stats (4 boxes)

The same style of box used on the Dashboard, complete with an icon chip, but **none of these
four are clickable.**

All four are scoped to the financial year picked in the page header (section 5.7), not always
the current one.

- **"Overdue"**: how many of this client's obligations are Overdue in the selected year.
  Colour: the overdue colour (red) if above zero. Underneath: the estimated late fee, or
  "nothing late". For a past year this is usually zero, since a past year's arrears are almost
  always resolved by the time a later year is underway.
- **"Pending"**: how many are Pending in the selected year. Colour: the pending colour (blue).
  Underneath: "upcoming in [the selected financial year]".
- **"Filed"**: how many have been filed in the selected year. Colour: the filed colour
  (green). Underneath: the selected financial year's label.
- **"Not applicable"**: how many were excluded in the selected year, whether by the rule
  engine or by hand. Underneath: "rule-excluded or overridden".

### 5.10 The three tabs

A three-option switch: **"Obligations ([how many])"**, **"Compliance profile"**, and
**"Communications ([how many])"**, each count live. Clicking any one switches the content below
it. When
**Obligations** is open, an extra **Head** dropdown ("All heads" or one specific head) appears
next to the switch, narrowing that tab's two lists; this dropdown disappears on the other two
tabs.

### 5.11 Obligations tab

Two lists, scoped to the financial year picked in the page header (section 5.7), one below
the other. **Clicking any row in either list** opens the shared obligation detail panel for
that one obligation (covered in its own module later in this document).

- **"Open"**: heading reads "**[how many]** items. Click any row for the rule behind
  it." Each row
  shows a small coloured marker (red for Overdue, a neutral colour for Pending), the form code
  and period, the head name and the specific rule reference behind it, the due date, a coloured
  countdown, the estimated late fee (bold red, or a dash if none), and a status tag. If there's
  nothing open: "Nothing open: every applicable compliance for this client is filed or ruled
  out."
- **"Settled"**: heading reads "**[how many]** filed or not applicable." Each row
  shows a coloured
  marker (green for Filed, grey for Not applicable), the form and period, an "override" tag if
  a person changed this by hand rather than the rule engine deciding it, the status basis (how
  the system knows it's settled), the acknowledgement number if any, who filed it if a person
  did, the date it was filed (or its due date if not filed), and a status tag.

### 5.12 Compliance profile tab

- A note at the top: "These are the fields the rule engine reads. Changing any of them re-runs
  applicability for this client. Compliances can appear or disappear, and scheduled reminders
  are rebuilt to match."
- Below that, several small cards, two per row: Identity & status, Income & audit, Income
  sources, GST, TDS/TCS, and Other statutory. Each card lists several labelled facts. Yes/No
  facts are shown as a small green ("Yes") or grey ("No") tag rather than plain text. A few
  facts have a small ⓘ that, on hover, explains what that field actually affects (e.g. "Caps
  the ₹200/day late fee under s.234E").
- Every field on this tab is editable in place. Saving a change re-runs applicability for this
  client immediately, exactly as the note above describes: compliances can appear or disappear,
  and scheduled reminders are rebuilt to match.

### 5.13 Communications tab

A table of every message sent to this client: **Sent** (date), **Channel**, **Stage** (which
reminder step it was, e.g. "T-3"), **Message** (a truncated preview of the text), and
**Delivery** (a status tag; red for Failed, blue for still Queued, green for anything else).
**Rows in this table are not clickable.** To see the exact message as the client received it,
open it from the Reminders log instead, covered in Module 6. If nothing has been sent yet:
"Nothing sent yet: reminders are triggered from the due dates on this client's obligations.
Nothing has met a trigger for this client."

### 5.14 Footer note

A small line beneath everything else: "Applicability last evaluated **[today's date]**
against the **[financial year]** statutory calendar."

---

## Module 6: Reminders

### 6.1 Purpose

What the firm has told its clients, and what it's about to tell them next. Two tabs: **Log**
(what already went out, and whether it landed) and **Scheduled** (what's queued to go out,
with the ability to send it early or stop it). Setting up the reminder cadence itself is not
here; that lives in Settings, covered in its own module later in this document.

### 6.2 Layout, top to bottom

1. Page header
2. A two-tab switch: Log / Scheduled
3. Whichever tab is open

### 6.3 Page header

- Title: "Reminders", with its icon repeated from the left-side menu.
- Note line: "**[how many]** sent · **[how many]** queued", plus "· **[how many]** failed"
  if any have failed.
- On the right: a "Reminder settings" button, leading to Settings (a later module in this
  document).

### 6.4 The two tabs

A two-option switch: **"Log ([how many])"** and **"Scheduled ([how many])"**.
Clicking either one switches the content below it.

### 6.5 Log tab: summary stats (5 boxes)

- **"Sent"**: every message ever sent, all time. Not clickable.
- **"Read"**: how many were opened by the client, and what percentage of all sent that is.
  Colour: the filed colour (green). Not clickable.
- **"Delivered, unread"**: reached the client's device but hasn't been opened yet. Colour: the
  pending colour (blue). Not clickable. (This is deliberately kept separate from "Read": a
  message sitting on a phone unopened is a different thing from one someone has actually seen.)
- **"Held"**: waiting for the sending window to reopen (see Settings for what that window is).
  Colour: the "soon" urgency colour (amber) if above zero. **Clickable only when above zero**;
  clicking it filters the table below to exactly these.
- **"Failed"**: never reached the client. Colour: the overdue colour (red) if above zero.
  **Clickable only when above zero**; clicking it filters the table below to exactly these.

### 6.6 Log tab: filters

Uses the filter pill pattern described in Module 4, section 4.4.

- A plain search box, placeholder "Search client, PAN or form". A small **×** appears inside
  it once something is typed, clearing it in one click.
- **Compliance** pill: "All compliances", or narrow to everything under one head, or to one
  specific form. Only heads and forms that actually appear in the log are offered; there's no
  option that would always show zero rows.
- **Channel** pill: "All channels" / "WhatsApp" / "Email", each option carrying that channel's
  own brand mark.
- **Delivery** pill: "All" / "Read" / "Delivered, not read" / "Held" / "Cancelled, already
  filed" / "Failed".
- **Sent by** pill: "Anyone" / "Automatic" (sent by the schedule itself, marked with a small
  lightning-bolt icon) / or one specific staff member, each shown with their avatar and role.
- A **date** pill: pick a preset (Today / Last 7 days / Last 30 days / This month) or set an
  exact from/to range.
- A **"Clear all"** button, shown once any of the above is active, clearing every one at once.
- On the right: a running count, "**[how many match]** of **[the total]**", and an
  **Export** button (see section 6.9).
- **Note:** this log only ever shows, and exports, the most recent 250 messages that match the
  current filters. If more than 250 match, the rest are not shown or included; narrowing the
  filters further is the only way to see or export the remainder.
- If nothing matches: "Nothing matches: try clearing a filter or widening the date range."

### 6.7 Log tab: selecting rows and bulk actions

- Each row has its own checkbox in the leftmost column, and the column header has one too,
  which selects or clears every row currently shown (up to the 250-row cap) in one click.
  Clicking a checkbox does not also trigger the row's own click (section 6.8).
- A bulk action bar appears above the table whenever any of these is true: at least one row is
  checked, or the Delivery filter is set to "Failed" with results showing, or it's set to
  "Held" with results showing. Only one of the three possible bars shows at a time:
  - **If rows are checked**: "**[how many]** selected", a **"Re-send selected"**
    button, and a **Clear** button that unchecks everything. Re-sending confirms with
    "Re-sent **[how many]** messages" or, if none of them could be sent because those filings are
    already complete, "Those filings are already complete."
  - **If filtered to Failed** (and nothing is checked): "**[how many]** were not
    delivered" and a **"Retry all"** button, confirming "Retrying **[how many]** messages".
  - **If filtered to Held** (and nothing is checked): "**[how many]** awaiting the sending
    window" and a **"Send now"** button, confirming either "Sent **[how many]** messages" or, if
    some clients had already filed while their message was held, "Sent **[how many]** messages
    · cancelled **[how many]** already filed".
  - A small note beside the bar always reads: "Re-sent messages are recorded as repeat
    attempts."

### 6.8 Log tab: the table

**Clicking anywhere on a row** (other than its checkbox or its own action button) opens the
Message Preview panel for that message, showing exactly what the client received. That panel
is covered in its own module later in this document.

- **Sent**: the exact date and time, plus "2 hours ago"-style wording for anything sent
  recently.
- **Client**: the client's name, and "attempt 2" (or higher) underneath if this was a repeat
  send.
- **Compliance**: the form, and the head underneath.
- **Channel**: WhatsApp or Email, with that channel's brand mark.
- **Trigger**: which reminder step this was (e.g. "T-3").
- **By**: a small lightning-bolt tag for anything sent automatically, or the sending staff
  member's avatar for anything sent by hand.
- **Delivery**: a status tag. These are delivery colours, a separate meaning from the filing
  status colours used elsewhere in this document, but drawn from the same palette: Read is
  green, Delivered (not yet read) is blue, Held is amber, Cancelled is plain grey, Failed is
  red.
- A small send icon on the far right of each row. **Clicking it** re-sends just that one
  message (labelled "Retry this message" if it had failed, otherwise "Send this again"),
  confirming "Re-sent to **[client]**" or, if that filing is already complete, "That filing is
  already complete." This click does not open the Message Preview panel.
- Underneath the table: "Updated **[date and time]**."

### 6.9 Log tab: exporting to Excel

**Clicking Export** downloads whatever the table is currently showing (so it is also subject
to the same 250-row cap described in section 6.6) as an Excel file with a coloured, frozen
header row, one row per message, with columns for Sent, Time, Client, PAN, Compliance, Head,
Channel, Trigger, Origin, Sent by, Delivery, Attempt, and Message. The file is named
`reminders-[today's date].xlsx`. A message confirms how many were exported.

### 6.10 Scheduled tab: summary stats (4 boxes)

None of these four are clickable.

- **"Batches queued"**: how many separate sends are due in the next 45 days. Colour: the
  pending colour (blue).
- **"Messages"**: the total number of individual messages those batches add up to (a batch
  going out over two channels to 90 clients counts as 180 messages here).
- **"Next batch"**: the time of the very next scheduled send, and underneath, its date and
  which compliance it's for; a dash if nothing is queued.
- **"Automatic sending"**: "On" (green) or "Paused" (red), reflecting the same setting
  controlled in Settings. Underneath: "Enabled" or "No reminders will be sent".
- If automatic sending is paused, a warning note appears above the filters: "Automatic sending
  is off. Reminders below will not be sent until it is re-enabled in Settings," with a link
  straight there.

### 6.11 Scheduled tab: filters and manual send

- A **Head** pill: "All heads" or one specific head, plus a **"Clear all"** button once it's
  set to anything else.
- On the right, a **"Send anything due"** button. Clicking it sends every batch that is
  actually due right now (not the whole 45-day queue), confirming "Sent **[how many]** messages"
  or, if nothing is currently due, "No reminders are due."

### 6.12 Scheduled tab: the table

One row per batch (one compliance, one reminder step, e.g. "GSTR-1 July, follow-up"), not one
row per client, since a batch can cover hundreds of clients at once.

- **Fires**: the exact date and time it's due to send, plus "in 3 hours"-style wording
  underneath.
- **Step**: the reminder step's name, and underneath, how it's timed (e.g. "3d before", "on
  the day", "5d after").
- **Compliance**: the form, and underneath, the period and head.
- **Due**: the compliance's own statutory due date.
- **Clients**: right-aligned, how many clients this batch currently covers. (Hovering a row
  that includes WhatsApp shows a tooltip breaking this down further: how many of those clients
  accept WhatsApp versus email-only.)
- **Channels**: the brand mark for each channel this batch will go out on.
- On the right, either:
  - **"Send now"** and a **Skip** button (a circle-with-a-line icon), for a batch still
    queued. "Send now" sends it immediately instead of waiting, confirming
    "Sent **[how many]** messages for **[form]**" or, if every client in it has already filed,
    "All clients have already filed." Skip removes it from the queue, confirming
    "Skipped **[step]** for **[form]**."
  - A **"Restore"** button instead, for a batch already skipped, putting it back in the queue
    and confirming "Batch restored to the queue." A skipped row is shown visually dimmed
    compared to the rest.
- If nothing is queued in the next 45 days: "Nothing queued: no reminders scheduled in the
  next 45 days. Check the reminder steps in Settings."
- Underneath the table: "Counts update as clients file. Clients who file before a batch is
  sent are excluded from it."

### 6.13 Deep links from elsewhere in the product

Several places elsewhere in this document link directly into a specific slice of this screen
rather than the plain unfiltered view, for example a notification reading "18 reminders failed
to send" links straight to the Log tab already filtered to Failed. Arriving that way lands
directly on the matching rows, not on the full list with the reader left to filter it by hand.

---

## Module 7: Settings

### 7.1 Purpose

Every piece of firm-level configuration in one place: the firm's own details, what clients
see when they're messaged, the reminder cadence, which compliances the firm actually tracks,
the staff roster, and which alerts the bell in the top bar is allowed to raise. Every control
on this screen writes immediately; there is no separate Save step anywhere in Settings.

### 7.2 Layout

A vertical menu of 6 sections on the left, and whichever one is selected on the right. **Firm**
is open by default.

### 7.3 Section menu

Each of the 6 entries shows an icon, a bold label, and a short note underneath. **Clicking
one** switches the panel on the right to it:

- **Firm**: "Your details"
- **Sender**: "WhatsApp and email"
- **Reminders**: "Steps and timing"
- **Compliances**: "What you track"
- **Team**: "Staff and owners"
- **Alerts**: "In-app alerts"

### 7.4 Firm

- **"Your firm"** card. Note: "Shown on client messages". Footer: "Your firm name appears at
  the end of every reminder sent to clients." Editable fields: Firm name, Firm Registration
  No. (labelled "FRN"), Membership no., PAN, GSTIN.
- **"Address & contact"** card. Editable fields: Address, City, State (a dropdown of 10 fixed
  Indian states), PIN code, Phone, Email, Website.

### 7.5 Sender

- **"WhatsApp Business"** card. Note: "Managed by KDK". Footer: "This number is set up for you
  and can't be changed here. Contact KDK to send from your own WhatsApp number instead."
  - Shows the WhatsApp brand icon, the display name clients see, the caption "Sending on
    behalf of the practice", and a status tag on the right: "Verified business" (green) or
    "Unverified" (blue).
  - Below that, two fields shown but **not editable**: Display name (hint: "What clients see
    as the sender") and Business number. The text can still be selected and copied even though
    it can't be changed.
- **"Email"** card. Footer: "This address is set up for you and can't be changed here. Replies
  are yours to route."
  - Shows the email brand icon, the From address, and "Replies arrive at **[reply-to
    address]**".
  - Below that: From address (not editable, hint: "Managed by KDK"), and Reply-to address,
    hint "Yours to set". **This is the only editable field in the whole Sender section.**

### 7.6 Reminders

- **"Automatic reminders"** card. Note shows "On" or "Off". One switch: "Send reminders
  automatically", body "When off, reminders are only sent manually." Toggling it confirms
  "Automatic reminders turned on" or "turned off".
- **"Reminder steps"** card. Note: "**[how many are on]** of **[the total]** on". Footer: "Each
  step is counted from the
  due date. Steps are skipped if the filing is already complete." A hint line reads "Enable or
  disable steps, and set the channel and time," and a **Reset** button on the right restores
  every step to its default setting, confirming "Steps reset."
  - Below, one row per step in the cadence ladder:
    - The offset (e.g. "-7", "0", "+2") and, underneath, "days before" / "on due date" / "days
      after". A step that fires after the due date is shown in the overdue-tinted style.
    - The step's own name (e.g. "First reminder"), a small "cc owner" tag if it also copies in
      the client's assigned staff member, and underneath, a short line describing its intent.
    - Two channel buttons, WhatsApp and Email, each with that channel's brand mark.
      **Clicking either one** turns that channel on or off for this one step only, independent
      of every other step.
    - A time-of-day dropdown (fixed hours only: 9, 10, 11, 12, 14, 16, or 18). **Changing it**
      sets exactly when that step sends.
    - A switch on the far right, turning the whole step on or off.
  - All of these are live and take effect immediately.
- **"Sending hours"** card. Note shows the active window (e.g. "09:00-20:00") or "Any time" if
  switched off. Footer: "Messages outside these hours are held and sent when the window
  reopens. Nothing is lost."
  - A switch, "Only send during set hours", body "Prevents reminders being sent late at
    night." Turning it on reveals two time dropdowns, **From** and **To**, each one narrowed
    so it can't cross over the other (From can't be set later than To, and vice versa).
  - A separate switch, "Skip weekends", body "Reminders due on a Saturday or Sunday move to a
    working day: Friday if the deadline has not passed, Monday if it has."

### 7.7 Compliances

One card, title "**[the total]** compliances", note "**[how many]** turned off" or "All on". Footer: "Untracked
compliances are removed from the Tracker, Calendar and reminders. Turning off 'Remind client'
keeps the compliance tracked but sends no reminders for it."

- A **head** dropdown ("All heads" or one specific head) narrows the table below. A **Reset**
  button restores every compliance's settings to default, confirming "Reset."
- A table, one row per compliance: a coloured spine for its head, the form name and its due
  rule underneath, the head, the frequency, a **Tracked** checkbox, and a **Remind client**
  checkbox.
  - **Remind client** is greyed out and cannot be checked whenever **Tracked** is off for that
    row: a compliance the firm doesn't track at all can't have client reminders either.
  - A row with **Tracked** switched off is shown dimmed across its whole width.
- If no compliance matches the head filter: "Nothing under this head."

### 7.8 Team

- **"[how many] people"** card. Note: "Staff". Footer: "Clients and filings can be
  assigned to these
  staff members." A table: Name (avatar and name), Role, and a **View** link on the right,
  leading to the Clients list already filtered to that one staff member's clients.
- **"Default owner"** card. Footer: "New clients are assigned to this staff member
  automatically." One dropdown, "Assign new clients to", either "Nobody (assign manually)" or
  a specific staff member (shown as name and role). **This is the only editable control in
  Team.**

### 7.9 Alerts

One card, title "Bell alerts", note "**[how many are on]** of **[the total]** on". Footer:
"Alerts clear automatically
once the underlying issue is resolved." Four switches, one per condition the notification bell
in the top bar can raise (the bell itself is covered in a later module in this document):

- **"Biggest backlog"**: "The filing with the highest number of clients still pending."
- **"Due today"**: "Filings with today's due date."
- **"No owner assigned"**: "Pending filings for clients with no staff member assigned."
- **"Failed reminders"**: "Reminders that were not delivered to the client."

Each switch independently turns that one alert on or off in the bell.

---

## Module 8: Filing Run Detail

Not its own item in the left-side menu; reached by clicking a compliance's date almost
anywhere else in this document (Calendar, Compliances, Tracker, Dashboard's queue).

### 8.1 Purpose

The actual workspace: one compliance, one period, every client behind it, and the three things
staff do here: mark clients filed, chase them, and reassign them. It's the last stop of the
3-step drill introduced in Module 3: **a compliance, then its dates, then the clients on that
date**.

### 8.2 Layout, top to bottom

1. Page header (Export, back to Calendar)
2. Summary stats, a progress bar, and an "if missed" note
3. Filters row
4. The client table, with bulk actions when rows are selected

### 8.3 Page header

- Title: "**[Form]** · **[Period]**" (e.g. "GSTR-3B · July 2026"). Note line: "**[Head]** ·
  due **[date]** · applies to **[how many]** clients" (excluding anyone it's not
  applicable to).
- On the right: an **Export** button (section 8.8) and a "← Calendar" button.
- If the address doesn't match a real filing run: "Run not found: this filing run has no
  clients attached, or the link is stale."

### 8.4 Summary stats, progress bar, and penalty note

- **"Overdue"**: count, red if above zero. Not clickable.
- **"Pending"**: count, no special colour. Not clickable.
- **"Filed"**: count, green. Underneath: what percentage of the run that is. Not clickable.
- **"At risk"**: total estimated late fee across the run, red if above zero. Not clickable.
- **"Not applicable"**: count. **This one is clickable**: clicking it switches the client
  table below to show only the excluded clients; clicking it again switches back to "Open".
- Underneath the stats, one tall 3-colour bar (filed green, pending blue, overdue red) showing
  the whole run's split at a glance.
- Below that, a note: "**If missed:** **[the plain-language description of the penalty]**."

### 8.5 Filters row

- A search box, placeholder "Find a client by name, PAN or GSTIN".
- A 5-option switch: **Open** (the default, meaning Pending and Overdue together) / **Overdue**
  / **Filed** / **Everyone** / **Not applicable**. Clicking one narrows the table to that
  slice.
- An **Owner** dropdown: "Any owner" / "Unassigned" / one specific staff member.
- On the right: a running row count.

### 8.6 The client table

**Clicking anywhere on a row** (other than its own checkbox) opens the shared obligation
detail panel for that one client and compliance, covered in its own module later in this
document.

- A select-all checkbox in the header, selecting or clearing every row currently shown.
- **Client**: name, then PAN and GSTIN underneath.
- **State**, **Owner** (avatar and name).
- **Status**: a status tag.
- **Source**: the status basis (how the system knows this is its current status), and, only
  for Filed rows, the acknowledgement number underneath, or "no ARN" if there isn't one.
- **Reminder**: which reminder stage this client is currently at.
- **Days**: right-aligned. "+**[days overdue]**" in red for something overdue, a coloured
  countdown for something pending, or a dash otherwise.
- **At risk**: right-aligned, the estimated late fee in bold red, or a dash if none.
- If nothing matches the current filters: "No clients match these filters."

### 8.7 Selecting rows and bulk actions

Checking at least one row opens a bulk action bar at the bottom of the screen:

- "**[how many]** selected", a **Mark filed** button, a **Remind** button, an
  **"Assign to…"** dropdown, and a small **×** to clear the selection.
- **Mark filed** asks for confirmation first, rather than acting immediately: "Mark
  **[how many]** clients filed? Late fees stop and reminders are cancelled. No
  acknowledgement number is recorded for a bulk action," with **"Yes, mark filed"** and
  **Cancel** buttons. Confirming records who did it and offers an **Undo** in the confirmation
  message, which reopens every one of them again if clicked.
- **Remind** acts immediately, with no confirmation: it queues a reminder on both WhatsApp and
  Email to every selected client, confirms "Reminders queued for **[how many]**
  clients," and clears the selection.
- **"Assign to…"** also acts immediately: picking a staff member reassigns every selected
  client's obligation to them, confirms "Reassigned **[how many]** items," and clears
  the selection.
- Only **Mark filed** asks first. The other two don't, because either is easy to correct
  simply by doing it again; marking something filed is not, since it stops the chase and zeros
  the late fee outright.

### 8.8 Exporting to Excel

**Clicking Export** downloads exactly the rows currently shown (respecting the search, the
5-option switch, and the Owner filter) as an Excel file with a coloured, frozen header row,
one row per client, with columns for Client, PAN, GSTIN, State, Form, Period, Due date,
Status, Status source, Acknowledgement, Filed on, Recorded by, Days overdue, Estimated
penalty, and Owner. The file is named `[compliance code]-[period].xlsx`. A message confirms
how many rows were exported.

### 8.9 Footer note

At the very bottom, in small muted text: the compliance's head name, then "Statutory rule:
**[the due-date rule]** · Applicability: **[who it applies to]**."

---

*(End of Module 8. Module 9, the shared obligation detail panel, follows the same section
pattern.)*

---

## Module 9: Obligation Detail Panel

Not its own screen or nav item. This is a drawer that slides in from the side, and it can be
opened from a cell on Tracker (Module 4), a row on Client Detail's Obligations tab (Module 5)
or on Filing Run Detail (Module 8), and other places elsewhere in the product that show one
client against one compliance. It always shows the same thing: exactly why this one obligation
is what it is, and lets staff act on it without leaving the screen behind it.

### 9.1 Purpose

Trust. If the rule engine silently decided a client should file ITR-4 instead of ITR-1, and
nobody could check why, staff would end up re-checking everything by hand anyway, which is the
manual work this whole product exists to remove. So every obligation can be opened to see the
exact rule that fired, the specific profile fields it read to get there, whether a person
overrode it, and precisely how any penalty figure was worked out.

### 9.2 Opening and closing

- Can be closed the **× icon** in its header, by **clicking anywhere outside it**, or by
  pressing **Escape**. Unlike the "Filed this month" drawer in Module 1, section 1.8, there is no
  separate "Close" button in its footer, since that space is used for action buttons instead
  (section 9.4).
- Title: the form code and period (e.g. "GSTR-3B · July 2026"). Subtitle: the client's name,
  as a link. **Clicking it** goes to that client's own page and closes the drawer.

### 9.3 What's shown, all at once

Nothing here is behind a tab or a second click; everything described below is visible the
moment the drawer opens.

- A status tag, plus, only while the obligation is still open (Pending or Overdue), a coloured
  countdown next to it. On the right, a tag reading either "Manual override" or "Rule-driven",
  saying at a glance whether a person changed this or the engine decided it on its own.
- Two facts side by side: **Due date** (with the statutory rule behind it written underneath),
  and **Owner**, shown as a **live dropdown**. **Changing the Owner dropdown reassigns just
  this one obligation immediately**, confirming "Owner updated." (This is different from the
  bulk reassignment on Filing Run Detail, section 8.7, which moves every selected client at once;
  this one only ever touches the single obligation the drawer is open on.)
- If the obligation is **Overdue**: a "Late fees accrued" fact showing the ₹ amount, and
  underneath, how many days overdue and the exact formula used to reach that figure.
- If the obligation is **Filed**: an "Acknowledgement" fact showing the ARN, or "Not recorded"
  if none was given, and underneath, how the system knows it's filed, the date it was filed,
  and who recorded it.
- **"Why this applies"** (or "Changed manually" if a person overrode it), with the specific
  rule reference code on the right:
  - If a person overrode it: a sentence naming who removed it or added it back, when, and the
    reason they gave, followed by a second line, "What the rules say: **[the original rule
    text]**", so the underlying rule is never hidden just because a person changed the outcome.
  - Otherwise: the plain-language rule condition itself.
  - Underneath, a row of small fact chips, each one a specific client-profile field and the
    value the rule engine actually read from it to reach this decision (for example, a
    turnover figure or a Yes/No flag), so staff can check exactly what data drove the outcome.
- A single link at the bottom, "Open **[client]** →", to that client's own page, closing the
  drawer.

### 9.4 Footer actions

Which of these show depends on the obligation's current status.

- **"Mark as filed"** (the main action, shown unless already Filed or Not Applicable):
  opens the "Record this filing" panel described in section 9.5. Does not act immediately by itself.
- **"Send reminder"** (shown only for compliances the client is actually chased for, and only
  while still open): acts immediately, no confirmation. Queues one reminder on WhatsApp and
  Email if the client accepts WhatsApp, or Email alone if they don't, confirming "Reminder
  queued for **[client]**."
- **"Not filed after all"** (shown only when the obligation is Filed **and** a person
  recorded it by hand, not a government portal or an automatic filing confirmation): acts
  immediately, no confirmation. Reopens the obligation, confirms "**[form]** reopened for
  **[client]**," and closes the drawer. This is only ever offered for filings a person
  recorded; a portal or automatic confirmation is evidence from outside the product, and a
  button here cannot overrule it.
- On the right, either **"Add back"** (if currently Not Applicable) or **"Not applicable"**
  (otherwise): opens the override panel described in section 9.6.

### 9.5 "Record this filing" panel

Opened by "Mark as filed" (section 9.4); appears below everything in section 9.3 rather than replacing it.

- Explains: "Recorded against **[your name]** and dated today. Late fees stop accruing and any
  scheduled reminder for this return is cancelled."
- An **optional** "Acknowledgement number" field (the placeholder text differs slightly for
  GST compliances versus everything else, but the field itself works the same way).
- **"Record filing"** (the primary button) and **Cancel**. Confirming shows a message naming
  the form, the client, and the acknowledgement number if one was given, with an **Undo**
  action attached to that same message; clicking Undo reopens the obligation again.

### 9.6 Override panel ("Remove this compliance" / "Add this compliance back")

Opened by "Not applicable" or "Add back" (section 9.4); also appears below section 9.3 rather than replacing
it.

- Explains: "A reason is required. Overrides are kept separate from rule-driven decisions so
  the engine's own accuracy stays measurable."
- A **required** reason field. **"Save override" stays disabled until at least 4 characters
  have been typed.**
- Confirming shows "Marked not applicable" or "Compliance reinstated" and closes the drawer.

---

*(End of Module 9. Module 10, Message Preview, follows the same section pattern.)*

---

## Module 10: Message Preview

Not its own screen. A drawer opened from a row in the Reminders log (Module 6, section 6.8), showing
exactly what one client received, rendered to look like the real thing rather than a plain
log line, because "did we tell them, and what exactly did we say?" is the question this panel
exists to answer, and a truncated line of text in a table cannot answer it.

### 10.1 Opening and closing

- Title: "WhatsApp to **[client]**" or "Email to **[client]**", matching whichever channel it
  was sent on. Subtitle: the reminder stage, the date and time it was sent, "2 hours
  ago"-style wording if it was sent recently, and "attempt **[number]**" if this was a repeat
  send.
- Closes the same way as other drawers in this document: the **×** icon, clicking outside, or
  **Escape**.

### 10.2 Footer

- **Close** (the primary button).
- A second button, labelled **"Retry send"** (if the message failed) or **"Send again"**
  (otherwise). **Clicking it resends this one message and does not close the drawer**,
  confirming "Retrying to **[client]**" or "Re-sent to **[client]**," or, if the client's
  filing has since closed on its own, "That filing has since closed. Nothing sent."
- On the right, a status tag showing this message's current delivery state.

### 10.3 WhatsApp rendering

Built to look like an actual WhatsApp conversation, not a styled quote block.

- A bar above the phone frame reads "Sending as **[sender name]** [a small verified badge] ·
  **[the shared WhatsApp handle]** · on behalf of **[the client's owner, or the firm if
  unassigned]**."
- A WhatsApp-style header: a back arrow, the client's own avatar and initials, their name and
  phone number, and video/call/menu icons. (These icons are decorative; they don't do
  anything.)
- The thread: the standard "Messages are end-to-end encrypted" banner, the date, and the
  message itself in a chat bubble, exactly as sent, line by line.
- In the corner of the bubble: the time it was sent, and a delivery mark matching WhatsApp's
  own convention: a clock for still held/queued, a single grey mark for sent-but-not-yet-known,
  a double grey mark for delivered, a double blue mark for read, a warning mark for failed, or
  a "not sent" mark if the reminder was cancelled before going out.
- Underneath the bubble, one line spelling out what that mark means in plain words: "Read by
  the client," "Delivered to the handset, not opened yet," "Never delivered. The number may be
  wrong or WhatsApp is not registered on it," "Not sent. The return was filed while this was
  held for the sending window," or "Held until the sending window opens."
- A compose bar at the very bottom, styled like WhatsApp's own, with emoji, attach, camera, and
  microphone icons. **This entire bar is inert.** It exists only so the thread looks like a
  real, live phone screen instead of stopping abruptly where the last message ends; none of
  its icons can be clicked.

### 10.4 Email rendering

- The subject line, with the email brand mark.
- Standard headers: **From**, **To**, **Cc** (the client's assigned owner, or "no owner
  assigned"), and **Sent** (date and time).
- The message body, exactly as sent.

### 10.5 Delivery facts (shown under either rendering)

A small fact block, the same for both channels: **Channel**, **Trigger** (which reminder
stage this was), **Compliance** (the form), **Owner**, **Sent by** (either "The cadence,
unattended" for a message the schedule sent on its own, or the specific staff member's name
for one sent by hand), and **Attempt** (which numbered try this was).

---

## Module 11: Shared Chrome

The left rail and the top bar. Not a screen of their own; present, unchanged, on every screen
covered by every other module in this document.

### 11.1 Purpose

Orientation and quick access: which of the 7 sections is open, what's landing this week, a way
to search or jump anywhere, what needs attention right now, and who's signed in.

### 11.2 The left rail

- At the top: the product's logo mark, "Compliance Tracker" in bold, and underneath, the
  firm's short identity and today's date.
- Below that, 7 links, always in this order: **Dashboard, Calendar, Compliances, Tracker,
  Clients, Reminders, Settings.** The current page's own link is visually highlighted.
- Some links carry a small count badge:
  - **Calendar**: how many distinct filing runs are due in the next 7 days.
  - **Compliances**: the total number of compliances in the catalogue.
  - **Tracker**: how many clients are currently overdue; this badge turns red whenever that
    number is above zero.
  - **Clients**: the total number of clients in the book.
  - Reminders and Settings carry no badge.
  - Any count above 999 is shortened (e.g. "1.2k").
- **Clicking the Collapse button** at the bottom shrinks the rail to icons only, hiding every
  label and the brand text. **Hovering or focusing a link while collapsed** shows its full
  label in a small floating tag beside it. Clicking the same button again (now labelled
  Expand) restores it.
- On a phone-width screen, the rail is hidden by default and opens instead as an overlay
  drawer, triggered by a menu button in the top bar (section 11.3). It closes automatically the
  moment any link is clicked, or by its own close button, or by clicking the dark overlay
  behind it.
- At the very bottom of the rail, two things:
  - **"This week"**, a link to Calendar showing 3 figures side by side: how many filings are
    due this week, how many are late (highlighted if above zero), and how many have been
    filed this month.
  - The **Collapse/Expand** button described above.

### 11.3 The top bar

Sits above the page content on every screen.

- On phone-width screens only, a menu button on the left opens the mobile nav drawer (section 11.2).
- A **breadcrumb**, shown only when the current page is nested two levels deep (for example,
  one specific client's page, or one specific compliance's page); it's left out entirely on
  every top-level page, so a page title is never repeated next to itself. **Clicking any
  segment except the last one** goes back up to that level.
- A **search bar** filling the middle of the bar, reading "Search clients, compliances, PAN or
  GSTIN" with a "/" hint. **Clicking it, or pressing / anywhere in the product** (outside a
  text field), opens the command palette (section 11.4).
- On the right, four controls in a row:
  - The **notification bell**, present here on every screen. See section 11.3.1 below for what
    it shows and how its unread badge behaves.
  - A **theme toggle**, switching instantly between light and dark.
  - The **profile button**: the signed-in user's avatar and a small down arrow. **Clicking
    it** opens a popover with:
    - The user's name, role, and firm name.
    - **"My clients"**: the Clients list, filtered to their own clients.
    - **"Account"**: takes the user to their account profile section in KDK Software itself,
      the parent application this module lives inside, not a page of its own inside
      Compliance Tracker.
    - **"Settings"**: Module 7.
    - A second theme toggle, for convenience from inside this popover.
    - **"Sign out"**, styled as a warning action: signs the user out of their account entirely.

### 11.3.1 Notification bell

Clicking the bell opens a popover listing up to 4 alerts, each one on or off in Settings ›
Alerts (Module 7, section 7.9): **Biggest backlog**, **Due today**, **No owner assigned**, and
**Failed reminders**. Only alerts currently switched on, and currently true, appear in the
list; if none apply, the popover reads "Nothing to flag right now."

- A small badge on the bell itself shows how many of the listed alerts are unread. The badge is
  hidden entirely once nothing is unread.
- Each alert's "read" state is judged by comparing its current wording against whatever
  wording it showed the last time it was opened, not by a simple seen/unseen flag. This is
  deliberate: if "5 clients unowned" was already read and the count later changes to "8 clients
  unowned," that counts as new information and the badge reappears, even though this same alert
  was opened before.
- **Clicking an alert** goes to the screen it describes (already filtered to the matching
  slice, per the deep-linking rule used throughout this document), marks that one alert read,
  and closes the popover.

### 11.4 Command palette (/)

- Opens as a centred overlay, dimming everything behind it. **Clicking outside it, or
  pressing Escape,** closes it without navigating anywhere.
- A single search box, focused automatically the moment it opens.
- With nothing typed, it lists all 7 destinations under a "Go to" heading, each with a short
  description.
- Typing narrows the list to:
  - Any of the 7 destinations whose name matches.
  - Any client whose name, legal name, PAN, or GSTIN matches (up to 40 shown), with their
    avatar, PAN, and their owner's avatar.
  - Any compliance whose form name or code matches (up to 55 results total, combined with the
    client results above), with its head underneath. A compliance the firm has switched off
    entirely in Settings is never offered here.
- Results are grouped under headings ("Go to" / "Clients" / "Compliances").
- The up and down arrow keys move the highlighted result; hovering a result with the mouse
  also highlights it; **Enter, or clicking a result,** goes there and closes the palette.
- If nothing matches what was typed: "Nothing matches "**[query]**"."

### 11.5 Boot splash

Shown once, briefly, every time the app loads: an animated month calendar with the four dates
a CA office actually plans its month around (the 7th, 11th, 15th, and 20th) lighting up in
sequence, next to the product's logo and name. It leaves on its own after a few seconds.
**Clicking, tapping, or pressing any key** dismisses it immediately.

---

*(End of Module 11. This completes the first full pass over every screen in the product.)*
