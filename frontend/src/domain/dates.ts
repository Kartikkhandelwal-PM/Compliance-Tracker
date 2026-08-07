/* Date helpers. Everything is an ISO `yyyy-mm-dd` string and all arithmetic is
   done in UTC, so no timezone can shift a statutory due date by a day. */

export const TODAY = "2026-08-06";

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
