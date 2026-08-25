/* ============================================================================
   CLIENT MESSAGES
   ----------------------------------------------------------------------------
   Every reminder a client receives is composed here, so the wording is the
   same object the log stores, the preview drawer renders and the cadence
   describes. Previously each was written at its own call site and they had
   already drifted apart.

   This is the code-side half of "Compliance Tracker - Reminder Templates
   (Email, WhatsApp, Notifications).xlsx" — that workbook is the reviewable
   copy deck a partner signs off on; this file is what actually sends. The two
   have to be kept in sync by hand; when the workbook changes, this file does.

   HOUSE RULES, all of which exist because this is a statutory reminder going
   to a paying client, not a marketing blast:
     • Address the entity by its own name, never "Dear Sir/Madam".
     • State the form, the period and the statutory date in the first line.
       That is the whole message; everything after it is courtesy.
     • Ask for one specific thing on Email. "Please share the working papers"
       is an action; "please do the needful" is not.
     • Say what happens if they have already filed — on Email only. Without
       that line every reminder generates a reply, and the ones that matter
       get buried.
     • Never threaten. On Email a late fee is stated as a fact, once. On
       WhatsApp it is stated as a condition ("a late fee applies and
       increases with delay"), never a rupee figure — the accrual shown
       elsewhere in the product is a planning estimate, not a number precise
       enough to hand a client as settled fact on a channel with no reply.
     • No emoji, no exclamation marks, no marketing.

   WHATSAPP IS NOT EMAIL WITH SHORTER SENTENCES. It goes out on the single
   "CA Connect" WhatsApp Business number KDK operates for every firm on the
   product, so the number itself carries no firm identity — every WhatsApp
   template names the firm inline in its first line instead of in a
   sign-off. It never asks for anything (no reply, no document, no
   acknowledgement number): a reply on the shared number is not visible to
   the firm today, so inviting one would set an expectation the product
   cannot meet. Email carries the ask, because its Reply-To genuinely reaches
   the firm. Neither channel ever names KDK or an individual staff member —
   both speak for the client's own firm.
   ========================================================================== */

import type { Channel, Obligation, Party, StepKind } from "./types.ts";
import { fmtLong } from "./dates.ts";

export interface Composed {
  /** One line for the outbox table. */
  line: string;
  /** The message as the client receives it. */
  body: string;
  /** Email only. */
  subject: string;
}

/**
 * The account these are sent from.
 *
 * Mutable, and read through `getSender()` rather than imported as a frozen
 * constant, because Settings edits it: the display name and number a client
 * sees are firm configuration, not source code. Kept in this module so the
 * dependency stays one-way — the engine imports messages, never the reverse.
 */
export interface Sender {
  name: string;
  handle: string;
  by: string;
  fromEmail: string;
  replyTo: string;
  verified: boolean;
}

let sender: Sender = {
  name: "CA Connect",
  handle: "+91 79000 12345",
  by: "KDK Software",
  fromEmail: "compliance@kdksoftware.com",
  replyTo: "compliance@kdksoftware.com",
  verified: true,
};

export function getSender(): Sender {
  return sender;
}

export function setSender(patch: Partial<Sender>) {
  sender = { ...sender, ...patch };
}

/** The condition-not-figure late fee line. Left out entirely wherever the
 *  accrued fee is zero — "a late fee applies" about a filing with no fee
 *  accruing is noise, not a warning. */
function emailFeeLine(o: Obligation, kind: StepKind): string | null {
  if (o.exposure <= 0) return null;
  return kind === "p1"
    ? "A late fee applies from the due date and increases with each additional day of delay."
    : "A late fee applies from the due date and continues to increase with each additional day of delay.";
}

function emailContent(
  o: Obligation, client: Party, kind: StepKind, due: string, firmName: string,
): { subject: string; body: string } {
  const opening = `Dear ${client.name},`;
  const fee = emailFeeLine(o, kind);
  const sign = ["Regards,", firmName];

  switch (kind) {
    /* Email has no -3 step of its own — WhatsApp's "Follow-up" sits between
       Email's first reminder and its due-date notice, so a t3-kinded Email
       (from a manual send, never from the schedule) reads as the same first
       reminder. */
    case "t7":
    case "t3":
      return {
        subject: `Reminder: ${o.form} for ${o.periodLabel} (due ${due})`,
        body: [
          opening, "",
          `Your ${o.form} for ${o.periodLabel} is due on ${due}.`, "",
          "Please send us the details we need so this can be completed well ahead of the deadline.", "",
          "If this has already been completed, please let us know so we can update our records.", "",
          ...sign,
        ].join("\n"),
      };
    case "t0":
      return {
        subject: `Due today: ${o.form} for ${o.periodLabel}`,
        body: [
          opening, "",
          `Your ${o.form} for ${o.periodLabel} is due on ${due}.`, "",
          "Please send us the pending details today so this can be completed on your behalf.", "",
          "If this has already been completed, please share the reference number so we can update our records.", "",
          ...sign,
        ].join("\n"),
      };
    case "p1":
      return {
        subject: `Overdue: ${o.form} for ${o.periodLabel}`,
        body: [
          opening, "",
          `Your ${o.form} for ${o.periodLabel} was due on ${due} and has not yet been completed. It is now ${o.daysOverdue} day(s) overdue.`,
          ...(fee ? ["", fee] : []), "",
          "Please send us the pending details at the earliest so this can be completed without further delay.", "",
          "If this has already been completed, please share the reference number so we can update our records.", "",
          ...sign,
        ].join("\n"),
      };
    case "p7":
      return {
        subject: `Overdue: ${o.form} for ${o.periodLabel} (second notice)`,
        body: [
          opening, "",
          `Your ${o.form} for ${o.periodLabel} was due on ${due} and remains pending. It has now been ${o.daysOverdue} days, over a week past the due date.`,
          ...(fee ? ["", fee] : []), "",
          "Please send us the pending details at the earliest so this can be completed without further delay.", "",
          "If this has already been completed, please share the reference number so we can update our records.", "",
          ...sign,
        ].join("\n"),
      };
    case "p30":
      /* Off by default, and the one step with no "already filed" line — this
         is the escalation-before-escalation, not another invitation to reply. */
      return {
        subject: `Overdue: ${o.form} for ${o.periodLabel} (final notice)`,
        body: [
          opening, "",
          `Your ${o.form} for ${o.periodLabel} was due on ${due} and remains pending, now ${o.daysOverdue} days overdue.`,
          ...(fee ? ["", fee] : []), "",
          "This is our final reminder before this is escalated internally. Please send us the pending details at the earliest so this can be completed without further delay.", "",
          ...sign,
        ].join("\n"),
      };
  }
}

function whatsappContent(
  o: Obligation, client: Party, kind: StepKind, due: string, firmName: string,
): string {
  const opener = `Dear ${client.name}, this is ${firmName} regarding your ${o.form} for ${o.periodLabel},`;

  switch (kind) {
    case "t7":
      return `${opener} due on ${due}.\n\nPlease ensure this is completed well ahead of the deadline.`;
    case "t3":
      return `${opener} due on ${due}.\n\nPlease ensure this is completed in time.`;
    case "t0":
      return `${opener} due on ${due}.\n\nPlease ensure this is completed at the earliest.`;
    /* WhatsApp carries only one overdue template. There is no Meta-approved
       escalation or final-notice variant — those steps stay Email-only, cc'd
       to the engagement owner, which is the more formal channel escalation
       is meant to be. */
    case "p1":
    case "p7":
    case "p30": {
      const fee = o.exposure > 0
        ? "A late fee applies from the due date and increases with each additional day of delay."
        : null;
      return [
        `${opener} which was due on ${due} and has not yet been completed. It is now ${o.daysOverdue} day(s) overdue.`,
        ...(fee ? [fee] : []),
        "Please ensure this is completed at the earliest to avoid further delay.",
      ].join("\n\n");
    }
  }
}

export function compose(o: Obligation, client: Party, channel: Channel, kind: StepKind): Composed {
  const due = fmtLong(o.dueDate);
  const firmName = sender.by;
  const overdue = kind === "p1" || kind === "p7" || kind === "p30";

  const line = overdue
    ? `${o.form} for ${o.periodLabel} was due on ${due} and is still pending.`
    : `${o.form} for ${o.periodLabel} is due on ${due}.`;

  if (channel === "WhatsApp") {
    return { line, body: whatsappContent(o, client, kind, due, firmName), subject: "" };
  }
  const { subject, body } = emailContent(o, client, kind, due, firmName);
  return { line, body, subject };
}
