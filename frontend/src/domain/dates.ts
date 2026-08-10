/* Date helpers. Everything is an ISO `yyyy-mm-dd` string and all arithmetic is
   done in UTC, so no timezone can shift a statutory due date by a day.

   TIMESTAMPS. A *due date* is a date and nothing more — the statute says "the
   20th", not "the 20th at 16:45". A *send* is the opposite: "we told them on
   the 6th" is not an answer when the question is whether the client had time
   to act before the portal closed, and two reminders on the same day are
   indistinguishable in a log that only carries the date. So anything the
   system DOES carries a `yyyy-mm-ddThh:mm` stamp, and anything the statute
   IMPOSES stays a plain date. The two are deliberately different types of
   string; `dateOf()` is the one-way door between them.

   Both sort correctly with a plain `<`, and because the timestamp is the date
   plus a suffix, a date-vs-timestamp comparison still does the right thing
   (`"2026-08-06T09:15" >= "2026-08-06"`). That is what lets the log's date
   filters keep comparing against bare dates. */

/**
 * Today, from the real clock.
 *
 * This was a hardcoded "2026-08-06", which was a Thursday and drifted further
 * from reality every day the prototype sat there — the week strip labelled the
 * current column TODAY and then went FRI, SAT, SUN, so on an actual Monday the
 * app was four days behind and disagreed with the reader's own calendar.
 *
 * The LOCAL date, not the UTC one: "what day is it" is a question about the
 * reader's wall calendar, and in IST a UTC date is the previous day for the
 * last five and a half hours of every evening. (All *arithmetic* below stays in
 * UTC — that is a separate concern, and the reason a due date can never be
 * shifted by a timezone.)
 *
 * Clamped into the seeded financial year. The client book only exists for
 * FY 2026-27, so outside that range the app would render a correct but empty
 * calendar; pinning to the edge keeps a demo working rather than showing
 * nothing. Remove the clamp once the book comes from a real backend.
 */
function currentDate(): string {
  const d = new Date();
  const local = iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  if (local < "2026-04-01") return "2026-04-01";
  if (local > "2027-03-31") return "2027-03-31";
  return local;
}

export const TODAY = currentDate();

/** Office hours, in the sense that matters here: the window the reminder
 *  engine is allowed to send inside. Quiet-hours holds are released at OPEN. */
export const DAY_OPEN = 9;
export const DAY_CLOSE = 20;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function iso(y: number, m: number, d: number): string {
  const dim = daysInMonth(y, m);
  const day = Math.min(d, dim);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function toUTC(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function parts(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** b − a, in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

export function addDays(s: string, n: number): string {
  const t = new Date(toUTC(s) + n * 86400000);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function dow(s: string): number {
  return new Date(toUTC(s)).getUTCDay();
}

export function isWeekend(s: string): boolean {
  const d = dow(s);
  return d === 0 || d === 6;
}

/** "20 Aug 2026" */
export function fmtDate(s: string): string {
  const { y, m, d } = parts(s);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "20 Aug" */
export function fmtShort(s: string): string {
  const { m, d } = parts(s);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Thu, 20 Aug 2026" */
export function fmtLong(s: string): string {
  return `${DOW[dow(s)]}, ${fmtDate(s)}`;
}

/* ---------------------------------------------------------------------------
   TIMESTAMPS  —  `yyyy-mm-ddThh:mm`
   ------------------------------------------------------------------------- */

/** Build a stamp from a date and a wall clock. */
export function stamp(date: string, hour: number, minute = 0): string {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The date half of a stamp. Also safe on a bare date, so callers never have
 *  to know which of the two they were handed. */
export function dateOf(ts: string): string {
  return ts.slice(0, 10);
}

/** The clock half: "14:32". Empty for a bare date. */
export function timeOf(ts: string): string {
  return ts.length > 10 ? ts.slice(11, 16) : "";
}

export function hourOf(ts: string): number {
  return ts.length > 10 ? Number(ts.slice(11, 13)) : 0;
}

/** Minutes since the epoch — for arithmetic across a day boundary. */
export function toMinutes(ts: string): number {
  const t = ts.length > 10 ? ts : `${ts}T00:00`;
  return toUTC(dateOf(t)) / 60000 + Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
}

export function addMinutes(ts: string, n: number): string {
  const total = toMinutes(ts) + n;
  const dayStart = Math.floor(total / 1440) * 1440;
  const d = new Date(dayStart * 60000);
  const mins = total - dayStart;
  return stamp(
    iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
    Math.floor(mins / 60),
    mins % 60,
  );
}

/** "14:32" — the clock alone, for a column that already says which day. */
export function fmtTime(ts: string): string {
  return timeOf(ts) || "—";
}

/** "6 Aug 2026, 14:32" */
export function fmtDateTime(ts: string): string {
  const t = timeOf(ts);
  return t ? `${fmtDate(dateOf(ts))}, ${t}` : fmtDate(dateOf(ts));
}

/** "6 Aug, 14:32" — the log's default, where the year is nearly always this one. */
export function fmtStampShort(ts: string): string {
  const t = timeOf(ts);
  return t ? `${fmtShort(dateOf(ts))}, ${t}` : fmtShort(dateOf(ts));
}

/**
 * How long ago, in the coarsest unit that is still true: "12m ago", "3h ago",
 * "Yesterday", "6 Aug". Precision below a minute is noise in a send log, and
 * anything past a week is better read as a date than as "9 days ago".
 */
export function fmtAgo(ts: string, nowTs = stamp(TODAY, 17, 30)): string {
  const mins = toMinutes(nowTs) - toMinutes(ts);
  if (mins < 0) {
    const ahead = -mins;
    if (ahead < 60) return `in ${ahead}m`;
    if (ahead < 1440) return `in ${Math.round(ahead / 60)}h`;
    const days = Math.round(ahead / 1440);
    return days === 1 ? "tomorrow" : `in ${days} days`;
  }
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  const days = diffDays(dateOf(ts), dateOf(nowTs));
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtShort(dateOf(ts));
}

/** Is this stamp outside the sending window? The window defaults to office
 *  hours but is firm configuration, so callers pass their own. */
export function inQuietHours(ts: string, open = DAY_OPEN, close = DAY_CLOSE): boolean {
  const h = hourOf(ts);
  return h < open || h >= close;
}

/**
 * The next moment the engine is allowed to send, at or after `ts`.
 *
 * With `skipWeekends`, a chase that would land on a Saturday waits for Monday:
 * the statutory date does not move for a weekend, but nobody assembles working
 * papers on one, and a reminder read on Monday morning is worth more than one
 * buried under two days of other messages.
 */
export function nextSendableAt(
  ts: string,
  open = DAY_OPEN,
  close = DAY_CLOSE,
  skipWeekends = false,
  /**
   * Which way a weekend send is moved.
   *
   * `"earlier"` for anything due on or before the statutory date; `"later"`
   * for chases after it. This is not a preference — moving the wrong way sends
   * a client the wrong thing:
   *
   *   A filing due Saturday 15 Aug, with its due-date reminder pushed FORWARD
   *   to Monday, delivers "this is due today, Saturday 15 August" on the 17th —
   *   two days after the deadline it was warning about. The statutory date does
   *   not move for a weekend, so a pre-deadline reminder can only ever move
   *   earlier: Friday the 14th, while the client can still act.
   *
   *   An overdue chase is the opposite. It cannot go out before the date it
   *   says was missed, so a weekend one waits for Monday.
   */
  shift: "earlier" | "later" = "later",
): string {
  let date = dateOf(ts);
  let hour = hourOf(ts);
  if (hour >= close) {
    date = addDays(date, 1);
    hour = open;
  } else if (hour < open) {
    hour = open;
  }
  if (skipWeekends) {
    /* At most two hops either way — Saturday to Monday, or Sunday to Friday. */
    const step = shift === "earlier" ? -1 : 1;
    while (isWeekend(date)) date = addDays(date, step);
    if (date !== dateOf(ts)) hour = Math.max(hour, open);
  }
  return stamp(date, hour, date === dateOf(ts) && hour === hourOf(ts) ? Number(ts.slice(14, 16)) : 0);
}

export function monthLabel(y: number, m: number): string {
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthLabelLong(y: number, m: number): string {
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

/** Relative countdown: "6 days overdue", "due in 5 days", "due today". */
export function countdown(dueDate: string, today = TODAY): string {
  const n = diffDays(today, dueDate);
  if (n === 0) return "due today";
  if (n === 1) return "due tomorrow";
  if (n === -1) return "1 day overdue";
  if (n < 0) return `${-n} days overdue`;
  return `due in ${n} days`;
}

/** Urgency band — drives the countdown colour and the runway bar. */
export type Urgency = "past" | "now" | "near" | "soon" | "calm";

export function urgency(dueDate: string, today = TODAY): Urgency {
  const n = diffDays(today, dueDate);
  if (n < 0) return "past";
  if (n <= 1) return "now";
  if (n <= 3) return "near";
  if (n <= 7) return "soon";
  return "calm";
}

/** ₹ in Indian notation: 1,23,45,678 */
export function inr(n: number): string {
  const v = Math.round(Math.abs(n));
  const s = String(v);
  if (s.length <= 3) return (n < 0 ? "-" : "") + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (n < 0 ? "-" : "") + grouped + "," + last3;
}

/** Compact ₹ for tight columns: ₹1.2L, ₹3.4Cr */
export function inrShort(n: number): string {
  const v = Math.round(Math.abs(n));
  const sign = n < 0 ? "-" : "";
  if (v >= 1e7) return `${sign}₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `${sign}₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1000) return `${sign}₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `${sign}₹${v}`;
}

export { MONTHS, MONTHS_LONG, DOW };
