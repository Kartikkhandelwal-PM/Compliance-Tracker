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
