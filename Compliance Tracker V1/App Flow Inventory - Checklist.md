# App Flow Inventory - Checklist

Behaviour the app already has that the BRD hasn't captured yet. Each line is written the way
it would eventually read inside the BRD itself: a plain statement of how something works.
Grouped by BRD module, so each item can be dropped into its matching section later.

## Module 1: Dashboard

- **Whole firm / My clients toggle.** Also rescales the 7-day hero chart next to it: bar
  heights are relative to whichever set of clients is currently selected, not a fixed number.
- **"In arrears" card.** Clicking it opens Tracker already filtered to the same clients.
- **7-day hero bars.** Each day's bar height is relative to the busiest of the 7 days shown,
  not a fixed scale, so the same literal count can render taller in a quiet week than in a busy
  one.
- **30-day runway strip.** Bar height is deliberately compressed for large numbers, so one very
  busy day doesn't flatten every other day to invisible by comparison.
- **Runway day panel and work-queue tabs.** Independent of each other: opening one doesn't
  close the other, and both can be open on screen at once.
- **Work-queue tab row limits.** The badge on each tab always shows the true total for that
  tab, even once the list itself stops showing more rows past its own display cap.
- **Status donut, centre number vs. legend.** The centre percentage is the share of obligations
  that are closed out of everything that isn't Not Applicable; each legend line's own
  percentage is that status's share of the full total, Not Applicable included. Both are
  correct, they're just two different bases.
- **Head-exposure bar chart.** Bar length is scaled to that month's own largest head, not a
  fixed rupee amount, so the same rupee figure can look different in size from one visit to the
  next.
- **Notification bell, read state.** An alert already opened goes back to looking unread if the
  number attached to it changes, even though it's the same underlying alert.
- **Which alerts appear in the bell.** Controlled live by Settings > Alerts; turning one off
  there removes it from the bell immediately.

## Module 2: Calendar

- **Any filter change, or picking a different month.** Closes whatever day's detail panel is
  currently open.
- **"+N more" on a busy day, vs. the date number itself.** "+N more" always opens that day's
  detail panel; clicking the date number instead toggles the panel open and closed.
- **Clicking a compliance name inside a day cell.** Navigates straight to that compliance; it
  doesn't also open the day's detail panel the way clicking the date number does.
- **Order of compliance chips on a busy day.** Whichever compliance has the most overdue
  clients is shown first, then the most pending, then alphabetically, not date order.
- **The list of years offered in the year picker.** Grows by one as each new financial year
  starts, up to the year just ahead of the one under way.

## Module 3: Compliances

- **"Clients it applies to," on the detail page.** This is the single busiest period's count
  for the year, not a total of every distinct client who was ever due across the year.
- **Search box.** Matches against the form name, its description, and its code all at once, so
  a search term that only appears in the description can still surface that result.

## Module 4: Tracker

- **"This month" / "Next 3 months" vs. "Full year" date windows.** "This month" and "Next 3
  months" reach 7 days into the past for anything overdue; "Full year" reaches 120 days back,
  since a full-year view is meant to catch older arrears the shorter windows are not.
- **The "fully filed" status filter, alongside another filter.** Calculated only from what the
  other filters currently show, so narrowing the head or date-window filter can change who
  counts as "fully filed" for that view.
- **Marking something filed from a single cell.** Updates the totals shown on Dashboard,
  Calendar and Compliances immediately as well, since every screen reads from the same
  underlying set of obligations.
- **"Not filed after all" (undo).** Only works on a filing this app itself recorded by hand; one
  confirmed through a government portal or through KDK's own software can't be undone from
  here, since there is no record of how to reverse a source outside the app's own control.
- **Reassigning the owner from inside a single cell.** Only changes the owner of that one
  obligation, not the client's default owner elsewhere.

## Module 5: Clients

- **Switching between the GST / TDS / Income Tax tabs.** Swaps to a different underlying list
  of records entirely, since these three record types (PAN, GSTIN, TAN) are kept as separate
  records rather than one shared client profile.
- **"In arrears" filter.** Only counts something once it's actually overdue; anything still
  pending (not yet due) is left out of the count either way.
- **Client Detail: Communications tab vs. Obligations tab.** The Obligations tab respects the
  financial-year selector at the top of the page; the Communications tab always shows every
  message ever sent to that client, regardless of which year is selected.

## Module 6: Reminders

- **A reminder step that's already gone out for a given compliance and period.** Never fires a
  second time for that same compliance and period, even if the batch is recomputed.
- **A pre-due reminder that would land on a weekend.** Moves to the working day before, so it's
  never delivered after its own deadline. An overdue chase that would land on a weekend moves
  the other way, to the working day after, since it can't be sent before the date it's reporting
  as missed.
- **A reminder that's scheduled, but the client files just before it goes out.** Gets skipped;
  eligibility is checked again right at the moment of sending, not just when it was first
  scheduled.
- **Resending a message.** Reuses the exact original wording, including anything time-sensitive
  in it like "days overdue," rather than refreshing it to match today.
- **Releasing a held batch.** This is the one case that does rewrite the message before sending,
  specifically so stale wording never actually reaches a client.
- **A client who hasn't opted into WhatsApp.** Their WhatsApp leg is dropped at send time; only
  Email goes out to them.
- **A one-off manual chase, sent to someone significantly overdue.** Uses the mildest, "just
  overdue" wording, since a manual chase is a person's own decision to reach out, not the
  automatic ladder's escalation.

## Module 7: Settings

- **Turning off the last enabled channel on a reminder step.** Automatically turns the whole
  step off too, since a step with no channels left has nothing left to send on.
- **Changing quiet hours or weekend-skipping.** Only affects reminders computed from that point
  forward; anything already sent or already scheduled beforehand keeps the timing it was
  already given.
- **Turning "Tracked" off for a compliance.** Also stops that compliance from being chased for
  reminders, in addition to removing it from every screen that lists compliances.
- **Editing the firm's name.** Also updates the sign-off used on WhatsApp and email messages,
  since the sign-off is drawn from the firm's own name rather than set separately.

## Module 8: Filing Run Detail

- **Bulk "Mark filed."** Never records an acknowledgement number for any of the rows, unlike
  marking a single client filed, which can capture one.
- **Bulk "Remind."** Requests both channels for everyone selected; each client's own WhatsApp
  opt-in is still respected individually when the message actually goes out.
- **Summary numbers and the progress bar at the top of the screen.** Always reflect the whole
  run, not just whatever the table below has been narrowed to by search or filter.
- **Exporting from this screen.** Exports whatever the current filter, search, and owner
  selection is narrowed down to, not the whole run.

## Module 9: Obligation Detail Panel (the drawer)

- **"Not filed after all" (undo).** Only works if this app itself recorded that filing by hand;
  one confirmed through a government portal or through KDK's own software can't be reopened
  from here.
- **Re-including something the rule engine had excluded.** From that point on, it's recorded as
  a person's own decision to include it, the same as if a person had excluded and then
  re-included it themselves.
- **The reason field when excluding or re-including something.** Needs at least a few words
  before it can be saved, so the reason recorded is always genuinely explanatory.
- **Reopening an old filing.** Recalculates its status and penalty fresh, based on today's
  date, rather than restoring it to exactly how it looked at the moment it was marked filed.

## Module 10: Message Preview

- **The "Cc" field on emails.** Only shown on the more escalated automatic reminder steps;
  earlier steps and manual sends go to the client alone.
- **The sender name shown on an already-sent message.** Reflects the firm's current sender
  profile, so a later change to the sender's display name is also reflected on messages sent
  before that change.

## Module 11: Shared Chrome

- **The "/" search shortcut.** Does nothing while typing in a text field elsewhere on the page,
  so it can't interrupt something already being typed, and toggles search open and closed
  rather than only opening it.
- **Global search.** Never returns a compliance the firm has switched off, even on an exact
  name or code match, since a switched-off compliance is treated as outside the firm's
  catalogue entirely.
- **Theme (light/dark).** Saved per browser rather than per account, and follows the device's
  own light/dark preference the first time it's used on that browser.
