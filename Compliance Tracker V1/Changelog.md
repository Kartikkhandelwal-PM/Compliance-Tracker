# Changelog

## 2026-09-23

- Fixed the "Due in the next 7 days" card on the dashboard. The headline
  total and the day-by-day strip underneath it used to count two
  different 7-day windows, so a big batch of filings due on the 8th day
  could show up in the total while the strip and the compliance count
  both read zero. Both now use the same window: today through six days
  from now.
- Fixed a bug where a filing due exactly today could never be marked
  Pending. It was being classified straight into Filed or Overdue
  instead, which meant "X filings land today" always showed 0 and some
  of today's filings were shown as overdue before their due date had
  actually passed.
- Added an owner dropdown to the Client Detail page. Previously the
  page showed who owned a client but gave no way to change it. The
  dropdown only changes who is responsible for that client going
  forward; it does not touch filings already assigned to the old owner.
- When marking a filing Not Applicable, added a dropdown of the reasons
  that come up most often (registration surrendered, filed through
  another consultant, below threshold, duplicate registration), with
  an "Other" option that drops back to typing the reason in.
- Added a link on each filing to open it directly in KDK. This points
  to a placeholder KDK URL for now, since there is no live per-filing
  link yet; it will be swapped for the real one once that exists.
- Added notes to filings. Staff can now add, edit or remove a short
  note on any individual filing for a client, visible to anyone who
  opens that filing later.
- Fixed a bug in the filing drawer where an action taken inside it
  (changing the owner, saving a note) did not show up until the
  drawer was closed and reopened, because it was reading a stale copy
  of the filing instead of the live one.
- Fixed the Not Applicable dropdown and the note box both showing a
  doubled border. The app's shared input styling reset that for a
  plain input, but not for a dropdown reusing an unrelated style or
  for a text box, so each one drew a second ring of its own.
  Restyled both to match the rest of the app's inputs.
  Also fixed the row above the note box: it collapsed into unbroken
  text ("Open Agarwal & RaghavanOpen this filing in KDK") because
  three links were styled like inline text instead of separate
  buttons. Dropped the "Open [client]" link entirely, since the
  client's name is already a link right above it in the drawer's own
  header, and added an arrow to that header link so it reads as
  navigation. The remaining two, "Open this filing" and "Add note",
  are now sized and spaced like proper buttons. When there is no note
  yet, only the small "Add note" button shows; the full note card
  only appears once a note exists, instead of an always-visible empty
  tile.
- Split the Filing Run Detail page's "At risk" figure into two: late
  fee and tax liability, shown as separate columns and totals instead
  of one lumped number. Tax liability only appears for compliances
  that actually carry one (ITR, TDS, and now GST's GSTR-3B/GSTR-9 —
  see below). The tax liability formula itself is a placeholder for
  now, pending the real calculation from the domain team.
- Added a way to change which method a TDS filing's tax liability is
  worked out from (books, challan payment, or comparison against the
  previous quarter), from inside the filing drawer. Changing it
  recalculates the figure immediately.
- Added click-to-sort on the "Late fee" and "Tax liability" columns
  on the Filing Run Detail page, replacing an earlier dropdown.
  Clicking a column sorts by it, high to low; clicking again reverses
  the order.
- Added the option for a firm to send WhatsApp and email through their
  own accounts (Rampwin for WhatsApp, ZeptoMail for email) instead of
  KDK's shared ones. Settings → WhatsApp and Settings → Email are now
  separate pages, each showing KDK's account and the firm's own as two
  selectable options. Switching back to KDK does not erase a firm's
  own saved connection; picking it again brings the same setup back.
  Once a connection is saved, the page shows a read-only summary of
  it rather than the open credential form, so it isn't sitting open
  to be changed by accident; an "Edit configuration" button reopens it.

## 2026-09-24

- Added GSTR-1A, the optional correction facility for an already-filed
  GSTR-1. Modelled on GSTR-3B's own three variants (monthly, and the
  two QRMP categories) and placed right before the matching GSTR-3B in
  every list, since the correction happens before or during the return
  that closes it. No late fee under GST law, so it never carries one.
- Added correction statements for all four TDS/TCS returns (24Q, 26Q,
  27Q, 27EQ), open for two years from the end of the financial year
  the original return belongs to. Both this and GSTR-1A only apply to
  a realistic minority of clients, roughly one in seven, rather than
  every client that files the original — most returns are never
  corrected.
- Fixed Calendar and the Compliance Tracker (the grid page) filtering
  long-tail items, ITR-U and the new TDS corrections, by the year
  they originally belong to instead of the year their due date falls
  in. Since these can fall due years after the year they're tagged
  with, they were invisible unless someone manually navigated back to
  that old year, even when genuinely due right now.
- Fixed ITR-U and the TDS corrections showing as open before there is
  anything to actually act on: ITR-U's 48-month window only starts
  once the assessment year itself ends, and a TDS correction only
  makes sense once that exact quarter's original return has been
  filed. Both used to show as open the day the year's book was built,
  before the original was even due.
- The Compliance Detail page for ITR-U and the TDS corrections now
  shows every year or quarter that's currently open together in one
  list, instead of one year at a time. A period that isn't open yet
  but will be before this financial year ends still shows, muted, as
  a heads-up; one that only opens once next FY starts doesn't show at
  all yet, since there'd be nothing to say about it for months.
- Fixed the Compliance Tracker's "Full year" view drifting about six
  months past the financial year's own end (it was rolling forward
  365 days from today rather than stopping at 31 March), which pulled
  a few months of next year's filings into "this year"'s view.
- Added tax liability, alongside late fees, for GSTR-3B (all three
  filing cadences) and GSTR-9. GSTR-1 and its correction stay at zero,
  since neither one has anything to pay. Same placeholder-formula
  caveat as ITR and TDS's figures, pending real numbers.
- Renamed Form 24Q, 26Q, 27Q and 27EQ to their new form numbers (138,
  140, 144 and 143), keeping the old code alongside the new number
  everywhere. In the Compliance Tracker grid, where the column is too
  narrow for the full "Form 138 (24Q)" label, it shows the shorter
  "138 (24Q)" instead.
